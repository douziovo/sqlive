package com.douzi.sqlive.service.database;

import com.douzi.sqlive.config.PoolProperties;
import com.douzi.sqlive.exception.PoolFullException;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DatabasePoolManagerTest {

    private static final int N = 5;

    private final List<DatabasePoolManager> managers = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (var mgr : managers) {
            try { mgr.cleanup(); } catch (Exception ignored) {}
        }
        managers.clear();
    }

    private PoolProperties createProps() {
        PoolProperties props = new PoolProperties();
        props.setMaxDatabases(N);
        props.setIdleTimeout(Duration.ofMillis(100));
        props.setCleanupInterval(Duration.ofMinutes(5));
        return props;
    }

    private DatabasePoolManager createManager() {
        var mgr = new DatabasePoolManager(createProps(), new SimpleMeterRegistry());
        managers.add(mgr);
        return mgr;
    }

    private DatabasePoolManager createManager(SimpleMeterRegistry registry, PoolProperties props) {
        var mgr = new DatabasePoolManager(props, registry);
        managers.add(mgr);
        return mgr;
    }

    // ── Existing tests (updated) ──────────────────────────────

    @Test
    void shouldCreateJdbcTemplateForValidName() {
        var mgr = createManager();
        JdbcTemplate jdbc = mgr.getOrCreateJdbcTemplate("test_db");
        assertNotNull(jdbc);
        assertNotNull(jdbc.getDataSource());
        // Verify SQLite connectivity by executing SQL
        jdbc.execute("CREATE TABLE verify_sqlite (id INTEGER)");
        jdbc.execute("INSERT INTO verify_sqlite VALUES (1)");
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM verify_sqlite", Integer.class);
        assertEquals(1, count);
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
    void shouldThrowPoolFullWhenAllSlotsActive() {
        var mgr = createManager();
        for (int i = 0; i < N; i++) {
            mgr.getOrCreateJdbcTemplate("full_db_" + i);
        }
        PoolFullException ex = assertThrows(PoolFullException.class,
                () -> mgr.getOrCreateJdbcTemplate("overflow_db"));
        assertEquals(N, ex.getMaxDatabases());
        assertEquals(N, mgr.getPoolSize());
    }

    @Test
    void shouldThrowWhenAllDatabasesActive() {
        var mgr = createManager();
        for (int i = 0; i < N; i++) {
            mgr.getOrCreateJdbcTemplate("active_db_" + i);
        }
        // re-access all to make them "active"
        for (int i = 0; i < N; i++) {
            mgr.getOrCreateJdbcTemplate("active_db_" + i);
        }
        assertThrows(PoolFullException.class,
                () -> mgr.getOrCreateJdbcTemplate("overflow_active"));
    }

    @Test
    void shouldCleanupAllConnectionsWithoutThrowing() {
        var mgr = createManager();
        mgr.getOrCreateJdbcTemplate("cleanup_a");
        mgr.getOrCreateJdbcTemplate("cleanup_b");
        mgr.getOrCreateJdbcTemplate("cleanup_c");

        assertDoesNotThrow(mgr::cleanup);
        assertEquals(0, mgr.getPoolSize());
    }

    // ── New tests ─────────────────────────────────────────────

    @Test
    void shouldUseSQLiteDataSource() {
        var mgr = createManager();
        JdbcTemplate jdbc = mgr.getOrCreateJdbcTemplate("ds_test");
        DataSource ds = jdbc.getDataSource();
        assertNotNull(ds);
        // Verify SQLite is used by checking connection URL
        try (Connection conn = ds.getConnection()) {
            String url = conn.getMetaData().getURL();
            assertTrue(url.contains("sqlite"),
                    "Connection URL should contain 'sqlite', but got: " + url);
        } catch (Exception e) {
            fail("Failed to verify SQLite DataSource: " + e.getMessage());
        }
    }

    @Test
    void shouldConstructUrlWithCacheShared() {
        var mgr = createManager();
        JdbcTemplate jdbc = mgr.getOrCreateJdbcTemplate("url_test");
        try (Connection conn = jdbc.getDataSource().getConnection()) {
            String url = conn.getMetaData().getURL();
            assertTrue(url.contains("cache=shared"),
                    "URL should contain 'cache=shared', but got: " + url);
        } catch (Exception e) {
            fail("Failed to verify cache=shared URL: " + e.getMessage());
        }
    }

    @Test
    void shouldIncrementHitCounterOnReuse() {
        var registry = new SimpleMeterRegistry();
        var props = createProps();
        var mgr = createManager(registry, props);

        mgr.getOrCreateJdbcTemplate("hit_test");
        mgr.getOrCreateJdbcTemplate("hit_test"); // reuse

        double hits = registry.get("db.pool.hits").counter().count();
        assertTrue(hits >= 1.0, "Hit counter should be >= 1 after one reuse, got: " + hits);
    }

    @Test
    void shouldIncrementEvictionCounter() {
        var registry = new SimpleMeterRegistry();
        var props = new PoolProperties();
        props.setMaxDatabases(3);
        props.setIdleTimeout(Duration.ofMillis(0));
        props.setCleanupInterval(Duration.ofMinutes(5));
        var mgr = createManager(registry, props);

        mgr.getOrCreateJdbcTemplate("evict_a");
        mgr.evictIdleDatabases();

        double evictions = registry.get("db.pool.evictions").counter().count();
        assertTrue(evictions >= 1.0, "Eviction counter should be >= 1, got: " + evictions);
    }

    @Test
    void shouldThrowPoolFullExceptionWithCorrectMessage() {
        var mgr = createManager();
        for (int i = 0; i < N; i++) {
            mgr.getOrCreateJdbcTemplate("msg_db_" + i);
        }
        PoolFullException ex = assertThrows(PoolFullException.class,
                () -> mgr.getOrCreateJdbcTemplate("overflow_msg"));
        assertTrue(ex.getMessage().contains("max: " + N),
                "Message should contain 'max: " + N + "', got: " + ex.getMessage());
        assertEquals(N, ex.getMaxDatabases());
    }

    @Test
    void shouldExposePoolSizeGaugeMetric() {
        var registry = new SimpleMeterRegistry();
        var props = createProps();
        var mgr = createManager(registry, props);

        mgr.getOrCreateJdbcTemplate("size_a");
        mgr.getOrCreateJdbcTemplate("size_b");

        assertEquals(2.0, registry.get("db.pool.size").gauge().value());
    }

    @Test
    void shouldTrackCreateLatencyMetric() {
        var registry = new SimpleMeterRegistry();
        var props = createProps();
        var mgr = createManager(registry, props);

        mgr.getOrCreateJdbcTemplate("latency_db");

        assertTrue(registry.get("db.pool.create.latency").timer().count() >= 1,
                "Create latency timer should have recorded at least one sample");
    }

    @Test
    void shouldEvictAllEntriesWithZeroIdleTimeout() {
        var registry = new SimpleMeterRegistry();
        var props = new PoolProperties();
        props.setMaxDatabases(10);
        props.setIdleTimeout(Duration.ofMillis(0));
        props.setCleanupInterval(Duration.ofMinutes(5));
        var mgr = createManager(registry, props);

        mgr.getOrCreateJdbcTemplate("zero_a");
        mgr.getOrCreateJdbcTemplate("zero_b");
        mgr.getOrCreateJdbcTemplate("zero_c");
        assertEquals(3, mgr.getPoolSize());

        mgr.evictIdleDatabases();

        assertEquals(0, mgr.getPoolSize(), "All entries should be evicted with idleTimeout=0");
        double evictions = registry.get("db.pool.evictions").counter().count();
        assertEquals(3.0, evictions, "Eviction counter should reflect 3 evicted entries");
    }

    @Test
    void shouldNotEvictAnyEntryWithLongIdleTimeout() {
        var registry = new SimpleMeterRegistry();
        var props = new PoolProperties();
        props.setMaxDatabases(10);
        props.setIdleTimeout(Duration.ofHours(1));
        props.setCleanupInterval(Duration.ofMinutes(5));
        var mgr = createManager(registry, props);

        mgr.getOrCreateJdbcTemplate("keep_a");
        mgr.getOrCreateJdbcTemplate("keep_b");
        mgr.getOrCreateJdbcTemplate("keep_c");
        assertEquals(3, mgr.getPoolSize());

        mgr.evictIdleDatabases();

        assertEquals(3, mgr.getPoolSize(),
                "No entries should be evicted — all were created recently, idleTimeout=1h not exceeded");
        double evictions = registry.get("db.pool.evictions").counter().count();
        assertEquals(0.0, evictions, "Eviction counter should be 0 — nothing evicted");
    }

    // ── Session recreation tracking tests (D-07) ──────────────────

    @Test
    void evictionPopulatesClosedDbNames() {
        var props = new PoolProperties();
        props.setMaxDatabases(N);
        props.setIdleTimeout(Duration.ofMillis(0));
        props.setCleanupInterval(Duration.ofMinutes(5));
        var mgr = createManager(new SimpleMeterRegistry(), props);

        mgr.getOrCreateJdbcTemplate("evicted_db");
        mgr.evictIdleDatabases();

        // Recreate after eviction — should trigger recreation path
        mgr.getOrCreateJdbcTemplate("evicted_db");
        assertTrue(mgr.consumeSessionRecreated("evicted_db"),
                "consumeSessionRecreated should return true after eviction + recreation");
    }

    @Test
    void consumeSessionRecreatedReturnsTrueForRecreatedName() {
        var props = new PoolProperties();
        props.setMaxDatabases(N);
        props.setIdleTimeout(Duration.ofMillis(0));
        props.setCleanupInterval(Duration.ofMinutes(5));
        var mgr = createManager(new SimpleMeterRegistry(), props);

        mgr.getOrCreateJdbcTemplate("recreate_me");
        mgr.evictIdleDatabases();
        mgr.getOrCreateJdbcTemplate("recreate_me");

        assertTrue(mgr.consumeSessionRecreated("recreate_me"),
                "Should return true for a name that was evicted and recreated");
    }

    @Test
    void consumeSessionRecreatedReturnsFalseForNeverEvictedName() {
        var mgr = createManager();

        mgr.getOrCreateJdbcTemplate("fresh_db");

        assertFalse(mgr.consumeSessionRecreated("fresh_db"),
                "Should return false for a database that was never evicted");
    }

    @Test
    void consumeSessionRecreatedReturnsFalseOnSecondCall() {
        var props = new PoolProperties();
        props.setMaxDatabases(N);
        props.setIdleTimeout(Duration.ofMillis(0));
        props.setCleanupInterval(Duration.ofMinutes(5));
        var mgr = createManager(new SimpleMeterRegistry(), props);

        mgr.getOrCreateJdbcTemplate("one_shot_db");
        mgr.evictIdleDatabases();
        mgr.getOrCreateJdbcTemplate("one_shot_db");

        assertTrue(mgr.consumeSessionRecreated("one_shot_db"),
                "First call should return true (one-shot read)");
        assertFalse(mgr.consumeSessionRecreated("one_shot_db"),
                "Second call should return false (already consumed)");
    }
}
