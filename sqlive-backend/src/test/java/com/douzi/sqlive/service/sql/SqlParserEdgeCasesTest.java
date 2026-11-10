package com.douzi.sqlive.service.sql;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Scanner edge cases at end-of-input: quote closers, comment starters and
 * keywords in the last position of the script, plus locateErrorLine token
 * extraction branches (empty/unclosed/punctuation tokens).
 */
class SqlParserEdgeCasesTest {

	private final SqlParser parser = new SqlParser();

	// ── EOF scanner edges ───────────────────────────────────

	@Test
	void backtickCloserAtEndOfScriptKeepsQuotedSemicolonsInsideTheIdentifier() {
		var statements = parser.parseStatementsPrecise("SELECT `a;b`");
		assertEquals(1, statements.size());
		assertEquals("SELECT `a;b`", statements.getFirst().sql());
		assertEquals(12, statements.getFirst().endPos());
	}

	@Test
	void temporaryTriggerKeepsItsBodyTogetherBeforeTheFollowingStatement() {
		String trigger = "CREATE TEMPORARY TRIGGER audit AFTER INSERT ON t BEGIN SELECT 1; SELECT 2; END;";
		var statements = parser.parseStatementsPrecise(trigger + " SELECT 3;");
		assertEquals(2, statements.size());
		assertEquals(trigger, statements.getFirst().sql());
		assertEquals("SELECT 3;", statements.get(1).sql());
	}

	@Test
	void doubleQuoteCloserAtEndOfScriptTerminatesIdentifier() {
		var statements = parser.parseStatementsPrecise("SELECT \"a\"");
		assertEquals(1, statements.size());
		assertEquals("SELECT \"a\"", statements.getFirst().sql());
	}

	@Test
	void backslashAtEndOfScriptInsideSingleQuotesIsTolerated() {
		var statements = parser.parseStatementsPrecise("SELECT 'a\\");
		assertEquals(1, statements.size());
	}

	@Test
	void loneDashAtEndOfScriptIsNotALineComment() {
		var statements = parser.parseStatementsPrecise("SELECT 1-");
		assertEquals(1, statements.size());
		assertEquals("SELECT 1-", statements.getFirst().sql());
	}

	@Test
	void loneSlashAtEndOfScriptIsNotABlockComment() {
		var statements = parser.parseStatementsPrecise("SELECT 1/");
		assertEquals(1, statements.size());
	}

	@Test
	void loneDashAfterLastSemicolonIsNotALineComment() {
		var statements = parser.parseStatementsPrecise("SELECT 1; -");
		// '-' at EOF is not a comment start; it scans as its own (garbage) statement
		assertEquals(2, statements.size());
		assertEquals("-", statements.get(1).sql());
	}

	@Test
	void loneSlashAfterLastSemicolonIsNotABlockComment() {
		var statements = parser.parseStatementsPrecise("SELECT 1; /");
		assertEquals(2, statements.size());
		assertEquals("/", statements.get(1).sql());
	}

	@Test
	void caseKeywordAtEndOfScriptIsStillRecognized() {
		var statements = parser.parseStatementsPrecise("SELECT CASE");
		assertEquals(1, statements.size());
	}

	@Test
	void keywordFollowedByUnderscoreIsNotAKeyword() {
		var statements = parser.parseStatementsPrecise("SELECT case_x, end_y;");
		assertEquals(1, statements.size(), "case_x/end_y must be treated as identifiers");
	}

	@Test
	void semicolonInsideCaseExpressionDoesNotSplit() {
		var statements = parser.parseStatementsPrecise("SELECT CASE WHEN a; THEN 1 ELSE 2 END;");
		assertEquals(1, statements.size(), "';' inside CASE depth must not split statements");
	}

	// ── locateErrorLine token branches ──────────────────────

	@Test
	void emptyTokenReturnsStartLine() {
		assertEquals(3, parser.locateErrorLine("SELECT 1", 3, "near \"\": syntax error"));
	}

	@Test
	void unclosedTokenQuoteReturnsStartLine() {
		assertEquals(2, parser.locateErrorLine("SELECT 1", 2, "near \"unclosed"));
	}

	@Test
	void tokenAtStatementStartReturnsStartLine() {
		assertEquals(1, parser.locateErrorLine(";", 1, "near \";\""));
	}

	@Test
	void openParenTokenUsesPrecedingCharacterPosition() {
		assertEquals(1, parser.locateErrorLine("SELECT (1", 1, "near \"(\""));
	}

	@Test
	void tokenNotFoundInStatementReturnsStartLine() {
		assertEquals(5, parser.locateErrorLine("SELECT 1", 5, "near \"zzz\""));
	}

	@Test
	void closeParenTokenTakesPrecedingPositionPath() {
		int line = parser.locateErrorLine("SELECT (1))", 1, "near \")\"");
		assertTrue(line >= 1);
	}

	@Test
	void statementsBackToBackWithoutWhitespaceSplitCorrectly() {
		var statements = parser.parseStatementsPrecise("SELECT 1;SELECT 2");
		assertEquals(2, statements.size());
		assertEquals("SELECT 1;", statements.get(0).sql());
		assertEquals("SELECT 2", statements.get(1).sql());
	}

	@Test
	void keywordDirectlyFollowedByWordCharacterIsNotAKeyword() {
		var statements = parser.parseStatementsPrecise("SELECT CASE1, ENDx;");
		assertEquals(1, statements.size());
	}

	@Test
	void commentsBetweenStatementsAreSkipped() {
		var statements = parser.parseStatementsPrecise("-- lead\nSELECT 1; /* mid */ SELECT 2;");
		assertEquals(2, statements.size());
		assertEquals("SELECT 1;", statements.get(0).sql());
		assertEquals("SELECT 2;", statements.get(1).sql());
	}

	@Test
	void dashOrSlashFollowedByNonCommentCharEndsSkipping() {
		// '-x' and '/x' are not comments; they start (garbage) statements
		var statements = parser.parseStatementsPrecise("SELECT 1; -x");
		assertEquals(2, statements.size());
		assertEquals("-x", statements.get(1).sql());
		statements = parser.parseStatementsPrecise("SELECT 1; /x");
		assertEquals(2, statements.size());
		assertEquals("/x", statements.get(1).sql());
	}
}
