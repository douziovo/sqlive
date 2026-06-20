package com.douzi.sqlive.service.database;

import com.douzi.sqlive.config.PoolProperties;
import com.douzi.sqlive.exception.PoolFullException;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.sqlite.SQLiteDataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import jakarta.annotation.PostConstruct;
import java.util.concurrent.ScheduledExecutorService;

@Component
@Slf4j
public class DatabasePoolManager {

    // DB_NAME_PATTERN stays hardcoded — security-sensitive, NOT configurable
    private static final String DB_NAME_PATTERN = "^[a-zA-Z0-9_-]{1,64}$";

    private final Map<String, DbEntry> jdbcTemplates = new ConcurrentHashMap<>();
    private final PoolProperties props;
    private final MeterRegistry registry;
    private final Counter hitCounter;
    private final Counter evictionCounter;
    private final Timer createTimer;
    private final ExecutorService closeExecutor;
    private ScheduledExecutorService cleanupScheduler;

    // D-07: Session resilience tracking
    private final Set<String> closedDbNames = ConcurrentHashMap.newKeySet();
    private final Set<String> recreatedSessionNames = ConcurrentHashMap.newKeySet();

    public DatabasePoolManager(PoolProperties props, MeterRegistry registry) {
        this.props = props;
        this.registry = registry;
        Gauge.builder("db.pool.size", jdbcTemplates, m -> (double) m.size())
                .description("Current number of active databases in pool")
                .register(registry);
        this.hitCounter = Counter.builder("db.pool.hits")
                .description("Cache hit count (existing database reused)")
                .register(registry);
        this.evictionCounter = Counter.builder("db.pool.evictions")
                .description("Total number of evicted databases")
                .register(registry);
        this.createTimer = Timer.builder("db.pool.create.latency")
                .description("Database creation latency")
                .register(registry);
        this.closeExecutor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "db-close-executor");
            t.setDaemon(true);
            return t;
        });
    }

    @PostConstruct
    void init() {
        this.cleanupScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "db-cleanup-scheduler");
            t.setDaemon(true);
            return t;
        });
        long intervalMs = props.getCleanupInterval().toMillis();
        this.cleanupScheduler.scheduleAtFixedRate(
                this::evictIdleDatabases,
                intervalMs,
                intervalMs,
                TimeUnit.MILLISECONDS);
        log.info("Scheduled idle eviction every {}ms (idleTimeout={}ms)",
                intervalMs, props.getIdleTimeout().toMillis());
    }

    @PreDestroy
    public void cleanup() {
        synchronized (jdbcTemplates) {
            for (var entry : jdbcTemplates.entrySet()) {
                try {
                    JdbcTemplate jdbc = entry.getValue().jdbcTemplate;
                    jdbc.update("PRAGMA foreign_keys = OFF");
                    closeDataSource(jdbc);
                    log.info("Closed database '{}'", entry.getKey());
                } catch (Exception e) {
                    log.warn("Failed to clean up database '{}'", entry.getKey(), e);
                }
            }
            jdbcTemplates.clear();
        }
        try {
            closeExecutor.shutdown();
            if (!closeExecutor.awaitTermination(10, TimeUnit.SECONDS)) {
                closeExecutor.shutdownNow();
            }
        } catch (InterruptedException e) {
            closeExecutor.shutdownNow();
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("Failed to shut down closeExecutor", e);
        }
        if (cleanupScheduler != null) {
            try {
                cleanupScheduler.shutdown();
            } catch (Exception e) {
                log.warn("Failed to shut down cleanupScheduler", e);
            }
        }
    }

    public JdbcTemplate getOrCreateJdbcTemplate(String dbName) {
        if (dbName == null || !dbName.matches(DB_NAME_PATTERN)) {
            throw new IllegalArgumentException("Invalid dbName: " + dbName);
        }
        DbEntry existing = jdbcTemplates.get(dbName);
        if (existing != null) {
            existing.lastAccessTime = System.currentTimeMillis();
            hitCounter.increment();
            return existing.jdbcTemplate;
        }
        synchronized (jdbcTemplates) {
            existing = jdbcTemplates.get(dbName);
            if (existing != null) {
                existing.lastAccessTime = System.currentTimeMillis();
                hitCounter.increment();
                return existing.jdbcTemplate;
            }
            if (jdbcTemplates.size() >= props.getMaxDatabases()) {
                throw new PoolFullException(
                        "All database slots are in use (max: " + props.getMaxDatabases()
                                + "). Please retry shortly.",
                        props.getMaxDatabases());
            }
            Timer.Sample sample = Timer.start(registry);
            JdbcTemplate jt = createJdbcTemplate(dbName);
            sample.stop(createTimer);
            DbEntry entry = new DbEntry(jt);
            jdbcTemplates.put(dbName, entry);
            // D-07: Detect session recreation after eviction
            if (closedDbNames.contains(dbName)) {
                closedDbNames.remove(dbName);
                recreatedSessionNames.add(dbName);
                log.info("Session recreated for database '{}' after eviction", dbName);
            }
            return jt;
        }
    }

    private void closeDataSource(JdbcTemplate jdbc) {
        DataSource ds = jdbc.getDataSource();
        Future<?> future = closeExecutor.submit(() -> {
            try {
                if (ds instanceof SingleConnectionDataSource scds) {
                    scds.destroy();
                } else if (ds instanceof SQLiteDataSource sqds) {
                    try (Connection conn = sqds.getConnection()) {
                        // getConnection() on in-memory DB triggers SQLite resource release
                        assert conn != null;
                    }
                }
            } catch (Exception e) {
                log.debug("DataSource already closed or unreachable", e);
            }
        });
        try {
            future.get(5, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            log.warn("DataSource close timed out after 5s, abandoning");
            future.cancel(true);
        } catch (Exception e) {
            log.warn("DataSource close interrupted", e);
        }
    }

    private JdbcTemplate createJdbcTemplate(String name) {
        SQLiteDataSource ds = new SQLiteDataSource();
        ds.setUrl("jdbc:sqlite:file:" + name + "?mode=memory&cache=shared");
        ds.setEnforceForeignKeys(true);
        Connection keeper;
        try {
            keeper = ds.getConnection();
            SingleConnectionDataSource scds = new SingleConnectionDataSource(keeper, true);
            log.info("Created DataSource for database '{}'", name);
            return new JdbcTemplate(scds);
        } catch (java.sql.SQLException e) {
            throw new RuntimeException("Failed to create DataSource for database '" + name + "'", e);
        }
    }

    int getPoolSize() {
        return jdbcTemplates.size();
    }

    /**
     * Consumes the session-recreated signal for a database name.
     * Returns true exactly once per eviction-to-recreation cycle.
     * Caller (SqlExecutionService-to-SqlController) uses this to set X-Session-Recreated header.
     */
    public boolean consumeSessionRecreated(String dbName) {
        boolean wasPresent = recreatedSessionNames.contains(dbName);
        if (wasPresent) {
            recreatedSessionNames.remove(dbName);
        }
        return wasPresent;
    }

    void evictIdleDatabases() {
        long now = System.currentTimeMillis();
        long idleThresholdMs = props.getIdleTimeout().toMillis();
        int removed = 0;
        var it = jdbcTemplates.entrySet().iterator();
        while (it.hasNext()) {
            var entry = it.next();
            if (now - entry.getValue().lastAccessTime >= idleThresholdMs) {
                try {
                    closeDataSource(entry.getValue().jdbcTemplate);
                    closedDbNames.add(entry.getKey());
                    it.remove();
                    removed++;
                } catch (Exception e) {
                    log.warn("Failed to close evicted database '{}'", entry.getKey(), e);
                }
            }
        }
        if (removed > 0) {
            evictionCounter.increment(removed);
            log.info("Evicted {} idle databases (threshold={}ms, remaining={})",
                    removed, idleThresholdMs, jdbcTemplates.size());
        }
        // Guard against unbounded closedDbNames growth: if the set grows past
        // 2x the pool capacity, clear stale session-recreation tracking records
        // to avoid a slow memory leak.
        int cap = props.getMaxDatabases() * 2;
        if (closedDbNames.size() > cap) {
            log.warn("closedDbNames exceeded {} entries ({}), clearing to prevent unbounded growth",
                    cap, closedDbNames.size());
            closedDbNames.clear();
        }
    }

    private static class DbEntry {
        final JdbcTemplate jdbcTemplate;
        volatile long lastAccessTime;
        DbEntry(JdbcTemplate jdbcTemplate) {
            this.jdbcTemplate = jdbcTemplate;
            this.lastAccessTime = System.currentTimeMillis();
        }
    }
}
