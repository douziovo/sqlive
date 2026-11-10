package com.douzi.sqlive.service;

import com.douzi.sqlive.dto.SqlResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Session reset (clearDatabase) behaviour: dropping FK-related tables in the
 * correct order, handling populated FK cycles, and restoring foreign-key
 * enforcement afterwards.
 */
class SqlExecutionServiceResetTest extends SqlExecutionServiceTestSupport {

	@Test
	void shouldResetRelatedTables() {
		// Setup: parent + child with FK (child.pid REFERENCES parent(id))
		String setup = "CREATE TABLE parent (id INTEGER PRIMARY KEY); " +
				"CREATE TABLE child (id INTEGER PRIMARY KEY, pid INTEGER REFERENCES parent(id));";
		SqlResponse r1 = service.execute(setup, db("fksort"), true);
		assertTrue(r1.getError() == null, "setup should succeed");

		// Trigger clearDatabase via reset=true — must drop both tables.
		SqlResponse r2 = service.execute("SELECT 1;", db("fksort"), true);
		assertTrue(r2.getError() == null, "clearDatabase should succeed");

		// Verify both tables are gone (clearDatabase dropped all objects).
		SqlResponse r3 = service.execute(
				"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('parent','child');",
				db("fksort"), false);
		assertTrue(r3.getError() == null);
		assertTrue(r3.getData().getQueryResults().getFirst().getData().isEmpty(),
				"both parent and child should be dropped after clearDatabase");
	}

	@Test
	void shouldResetPopulatedForeignKeyCyclesAndRestoreEnforcement() {
		String name = db("fk_cycle");
		String setup = """
				CREATE TABLE a (id INTEGER PRIMARY KEY, bid INTEGER REFERENCES b(id));
				CREATE TABLE b (id INTEGER PRIMARY KEY, aid INTEGER REFERENCES a(id));
				INSERT INTO a VALUES (1, NULL);
				INSERT INTO b VALUES (1, 1);
				UPDATE a SET bid = 1;
				""";
		assertTrue(service.execute(setup, name, true).getError() == null);
		assertTrue(service.execute(setup, name, true).getError() == null, "reset must handle populated FK cycles");
		var invalid = service.execute("INSERT INTO a VALUES (2, 999);", name, false);
		assertFalse(invalid.getError() == null);
		assertTrue(invalid.getError().getMessage().contains("FOREIGN KEY"));
	}

}
