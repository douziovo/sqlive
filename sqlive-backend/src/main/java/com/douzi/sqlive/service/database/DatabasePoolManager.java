package com.douzi.sqlive.service.database;

import com.douzi.sqlive.config.PoolProperties;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.Nullable;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
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

	// R0-002: LinkedHashMap access-order (LRU) + synchronizedMap for thread safety.
	// accessOrder=true means get/put move the entry to the tail (most-recently-used);
	// iteration order is from oldest (LRU) to newest (MRU) — evictToTarget relies on this.
	private final Map<String, JdbcTemplate> pools = Collections.synchronizedMap(
			new LinkedHashMap<>(16, 0.75f, true));
	// R0-002: versioned entry — fast path snapshots generation before pools.get, then
	// re-checks after incrementAndGet. If generation changed, an evict happened in
	// between (TOCTOU window) and the fast path downgrades to createNewPool instead of
	// returning a potentially-closed JdbcTemplate. volatile guarantees 64-bit visibility.
	private volatile long evictionGeneration = 0L;
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

		long intervalSecs = Math.max(1, props.getCleanupInterval().toSeconds());
		cleaner.scheduleWithFixedDelay(this::evictIdlePools,
				intervalSecs, intervalSecs, TimeUnit.SECONDS);
	}

	@PreDestroy
	public void cleanup() {
		cleaner.shutdownNow();
		// R0-002 / Rule 2: iterate under the lock — the cleaner thread may still be
		// mid-eviction (shutdownNow interrupts but does not join), and an unsynchronized
		// iteration over synchronizedMap(LinkedHashMap) would CME on its structural mods.
		synchronized (pools) {
			for (var entry : pools.entrySet()) {
				closeQuietly(entry.getKey(), entry.getValue());
			}
			pools.clear();
		}
		refCounts.clear();
		lastAccessNanos.clear();
		acquireStartNanos.clear();
		poolOwnerIps.clear();
		ipCounts.clear();
	}

	public PoolEntry getOrCreateJdbcTemplate(String dbName) {
		return getOrCreateJdbcTemplate(dbName, null);
	}

	public PoolEntry getOrCreateJdbcTemplate(String dbName, @Nullable String clientIp) {
		if (dbName == null || !dbName.matches(DB_NAME_PATTERN)) {
			throw new IllegalArgumentException("Invalid dbName: " + dbName);
		}

		// R0-002 TOCTOU fix: snapshot generation BEFORE pools.get. If an evict happens
		// between pools.get and refCounts.incrementAndGet, generation will have changed
		// by the time we re-check — we then roll back the refCount bump and fall through
		// to createNewPool instead of returning a JdbcTemplate whose DataSource was just
		// closed by evict.closeQuietly. Snapshot order is load-bearing: if we snapshotted
		// AFTER pools.get, an evict between get and snapshot would already bump generation
		// and the post-increment check would see gen == evictionGeneration (both post-evict)
		// — the closed JdbcTemplate would slip through.
		long gen = evictionGeneration;
		JdbcTemplate existing = pools.get(dbName);
		if (existing != null) {
			refCounts.computeIfAbsent(dbName, k -> new AtomicInteger()).incrementAndGet();
			lastAccessNanos.computeIfAbsent(dbName, k -> new AtomicLong()).set(System.nanoTime());
			if (gen != evictionGeneration) {
				// Evict won the race between pools.get and incrementAndGet — the entry we
				// got may be closed. Roll back the refCount bump and create a fresh pool.
				refCounts.computeIfPresent(dbName, (k, v) -> v.decrementAndGet() <= 0 ? null : v);
				return createNewPool(dbName, clientIp);
			}
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
		// WR-01: increment refCount BEFORE pools.put so isIdle() returns false the
		// instant the pool becomes visible to evictIdlePools/evictToTarget. The original
		// ordering (pools.put → refCounts.incrementAndGet) left a window where a cleaner
		// thread holding the `pools` lock could observe the new entry, see
		// refCounts.get(dbName) == null (isIdle returns true), and close the
		// HikariDataSource before this method incremented refCount — handing the caller
		// a closed JdbcTemplate. createNewPool is `synchronized` on `this`, but evict*
		// synchronize on `pools` (the synchronizedMap mutex), so the pools.put call
		// inside createNewPool only holds the pools lock for the duration of the put,
		// not for the subsequent refCount increment under the original ordering.
		refCounts.computeIfAbsent(dbName, k -> new AtomicInteger()).incrementAndGet();
		pools.put(dbName, jt);
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

		// R0-002 / Rule 2: iterate pools under the lock. With ConcurrentHashMap the
		// iteration was weakly consistent; with synchronizedMap(LinkedHashMap) an
		// unsynchronized iteration would CME because the fast path's pools.get (access-
		// order reorder) and createNewPool's pools.put both structurally modify the map.
		// Collect names first, then evict outside the lock — evict() does pools.remove
		// which would CME the iterator even while we hold the synchronized mutex.
		List<String> toEvict = new ArrayList<>();
		synchronized (pools) {
			for (var entry : pools.entrySet()) {
				String name = entry.getKey();
				AtomicLong lastNanos = lastAccessNanos.get(name);
				boolean idle = isIdle(name);

				if (idle && lastNanos != null && lastNanos.get() < idleCutoff) {
					toEvict.add(name);
					continue;
				}

				// Force-evict pools held too long (ref count leak protection)
				if (!idle) {
					Long acquireStart = acquireStartNanos.get(name);
					if (acquireStart != null && acquireStart < holdCutoff) {
						log.warn("Force-evicting '{}': held for >{}min (possible ref leak)", name,
								TimeUnit.NANOSECONDS.toMinutes(MAX_HOLD_NANOS));
						toEvict.add(name);
					}
				}
			}
		}
		for (String name : toEvict) {
			evict(name);
		}
	}

	void evictToTarget(int target) {
		int evicted = 0;
		// R0-002: synchronized iteration over the LinkedHashMap so the access-order
		// traversal is LRU-first and no concurrent fast-path get/put can CME the
		// iterator. it.remove() (not pools.remove) keeps the iterator consistent.
		// evictionGeneration++ is inside the lock so the fast path's generation
		// snapshot/check sees a version that is atomic with the pools.remove.
		synchronized (pools) {
			var it = pools.entrySet().iterator();
			while (it.hasNext() && pools.size() > target) {
				var entry = it.next();
				String name = entry.getKey();
				if (!isIdle(name)) {
					continue;
				}
				it.remove();
				// Auxiliary-map cleanup — mirrors evict() minus the pools.remove (already
				// done by it.remove above). Inline rather than calling evict(name) because
				// evict()'s pools.remove would CME the iterator even inside synchronized.
				refCounts.remove(name);
				lastAccessNanos.remove(name);
				acquireStartNanos.remove(name);
				String ownerIp = poolOwnerIps.remove(name);
				if (ownerIp != null) {
					AtomicInteger count = ipCounts.get(ownerIp);
					if (count != null && count.decrementAndGet() <= 0) {
						ipCounts.remove(ownerIp);
					}
				}
				closeQuietly(name, entry.getValue());
				evictionGeneration++;
				evicted++;
			}
		}
		if (evicted > 0) {
			log.info("Batch evicted {} idle pools to reach target {}", evicted, target);
		}
	}

	private void evict(String dbName) {
		// R0-002: hold the pools lock across remove + closeQuietly so the fast path
		// cannot observe a half-closed JdbcTemplate. evictionGeneration++ is atomic
		// with pools.remove under this lock — the fast path's generation snapshot/check
		// reliably detects that the entry is gone.
		synchronized (pools) {
			JdbcTemplate jdbc = pools.remove(dbName);
			if (jdbc == null) return;
			evictionGeneration++;
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
	}

	private boolean isIdle(String dbName) {
		AtomicInteger count = refCounts.get(dbName);
		return count == null || count.get() == 0;
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

	public record PoolEntry(JdbcTemplate jdbcTemplate, boolean isNew) {
	}
}
