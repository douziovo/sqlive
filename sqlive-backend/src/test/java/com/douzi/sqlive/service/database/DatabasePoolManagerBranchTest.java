package com.douzi.sqlive.service.database;

import com.douzi.sqlive.config.PoolProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Branch coverage for {@link DatabasePoolManager}: soft-max defaulting,
 * eager eviction above the soft max inside evictIdlePools, and resilient
 * DataSource close during cleanup.
 */
class DatabasePoolManagerBranchTest {

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

	private DatabasePoolManager createManager(int maxDatabases, Duration idleTimeout) {
		var props = new PoolProperties();
		props.setMaxDatabases(maxDatabases);
		props.setIdleTimeout(idleTimeout);
		props.setCleanupInterval(Duration.ofHours(1));
		var mgr = new DatabasePoolManager(props);
		managers.add(mgr);
		return mgr;
	}

	@Test
	void zeroMaxDatabasesFallsBackToDefaultSoftMax() {
		var mgr = createManager(0, Duration.ofMinutes(30));
		// default soft max (500) allows normal usage
		assertNotNull(mgr.getOrCreateJdbcTemplate("default_soft_max").jdbcTemplate());
		assertEquals(1, mgr.getPoolSize());
	}

	@Test
	void evictIdlePoolsTriggersEagerEvictionAboveSoftMax() {
		var mgr = createManager(1, Duration.ofMinutes(30));
		mgr.getOrCreateJdbcTemplate("over_a");
		mgr.release("over_a");
		mgr.getOrCreateJdbcTemplate("over_b");
		mgr.release("over_b");
		assertEquals(2, mgr.getPoolSize());

		ReflectionTestUtils.invokeMethod(mgr, "evictIdlePools");
		assertEquals(1, mgr.getPoolSize(), "evictIdlePools must shrink the pool to softMax");
	}

	@Test
	void evictIdlePoolsBelowSoftMaxOnlyEvictsExpiredEntries() {
		var mgr = createManager(500, Duration.ofMinutes(30));
		mgr.getOrCreateJdbcTemplate("idle_keep");
		mgr.release("idle_keep");

		ReflectionTestUtils.invokeMethod(mgr, "evictIdlePools");
		assertEquals(1, mgr.getPoolSize(), "non-expired pool must survive when below softMax");
	}

	@Test
	@SuppressWarnings("unchecked")
	void cleanupSwallowsDataSourceCloseFailures() {
		var mgr = createManager(500, Duration.ofMinutes(30));

		JdbcTemplate broken = mock(JdbcTemplate.class);
		when(broken.getDataSource()).thenThrow(new RuntimeException("already closed"));

		Map<String, JdbcTemplate> pools = new LinkedHashMap<>();
		pools.put("broken_pool", broken);
		ReflectionTestUtils.setField(mgr, "pools", pools);

		assertDoesNotThrow(mgr::cleanup);
		assertEquals(0, mgr.getPoolSize());
	}

	@Test
	@SuppressWarnings("unchecked")
	void cleanupSkipsNonHikariDataSourcesQuietly() {
		var mgr = createManager(500, Duration.ofMinutes(30));

		JdbcTemplate plain = mock(JdbcTemplate.class);
		when(plain.getDataSource()).thenReturn(null); // not a HikariDataSource

		Map<String, JdbcTemplate> pools = new LinkedHashMap<>();
		pools.put("plain_pool", plain);
		ReflectionTestUtils.setField(mgr, "pools", pools);

		assertDoesNotThrow(mgr::cleanup);
		assertEquals(0, mgr.getPoolSize());
	}

	@Test
	void releasingUnknownDatabaseIsANoOp() {
		var mgr = createManager(500, Duration.ofMinutes(30));
		mgr.getOrCreateJdbcTemplate("known_db");
		assertDoesNotThrow(() -> mgr.release("never_created_db"));
		assertEquals(1, mgr.getPoolSize(), "release of unknown db must not touch pools");
	}

	@Test
	void ipv6LongFormLoopbackBypassesPerIpLimit() {
		var mgr = createManager(500, Duration.ofMinutes(30));
		// "0:0:0:0:0:0:0:1" is the long form of ::1 and must bypass the per-IP cap
		assertNotNull(mgr.getOrCreateJdbcTemplate("lh6long_db", "0:0:0:0:0:0:0:1").jdbcTemplate());
	}
}
