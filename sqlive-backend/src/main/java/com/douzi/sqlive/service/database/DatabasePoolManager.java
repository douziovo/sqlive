package com.douzi.sqlive.service.database;

import com.douzi.sqlive.config.PoolProperties;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Component
@Slf4j
public class DatabasePoolManager {

    private static final int DEFAULT_SOFT_MAX = 500;
    private static final int DEFAULT_HARD_MAX = 2000;
    private static final int DEFAULT_MAX_PER_IP = 50;
    private static final String DB_NAME_PATTERN = "^[a-zA-Z0-9_-]{1,64}$";
    private static final long MAX_HOLD_NANOS = TimeUnit.MINUTES.toNanos(10);
    private static final int BUSY_TIMEOUT_MS = 5000;
    private static final int CONNECTION_TIMEOUT_MS = 5000;
    private static final int LEAK_DETECTION_MS = 60_000;

    private final int softMax;
    private final int hardMax;
    private final int maxPerIp;
    private final long idleEvictionNanos;
    private final long cleanerIntervalNanos;

    private final Map<String, JdbcTemplate> pools = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> refCounts = new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> lastAccessNanos = new ConcurrentHashMap<>();
    private final Map<String, Long> acquireStartNanos = new ConcurrentHashMap<>();
    private final Map<String, String> poolOwnerIps = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> ipCounts = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor(r -> {
        var t = new Thread(r, "db-pool-cleaner");
        t.setDaemon(true);
        return t;
    });

    public DatabasePoolManager(PoolProperties props) {
        this.softMax = props.getMaxDatabases() > 0 ? props.getMaxDatabases() : DEFAULT_SOFT_MAX;
        this.hardMax = softMax * 4;
        this.maxPerIp = DEFAULT_MAX_PER_IP;
        this.idleEvictionNanos = props.getIdleTimeout().toNanos();
        this.cleanerIntervalNanos = props.getCleanupInterval().toNanos();

        long intervalSecs = Math.max(1, props.getCleanupInterval().toSeconds());
        cleaner.scheduleWithFixedDelay(this::evictIdlePools,
                intervalSecs, intervalSecs, TimeUnit.SECONDS);
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
        acquireStartNanos.clear();
        poolOwnerIps.clear();
        ipCounts.clear();
    }

    public record PoolEntry(JdbcTemplate jdbcTemplate, boolean isNew) {}

    public PoolEntry getOrCreateJdbcTemplate(String dbName) {
        return getOrCreateJdbcTemplate(dbName, null);
    }

    public PoolEntry getOrCreateJdbcTemplate(String dbName, @Nullable String clientIp) {
        if (dbName == null || !dbName.matches(DB_NAME_PATTERN)) {
            throw new IllegalArgumentException("Invalid dbName: " + dbName);
        }

        JdbcTemplate existing = pools.get(dbName);
        if (existing != null) {
            refCounts.computeIfAbsent(dbName, k -> new AtomicInteger()).incrementAndGet();
            lastAccessNanos.computeIfAbsent(dbName, k -> new AtomicLong()).set(System.nanoTime());
            return new PoolEntry(existing, false);
        }

        return createNewPool(dbName, clientIp);
    }

    private synchronized PoolEntry createNewPool(String dbName, @Nullable String clientIp) {
        JdbcTemplate existing = pools.get(dbName);
        if (existing != null) {
            refCounts.computeIfAbsent(dbName, k -> new AtomicInteger()).incrementAndGet();
            lastAccessNanos.computeIfAbsent(dbName, k -> new AtomicLong()).set(System.nanoTime());
            return new PoolEntry(existing, false);
        }

        checkHardLimit(dbName, clientIp);
        checkPerIpLimit(clientIp);

        JdbcTemplate jt = createJdbcTemplate(dbName);
        pools.put(dbName, jt);
        refCounts.computeIfAbsent(dbName, k -> new AtomicInteger()).incrementAndGet();
        lastAccessNanos.computeIfAbsent(dbName, k -> new AtomicLong()).set(System.nanoTime());
        acquireStartNanos.put(dbName, System.nanoTime());
        if (clientIp != null) {
            poolOwnerIps.put(dbName, clientIp);
            ipCounts.computeIfAbsent(clientIp, k -> new AtomicInteger()).incrementAndGet();
        }
        return new PoolEntry(jt, true);
    }

