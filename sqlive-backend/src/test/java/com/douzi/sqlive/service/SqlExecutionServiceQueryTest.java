package com.douzi.sqlive.service;

import com.douzi.sqlive.dto.SqlResponse;
import com.douzi.sqlive.dto.TableSchema;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * SQL language feature coverage: DML (UPDATE/UPSERT), CTEs, set operations,
 * window functions, joins, scalar/aggregate/string/date/NULL functions, DDL
 * (ALTER/CTAS), CASE, subqueries, LIKE/GLOB, DISTINCT/LIMIT/OFFSET and trigger
 * parsing edge cases.
 */
class SqlExecutionServiceQueryTest extends SqlExecutionServiceTestSupport {

	// ============================================================
	//  DML — UPDATE / DELETE / UPSERT
	// ============================================================

	@Test
	void shouldExecuteUpdateAndModifyData() {
		SqlResponse r = service.execute(fullScript, db("update_test"), true);
		assertTrue(r.getError() == null);

		TableSchema employees = r.getData().getTables().stream()
				.filter(t -> t.getName().equals("employees")).findFirst().orElseThrow();

		// 张三's salary should be updated: 15000 * 1.1 = 16500
		Optional<Map<String, Object>> zhangsan = employees.getData().stream()
				.filter(row -> "张三".equals(row.get("name")))
				.findFirst();
		assertTrue(zhangsan.isPresent(), "张三 should still exist after UPSERT");
		assertEquals(16500.0, (Double) zhangsan.get().get("salary"), 0.01);
	}

	@Test
	void shouldHandleUpsertCorrectly() {
		SqlResponse r = service.execute(fullScript, db("upsert_test"), true);
		assertTrue(r.getError() == null);

		TableSchema employees = r.getData().getTables().stream()
				.filter(t -> t.getName().equals("employees")).findFirst().orElseThrow();

		// 张三 should have age=29 after UPSERT
		Optional<Map<String, Object>> zhangsan = employees.getData().stream()
				.filter(row -> "张三".equals(row.get("name")))
				.findFirst();
		assertTrue(zhangsan.isPresent());
		assertEquals(29, zhangsan.get().get("age"));
	}

	// ============================================================
	//  CTE / Recursive CTE
	// ============================================================

	@Test
	void shouldExecuteCteQueries() {
		// Extract and run just the CTE queries + table setup
		String cteSql = """
				CREATE TABLE employees (id INTEGER, name TEXT, salary REAL, dept_id INTEGER);
				CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);
				INSERT INTO departments VALUES (1, 'Tech'), (2, 'Sales');
				INSERT INTO employees VALUES (1, 'Alice', 7500, 1), (2, 'Bob', 5000, 2), (3, 'Charlie', 9000, 1);
				""";
		SqlResponse r = service.execute(cteSql, db("cte_test"), true);
		assertTrue(r.getError() == null);

		// Regular CTE
		r = service.execute("""
				WITH dept_total AS (
				    SELECT dept_id, SUM(salary) AS total_salary FROM employees GROUP BY dept_id
				)
				SELECT d.name, dt.total_salary FROM dept_total dt JOIN departments d ON d.id = dt.dept_id;
				""", db("cte_test"), false);
		assertTrue(r.getError() == null);
		assertFalse(r.getData().getQueryResults().isEmpty());
	}

	@Test
	void shouldExecuteRecursiveCte() {
		SqlResponse r = service.execute("""
				WITH RECURSIVE seq(n) AS (
				    SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 10
				)
				SELECT n, n * n AS square FROM seq;
				""", db("rec_cte_test"), true);
		assertTrue(r.getError() == null);
		assertEquals(1, r.getData().getQueryResults().size());
		assertEquals(10, r.getData().getQueryResults().getFirst().getData().size());
	}

	// ============================================================
	//  Set operations
	// ============================================================

