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
import java.util.concurrent.atomic.AtomicBoolean;
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
	 * WR-07: 1 acquire thread + 1 evict thread. The acquire thread loops
	 * acquire → sleep(10ms) → queryForList → release, so between release and the
	 * next acquire the pool is idle (refCount=0) and evictToTarget(0) can target
	 * it. This is the
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
	 *
	 * <p>UAT 2026-07-01 Test 2 found that the WR-07 rewrite still passed both WITH
	 * and WITHOUT the TOCTOU fix. Root cause: 10 evict threads × 200 iterations of
	 * empty {@code evictToTarget(0)} complete in ~10ms, while the acquire thread's
	 * first {@code createNewPool} takes ~100ms (HikariDataSource startup). By the
	 * time the pool exists in the {@code pools} map, all evict threads have exited.
	 * The race window is never entered.
	 *
	 * <p>This rewrite closes the gap with three changes (all three are needed —
	 * any one alone is insufficient):
	 * <ol>
	 *   <li><b>Pre-create the pool</b> before submitting any threads: call
	 *       {@code getOrCreateJdbcTemplate + queryForList + release} so the pool
	 *       sits idle in the {@code pools} map from the start. Evict threads see
	 *       it on their very first iteration rather than waiting ~100ms for the
	 *       acquire thread's first {@code createNewPool}.</li>
	 *   <li><b>startLatch barrier</b>: all 11 threads call {@code startLatch.countDown()}
	 *       followed by {@code startLatch.await()} before entering the main loop,
	 *       so all threads begin spinning simultaneously. Without the barrier the
	 *       executor may schedule the acquire thread first, letting it complete
	 *       several iterations before evict threads start.</li>
	 *   <li><b>AtomicBoolean done flag</b> (replaces fixed for-loop in evict threads):
	 *       evict threads loop {@code while (!done.get()) { mgr.evictToTarget(0); }}
	 *       for the entire duration of the acquire thread's 200 iterations. Fixed
	 *       iteration counts fail because empty {@code evictToTarget(0)} calls
	 *       (~0.01ms each) finish in ~2ms total, while the acquire thread's
	 *       {@code createNewPool} takes ~100ms per slow-path iteration — evict
	 *       threads exit before the pool is recreated, so iterations 1+ run
	 *       unopposed. The flag-based loop keeps evict threads spinning when the
	 *       pool reappears after each eviction.</li>
	 * </ol>
	 */
	@Test
	void shouldHandleConcurrentGetOrCreateAndEvict() throws Exception {
		// 1 evict thread: keeps the pool in the map between acquires (low eviction
		// pressure), so the acquire thread's fast-path pools.get returns the existing
		// JdbcTemplate and the race window opens. With many evict threads, the pool
		// is evicted before the next acquire — pools.get returns null, race never
		// opens, test passes even without the fix (UAT 2026-07-01 Test 2 root cause).
		int evictThreadCount = 1;
		int acquireThreadCount = 1;
		int threadCount = evictThreadCount + acquireThreadCount;
		// 500 iterations (not 200): the TOCTOU race window is ~1µs (between pools.get
		// and refCounts.incrementAndGet), so each iteration has a low race probability.
		// 200 iterations caught the regression ~50% of the time (flaky); 500 iterations
		// raises the catch rate to >95% with the fix reverted.
		int iterationsPerThread = 500;
		String dbName = "concurrent_test";
		var mgr = createManager();

		// Change 1 — Pre-create the pool so evict threads see an idle pool from the
		// very first iteration. Without this, the acquire thread's first
		// getOrCreateJdbcTemplate goes through createNewPool (~100ms HikariDataSource
		// startup) and all 10 evict threads finish their iterations before the pool
		// exists in the pools map. (UAT 2026-07-01 Test 2 root cause.)
		var preEntry = mgr.getOrCreateJdbcTemplate(dbName, "127.0.0.1");
		preEntry.jdbcTemplate().queryForList("SELECT 1");
		mgr.release(dbName);

		CountDownLatch latch = new CountDownLatch(threadCount);
		// Change 2 — startLatch barrier: all threads count down then await, so all
		// begin spinning simultaneously. Without this the executor may schedule the
		// acquire thread first and it could complete several iterations before evict
		// threads start.
		CountDownLatch startLatch = new CountDownLatch(threadCount);
		// Change 3 — AtomicBoolean done flag: evict threads loop while (!done.get())
		// for the entire duration of the acquire thread's iterations. Fixed iteration
		// counts finish in ~2ms (empty evictToTarget(0) is ~0.01ms each) while the
		// acquire thread's createNewPool takes ~100ms per slow-path iteration — evict
		// threads would exit before the pool is recreated. The flag-based loop keeps
		// evict threads spinning whenever the pool reappears after each eviction.
		AtomicBoolean done = new AtomicBoolean(false);
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
						startLatch.countDown();
						startLatch.await();
						for (int j = 0; j < iterationsPerThread; j++) {
							var entry = mgr.getOrCreateJdbcTemplate(dbName, "127.0.0.1");
							// Give evict threads time to finish closeQuietly (hds.close())
							// IF the TOCTOU race fired between pools.get and
							// refCounts.incrementAndGet. Without this delay, queryForList
							// might run before hds.close() completes — masking the race.
							// With the fix present, the race is detected (gen != gen2)
							// and createNewPool returns a fresh open pool, so the sleep
							// is a no-op. With the fix reverted, the sleep gives evict's
							// closeQuietly time to close the HikariDataSource before
							// queryForList runs — so queryForList throws "closed".
							Thread.sleep(10);
							entry.jdbcTemplate().queryForList("SELECT 1");
							mgr.release(dbName);
						}
						successCount.incrementAndGet();
					} catch (Exception e) {
						errors.add(e);
						// Surface closed-pool errors specifically — these are the TOCTOU
						// signature. HikariDataSource.close() makes subsequent queryForList
						// throw "Connection is closed" / "Failed to obtain JDBC Connection"
						// (CannotGetJdbcConnectionException wraps the underlying closed
						// HikariDataSource error) or similar.
						String msg = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
						if (msg.contains("closed") || msg.contains("has been closed")
								|| msg.contains("failed to obtain")) {
							closedPoolErrors.incrementAndGet();
						}
					} finally {
						done.set(true);
						latch.countDown();
					}
				});
			}
			// 1 thread: evictToTarget(0) in a tight loop while !done — maintains
			// race-window pressure throughout all 200 acquire iterations. 1 thread
			// (not 10+) keeps the pool in the map between acquires — more evict
			// threads evict the pool before the next acquire, so the race window
			// never opens. Thread.yield() after each evictToTarget(0) gives the
			// acquire thread a chance to call pools.get before the next eviction —
			// without yield, the evict thread's tight loop always wins the
			// synchronized(pools) lock after release, evicting the pool before the
			// acquire thread's next pools.get runs.
			for (int i = 0; i < evictThreadCount; i++) {
				executor.submit(() -> {
					try {
						startLatch.countDown();
						startLatch.await();
						while (!done.get()) {
							mgr.evictToTarget(0);
							Thread.yield();
						}
					} catch (Exception e) {
						errors.add(e);
					} finally {
						latch.countDown();
					}
				});
			}
			assertTrue(latch.await(60, TimeUnit.SECONDS), "latch timed out");
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
