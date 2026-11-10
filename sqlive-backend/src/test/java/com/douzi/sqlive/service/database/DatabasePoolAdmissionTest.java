package com.douzi.sqlive.service.database;

import com.douzi.sqlive.config.PoolProperties;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

class DatabasePoolAdmissionTest {

	@Test
	void admissionReclaimsReleasedPoolsImmediatelyButProtectsAllActiveLeases() {
		var props = new PoolProperties();
		props.setMaxDatabases(1);
		props.setCleanupInterval(Duration.ofDays(1));
		var manager = new DatabasePoolManager(props);
		try {
			for (int i = 0; i < 4; i++) manager.getOrCreateJdbcTemplate("admit_" + i);
			// A queued script already holds a lease before it enters the per-session lock.
			manager.getOrCreateJdbcTemplate("admit_0");
			assertThrows(TooManyDatabasesException.class, () -> manager.getOrCreateJdbcTemplate("admit_blocked"));
			manager.release("admit_0");
			assertThrows(TooManyDatabasesException.class, () -> manager.getOrCreateJdbcTemplate("admit_still_blocked"));
			manager.release("admit_0");
			assertNotNull(manager.getOrCreateJdbcTemplate("admit_new"));
			assertEquals(4, manager.getPoolSize());
			assertFalse(manager.getOrCreateJdbcTemplate("admit_1").isNew());
		} finally {
			manager.cleanup();
		}
	}
}
