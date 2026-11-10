package com.douzi.sqlive.service;

import com.douzi.sqlive.dto.SqlResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SqlExecutionServiceTransactionTest extends SqlExecutionServiceTestSupport {

	@Test
	void commitsEveryStatementInAnExplicitTransaction() {
		var response = service.execute("BEGIN; CREATE TABLE t(id INTEGER); INSERT INTO t VALUES(1); COMMIT; SELECT * FROM t;", db("tx_commit"), true);
		assertNull(response.getError());
		assertEquals(5, response.getData().getMetadata().getStatementCount());
		assertEquals(5, response.getData().getCanonicalStatements().size());
		assertEquals(1, response.getData().getQueryResults().getFirst().getData().size());
	}

	@Test
	void completedRollbackLeavesTheConnectionReadyForTheNextRequest() {
		String name = db("tx_rollback");
		assertNull(service.execute("CREATE TABLE t(id INTEGER); BEGIN; INSERT INTO t VALUES(1); ROLLBACK;", name, true).getError());
		var next = service.execute("BEGIN; INSERT INTO t VALUES(2); COMMIT; SELECT * FROM t;", name, false);
		assertNull(next.getError());
		assertEquals(1, next.getData().getQueryResults().getFirst().getData().size());
		assertEquals(2, next.getData().getQueryResults().getFirst().getData().getFirst().get("id"));
	}

	@Test
	void incompleteBeginAndSavepointAreRejectedAndRolledBack() {
		for (String start : new String[]{"BEGIN", "SAVEPOINT unfinished"}) {
			String name = db("tx_open_" + start.length());
			assertNull(service.execute("CREATE TABLE t(id INTEGER);", name, true).getError());
			var incomplete = service.execute(start + "; INSERT INTO t VALUES(1);", name, false);
			assertNotNull(incomplete.getError());
			assertTrue(incomplete.getError().getMessage().contains("within one request"));
			var next = service.execute("BEGIN; SELECT * FROM t; COMMIT;", name, false);
			assertNull(next.getError());
			assertTrue(next.getData().getQueryResults().getFirst().getData().isEmpty());
		}
	}

	@Test
	void failingTransactionCannotLeakWritesOrBreakResetAndForeignKeys() {
		String name = db("tx_failed");
		assertNull(service.execute("CREATE TABLE t(id INTEGER);", name, true).getError());
		assertNotNull(service.execute("BEGIN; INSERT INTO t VALUES(1); SELECT * FROM missing;", name, false).getError());
		var recovered = service.execute("BEGIN; SELECT * FROM t; COMMIT;", name, false);
		assertNull(recovered.getError());
		assertTrue(recovered.getData().getQueryResults().getFirst().getData().isEmpty());
		assertNull(service.execute("CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id));", name, true).getError());
		assertNotNull(service.execute("INSERT INTO child VALUES(99);", name, false).getError());
	}

	@Test
	void failedAndBlockedRecreatedSessionsKeepTheirMetadata() {
		SqlResponse failed = service.execute("SELECT * FROM missing;", db("recreated_error"), false);
		assertNotNull(failed.getError());
		assertTrue(failed.isSessionRecreated());
		SqlResponse blocked = service.execute("PRAGMA database_list;", db("recreated_block"), false);
		assertNotNull(blocked.getError());
		assertTrue(blocked.isSessionRecreated());
	}

	@Test
	void triggerBodiesRemainWholeInsideTransactions() {
		var response = service.execute("""
				BEGIN;
				CREATE TABLE source(id INTEGER);
				CREATE TABLE audit(id INTEGER);
				CREATE TEMP /* preserved */ TRIGGER track AFTER INSERT ON source BEGIN
				  INSERT INTO audit VALUES(CASE WHEN NEW.id > 0 THEN NEW.id ELSE 0 END);
				  INSERT INTO audit VALUES(2);
				END;
				INSERT INTO source VALUES(1);
				COMMIT;
				SELECT * FROM audit;
				""", db("tx_trigger"), true);
		assertNull(response.getError(), () -> String.valueOf(response.getError()));
		assertEquals(7, response.getData().getMetadata().getStatementCount());
		assertEquals(2, response.getData().getQueryResults().getFirst().getData().size());
	}
}
