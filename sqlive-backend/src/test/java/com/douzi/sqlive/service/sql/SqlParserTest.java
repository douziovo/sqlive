package com.douzi.sqlive.service.sql;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SqlParserTest {

	private final SqlParser parser = new SqlParser();

	// ── parseStatementsPrecise ──────────────────────────────

	@Test
	void shouldParseSingleStatement() {
		var stmts = parser.parseStatementsPrecise("SELECT 1;");
		assertEquals(1, stmts.size());
		assertTrue(stmts.get(0).sql().contains("SELECT 1"));
		assertEquals(1, stmts.get(0).startLine());
	}

	@Test
	void shouldParseMultipleStatements() {
		var stmts = parser.parseStatementsPrecise("SELECT 1; SELECT 2;");
		assertEquals(2, stmts.size());
	}

	@Test
	void shouldNotSplitSemicolonInsideSingleQuotedString() {
		var stmts = parser.parseStatementsPrecise("INSERT INTO t VALUES ('a;b');");
		assertEquals(1, stmts.size());
	}

	@Test
	void shouldNotSplitSemicolonInsideDoubleQuotedIdentifier() {
		var stmts = parser.parseStatementsPrecise("CREATE TABLE \"t;a\" (x INT);");
		assertEquals(1, stmts.size());
	}

	@Test
	void shouldNotSplitSemicolonsInsideBeginEndBlock() {
		var stmts = parser.parseStatementsPrecise("""
				BEGIN;
				SELECT 1;
				SELECT 2;
				END;""");
		assertEquals(1, stmts.size());
	}

	@Test
	void shouldTrackCaseEndDepth() {
		var stmts = parser.parseStatementsPrecise(
				"SELECT CASE WHEN x=1 THEN 'a' END FROM t;");
		assertEquals(1, stmts.size());
	}

	@Test
	void shouldSkipLineComments() {
		var stmts = parser.parseStatementsPrecise("""
				-- this is a comment
				SELECT 1;
				-- another comment""");
		assertEquals(1, stmts.size());
	}

	@Test
	void shouldSkipBlockComments() {
		var stmts = parser.parseStatementsPrecise("""
				/* multi-line
				   comment */
				SELECT 1;""");
		assertEquals(1, stmts.size());
	}

	@Test
	void shouldReportCorrectLineNumbers() {
		var stmts = parser.parseStatementsPrecise("""
				SELECT 1;
				SELECT 2;
				SELECT 3;""");
		assertEquals(3, stmts.size());
		assertEquals(1, stmts.get(0).startLine());
		assertEquals(2, stmts.get(1).startLine());
		assertEquals(3, stmts.get(2).startLine());
	}

	@Test
	void shouldExcludeWhitespaceOnlyStatements() {
		var stmts = parser.parseStatementsPrecise("SELECT 1;\n   \t  \nSELECT 2;");
		assertEquals(2, stmts.size());
	}

	@Test
	void shouldHandleSqlWithoutSemicolon() {
		var stmts = parser.parseStatementsPrecise("SELECT 1");
		assertEquals(1, stmts.size());
		assertTrue(stmts.get(0).sql().contains("SELECT 1"));
	}

	@Test
	void shouldHandleEscapedSingleQuotes() {
		var stmts = parser.parseStatementsPrecise("INSERT INTO t VALUES ('it''s');");
		assertEquals(1, stmts.size());
	}

	// ── D-03a: endPos char-offset contract ───────────────────

	@Test
	void shouldPopulateEndPosAsCharOffsetAfterSemicolon() {
		var stmts = parser.parseStatementsPrecise("SELECT 1; SELECT 2;");
		assertEquals(2, stmts.size());
		assertEquals(0, stmts.get(0).startPos());
		assertEquals(10, stmts.get(0).endPos());   // cursor AFTER first ';'
		assertEquals(11, stmts.get(1).startPos());
		assertEquals(21, stmts.get(1).endPos());   // cursor AFTER second ';'
	}

	@Test
	void shouldHandleNonAsciiWithoutByteOffsetMismatch() {
		String script = "SELECT 1; -- 中文\nSELECT 2;";
		var stmts = parser.parseStatementsPrecise(script);
		assertEquals(2, stmts.size());
		// Lock the char-offset contract: UTF-16 code unit indices, NOT byte offsets.
		// A byte-offset implementation would slice into the middle of the multi-byte
		// '中' sequence and the assertions below would fail.
		assertEquals(script.substring(0, 10), stmts.get(0).sql());
		assertEquals(script.substring(11), stmts.get(1).sql());
		assertEquals(0, stmts.get(0).startPos());
		assertEquals(10, stmts.get(0).endPos());
		assertEquals(11, stmts.get(1).startPos());
		assertEquals(script.length(), stmts.get(1).endPos());
	}

	// ── locateErrorLine ─────────────────────────────────────

	@Test
	void shouldLocateErrorLineForKnownToken() {
		int line = parser.locateErrorLine("SELECT *\nFROM foo\nWHERE x = ?;", 10, "near \"?\"");
		// '?' found on line 3 (0-indexed offset to startLine 10 → line 12)
		assertEquals(12, line);
	}

	@Test
	void shouldReturnStartLineWhenTokenNotFound() {
		int line = parser.locateErrorLine("SELECT 1;", 5, "near \"xyz\"");
		assertEquals(5, line);
	}

	@Test
	void shouldLocateErrorLineForSemicolonToken() {
		int line = parser.locateErrorLine("SELECT 1;\nSELECT 2;", 1, "near \";\"");
		// Semicolon triggers special position logic; verify it returns a valid line
		assertTrue(line >= 1);
	}

	@Test
	void shouldReturnStartLineWhenErrorMessageIsEmpty() {
		int line = parser.locateErrorLine("SELECT 1;", 3, "");
		assertEquals(3, line);
	}
}
