package com.douzi.sqlive.service;

import com.douzi.sqlive.dto.SqlResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Security-related blocking (SEC-01 and friends): ATTACH DATABASE and PRAGMA
 * rejection in all spellings/layouts, keyword-as-identifier regressions, early
 * return after a blocked statement, line-number accuracy, file-writing
 * statements (VACUUM INTO / backup / restore) and dangerous words inside string
 * literals.
 */
class SqlExecutionServiceSecurityTest extends SqlExecutionServiceTestSupport {

	// ============================================================
	//  Security: ATTACH DATABASE blocking (SEC-01)
	// ============================================================

	@Test
	void shouldRejectAttachDatabase() {
		SqlResponse r = service.execute("ATTACH DATABASE '/etc/passwd' AS aux;", db("attach_test_attachdb"), true);
		assertFalse(r.getError() == null);
		assertEquals("ATTACH DATABASE is not allowed for security reasons", r.getError().getMessage());
		assertEquals(1, r.getError().getLine());
	}

	@Test
	void shouldRejectAttachShorthand() {
		SqlResponse r = service.execute("ATTACH ':memory:' AS mem;", db("attach_test_shorthand"), true);
		assertFalse(r.getError() == null);
		assertEquals("ATTACH DATABASE is not allowed for security reasons", r.getError().getMessage());
	}

	@Test
	void shouldRejectAttachLowercase() {
		SqlResponse r = service.execute("attach ':memory:' AS mem;", db("attach_test_lowercase"), true);
		assertFalse(r.getError() == null);
		assertTrue(r.getError().getMessage().contains("ATTACH"));
	}

	@Test
	void shouldRejectAttachInScript() {
		SqlResponse r = service.execute("CREATE TABLE t (x INTEGER);\nATTACH ':memory:' AS aux;\nSELECT 1;", db("attach_test_script"), true);
		assertFalse(r.getError() == null);
		assertEquals(2, r.getError().getLine());
	}

	// ============================================================
	//  Security: PRAGMA blocking (SEC-01)
	// ============================================================

	@Test
	void shouldRejectPragmaStatement() {
		SqlResponse r = service.execute("PRAGMA database_list;", db("pragma_test_std"), true);
		assertFalse(r.getError() == null);
		assertEquals("PRAGMA statements are not allowed", r.getError().getMessage());
		assertEquals(1, r.getError().getLine());
	}

	@Test
	void shouldRejectPragmaWithLeadingWhitespace() {
		SqlResponse r = service.execute("  PRAGMA page_count;", db("pragma_test_ws"), true);
		assertFalse(r.getError() == null);
		assertTrue(r.getError().getMessage().contains("PRAGMA"));
	}

	@Test
	void shouldRejectPragmaInScript() {
		SqlResponse r = service.execute("CREATE TABLE t (x INTEGER);\nINSERT INTO t VALUES (1);\nPRAGMA table_info('t');\nSELECT * FROM t;", db("pragma_test_script"), true);
		assertFalse(r.getError() == null);
		assertEquals(3, r.getError().getLine());
	}

	@Test
	void shouldRejectVariousPragmaNames() {
		SqlResponse r1 = service.execute("PRAGMA journal_mode;", db("pragma_test_names1"), true);
		assertFalse(r1.getError() == null);
		SqlResponse r2 = service.execute("PRAGMA cache_size;", db("pragma_test_names2"), true);
		assertFalse(r2.getError() == null);
	}

	// ============================================================
	//  Security: Regression — normal SQL unaffected (SEC-01)
	// ============================================================

	@Test
	void shouldAllowNormalStatementsDespiteBlockingCheck() {
		SqlResponse r1 = service.execute("SELECT 1;", db("reg_test_normal"), true);
		assertTrue(r1.getError() == null);

		SqlResponse r2 = service.execute("CREATE TABLE demo (id INTEGER); INSERT INTO demo VALUES (1); SELECT * FROM demo;", db("reg_test_ddl"), true);
		assertTrue(r2.getError() == null);

		SqlResponse r3 = service.execute("SELECT 2;", db("reg_test_dml"), true);
		assertTrue(r3.getError() == null);

		SqlResponse r4 = service.execute("  SELECT 3;", db("reg_test_ws"), true);
		assertTrue(r4.getError() == null);
	}

	// ============================================================
	//  Security: Mixed case PRAGMA (boundary)
	// ============================================================

	@Test
	void shouldRejectPragmaMixedCase() {
		SqlResponse r1 = service.execute("Pragma database_list;", db("pragma_mixed1"), true);
		assertFalse(r1.getError() == null);
		assertTrue(r1.getError().getMessage().contains("PRAGMA"));

		SqlResponse r2 = service.execute("pragMA cache_size;", db("pragma_mixed2"), true);
		assertFalse(r2.getError() == null);
		assertTrue(r2.getError().getMessage().contains("PRAGMA"));
	}

