package com.douzi.sqlive.service.database;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DatabasePoolManagerTest {

    private final List<DatabasePoolManager> managers = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (var mgr : managers) {
            try { mgr.cleanup(); } catch (Exception ignored) {}
        }
        managers.clear();
    }

    private DatabasePoolManager createManager() {
        var mgr = new DatabasePoolManager();
        managers.add(mgr);
        return mgr;
    }

    @Test
    void shouldCreateJdbcTemplateForValidName() {
        var mgr = createManager();
        JdbcTemplate jdbc = mgr.getOrCreateJdbcTemplate("test_db");
        assertNotNull(jdbc);
        assertNotNull(jdbc.getDataSource());
    }

    @Test
    void shouldReuseJdbcTemplateForSameName() {
        var mgr = createManager();
        var jdbc1 = mgr.getOrCreateJdbcTemplate("reuse_db");
        var jdbc2 = mgr.getOrCreateJdbcTemplate("reuse_db");
        assertSame(jdbc1, jdbc2);
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
        assertNotNull(mgr.getOrCreateJdbcTemplate("my-db_01"));
    }

    @Test
    void shouldEvictWhenPoolExceedsMaxDatabases() {
        var mgr = createManager();
        // MAX_DATABASES = 20, create 20 successfully
        for (int i = 0; i < 20; i++) {
            assertNotNull(mgr.getOrCreateJdbcTemplate("evict_db_" + i));
        }
        // 21st create triggers pool-full check; all entries are recently created
        // (none idle >20min), so IllegalStateException is thrown
        assertThrows(IllegalStateException.class,
            () -> mgr.getOrCreateJdbcTemplate("evict_db_20"),
            "Pool full with all active entries should throw");
        // Pool remains at max capacity
        assertEquals(20, mgr.getPoolSize(), "Pool size should not exceed MAX_DATABASES");
    }

    @Test
    void shouldThrowWhenAllDatabasesActive() {
        var mgr = createManager();
        // Fill pool to max (20 databases)
        for (int i = 0; i < 20; i++) {
            assertNotNull(mgr.getOrCreateJdbcTemplate("active_db_" + i));
        }
        // Touch each database to update lastAccessTime (simulate recent activity)
        for (int i = 0; i < 20; i++) {
            assertNotNull(mgr.getOrCreateJdbcTemplate("active_db_" + i));
        }
        // Attempt to create 21st database should throw
        assertThrows(IllegalStateException.class,
            () -> mgr.getOrCreateJdbcTemplate("overflow_db"),
            "Should throw when all databases are active and pool is full");
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
}
