package com.douzi.sqlive.service.database;

import com.douzi.sqlive.config.PoolProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Concurrent safety tests for {@link DatabasePoolManager}.
 *
 * <p>Verifies two R0-002 invariants:
 * <ul>
 *   <li>TOCTOU: concurrent {@code getOrCreateJdbcTemplate} + {@code evictToTarget}
 *       must not hand out a closed {@code JdbcTemplate}.</li>
 *   <li>LRU: {@code evictToTarget} evicts the least-recently-used pool first
 *       (LinkedHashMap access-order), not a random {@code ConcurrentHashMap} bin order.</li>
 * </ul>
 *
 * <p>Analog: {@code RateLimitFilterConcurrencyTest} (ExecutorService + CountDownLatch +
 * Collections.synchronizedList errors + try-with-resources). Unit test — no
 * {@code @SpringBootTest}; {@code new DatabasePoolManager(props)} per {@code DatabasePoolManagerTest}.
 */
class DatabasePoolManagerConcurrencyTest {

	private final List<DatabasePoolManager> managers = new ArrayList<>();

	@AfterEach
	void cleanup() {
		for (var mgr : managers) {
			try {
				mgr.cleanup();
			} catch (Exception ignored) {
			}
		}
		managers.clear();
	}

	private DatabasePoolManager createManager() {
		var props = new PoolProperties();
		props.setMaxDatabases(500);
		props.setIdleTimeout(Duration.ofMinutes(30));
		props.setCleanupInterval(Duration.ofMinutes(5));
		var mgr = new DatabasePoolManager(props);
		managers.add(mgr);
		return mgr;
	}

	/**
	 * WR-07: 1 acquire thread + 10 evict threads. The acquire thread loops
	 * acquire → queryForList → release, so between release and the next acquire the
	 * pool is idle (refCount=0) and evictToTarget(0) can target it. This is the
	 * TOCTOU window the fast-path {@code evictionGeneration} check must handle:
	 * <ol>
	 *   <li>acquire thread: {@code gen = evictionGeneration} snapshot</li>
	 *   <li>acquire thread: {@code pools.get(dbName)} returns existing JdbcTemplate</li>
	 *   <li>evict thread: {@code evict()} removes the entry, closes the HikariDataSource,
	 *       and increments {@code evictionGeneration}</li>
	 *   <li>acquire thread: {@code refCounts.incrementAndGet} on a closed pool, then
	 *       {@code gen != evictionGeneration} rolls back the refCount bump and falls
	 *       through to {@code createNewPool} — handing out a fresh, open pool</li>
	 * </ol>
	 * Without the TOCTOU fix, step 4 returns the closed JdbcTemplate and
	 * {@code queryForList("SELECT 1")} throws. The original test kept all 10
	 * getOrCreate threads holding refCounts, so {@code evictToTarget(0)} always
	 * skipped the pool (non-idle) and the race was never exercised.
	 */
	@Test
	void shouldHandleConcurrentGetOrCreateAndEvict() throws Exception {
		int evictThreadCount = 10;
		int acquireThreadCount = 1;
		int threadCount = evictThreadCount + acquireThreadCount;
		int iterationsPerThread = 200;
		String dbName = "concurrent_test";
		var mgr = createManager();

		CountDownLatch latch = new CountDownLatch(threadCount);
		AtomicInteger successCount = new AtomicInteger(0);
		AtomicInteger closedPoolErrors = new AtomicInteger(0);
		List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());

		try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
			// 1 thread: acquire → queryForList → release, 200 iterations. Each release
			// opens an idle window where evictToTarget(0) can target the pool. The next
			// acquire races against evict — the TOCTOU gen check must catch any evict
			// that lands between pools.get and refCounts.incrementAndGet.
			for (int i = 0; i < acquireThreadCount; i++) {
				executor.submit(() -> {
					try {
						for (int j = 0; j < iterationsPerThread; j++) {
							var entry = mgr.getOrCreateJdbcTemplate(dbName, "127.0.0.1");
							entry.jdbcTemplate().queryForList("SELECT 1");
							mgr.release(dbName);
						}
						successCount.incrementAndGet();
					} catch (Exception e) {
						errors.add(e);
						// Surface closed-pool errors specifically — these are the TOCTOU
						// signature. HikariDataSource.close() makes subsequent queryForList
						// throw "Connection is closed" or similar.
						String msg = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
						if (msg.contains("closed") || msg.contains("has been closed")) {
							closedPoolErrors.incrementAndGet();
						}
					} finally {
						latch.countDown();
					}
				});
			}
			// 10 threads: evictToTarget(0) × 200 iterations — evicts idle pools during
			// the acquire thread's release window.
			for (int i = 0; i < evictThreadCount; i++) {
				executor.submit(() -> {
					try {
						for (int j = 0; j < iterationsPerThread; j++) {
							mgr.evictToTarget(0);
						}
					} catch (Exception e) {
						errors.add(e);
					} finally {
						latch.countDown();
					}
				});
			}
			assertTrue(latch.await(30, TimeUnit.SECONDS), "latch timed out");
		}

		assertTrue(errors.isEmpty(),
				"Concurrent errors (including closed JdbcTemplate from TOCTOU race): " + errors);
		assertEquals(acquireThreadCount, successCount.get(),
				"Acquire thread should complete all " + iterationsPerThread
						+ " iterations without closed JdbcTemplate errors");
		assertEquals(0, closedPoolErrors.get(),
				"TOCTOU race detected: handed out a closed JdbcTemplate " + closedPoolErrors.get()
						+ " time(s) — fast-path gen check failed to roll back");
	}

	/**
	 * Create db1/db2/db3, re-access db2 and db3 (not db1), then evictToTarget(1).
	 * LRU order: db1 (oldest) → db2 → db3 (newest). Eviction should remove db1
	 * (LRU) and retain db3 (MRU). Under non-LRU iteration (ConcurrentHashMap bin
	 * order) db3 could be evicted instead — this test catches that regression.
	 */
	@Test
	void shouldEvictLeastRecentlyUsedFirst() {
		var mgr = createManager();

		// Create 3 pools (release each so they're evictable: isInUse == false)
		mgr.getOrCreateJdbcTemplate("db1", null);
		mgr.release("db1");
		mgr.getOrCreateJdbcTemplate("db2", null);
		mgr.release("db2");
		mgr.getOrCreateJdbcTemplate("db3", null);
		mgr.release("db3");

		// Re-access db2 and db3 (NOT db1) → db1 stays least-recently-used
		mgr.getOrCreateJdbcTemplate("db2", null);
		mgr.release("db2");
		mgr.getOrCreateJdbcTemplate("db3", null);
		mgr.release("db3");

		// LRU order now: db1 (oldest), db2, db3 (newest)
		mgr.evictToTarget(1);

		// db1 (LRU) should be evicted → re-access creates a new pool (isNew=true)
		assertTrue(mgr.getOrCreateJdbcTemplate("db1", null).isNew(),
				"db1 should be evicted (LRU) — isNew=true means pool was recreated");
		// db3 (MRU) should be retained → re-access returns existing pool (isNew=false)
		assertFalse(mgr.getOrCreateJdbcTemplate("db3", null).isNew(),
				"db3 should be retained (MRU) — isNew=false means pool still exists");
	}
}
