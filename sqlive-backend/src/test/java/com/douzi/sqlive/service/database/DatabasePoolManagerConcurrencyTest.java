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
import java.util.concurrent.Future;
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

	@Test
	void shouldNotLoseReferencesDuringConcurrentAcquireReleaseAndEviction() throws Exception {
		var mgr = createManager();
		var start = new CountDownLatch(1);
		var finished = new CountDownLatch(4);
		try (var workers = Executors.newFixedThreadPool(5)) {
			List<Future<?>> jobs = new ArrayList<>();
			for (int i = 0; i < 4; i++) {
				jobs.add(workers.submit(() -> {
					start.await();
					try {
						for (int j = 0; j < 500; j++) {
							var lease = mgr.getOrCreateJdbcTemplate("shared");
							try {
								assertEquals(1, lease.jdbcTemplate().queryForObject("SELECT 1", Integer.class));
							} finally {
								mgr.release("shared");
							}
						}
					} finally {
						finished.countDown();
					}
					return null;
				}));
			}
			jobs.add(workers.submit(() -> {
				start.await();
				while (finished.getCount() > 0) mgr.evictToTarget(0);
				return null;
			}));
			start.countDown();
			for (var job : jobs) job.get(30, TimeUnit.SECONDS);
		}
		mgr.evictToTarget(0);
		assertEquals(0, mgr.getPoolSize());
	}

	@Test
	void shouldHandleConcurrentGetOrCreateAndEvict() throws Exception {
		int evictThreadCount = 1;
		int acquireThreadCount = 1;
		int threadCount = evictThreadCount + acquireThreadCount;
		int iterationsPerThread = 500;
		String dbName = "concurrent_test";
		var mgr = createManager();
		var preEntry = mgr.getOrCreateJdbcTemplate(dbName, "127.0.0.1");
		preEntry.jdbcTemplate().queryForList("SELECT 1");
		mgr.release(dbName);

		CountDownLatch latch = new CountDownLatch(threadCount);
		CountDownLatch startLatch = new CountDownLatch(threadCount);
		AtomicBoolean done = new AtomicBoolean(false);
		AtomicInteger successCount = new AtomicInteger(0);
		AtomicInteger closedPoolErrors = new AtomicInteger(0);
		List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());

		try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
			for (int i = 0; i < acquireThreadCount; i++) {
				executor.submit(() -> {
					try {
						startLatch.countDown();
						startLatch.await();
						for (int j = 0; j < iterationsPerThread; j++) {
							var entry = mgr.getOrCreateJdbcTemplate(dbName, "127.0.0.1");
							Thread.sleep(10);
							entry.jdbcTemplate().queryForList("SELECT 1");
							mgr.release(dbName);
						}
						successCount.incrementAndGet();
					} catch (Exception e) {
						errors.add(e);
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
			for (int i = 0; i < evictThreadCount; i++) {
				executor.submit(() -> {
					try {
						startLatch.countDown();
						startLatch.await();
						while (!done.get()) {
							mgr.evictToTarget(0);
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
						+ " time(s)");
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
