package com.douzi.sqlive.service.database;

import com.douzi.sqlive.config.PoolProperties;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.Nullable;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
@Slf4j
public class DatabasePoolManager {

	private static final int DEFAULT_SOFT_MAX = 500;
	private static final int DEFAULT_MAX_PER_IP = 50;
	private static final String DB_NAME_PATTERN = "^[a-zA-Z0-9_-]{1,64}$";
	private static final int BUSY_TIMEOUT_MS = 5000;
	private static final int CONNECTION_TIMEOUT_MS = 5000;
	private static final int LEAK_DETECTION_MS = 60_000;

	private final int softMax;
	private final int hardMax;
	private final int maxPerIp;
	private final long idleEvictionNanos;

	// ponytail: one lock for pool bookkeeping; use per-entry leases if contention becomes measurable.
	private final Map<String, JdbcTemplate> pools = new LinkedHashMap<>(16, 0.75f, true);
	private final Map<String, Integer> refCounts = new HashMap<>();
	private final Map<String, Long> lastAccessNanos = new HashMap<>();
	private final Map<String, String> poolOwnerIps = new HashMap<>();
	private final Map<String, Integer> ipCounts = new HashMap<>();
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

		long intervalSecs = Math.max(1, props.getCleanupInterval().toSeconds());
		cleaner.scheduleWithFixedDelay(this::evictIdlePools,
				intervalSecs, intervalSecs, TimeUnit.SECONDS);
	}

	@PreDestroy
	public synchronized void cleanup() {
		cleaner.shutdownNow();
		pools.forEach(this::closeQuietly);
		pools.clear();
		refCounts.clear();
		lastAccessNanos.clear();
		poolOwnerIps.clear();
		ipCounts.clear();
	}

	public PoolEntry getOrCreateJdbcTemplate(String dbName) {
		return getOrCreateJdbcTemplate(dbName, null);
	}

	public synchronized PoolEntry getOrCreateJdbcTemplate(String dbName, @Nullable String clientIp) {
		if (dbName == null || !dbName.matches(DB_NAME_PATTERN)) {
			throw new IllegalArgumentException("Invalid dbName: " + dbName);
		}
		JdbcTemplate jdbc = pools.get(dbName);
		boolean isNew = jdbc == null;
		if (isNew) {
			checkHardLimit(dbName, clientIp);
			checkPerIpLimit(clientIp);
			jdbc = createJdbcTemplate(dbName);
			pools.put(dbName, jdbc);
			if (clientIp != null) {
				poolOwnerIps.put(dbName, clientIp);
				ipCounts.merge(clientIp, 1, Integer::sum);
			}
		}
		refCounts.merge(dbName, 1, Integer::sum);
		lastAccessNanos.put(dbName, System.nanoTime());
		return new PoolEntry(jdbc, isNew);
	}

	public synchronized void release(String dbName) {
		refCounts.computeIfPresent(dbName, (name, count) -> count > 1 ? count - 1 : null);
		if (pools.containsKey(dbName)) lastAccessNanos.put(dbName, System.nanoTime());
	}

	synchronized int getPoolSize() {
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
		int current = ipCounts.getOrDefault(clientIp, 0);
		if (current >= maxPerIp) {
			log.warn("Per-IP limit reached: IP {} has {} pools (max {})", clientIp, current, maxPerIp);
			throw new TooManyDatabasesException(
					String.format("当前客户端连接数过多 (limit: %d)，请关闭不用的标签页", maxPerIp));
		}
	}

	private synchronized void evictIdlePools() {
		if (pools.size() > softMax) evictToTarget(softMax);
		long cutoff = System.nanoTime() - idleEvictionNanos;
		var it = pools.entrySet().iterator();
		while (it.hasNext()) {
			var entry = it.next();
			String name = entry.getKey();
			if (!refCounts.containsKey(name) && lastAccessNanos.get(name) < cutoff) {
				it.remove();
				closePool(name, entry.getValue());
			}
		}
	}

	synchronized void evictToTarget(int target) {
		var it = pools.entrySet().iterator();
		while (it.hasNext() && pools.size() > target) {
			var entry = it.next();
			if (refCounts.containsKey(entry.getKey())) continue;
			it.remove();
			closePool(entry.getKey(), entry.getValue());
		}
	}

	private void closePool(String name, JdbcTemplate jdbc) {
		lastAccessNanos.remove(name);
		String owner = poolOwnerIps.remove(name);
		if (owner != null) ipCounts.computeIfPresent(owner, (ip, count) -> count > 1 ? count - 1 : null);
		closeQuietly(name, jdbc);
	}

	private void closeQuietly(String dbName, JdbcTemplate jdbc) {
		try {
			if (jdbc.getDataSource() instanceof HikariDataSource hds) hds.close();
		} catch (Exception e) {
			log.warn("Failed to close DataSource for '{}'", dbName, e);
		}
	}

	private JdbcTemplate createJdbcTemplate(String name) {
		String url = "jdbc:sqlite:file:" + name + "?mode=memory&busy_timeout=" + BUSY_TIMEOUT_MS;
		HikariConfig config = new HikariConfig();
		config.setJdbcUrl(url);
		config.setMaximumPoolSize(1);
		config.addDataSourceProperty("foreign_keys", "true");
		config.addDataSourceProperty("limit_attached", "0");
		config.setConnectionInitSql("PRAGMA trusted_schema = OFF");
		config.setConnectionTimeout(CONNECTION_TIMEOUT_MS);
		config.setLeakDetectionThreshold(LEAK_DETECTION_MS);
		config.setPoolName("SQLitePool-" + name);
		log.info("Created DataSource for database '{}'", name);
		return new JdbcTemplate(new HikariDataSource(config));
	}

	private boolean isLocalhost(String ip) {
		return "127.0.0.1".equals(ip) || "0:0:0:0:0:0:0:1".equals(ip);
	}

	public record PoolEntry(JdbcTemplate jdbcTemplate, boolean isNew) {
	}
}