	@Test
	void shouldExecuteIntersectAndExcept() {
		String setup = """
				CREATE TABLE a (x INTEGER); INSERT INTO a VALUES (1), (2), (3);
				CREATE TABLE b (x INTEGER); INSERT INTO b VALUES (2), (3), (4);
				""";
		service.execute(setup, db("setop_test"), true);

		SqlResponse r1 = service.execute("SELECT x FROM a INTERSECT SELECT x FROM b;", db("setop_test"), false);
		assertTrue(r1.getError() == null);
		assertEquals(2, r1.getData().getQueryResults().getFirst().getData().size());

		SqlResponse r2 = service.execute("SELECT x FROM a EXCEPT SELECT x FROM b;", db("setop_test"), false);
		assertTrue(r2.getError() == null);
		assertEquals(1, r2.getData().getQueryResults().getFirst().getData().size());
	}

	// ============================================================
	//  Window functions (all variants)
	// ============================================================

	@Test
	void shouldExecuteRankingFunctions() {
		String setup = """
				CREATE TABLE t (name TEXT, dept_id INTEGER, salary REAL);
				INSERT INTO t VALUES ('Alice', 1, 100), ('Bob', 1, 200), ('Charlie', 2, 150), ('David', 2, 300);
				""";
		service.execute(setup, db("window_test"), true);

		SqlResponse r = service.execute("""
				SELECT name, salary,
				    ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn,
				    RANK()       OVER (ORDER BY salary DESC) AS rk,
				    DENSE_RANK() OVER (ORDER BY salary DESC) AS dr,
				    NTILE(2)     OVER (ORDER BY salary DESC) AS nt
				FROM t;
				""", db("window_test"), false);
		assertTrue(r.getError() == null);
	}

	@Test
	void shouldExecuteLagLead() {
		String setup = """
				CREATE TABLE t (name TEXT, salary REAL);
				INSERT INTO t VALUES ('Alice', 100), ('Bob', 200), ('Charlie', 150), ('David', 300);
				""";
		service.execute(setup, db("window_test"), true);

		SqlResponse r = service.execute("""
				SELECT name, salary,
				    LAG(salary, 1, 0)  OVER (ORDER BY salary) AS prev,
				    LEAD(salary, 1, 0) OVER (ORDER BY salary) AS next
				FROM t;
				""", db("window_test"), false);
		assertTrue(r.getError() == null);
	}

	@Test
	void shouldExecuteFirstLastValue() {
		String setup = """
				CREATE TABLE t (name TEXT, salary REAL);
				INSERT INTO t VALUES ('Alice', 100), ('Bob', 200), ('Charlie', 150), ('David', 300);
				""";
		service.execute(setup, db("window_test"), true);

		SqlResponse r = service.execute("""
				SELECT name, salary,
				    FIRST_VALUE(name) OVER (ORDER BY salary DESC) AS highest,
				    LAST_VALUE(name) OVER (ORDER BY salary DESC
				        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS lowest
				FROM t;
				""", db("window_test"), false);
		assertTrue(r.getError() == null);
	}

	@Test
	void shouldExecuteCumeDistPercentRank() {
		String setup = """
				CREATE TABLE t (name TEXT, salary REAL);
				INSERT INTO t VALUES ('Alice', 100), ('Bob', 200), ('Charlie', 150), ('David', 300);
				""";
		service.execute(setup, db("window_test"), true);

		SqlResponse r = service.execute("""
				SELECT name, ROUND(CUME_DIST() OVER (ORDER BY salary), 3) AS cd,
				    ROUND(PERCENT_RANK() OVER (ORDER BY salary), 3) AS pr
				FROM t;
				""", db("window_test"), false);
		assertTrue(r.getError() == null);
	}

	// ============================================================
	//  JOIN types
	// ============================================================

	@Test
	void shouldExecuteCrossJoin() {
		String setup = """
				CREATE TABLE a (id INTEGER, name TEXT); INSERT INTO a VALUES (1, 'X'), (2, 'Y');
				CREATE TABLE b (id INTEGER, val TEXT); INSERT INTO b VALUES (1, 'foo'), (3, 'bar');
				""";
		service.execute(setup, db("join_test"), true);

		SqlResponse r = service.execute("SELECT * FROM a CROSS JOIN b;", db("join_test"), false);
		assertTrue(r.getError() == null);
		assertEquals(4, r.getData().getQueryResults().getFirst().getData().size());
	}

