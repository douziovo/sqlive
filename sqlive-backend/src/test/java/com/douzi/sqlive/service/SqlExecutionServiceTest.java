package com.douzi.sqlive.service;

import com.douzi.sqlive.dto.SqlResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Basic execution behaviour: sanity checks, full-script execution, database
 * isolation and the canonicalStatements payload.
 *
 * <p>Split from the original monolithic SqlExecutionServiceTest; schema/data
 * verification, query features, reset, concurrency and security coverage now
 * live in dedicated sibling classes sharing {@link SqlExecutionServiceTestSupport}.
 */
class SqlExecutionServiceTest extends SqlExecutionServiceTestSupport {

	// ============================================================
	//  Sanity checks
	// ============================================================

	@Test
	void shouldExecuteSimpleSelect() {
		SqlResponse r = service.execute("SELECT 1;", db("test"), true);
		assertTrue(r.getError() == null);
		assertEquals(1, r.getData().getQueryResults().size());
	}

	@Test
	void shouldReturnErrorForInvalidSql() {
		SqlResponse r = service.execute("NOT VALID SQL;", db("test"), true);
		assertFalse(r.getError() == null);
		assertNotNull(r.getError());
	}

	@Test
	void shouldHandleEmptyScript() {
		SqlResponse r = service.execute("", db("test"), true);
		assertTrue(r.getError() == null);
	}

	@Test
	void shouldHandleCommentsOnly() {
		SqlResponse r = service.execute("-- comment\n/* block */", db("test"), true);
		assertTrue(r.getError() == null);
	}

	// ============================================================
	//  Full script execution
	// ============================================================

	@Test
	void shouldExecuteFullScriptSuccessfully() {
		assertNotNull(fullScript, "test-multi-table.sql should be loaded");
		SqlResponse r = service.execute(fullScript, db("fulltest"), true);
		assertTrue(r.getError() == null, "Full script should succeed. Error: " +
				(r.getError() != null ? "line " + r.getError().getLine() + " — " + r.getError().getMessage() : "none"));
	}

	// ============================================================
	//  Persistence / isolation
	// ============================================================

	@Test
	void shouldIsolateDatabasesByName() {
		service.execute("CREATE TABLE a (x INTEGER); INSERT INTO a VALUES (1);", db("db1"), true);
		service.execute("CREATE TABLE b (y TEXT); INSERT INTO b VALUES ('hello');", db("db2"), true);

		SqlResponse r1 = service.execute("SELECT * FROM a;", db("db1"), false);
		assertTrue(r1.getError() == null);
		assertEquals("a", r1.getData().getTables().getFirst().getName());

		SqlResponse r2 = service.execute("SELECT * FROM b;", db("db2"), false);
		assertTrue(r2.getError() == null);
		assertEquals("b", r2.getData().getTables().getFirst().getName());
	}

	@Test
	void shouldHandleStringLiteralsWithSemicolons() {
		SqlResponse r = service.execute("""
				CREATE TABLE t (x TEXT);
				INSERT INTO t VALUES ('hello; world');
				INSERT INTO t VALUES ('it''s fine');
				SELECT * FROM t;
				""", db("str_esc_test"), true);
		assertTrue(r.getError() == null);
		assertEquals(2, r.getData().getQueryResults().getFirst().getData().size());
	}

	// ============================================================
	//  canonicalStatements payload population
	// ============================================================

	@Test
	void shouldPopulateCanonicalStatementsWithCharOffsets() {
		SqlResponse r = service.execute("SELECT 1; SELECT 2;", db("canonical"), true);
		assertTrue(r.getError() == null);
		assertNotNull(r.getData().getCanonicalStatements(),
				"canonicalStatements must be populated by SqlExecutionService.execute()");
		assertEquals(2, r.getData().getCanonicalStatements().size(),
				"1:1 mapping with parsed statements");
		assertEquals(0, r.getData().getCanonicalStatements().get(0).getStart());
		assertEquals(9, r.getData().getCanonicalStatements().get(0).getEnd(),
				"end == parser endPos (cursor after first ';')");
		assertEquals(10, r.getData().getCanonicalStatements().get(1).getStart());
		assertEquals(19, r.getData().getCanonicalStatements().get(1).getEnd(),
				"end == script.length() for the trailing statement");
	}

}
