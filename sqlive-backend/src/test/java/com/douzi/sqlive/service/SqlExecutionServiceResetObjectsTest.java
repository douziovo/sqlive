package com.douzi.sqlive.service;

import com.douzi.sqlive.dto.SqlResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * clearDatabase must drop every schema object type: tables (already covered
 * by SqlExecutionServiceResetTest) as well as views and triggers.
 */
class SqlExecutionServiceResetObjectsTest extends SqlExecutionServiceTestSupport {
	@Test
	void resetRemovesTempTableBetweenThreeConsecutiveRequests() {
		String name = db("temp_reset");
		assertNull(service.execute("CREATE TEMP TABLE scratch(id); INSERT INTO scratch VALUES(9);", name, true).getError());
		assertNotNull(service.execute("SELECT * FROM scratch;", name, true).getError());
		var rerun = service.execute("CREATE TEMP TABLE scratch(id); INSERT INTO scratch VALUES(9);", name, true);
		assertNull(rerun.getError());
		assertEquals("scratch", rerun.getData().getTables().getFirst().getName());
		assertEquals(1, rerun.getData().getTables().getFirst().getData().size());
	}

	@Test
	void rerunsMainAndTempNamesViewsAndTriggersWithoutShadowingDrops() {
		String name = db("temp_shadow");
		String script = """
				CREATE TABLE scratch(id);
				INSERT INTO main.scratch VALUES(1);
				CREATE TEMP TABLE scratch(id);
				CREATE TEMP TRIGGER scratch_insert AFTER INSERT ON temp.scratch BEGIN SELECT 1; END;
				CREATE TEMP VIEW scratch_view AS SELECT * FROM scratch;
				INSERT INTO temp.scratch VALUES(9);
				""";
		for (int request = 0; request < 3; request++) {
			var result = service.execute(script, name, true);
			assertNull(result.getError(), "request " + request);
			assertEquals(1, result.getData().getTables().size(), "TEMP shadows main in unqualified metadata");
			assertEquals(9, ((Number) result.getData().getTables().getFirst().getData().getFirst().get("id")).intValue());
			assertEquals(1, result.getData().getViews().size());
			assertEquals(1, result.getData().getTriggers().size());
		}
		var reset = service.execute("SELECT (SELECT count(*) FROM main.sqlite_master WHERE name NOT LIKE 'sqlite_%') + " +
				"(SELECT count(*) FROM temp.sqlite_master WHERE name NOT LIKE 'sqlite_%') AS n;", name, true);
		assertNull(reset.getError());
		assertEquals(0, ((Number) reset.getData().getQueryResults().getFirst().getData().getFirst().get("n")).intValue());
	}

	@Test
	void resetDropsViewsAndTriggersBesidesTables() {
		String name = db("objreset");
		String setup = """
				CREATE TABLE t (a INTEGER);
				CREATE VIEW v_t AS SELECT a FROM t;
				CREATE TRIGGER trg_t AFTER INSERT ON t BEGIN SELECT 1; END;
				""";
		SqlResponse setupResponse = service.execute(setup, name, true);
		assertNull(setupResponse.getError(), "setup should succeed");

		SqlResponse resetResponse = service.execute("SELECT 1;", name, true);
		assertNull(resetResponse.getError(), "reset with view+trigger present should succeed");

		SqlResponse after = service.execute(
				"SELECT count(*) AS n FROM sqlite_master WHERE name IN ('v_t', 'trg_t', 't');",
				name, false);
		assertNull(after.getError());
		var row = after.getData().getQueryResults().getFirst().getData().getFirst();
		assertEquals(0L, ((Number) row.get("n")).longValue(), "view, trigger and table must all be dropped");
	}
}