	@Test
	void shouldExecuteLeftJoin() {
		String setup = """
				CREATE TABLE a (id INTEGER, name TEXT); INSERT INTO a VALUES (1, 'X'), (2, 'Y');
				CREATE TABLE b (id INTEGER, val TEXT); INSERT INTO b VALUES (1, 'foo'), (3, 'bar');
				""";
		service.execute(setup, db("join_test"), true);

		SqlResponse r = service.execute("SELECT a.name, b.val FROM a LEFT JOIN b ON a.id = b.id;", db("join_test"), false);
		assertTrue(r.getError() == null);
	}

	// ============================================================
	//  NULL functions
	// ============================================================

	@Test
	void shouldExecuteNullFunctions() {
		SqlResponse r = service.execute("""
				SELECT
				    COALESCE(NULL, NULL, 'third', 'fourth') AS c,
				    IFNULL(NULL, 'default') AS i,
				    NULLIF(10, 10) AS n1,
				    NULLIF(10, 20) AS n2;
				""", db("null_test"), true);
		assertTrue(r.getError() == null);
		Map<String, Object> row = r.getData().getQueryResults().getFirst().getData().getFirst();
		assertEquals("third", row.get("c"));
		assertEquals("default", row.get("i"));
		assertNull(row.get("n1"));
		assertEquals(10, row.get("n2"));
	}

	// ============================================================
	//  String functions
	// ============================================================

	@Test
	void shouldExecuteStringFunctions() {
		SqlResponse r = service.execute("""
				SELECT
				    UPPER('hello') AS u,
				    LOWER('WORLD') AS l,
				    LENGTH('test') AS len,
				    SUBSTR('abcdef', 1, 3) AS sub,
				    REPLACE('a-b-c', '-', '/') AS rep,
				    TRIM('  x  ') AS tr,
				    'A' || 'B' AS concat;
				""", db("str_test"), true);
		assertTrue(r.getError() == null);
		Map<String, Object> row = r.getData().getQueryResults().getFirst().getData().getFirst();
		assertEquals("HELLO", row.get("u"));
		assertEquals("world", row.get("l"));
		assertEquals(4, row.get("len"));
		assertEquals("abc", row.get("sub"));
		assertEquals("a/b/c", row.get("rep"));
		assertEquals("x", row.get("tr"));
		assertEquals("AB", row.get("concat"));
	}

	// ============================================================
	//  Date / time functions
	// ============================================================

	@Test
	void shouldExecuteDateTimeFunctions() {
		SqlResponse r = service.execute("""
				SELECT
				    date('now') AS d,
				    time('now') AS t,
				    datetime('now') AS dt,
				    datetime('now', '+1 day') AS tomorrow,
				    datetime('now', '-7 days') AS week_ago,
				    strftime('%Y-%m-%d', 'now') AS fmt,
				    julianday('now') AS jd;
				""", db("dt_test"), true);
		assertTrue(r.getError() == null);
		Map<String, Object> row = r.getData().getQueryResults().getFirst().getData().getFirst();
		assertNotNull(row.get("d"));
		assertNotNull(row.get("t"));
		assertNotNull(row.get("fmt"));
	}

	// ============================================================
	//  Math / aggregate functions
	// ============================================================

	@Test
	void shouldExecuteAggregateFunctions() {
		String setup = "CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1), (2), (3), (4), (5);";
		service.execute(setup, db("agg_test"), true);
		SqlResponse r = service.execute("""
				SELECT COUNT(*) AS cnt, COUNT(DISTINCT x) AS dc, SUM(x) AS s,
				    ROUND(AVG(x), 2) AS a, MIN(x) AS mn, MAX(x) AS mx,
				    GROUP_CONCAT(x, ',') AS gc, TOTAL(x) AS tot
				FROM t;
				""", db("agg_test"), false);
		assertTrue(r.getError() == null);
		Map<String, Object> row = r.getData().getQueryResults().getFirst().getData().getFirst();
		assertEquals(5, row.get("cnt"));
		assertEquals(5, row.get("dc"));
		assertEquals(15.0, ((Number) row.get("s")).doubleValue(), 0.01);
		assertEquals("1,2,3,4,5", row.get("gc"));
	}

