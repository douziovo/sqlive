package com.douzi.sqlive.service;

import com.douzi.sqlive.dto.SqlResponse;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Concurrency behaviour of SqlExecutionService: parallel requests on distinct
 * databases, concurrent writes to one database, concurrent resets, pool
 * eviction under contention, and a schema-read-vs-modify stress run.
 */
class SqlExecutionServiceConcurrencyTest extends SqlExecutionServiceTestSupport {

	@Test
	void shouldHandleConcurrentRequestsOnDifferentDatabases() throws Exception {
		int threadCount = 4;
		CountDownLatch latch = new CountDownLatch(threadCount);
		List<Exception> errors = Collections.synchronizedList(new ArrayList<>());

		try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
			for (int i = 0; i < threadCount; i++) {
				final int n = i;
				executor.submit(() -> {
					try {
						String dbName = db("concurrent_db_" + n);
						SqlResponse r = service.execute(
								"CREATE TABLE t" + n + " (x INTEGER); INSERT INTO t" + n + " VALUES (" + n + ");",
								dbName, true
						);
						assertTrue(r.getError() == null, "Thread " + n + " should succeed");
					} catch (Exception e) {
						errors.add(e);
					} finally {
						latch.countDown();
					}
				});
			}

			assertTrue(latch.await(10, TimeUnit.SECONDS), "All threads should finish within 10 seconds");
			assertTrue(errors.isEmpty(), "No errors should occur: " + errors);
		}
	}

	@Test
	void shouldHandleConcurrentWritesToSameDatabase() throws Exception {
		int threadCount = 8;
		CountDownLatch latch = new CountDownLatch(threadCount);
		List<Exception> errors = Collections.synchronizedList(new ArrayList<>());
		AtomicInteger successCount = new AtomicInteger(0);

		service.execute("CREATE TABLE IF NOT EXISTS con_test (id INTEGER, val TEXT);", db("con_same_db"), true);

		try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
			for (int i = 0; i < threadCount; i++) {
				final int n = i;
				executor.submit(() -> {
					try {
						SqlResponse r = service.execute(
								"INSERT INTO con_test VALUES (" + n + ", 'thread-" + n + "');",
								db("con_same_db"), false
						);
						assertTrue(r.getError() == null, "Thread " + n + " insert should succeed");
						successCount.incrementAndGet();
					} catch (Exception e) {
						errors.add(e);
					} finally {
						latch.countDown();
					}
				});
			}

			assertTrue(latch.await(15, TimeUnit.SECONDS), "All threads should finish within 15s");
			assertTrue(errors.isEmpty(), "No exceptions expected: " + errors);
			assertEquals(threadCount, successCount.get());

			SqlResponse verify = service.execute(
					"SELECT COUNT(*) AS cnt FROM con_test;", db("con_same_db"), false);
			assertTrue(verify.getError() == null);
			long count = ((Number) verify.getData().getQueryResults().getFirst().getData().getFirst().get("cnt")).longValue();
			assertEquals(threadCount, count, "All " + threadCount + " rows should be visible");
		}
	}

	@Test
	void shouldHandleConcurrentResetOnSameDatabase() throws Exception {
		int threadCount = 6;
		CountDownLatch latch = new CountDownLatch(threadCount);
		List<Exception> errors = Collections.synchronizedList(new ArrayList<>());

		try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
			for (int i = 0; i < threadCount; i++) {
				executor.submit(() -> {
					try {
						SqlResponse r = service.execute(
								"CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1); SELECT * FROM t;",
								db("con_reset_db"), true
						);
						assertTrue(r.getError() == null);
					} catch (Exception e) {
						errors.add(e);
					} finally {
						latch.countDown();
					}
				});
			}
			assertTrue(latch.await(20, TimeUnit.SECONDS));
			assertTrue(errors.isEmpty(), "No exceptions should escape: " + errors);
		}
	}

	@Test
	void shouldHandleConcurrentDatabaseEviction() throws Exception {
		int threadCount = 10;
		CountDownLatch latch = new CountDownLatch(threadCount);
		List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());

		try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
			for (int i = 0; i < threadCount; i++) {
				final int n = i;
				executor.submit(() -> {
					try {
						SqlResponse r = service.execute(
								"SELECT 1 AS col;", db("evict_db_" + n), true
						);
						assertTrue(r.getError() == null, "DB " + db("evict_db_" + n) + " should succeed");
					} catch (Throwable e) {
						errors.add(e);
					} finally {
						latch.countDown();
					}
				});
			}
			assertTrue(latch.await(30, TimeUnit.SECONDS), "All threads should complete within timeout");
			assertTrue(errors.isEmpty(), "No errors during concurrent db creation: " + errors);

			// Verify the first-created database is still accessible
			SqlResponse verify = service.execute("SELECT 1;", db("evict_db_0"), false);
			assertTrue(verify.getError() == null, "First created db should be accessible after concurrent creation");
		}
	}

	/**
	 * 5-second stress run: one writer mutates the schema (CREATE/DROP in a loop)
	 * while three readers continuously query sqlite_master. Semantics preserved
	 * verbatim from the original monolithic test (Thread.sleep(5000) window).
	 */
	@Test
	void shouldHandleConcurrentSchemaReadsWhileModifying() throws Exception {
		AtomicBoolean running = new AtomicBoolean(true);
		List<Exception> errors = Collections.synchronizedList(new ArrayList<>());

		service.execute("CREATE TABLE IF NOT EXISTS stress_base (id INTEGER, name TEXT);", db("stress_db"), true);

		try (ExecutorService executor = Executors.newFixedThreadPool(4)) {
			executor.submit(() -> {
				int counter = 0;
				while (running.get() && counter < 50) {
					try {
						service.execute(
								"CREATE TABLE IF NOT EXISTS tmp_" + (counter % 10) + " (x INTEGER); "
										+ "DROP TABLE IF EXISTS tmp_" + ((counter + 5) % 10) + ";",
								db("stress_db"), false
						);
						counter++;
					} catch (Exception e) {
						errors.add(e);
						running.set(false);
					}
				}
			});

			CountDownLatch readerLatch = new CountDownLatch(3);
			for (int i = 0; i < 3; i++) {
				executor.submit(() -> {
					try {
						while (running.get()) {
							SqlResponse r = service.execute(
									"SELECT name, type FROM sqlite_master ORDER BY name;",
									db("stress_db"), false
							);
							assertNotNull(r);
						}
					} catch (Exception e) {
						errors.add(e);
					} finally {
						readerLatch.countDown();
					}
				});
			}

			Thread.sleep(5000);
			running.set(false);
			assertTrue(readerLatch.await(10, TimeUnit.SECONDS));
			assertTrue(errors.isEmpty(), "No errors during stress test: " + errors);
		}
	}

}