    public void release(String dbName) {
        AtomicInteger count = refCounts.get(dbName);
        if (count != null && count.decrementAndGet() <= 0) {
            refCounts.remove(dbName);
            acquireStartNanos.remove(dbName);
        }
    }

    int getPoolSize() {
        return pools.size();
    }

    private void checkHardLimit(String dbName, @Nullable String clientIp) {
        if (pools.size() >= hardMax) {
            log.error("HARD_MAX reached: {} pools, refusing '{}' from IP {}", hardMax, dbName, clientIp);
            throw new TooManyDatabasesException(
                    String.format("服务器繁忙，请稍后重试 (limit: %d)", hardMax));
        }
        if (pools.size() >= softMax) {
            log.warn("SOFT_MAX reached: {} pools (current: {}), triggering eager eviction", softMax, pools.size());
        }
    }

    private void checkPerIpLimit(@Nullable String clientIp) {
        if (clientIp == null || isLocalhost(clientIp)) return;
        AtomicInteger count = ipCounts.get(clientIp);
        int current = count != null ? count.get() : 0;
        if (current >= maxPerIp) {
            log.warn("Per-IP limit reached: IP {} has {} pools (max {})", clientIp, current, maxPerIp);
            throw new TooManyDatabasesException(
                    String.format("当前客户端连接数过多 (limit: %d)，请关闭不用的标签页", maxPerIp));
        }
    }

    private void evictIdlePools() {
        long idleCutoff = System.nanoTime() - idleEvictionNanos;
        long holdCutoff = System.nanoTime() - MAX_HOLD_NANOS;

        // Batch evict idle pools until below softMax
        if (pools.size() > softMax) {
            evictToTarget(softMax);
        }

        for (var entry : pools.entrySet()) {
            String name = entry.getKey();
            AtomicLong lastNanos = lastAccessNanos.get(name);
            boolean isIdle = !isInUse(name);

            if (isIdle && lastNanos != null && lastNanos.get() < idleCutoff) {
                evict(name);
                continue;
            }

            // Force-evict pools held too long (ref count leak protection)
            if (!isIdle) {
                Long acquireStart = acquireStartNanos.get(name);
                if (acquireStart != null && acquireStart < holdCutoff) {
                    log.warn("Force-evicting '{}': held for >{}min (possible ref leak)", name,
                            TimeUnit.NANOSECONDS.toMinutes(MAX_HOLD_NANOS));
                    evict(name);
                }
            }
        }
    }

    private void evictToTarget(int target) {
        int evicted = 0;
        for (var entry : pools.entrySet()) {
            if (pools.size() <= target) break;
            String name = entry.getKey();
            if (!isInUse(name)) {
                evict(name);
                evicted++;
            }
        }
        if (evicted > 0) {
            log.info("Batch evicted {} idle pools to reach target {}", evicted, target);
        }
    }

    private void evict(String dbName) {
        JdbcTemplate jdbc = pools.remove(dbName);
        if (jdbc == null) return;
        refCounts.remove(dbName);
        lastAccessNanos.remove(dbName);
        acquireStartNanos.remove(dbName);
        String ownerIp = poolOwnerIps.remove(dbName);
        if (ownerIp != null) {
            AtomicInteger count = ipCounts.get(ownerIp);
            if (count != null && count.decrementAndGet() <= 0) {
                ipCounts.remove(ownerIp);
            }
        }
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
        String url = "jdbc:sqlite:file:" + name + "?mode=memory&busy_timeout=" + BUSY_TIMEOUT_MS;
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setMaximumPoolSize(1);
        config.setConnectionTimeout(CONNECTION_TIMEOUT_MS);
        config.setLeakDetectionThreshold(LEAK_DETECTION_MS);
        config.setPoolName("SQLitePool-" + name);
        log.info("Created DataSource for database '{}'", name);
        return new JdbcTemplate(new HikariDataSource(config));
    }

    private boolean isLocalhost(String ip) {
        return "127.0.0.1".equals(ip) || "0:0:0:0:0:0:0:1".equals(ip);
    }
}