	// ============================================================
	//  DDL — ALTER / CREATE TABLE AS
	// ============================================================

	@Test
	void shouldExecuteAlterTable() {
		SqlResponse r = service.execute("""
				CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT);
				INSERT INTO t VALUES (1, 'test');
				ALTER TABLE t ADD COLUMN email TEXT DEFAULT 'no-email';
				""", db("alter_test"), true);
		assertTrue(r.getError() == null);
		TableSchema t = r.getData().getTables().getFirst();
		assertTrue(t.getColumns().contains("email"), "Should have new column 'email'");
	}

	@Test
	void shouldExecuteCreateTableAsSelect() {
		SqlResponse r = service.execute("""
				CREATE TABLE src (x INTEGER, y TEXT);
				INSERT INTO src VALUES (1, 'a'), (2, 'b');
				CREATE TABLE copy AS SELECT * FROM src;
				""", db("ctas_test"), true);
		assertTrue(r.getError() == null);
		assertEquals(2, r.getData().getTables().size());
		TableSchema copy = r.getData().getTables().stream()
				.filter(t -> t.getName().equals("copy")).findFirst().orElseThrow();
		assertEquals(2, copy.getData().size());
	}

	// ============================================================
	//  CASE expression
	// ============================================================

	@Test
	void shouldExecuteCaseExpression() {
		String setup = "CREATE TABLE t (name TEXT, score INTEGER); INSERT INTO t VALUES ('A', 90), ('B', 70), ('C', 50);";
		service.execute(setup, db("case_test"), true);
		SqlResponse r = service.execute("""
				SELECT name, score,
				    CASE WHEN score >= 80 THEN '优秀'
				         WHEN score >= 60 THEN '及格'
				         ELSE '不及格' END AS grade
				FROM t ORDER BY score DESC;
				""", db("case_test"), false);
		assertTrue(r.getError() == null);
		assertEquals("优秀", r.getData().getQueryResults().getFirst().getData().getFirst().get("grade"));
	}

	// ============================================================
	//  Subquery types
	// ============================================================

	@Test
	void shouldExecuteCorrelatedSubquery() {
		String setup = """
				CREATE TABLE dept (id INTEGER, name TEXT); INSERT INTO dept VALUES (1, 'IT'), (2, 'HR');
				CREATE TABLE emp (id INTEGER, name TEXT, salary REAL, dept_id INTEGER);
				INSERT INTO emp VALUES (1, 'Alice', 100, 1), (2, 'Bob', 200, 1), (3, 'Charlie', 150, 2);
				""";
		service.execute(setup, db("subq_test"), true);
		SqlResponse r = service.execute("""
				SELECT e.name, e.salary FROM emp e
				WHERE e.salary > (SELECT AVG(e2.salary) FROM emp e2 WHERE e2.dept_id = e.dept_id);
				""", db("subq_test"), false);
		assertTrue(r.getError() == null);
	}

	@Test
	void shouldExecuteScalarSubqueryInSelect() {
		String setup = "CREATE TABLE t (name TEXT, salary REAL); INSERT INTO t VALUES ('A', 100), ('B', 200);";
		service.execute(setup, db("scalar_test"), true);
		SqlResponse r = service.execute("""
				SELECT name, salary,
				    (SELECT ROUND(AVG(salary), 2) FROM t) AS avg_all,
				    ROUND(salary - (SELECT AVG(salary) FROM t), 2) AS diff
				FROM t;
				""", db("scalar_test"), false);
		assertTrue(r.getError() == null);
	}

	// ============================================================
	//  LIKE / GLOB
	// ============================================================

	@Test
	void shouldExecuteLikeAndGlob() {
		String setup = "CREATE TABLE t (name TEXT); INSERT INTO t VALUES ('张三'), ('李四'), ('王五');";
		service.execute(setup, db("like_test"), true);

		SqlResponse r = service.execute("SELECT * FROM t WHERE name LIKE '张%';", db("like_test"), false);
		assertTrue(r.getError() == null);
		assertEquals(1, r.getData().getQueryResults().getFirst().getData().size());
	}

