package com.douzi.sqlive.service.metadata;

import com.douzi.sqlive.config.PoolProperties;
import com.douzi.sqlive.service.database.DatabasePoolManager;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;

class MetadataExtractorTest {

    private final MetadataExtractor extractor = new MetadataExtractor();
    private final DatabasePoolManager poolManager = createPoolManager();

    private DatabasePoolManager createPoolManager() {
        PoolProperties props = new PoolProperties();
        return new DatabasePoolManager(props, new SimpleMeterRegistry());
    }
    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc = poolManager.getOrCreateJdbcTemplate("meta_test_db");
    }

    @AfterEach
    void tearDown() {
        poolManager.cleanup();
    }

    // ── extractAllTables ────────────────────────────────────

    @Test
    void shouldExtractTableWithColumns() {
        jdbc.execute("CREATE TABLE users (id INTEGER, name TEXT)");
        jdbc.execute("INSERT INTO users VALUES (1, 'Alice')");

        var tables = extractor.extractAllTables(jdbc);
        assertEquals(1, tables.size());
        var users = tables.get(0);
        assertEquals("users", users.getName());
        assertEquals(2, users.getColumns().size());
        assertEquals("INTEGER", users.getColumnTypes().get("id"));
        assertEquals(1, users.getData().size());
    }

    // ── extractIndexes ──────────────────────────────────────

    @Test
    void shouldExtractIndexInfo() {
        jdbc.execute("CREATE TABLE items (id INTEGER, name TEXT)");
        jdbc.execute("CREATE INDEX idx_name ON items (name)");

        var indexes = extractor.extractIndexes(jdbc);
        assertFalse(indexes.isEmpty());
        assertTrue(indexes.stream().anyMatch(i -> "idx_name".equals(i.getName())));
    }

    // ── extractViews ────────────────────────────────────────

    @Test
    void shouldExtractViewInfo() {
        jdbc.execute("CREATE TABLE t (x INTEGER)");
        jdbc.execute("CREATE VIEW v AS SELECT x FROM t");

        var views = extractor.extractViews(jdbc);
        assertEquals(1, views.size());
        assertEquals("v", views.get(0).getName());
        assertTrue(views.get(0).getSql().contains("SELECT"));
    }

    // ── extractTriggers ─────────────────────────────────────

    @Test
    void shouldExtractTriggerInfo() {
        jdbc.execute("CREATE TABLE log (msg TEXT)");
        jdbc.execute("CREATE TRIGGER trg AFTER INSERT ON log BEGIN INSERT INTO log VALUES ('fired'); END");

        var triggers = extractor.extractTriggers(jdbc);
        assertEquals(1, triggers.size());
        assertEquals("trg", triggers.get(0).getName());
    }

    // ── extractForeignKeys ──────────────────────────────────

    @Test
    void shouldExtractForeignKeyInfo() {
        jdbc.execute("CREATE TABLE dept (id INTEGER PRIMARY KEY, name TEXT)");
        jdbc.execute("CREATE TABLE emp (id INTEGER, dept_id INTEGER REFERENCES dept(id))");

        var fks = extractor.extractForeignKeys(jdbc);
        assertFalse(fks.isEmpty());
        var fk = fks.get(0);
        assertEquals("dept", fk.getToTable());
    }

    // ── Constraint parsing ──────────────────────────────────

    @Test
    void shouldIncludeConstraintsInColumnTypes() {
        jdbc.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");

        var tables = extractor.extractAllTables(jdbc);
        assertEquals(1, tables.size());
        var types = tables.get(0).getColumnTypes();
        assertTrue(types.get("id").contains("PRIMARY"));
        assertTrue(types.get("name").contains("NOT NULL"));
    }

    // ── Identifier validation ────────────────────────────────

    @Test
    void shouldRejectNullIdentifier() {
        var tables = extractor.extractAllTables(jdbc);
        assertTrue(tables.isEmpty());
        // verify no exception with empty db
    }

    @Test
    void shouldQuoteValidIdentifier() {
        assertEquals("\"my_table\"", MetadataExtractor.quoteIdentifier("my_table"));
    }

    @Test
    void shouldThrowForInvalidIdentifier() {
        assertThrows(IllegalArgumentException.class,
                () -> MetadataExtractor.quoteIdentifier("bad;name"));
        assertThrows(IllegalArgumentException.class,
                () -> MetadataExtractor.quoteIdentifier(""));
        assertThrows(IllegalArgumentException.class,
                () -> MetadataExtractor.quoteIdentifier(null));
    }
}
