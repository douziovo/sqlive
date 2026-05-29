package com.douzi.sqlive.service.database;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
@Slf4j
public class DatabasePoolManager {

    private static final int MAX_DATABASES = 20;
    private static final String DB_NAME_PATTERN = "^[a-zA-Z0-9_-]{1,64}$";
    private static final long IDLE_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(20);

    private final Map<String, DbEntry> jdbcTemplates = Collections.synchronizedMap(new LinkedHashMap<>(16, 0.75f, true));
    private final ScheduledExecutorService cleanupScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "db-pool-cleanup");
        t.setDaemon(true);
        return t;
    });

    @PostConstruct
    void init() {
        cleanupScheduler.scheduleAtFixedRate(this::evictIdleDatabases, 5, 5, TimeUnit.MINUTES);
    }

    private static class DbEntry {
        final JdbcTemplate jdbcTemplate;
        volatile long lastAccessTime;

        DbEntry(JdbcTemplate jdbcTemplate) {
            this.jdbcTemplate = jdbcTemplate;
            this.lastAccessTime = System.currentTimeMillis();
        }
    }

    void evictIdleDatabases() {
        synchronized (jdbcTemplates) {
            long now = System.currentTimeMillis();
            var it = jdbcTemplates.entrySet().iterator();
            while (it.hasNext()) {
                var entry = it.next();
                if (now - entry.getValue().lastAccessTime >= IDLE_TIMEOUT_MS) {
                    log.info("Evicting idle database '{}' (idle > {}min)", entry.getKey(), IDLE_TIMEOUT_MS / 60_000);
                    closeDataSource(entry.getValue().jdbcTemplate);
                    it.remove();
                }
            }
        }
    }

    @PreDestroy
    public void cleanup() {
        synchronized (jdbcTemplates) {
            for (var entry : jdbcTemplates.entrySet()) {
                try {
                    JdbcTemplate jdbc = entry.getValue().jdbcTemplate;
                    jdbc.execute("PRAGMA foreign_keys = OFF");
                    var ds = jdbc.getDataSource();
                    if (ds instanceof HikariDataSource hds) {
                        hds.close();
                    }
                    log.info("Closed database '{}'", entry.getKey());
                } catch (Exception e) {
                    log.warn("Failed to clean up database '{}'", entry.getKey(), e);
                }
            }
            jdbcTemplates.clear();
        }
        cleanupScheduler.shutdown();
    }

    public JdbcTemplate getOrCreateJdbcTemplate(String dbName) {
        if (dbName == null || !dbName.matches(DB_NAME_PATTERN)) {
            throw new IllegalArgumentException("Invalid dbName: " + dbName);
        }
        DbEntry existing = jdbcTemplates.get(dbName);
        if (existing != null) {
            existing.lastAccessTime = System.currentTimeMillis();
            return existing.jdbcTemplate;
        }
        synchronized (jdbcTemplates) {
            existing = jdbcTemplates.get(dbName);
            if (existing != null) {
                existing.lastAccessTime = System.currentTimeMillis();
                return existing.jdbcTemplate;
            }
            if (jdbcTemplates.size() >= MAX_DATABASES) {
                long now = System.currentTimeMillis();
                boolean evicted = false;
                var it = jdbcTemplates.entrySet().iterator();
                while (it.hasNext()) {
                    var entry = it.next();
                    if (now - entry.getValue().lastAccessTime >= IDLE_TIMEOUT_MS) {
                        log.info("Evicted idle database '{}' (max={})", entry.getKey(), MAX_DATABASES);
                        closeDataSource(entry.getValue().jdbcTemplate);
                        it.remove();
                        evicted = true;
                        break;
                    }
                }
                if (!evicted) {
                    throw new IllegalStateException("Database pool at capacity. No idle sessions available for eviction.");
                }
            }
            JdbcTemplate jt = createJdbcTemplate(dbName);
            jdbcTemplates.put(dbName, new DbEntry(jt));
            return jt;
        }
    }

    private void closeDataSource(JdbcTemplate jdbc) {
        try {
            var ds = jdbc.getDataSource();
            if (ds instanceof HikariDataSource hds) {
                hds.close();
            }
        } catch (Exception e) {
            log.warn("Failed to close DataSource", e);
        }
    }

    private JdbcTemplate createJdbcTemplate(String name) {
        String url = "jdbc:sqlite:file:" + name + "?mode=memory";
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setMaximumPoolSize(1);
        config.setPoolName("SQLitePool-" + name);
        log.info("Created DataSource for database '{}'", name);
        return new JdbcTemplate(new HikariDataSource(config));
    }

    int getPoolSize() {
        return jdbcTemplates.size();
    }
}