	// ============================================================
	//  DISTINCT / LIMIT / OFFSET
	// ============================================================

	@Test
	void shouldExecuteDistinctLimitOffset() {
		String setup = "CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1), (1), (2), (2), (3);";
		service.execute(setup, db("dlo_test"), true);

		SqlResponse r = service.execute("SELECT DISTINCT x FROM t ORDER BY x;", db("dlo_test"), false);
		assertTrue(r.getError() == null);
		assertEquals(3, r.getData().getQueryResults().getFirst().getData().size());

		r = service.execute("SELECT * FROM t LIMIT 2;", db("dlo_test"), false);
		assertEquals(2, r.getData().getQueryResults().getFirst().getData().size());

		r = service.execute("SELECT * FROM t LIMIT 2 OFFSET 2;", db("dlo_test"), false);
		assertEquals(2, r.getData().getQueryResults().getFirst().getData().size());
	}

	// ============================================================
	//  Parsing: triggers with BEGIN...END and CASE...END
	// ============================================================

	@Test
	void shouldParseTriggerWithNestedCaseEnd() {
		String sql = """
				CREATE TABLE t (val REAL, start_date TEXT, end_date TEXT);
				CREATE TRIGGER trg_t_default_end
				BEFORE INSERT ON t
				BEGIN
				    UPDATE t SET end_date = CASE
				        WHEN NEW.end_date IS NULL AND NEW.start_date IS NOT NULL
				        THEN date(NEW.start_date, '+1 year')
				        ELSE NEW.end_date
				    END
				    WHERE rowid = NEW.rowid;
				END;
				""";
		SqlResponse r = service.execute(sql, db("parse_trigger_test"), true);
		assertTrue(r.getError() == null, "Should parse trigger with CASE...END inside BEGIN...END");
		assertEquals(1, r.getData().getTriggers().size());
	}

	@Test
	void shouldParseMultipleTriggersWithInsertStatements() {
		String sql = """
				CREATE TABLE t (id INTEGER, name TEXT, salary REAL);
				CREATE TABLE log (msg TEXT);
				
				CREATE TRIGGER trg1 AFTER INSERT ON t
				BEGIN
				    INSERT INTO log (msg) VALUES ('insert ' || NEW.name);
				END;
				
				CREATE TRIGGER trg2 AFTER UPDATE ON t
				BEGIN
				    INSERT INTO log (msg) VALUES ('update ' || OLD.name || ' -> ' || NEW.name);
				END;
				
				CREATE TRIGGER trg3 AFTER DELETE ON t
				BEGIN
				    INSERT INTO log (msg) VALUES ('delete ' || OLD.name);
				END;
				""";
		SqlResponse r = service.execute(sql, db("multi_trg_test"), true);
		assertTrue(r.getError() == null, "Should parse 3 triggers correctly");
		assertEquals(3, r.getData().getTriggers().size());
	}

	// ============================================================
	//  Recursive CTE with org tree
	// ============================================================

	@Test
	void shouldExecuteRecursiveOrgTree() {
		String sql = """
				CREATE TABLE org (id INTEGER PRIMARY KEY, name TEXT, parent_id INTEGER);
				INSERT INTO org VALUES (1, '总公司', NULL), (2, '技术部', 1),
				    (3, '前端组', 2), (4, '后端组', 2), (5, '市场部', 1);
				
				WITH RECURSIVE org_path(id, name, path, level) AS (
				    SELECT id, name, name, 0 FROM org WHERE parent_id IS NULL
				    UNION ALL
				    SELECT t.id, t.name, op.path || ' > ' || t.name, op.level + 1
				    FROM org t JOIN org_path op ON t.parent_id = op.id
				)
				SELECT id, path, level FROM org_path ORDER BY id;
				""";
		SqlResponse r = service.execute(sql, db("org_test"), true);
		assertTrue(r.getError() == null);
		var rows = r.getData().getQueryResults().getFirst().getData();
		assertEquals(5, rows.size());
		// Check that the path contains hierarchy
		String backendPath = (String) rows.get(3).get("path"); // id=4, 后端组
		assertTrue(backendPath.contains("技术部"), "Path should include parent department");
	}

}
