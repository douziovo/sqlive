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
		// "SELECT 1; SELECT 2;" — length 19
		//   stmt 0: 'SELECT 1;' chars 0..8 (; at index 8) → endPos = 9 (cursor AFTER ';')
		//   stmt 1: 'SELECT 2;' chars 10..18 (; at index 18) → endPos = 19
		var stmts = parser.parseStatementsPrecise("SELECT 1; SELECT 2;");
		assertEquals(2, stmts.size());
		assertEquals(0, stmts.get(0).startPos());
		assertEquals(9, stmts.get(0).endPos());    // cursor AFTER first ';'
		assertEquals(10, stmts.get(1).startPos());
		assertEquals(19, stmts.get(1).endPos());   // cursor AFTER second ';'
		// Lock the substring contract: sql() must be exactly the char-offset slice.
		assertEquals("SELECT 1;", "SELECT 1; SELECT 2;".substring(
				stmts.get(0).startPos(), stmts.get(0).endPos()));
		assertEquals("SELECT 2;", "SELECT 1; SELECT 2;".substring(
				stmts.get(1).startPos(), stmts.get(1).endPos()));
	}

	@Test
	void shouldHandleNonAsciiWithoutByteOffsetMismatch() {
		String script = "SELECT 1; -- 中文\nSELECT 2;";
		var stmts = parser.parseStatementsPrecise(script);
		assertEquals(2, stmts.size());
		// Lock the char-offset contract: UTF-16 code unit indices, NOT byte offsets.
		// A byte-offset implementation would slice into the middle of the multi-byte
		// '中' sequence and the assertions below would fail.
		assertEquals(script.substring(stmts.get(0).startPos(), stmts.get(0).endPos()),
				stmts.get(0).sql());
		assertEquals(script.substring(stmts.get(1).startPos(), stmts.get(1).endPos()),
				stmts.get(1).sql());
		// Specific offset assertions: stmt 0 ends at index 9 (right after first ';');
		// stmt 1 starts at index 16 (after the line comment "\n" consumed by skipWhitespace).
		assertEquals(0, stmts.get(0).startPos());
		assertEquals(9, stmts.get(0).endPos());
		assertEquals(16, stmts.get(1).startPos());
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
