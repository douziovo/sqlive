package com.douzi.sqlive.service.database;

import com.douzi.sqlive.config.PoolProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DatabasePoolManagerTest {

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
	void shouldCreateJdbcTemplateForValidName() {
		var mgr = createManager();
		var poolEntry = mgr.getOrCreateJdbcTemplate("test_db");
		assertTrue(poolEntry.isNew());
		JdbcTemplate jdbc = poolEntry.jdbcTemplate();
		assertNotNull(jdbc);
		assertNotNull(jdbc.getDataSource());
	}

	@Test
	void shouldReuseJdbcTemplateForSameName() {
		var mgr = createManager();
		var e1 = mgr.getOrCreateJdbcTemplate("reuse_db");
		var e2 = mgr.getOrCreateJdbcTemplate("reuse_db");
		assertTrue(e1.isNew());
		assertFalse(e2.isNew());
		assertSame(e1.jdbcTemplate(), e2.jdbcTemplate());
	}

	@Test
	void shouldRejectNullDbName() {
		var mgr = createManager();
		assertThrows(IllegalArgumentException.class, () -> mgr.getOrCreateJdbcTemplate(null));
	}

	@Test
	void shouldRejectInvalidDbNameWithSpecialChars() {
		var mgr = createManager();
		assertThrows(IllegalArgumentException.class, () -> mgr.getOrCreateJdbcTemplate("test; DROP TABLE"));
	}

	@Test
	void shouldRejectDbNameWithSlashes() {
		var mgr = createManager();
		assertThrows(IllegalArgumentException.class, () -> mgr.getOrCreateJdbcTemplate("../../etc/passwd"));
	}

	@Test
	void shouldAcceptDbNameWithUnderscoreAndDash() {
		var mgr = createManager();
		assertNotNull(mgr.getOrCreateJdbcTemplate("my-db_01").jdbcTemplate());
	}

	@Test
	void shouldNotEvictWhenExceedingSoftMaxIfAllInUse() {
		var mgr = createManager();
		// SOFT_MAX = 500, create 501 pools without releasing — all are "in use"
		for (int i = 0; i < 501; i++) {
			assertNotNull(mgr.getOrCreateJdbcTemplate("soft_db_" + i).jdbcTemplate());
		}
		// Should allow overflow since all pools are in use
		assertEquals(501, mgr.getPoolSize());
	}

	@Test
	void shouldAllowPoolCreationAfterRelease() {
		var mgr = createManager();
		// Create 21 pools, release all → cleaner should be able to evict
		for (int i = 0; i < 21; i++) {
			mgr.getOrCreateJdbcTemplate("rel_db_" + i);
			mgr.release("rel_db_" + i);
		}
		assertEquals(21, mgr.getPoolSize());
	}

	@Test
	void shouldRejectHardMax() {
		var mgr = createManager();
		// HARD_MAX = 2000, create 2000 pools (all in use)
		for (int i = 0; i < 2000; i++) {
			assertNotNull(mgr.getOrCreateJdbcTemplate("hard_db_" + i).jdbcTemplate());
		}
		assertEquals(2000, mgr.getPoolSize());
		// 2001st should throw
		assertThrows(TooManyDatabasesException.class, () -> mgr.getOrCreateJdbcTemplate("hard_db_overflow"));
	}

	@Test
	void shouldCleanupAllConnectionsWithoutThrowing() {
		var mgr = createManager();
		mgr.getOrCreateJdbcTemplate("cleanup_a");
		mgr.getOrCreateJdbcTemplate("cleanup_b");
		mgr.getOrCreateJdbcTemplate("cleanup_c");

		assertDoesNotThrow(mgr::cleanup);
		assertEquals(0, mgr.getPoolSize(), "Pool should be empty after cleanup");
	}

	@Test
	void shouldRefuseTooManyPoolsPerIp() {
		var mgr = createManager();
		// MAX_PER_IP = 50
		for (int i = 0; i < 50; i++) {
			mgr.getOrCreateJdbcTemplate("ip_db_" + i, "192.168.1.100");
		}
		assertEquals(50, mgr.getPoolSize());
		assertThrows(TooManyDatabasesException.class,
				() -> mgr.getOrCreateJdbcTemplate("ip_db_overflow", "192.168.1.100"));
	}

	@Test
	void shouldAllowLocalhostToBypassPerIpLimit() {
		var mgr = createManager();
		for (int i = 0; i < 60; i++) {
			assertNotNull(mgr.getOrCreateJdbcTemplate("lh_db_" + i, "127.0.0.1").jdbcTemplate());
		}
		assertEquals(60, mgr.getPoolSize());
	}

	@Test
	void shouldRefCountCorrectly() {
		var mgr = createManager();
		mgr.getOrCreateJdbcTemplate("ref_db");
		assertEquals(1, mgr.getPoolSize());
		mgr.getOrCreateJdbcTemplate("ref_db"); // reuse
		mgr.release("ref_db");
		// Still 1 pool, just refcount decremented
		assertEquals(1, mgr.getPoolSize());
		mgr.release("ref_db"); // matches second acquire
		assertEquals(1, mgr.getPoolSize()); // pool still exists, cleaner will remove later
	}

	@Test
	void shouldEvictLeastRecentlyUsedFirst() {
		var mgr = createManager();
		// Create 3 pools (release each so they're evictable: isInUse == false)
		mgr.getOrCreateJdbcTemplate("lru_db1", null);
		mgr.release("lru_db1");
		mgr.getOrCreateJdbcTemplate("lru_db2", null);
		mgr.release("lru_db2");
		mgr.getOrCreateJdbcTemplate("lru_db3", null);
		mgr.release("lru_db3");

		// Re-access db2 and db3 (NOT db1) — db1 stays least-recently-used.
		// Under LinkedHashMap access-order this reorders the tail: db1, db2, db3.
		mgr.getOrCreateJdbcTemplate("lru_db2", null);
		mgr.release("lru_db2");
		mgr.getOrCreateJdbcTemplate("lru_db3", null);
		mgr.release("lru_db3");

		// Evict down to 1 pool — should retain db3 (MRU), evict db1 (LRU) then db2.
		mgr.evictToTarget(1);

		// db1 (LRU) evicted → re-access creates a new pool (isNew=true)
		assertTrue(mgr.getOrCreateJdbcTemplate("lru_db1", null).isNew(),
				"db1 should be evicted (LRU) — isNew=true means pool was recreated");
		// db3 (MRU) retained → re-access returns existing pool (isNew=false)
		assertFalse(mgr.getOrCreateJdbcTemplate("lru_db3", null).isNew(),
				"db3 should be retained (MRU) — isNew=false means pool still exists");
	}
}
