package com.douzi.sqlive.service.database;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@Slf4j
public class DatabasePoolManager {

    private static final int SOFT_MAX = 500;
    private static final int HARD_MAX = 2000;
    private static final int MAX_PER_IP = 50;
    private static final long IDLE_EVICTION_SECONDS = TimeUnit.MINUTES.toSeconds(30);
    private static final long CLEANER_INTERVAL_SECONDS = TimeUnit.MINUTES.toSeconds(5);
    private static final String DB_NAME_PATTERN = "^[a-zA-Z0-9_-]{1,64}$";

    private final Map<String, JdbcTemplate> pools = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> refCounts = new ConcurrentHashMap<>();
    private final Map<String, Long> lastAccessNanos = new ConcurrentHashMap<>();
    private final Map<String, String> poolOwnerIps = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor(r -> {
        var t = new Thread(r, "db-pool-cleaner");
        t.setDaemon(true);
        return t;
    });

    public DatabasePoolManager() {
        cleaner.scheduleWithFixedDelay(this::evictIdlePools,
                CLEANER_INTERVAL_SECONDS, CLEANER_INTERVAL_SECONDS, TimeUnit.SECONDS);
    }

    @PreDestroy
    public void cleanup() {
        cleaner.shutdownNow();
        for (var entry : pools.entrySet()) {
            closeQuietly(entry.getKey(), entry.getValue());
        }
        pools.clear();
        refCounts.clear();
        lastAccessNanos.clear();
        poolOwnerIps.clear();
    }

    public JdbcTemplate getOrCreateJdbcTemplate(String dbName) {
        return getOrCreateJdbcTemplate(dbName, null);
    }

    public JdbcTemplate getOrCreateJdbcTemplate(String dbName, @Nullable String clientIp) {
        if (dbName == null || !dbName.matches(DB_NAME_PATTERN)) {
            throw new IllegalArgumentException("Invalid dbName: " + dbName);
        }

        JdbcTemplate existing = pools.get(dbName);
        if (existing != null) {
            refCounts.computeIfAbsent(dbName, k -> new AtomicInteger()).incrementAndGet();
            lastAccessNanos.put(dbName, System.nanoTime());
            return existing;
        }

        synchronized (this) {
            existing = pools.get(dbName);
            if (existing != null) {
                refCounts.computeIfAbsent(dbName, k -> new AtomicInteger()).incrementAndGet();
                lastAccessNanos.put(dbName, System.nanoTime());
                return existing;
            }

            checkHardLimit(dbName, clientIp);
            checkPerIpLimit(clientIp);

            JdbcTemplate jt = createJdbcTemplate(dbName);
            pools.put(dbName, jt);
            refCounts.computeIfAbsent(dbName, k -> new AtomicInteger()).incrementAndGet();
            lastAccessNanos.put(dbName, System.nanoTime());
            if (clientIp != null) {
                poolOwnerIps.put(dbName, clientIp);
            }
            return jt;
        }
    }

    public void release(String dbName) {
        AtomicInteger count = refCounts.get(dbName);
        if (count != null && count.decrementAndGet() <= 0) {
            refCounts.remove(dbName);
        }
    }

    int getPoolSize() {
        return pools.size();
    }

    private void checkHardLimit(String dbName, @Nullable String clientIp) {
        if (pools.size() >= HARD_MAX) {
            log.error("HARD_MAX reached: {} pools, refusing '{}' from IP {}", HARD_MAX, dbName, clientIp);
            throw new TooManyDatabasesException(
                    String.format("Too many databases (limit: %d). Please try again later.", HARD_MAX));
        }
        if (pools.size() >= SOFT_MAX) {
            log.warn("SOFT_MAX reached: {} pools (current: {}), triggering eager eviction", SOFT_MAX, pools.size());
            evictOneIdlePool();
        }
    }

    private void checkPerIpLimit(@Nullable String clientIp) {
        if (clientIp == null || isLocalhost(clientIp)) return;
        long count = poolOwnerIps.values().stream().filter(clientIp::equals).count();
        if (count >= MAX_PER_IP) {
            log.warn("Per-IP limit reached: IP {} has {} pools (max {})", clientIp, count, MAX_PER_IP);
            throw new TooManyDatabasesException(
                    String.format("Too many databases for this client (limit: %d).", MAX_PER_IP));
        }
    }

    private void evictIdlePools() {
        long cutoff = System.nanoTime() - TimeUnit.SECONDS.toNanos(IDLE_EVICTION_SECONDS);
        int target = SOFT_MAX;

        for (var entry : pools.entrySet()) {
            if (pools.size() <= target) break;
            String name = entry.getKey();
            if (isInUse(name)) continue;
            Long lastNanos = lastAccessNanos.get(name);
            if (lastNanos != null && lastNanos < cutoff) {
                evict(name);
            }
        }
    }

    private void evictOneIdlePool() {
        for (var entry : pools.entrySet()) {
            if (!isInUse(entry.getKey())) {
                evict(entry.getKey());
                return;
            }
        }
    }

    private void evict(String dbName) {
        JdbcTemplate jdbc = pools.remove(dbName);
        if (jdbc == null) return;
        refCounts.remove(dbName);
        lastAccessNanos.remove(dbName);
        poolOwnerIps.remove(dbName);
        closeQuietly(dbName, jdbc);
        log.info("Evicted idle database '{}' (pool size now: {})", dbName, pools.size());
    }

    private boolean isInUse(String dbName) {
        AtomicInteger count = refCounts.get(dbName);
        return count != null && count.get() > 0;
    }

    private void closeQuietly(String dbName, JdbcTemplate jdbc) {
        try {
            jdbc.execute("PRAGMA foreign_keys = OFF");
            var ds = jdbc.getDataSource();
            if (ds instanceof HikariDataSource hds) {
                hds.close();
            }
        } catch (Exception e) {
            log.warn("Failed to close DataSource for '{}'", dbName, e);
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

    private boolean isLocalhost(String ip) {
        return "127.0.0.1".equals(ip) || "0:0:0:0:0:0:0:1".equals(ip);
    }
}