	// ============================================================
	//  Security: Keywords as identifiers — should NOT be blocked
	// ============================================================

	@Test
	void shouldAllowAttachAsTableName() {
		SqlResponse r = service.execute("CREATE TABLE attach (x INTEGER); INSERT INTO attach VALUES (1); SELECT * FROM attach;", db("attach_as_table"), true);
		assertTrue(r.getError() == null, "ATTACH as table name should not be blocked");
		assertEquals(1, r.getData().getQueryResults().getFirst().getData().size());
	}

	@Test
	void shouldAllowPragmaAsColumnName() {
		SqlResponse r = service.execute("CREATE TABLE t (pragma TEXT); INSERT INTO t VALUES ('val'); SELECT pragma FROM t;", db("pragma_as_col"), true);
		assertTrue(r.getError() == null, "PRAGMA as column name should not be blocked");
		assertEquals("val", r.getData().getQueryResults().getFirst().getData().getFirst().get("pragma"));
	}

	// ============================================================
	//  Security: Whitespace boundary (tabs, Windows newlines)
	// ============================================================

	@Test
	void shouldRejectAttachWithTabWhitespace() {
		SqlResponse r = service.execute("\tATTACH ':memory:' AS x;", db("attach_tab"), true);
		assertFalse(r.getError() == null);
		assertEquals("ATTACH DATABASE is not allowed for security reasons", r.getError().getMessage());
	}

	@Test
	void shouldRejectPragmaWithWindowsNewline() {
		SqlResponse r = service.execute("\r\nPRAGMA cache_size;", db("pragma_crlf"), true);
		assertFalse(r.getError() == null);
		assertTrue(r.getError().getMessage().contains("PRAGMA"));
	}

	// ============================================================
	//  Security: Early return — statements after blocked one don't execute
	// ============================================================

	@Test
	void shouldNotExecuteStatementsAfterBlockedOne() {
		// ATTACH blocked → immediate return, SELECT 1 never executes
		SqlResponse r = service.execute("ATTACH ':memory:' AS aux;\nSELECT 1;", db("early_return"), true);
		assertFalse(r.getError() == null);
		assertEquals("ATTACH DATABASE is not allowed for security reasons", r.getError().getMessage());
		// Verify no query results (SELECT didn't execute)
		assertNull(r.getData());
	}

	// ============================================================
	//  Security: Line number accuracy with blank lines
	// ============================================================

	@Test
	void shouldReportCorrectLineForAttachAfterBlankLines() {
		SqlResponse r = service.execute("\n\nATTACH ':memory:' AS aux;", db("attach_blank_lines"), true);
		assertFalse(r.getError() == null);
		assertEquals(3, r.getError().getLine(), "ATTACH on line 3 after two blank lines");
	}

	// ============================================================
	//  Security: ATTACH expression / comment variants
	// ============================================================

	@Test
	void shouldBlockAttachExpressionsAndCommentVariants() {
		for (String sql : List.of(
				"ATTACH (':memory:') AS aux;", "ATTACH \":memory:\" AS aux;",
				"ATTACH/**/DATABASE ':memory:' AS aux;",
				"/* lead */ ATTACH(':memory:') AS aux;",
				"EXPLAIN ATTACH ':memory:' AS aux;", "\uFEFFATTACH ':memory:' AS aux;")) {
			var result = service.execute(sql, db("attach_variants"), true);
			assertFalse(result.getError() == null, sql);
			assertEquals(SqlExecutionService.DEFAULT_ATTACH_ERROR, result.getError().getMessage(), sql);
		}
	}

	@Test
	void shouldBlockFileOperationsWithoutCreatingFiles(@TempDir Path dir) {
		Path target = dir.resolve("export.db");
		String filename = target.toString().replace("'", "''");
		for (String sql : List.of("VACUUM INTO '" + filename + "';",
				"VACUUM/**/main/**/INTO ('" + filename + "');",
				"EXPLAIN VACUUM INTO '" + filename + "';",
				"backup to '" + filename + "'", "restore from '" + filename + "'")) {
			var result = service.execute(sql, db("file_ops"), true);
			assertFalse(result.getError() == null, sql);
			assertTrue(result.getError().getMessage().contains("not allowed"), sql);
			assertFalse(Files.exists(target), "blocked SQL must not create a file");
		}
	}

	@Test
	void shouldAllowDangerousWordsInStringValues() {
		assertTrue(service.execute("SELECT 'ATTACH DATABASE', 'VACUUM INTO', 'PRAGMA foreign_keys';",
				db("literal"), true).getError() == null);
	}

}
