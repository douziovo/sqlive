package com.douzi.sqlive.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SqlExecutionServiceSqliteLexingTest extends SqlExecutionServiceTestSupport {
	@Test
	void executesSelectFollowingAStringEndingInBackslash() {
		var result = service.execute("SELECT 'C:\\'; SELECT 2 AS second;", db("slash_select"), true);
		assertNull(result.getError());
		assertEquals(2, result.getData().getMetadata().getStatementCount());
		assertEquals(2, result.getData().getQueryResults().size());
		assertEquals(2, ((Number) result.getData().getQueryResults().getLast().getData().getFirst().get("second")).intValue());
	}

	@Test
	void persistsWritesFollowingBackslashesAndDoubledQuotes() {
		var result = service.execute("CREATE TABLE paths(value TEXT); INSERT INTO paths VALUES ('C:\\'); " +
				"INSERT INTO paths VALUES ('it''s\\'); SELECT * FROM paths;", db("slash_write"), true);
		assertNull(result.getError());
		assertEquals(4, result.getData().getMetadata().getStatementCount());
		var rows = result.getData().getTables().getFirst().getData();
		assertEquals(2, rows.size());
		assertEquals("C:\\", rows.getFirst().get("value"));
		assertEquals("it's\\", rows.getLast().get("value"));
	}

	@Test
	void quotedIdentifierSemicolonsDoNotPreventLaterWrites() {
		for (String identifier : new String[]{"[a;b]", "`a``;b`", "\"a\"\";b\""}) {
			var result = service.execute("CREATE TABLE " + identifier + "(id); INSERT INTO " + identifier +
					" VALUES(9); SELECT * FROM " + identifier + ";", db("quoted"), true);
			assertNull(result.getError(), identifier);
			assertEquals(3, result.getData().getMetadata().getStatementCount());
			assertEquals(9, ((Number) result.getData().getTables().getFirst().getData().getFirst().get("id")).intValue());
		}
	}
}
