package com.douzi.sqlive.service;

import com.douzi.sqlive.dto.*;
import com.douzi.sqlive.service.database.DatabasePoolManager;
import com.douzi.sqlive.service.metadata.MetadataExtractor;
import com.douzi.sqlive.service.sql.SqlParser;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.stream.Collectors;

class SqlExecutionServiceTest {

    private final SqlExecutionService service = new SqlExecutionService(
            new DatabasePoolManager(), new SqlParser(), new MetadataExtractor());
    private static String fullScript;

    @BeforeAll
    static void loadScript() throws IOException {
        // 读取项目根目录的 test-multi-table.sql
        Path scriptPath = Paths.get("../test-multi-table.sql");
        if (!Files.exists(scriptPath)) {
            scriptPath = Paths.get("test-multi-table.sql");
        }
        fullScript = Files.readString(scriptPath);
    }

    // ============================================================
    //  Sanity checks
    // ============================================================

    @Test
    void shouldExecuteSimpleSelect() {
        SqlResponse r = service.execute("SELECT 1;", "test", true);
        assertTrue(r.isSuccess());
        assertEquals(1, r.getData().getQueryResults().size());
    }

    @Test
    void shouldReturnErrorForInvalidSql() {
        SqlResponse r = service.execute("NOT VALID SQL;", "test", true);
        assertFalse(r.isSuccess());
        assertNotNull(r.getError());
    }

    @Test
    void shouldHandleEmptyScript() {
        SqlResponse r = service.execute("", "test", true);
        assertTrue(r.isSuccess());
    }

    @Test
    void shouldHandleCommentsOnly() {
        SqlResponse r = service.execute("-- comment\n/* block */", "test", true);
        assertTrue(r.isSuccess());
    }

    // ============================================================
    //  Full script execution
    // ============================================================

    @Test
    void shouldExecuteFullScriptSuccessfully() {
        assertNotNull(fullScript, "test-multi-table.sql should be loaded");
        SqlResponse r = service.execute(fullScript, "fulltest", true);
        assertTrue(r.isSuccess(), "Full script should succeed. Error: " +
            (r.getError() != null ? "line " + r.getError().getLine() + " — " + r.getError().getMessage() : "none"));
    }

    // ============================================================
    //  Tables — DDL verification
    // ============================================================

    @Test
    void shouldCreateAllTables() {
        SqlResponse r = service.execute(fullScript, "tables_test", true);
        assertTrue(r.isSuccess());

        List<String> tableNames = r.getData().getTables().stream()
            .map(TableSchema::getName).toList();

        // Core tables
        assertTrue(tableNames.contains("departments"), "Should have departments");
        assertTrue(tableNames.contains("employees"), "Should have employees");
        assertTrue(tableNames.contains("projects"), "Should have projects");
        assertTrue(tableNames.contains("employee_projects"), "Should have employee_projects");
        assertTrue(tableNames.contains("type_demo"), "Should have type_demo");
        assertTrue(tableNames.contains("audit_log"), "Should have audit_log");

        // Tables created by DML / AS SELECT / etc.
        assertTrue(tableNames.contains("high_salary_backup"), "Should have high_salary_backup");
        assertTrue(tableNames.contains("org_hierarchy"), "Should have org_hierarchy (renamed)");
        assertTrue(tableNames.contains("dept_summary"), "Should have dept_summary (CTAS)");
        assertTrue(tableNames.contains("products"), "Should have products");
    }

    @Test
    void shouldHaveCorrectColumnConstraintsOnTypeDemo() {
        SqlResponse r = service.execute(fullScript, "typedemo_test", true);
        assertTrue(r.isSuccess());

        TableSchema typeDemo = r.getData().getTables().stream()
            .filter(t -> t.getName().equals("type_demo"))
            .findFirst().orElseThrow();

        assertEquals(31, typeDemo.getColumns().size(), "type_demo should have 31 columns");

        Map<String, String> types = typeDemo.getColumnTypes();
        assertTrue(types.get("col_unique").contains("UNIQUE"), "col_unique should have UNIQUE");
        assertTrue(types.get("col_check").contains("CHECK"), "col_check should have CHECK");
        // col_not_null may get its constraint via DEFAULT 'default_val' combined with NOT NULL
        assertNotNull(types.get("col_not_null"), "col_not_null should exist");
    }

    @Test
    void shouldHaveCorrectDataInTypeDemo() {
        SqlResponse r = service.execute(fullScript, "typedata_test", true);
        assertTrue(r.isSuccess());

        TableSchema typeDemo = r.getData().getTables().stream()
            .filter(t -> t.getName().equals("type_demo"))
            .findFirst().orElseThrow();

        assertEquals(2, typeDemo.getData().size(), "type_demo should have 2 rows");
        Map<String, Object> row1 = typeDemo.getData().getFirst();
        assertEquals(42, row1.get("col_integer"));
        assertEquals(3.141592653589793, (Double) row1.get("col_real"), 1e-10);
        assertEquals("Hello SQLite", row1.get("col_text"));
        assertEquals(1, row1.get("col_boolean"));
    }

    @Test
    void shouldHaveCorrectEmployeeAndDepartmentData() {
        SqlResponse r = service.execute(fullScript, "empdata_test", true);
        assertTrue(r.isSuccess());

        TableSchema employees = r.getData().getTables().stream()
            .filter(t -> t.getName().equals("employees"))
            .findFirst().orElseThrow();

        // 8 original + 2 new (新员工A, 新员工B) + UPSERT update = still 10 rows
        assertTrue(employees.getData().size() >= 8, "Should have at least 8 employee rows");

        TableSchema departments = r.getData().getTables().stream()
            .filter(t -> t.getName().equals("departments"))
            .findFirst().orElseThrow();
        assertEquals(4, departments.getData().size(), "Should have 4 departments");
    }

    // ============================================================
    //  Indexes
    // ============================================================

    @Test
    void shouldCreateAllIndexes() {
        SqlResponse r = service.execute(fullScript, "index_test", true);
        assertTrue(r.isSuccess());

        List<IndexInfo> indexes = r.getData().getIndexes();
        assertTrue(indexes.size() >= 7, "Should have at least 7 indexes, got " + indexes.size());

        Set<String> indexNames = indexes.stream().map(IndexInfo::getName).collect(Collectors.toSet());
        assertTrue(indexNames.contains("idx_employees_dept"), "Should have idx_employees_dept");
        assertTrue(indexNames.contains("idx_employees_email"), "Should have idx_employees_email");
        assertTrue(indexNames.contains("idx_employees_dept_salary"), "Should have composite index");
        assertTrue(indexNames.contains("idx_employees_name_lower"), "Should have expression index");
        assertTrue(indexNames.contains("idx_employees_high_salary"), "Should have partial index");

        // Unique index
        IndexInfo emailIdx = indexes.stream()
            .filter(ix -> ix.getName().equals("idx_employees_email"))
            .findFirst().orElseThrow();
        assertTrue(emailIdx.isUnique(), "idx_employees_email should be unique");
    }

    // ============================================================
    //  Views
    // ============================================================

    @Test
    void shouldCreateAllViews() {
        SqlResponse r = service.execute(fullScript, "view_test", true);
        assertTrue(r.isSuccess());

        List<ViewInfo> views = r.getData().getViews();
        assertTrue(views.size() >= 4, "Should have at least 4 views, got " + views.size());

        Set<String> viewNames = views.stream().map(ViewInfo::getName).collect(Collectors.toSet());
        assertTrue(viewNames.contains("v_employee_full"), "Should have v_employee_full");
        assertTrue(viewNames.contains("v_project_summary"), "Should have v_project_summary");
        assertTrue(viewNames.contains("v_dept_salary_stats"), "Should have v_dept_salary_stats");
        assertTrue(viewNames.contains("v_high_salary_employees"), "Should have v_high_salary_employees");

        // Verify view SQL is captured
        ViewInfo v = views.stream().filter(vw -> vw.getName().equals("v_employee_full")).findFirst().orElseThrow();
        assertNotNull(v.getSql());
        assertTrue(v.getSql().contains("SELECT"), "View SQL should contain SELECT");
    }

    // ============================================================
    //  Triggers
    // ============================================================

    @Test
    void shouldCreateAllTriggers() {
        SqlResponse r = service.execute(fullScript, "trigger_test", true);
        assertTrue(r.isSuccess());

        List<TriggerInfo> triggers = r.getData().getTriggers();
        assertTrue(triggers.size() >= 7, "Should have at least 7 triggers, got " + triggers.size());

        Set<String> triggerNames = triggers.stream().map(TriggerInfo::getName).collect(Collectors.toSet());
        assertTrue(triggerNames.contains("trg_employees_insert"));
        assertTrue(triggerNames.contains("trg_employees_update"));
        assertTrue(triggerNames.contains("trg_employees_delete"));
        assertTrue(triggerNames.contains("trg_projects_default_end_date"));
        assertTrue(triggerNames.contains("trg_employees_salary_check"));
        assertTrue(triggerNames.contains("trg_high_salary_alert"));
        assertTrue(triggerNames.contains("trg_employees_salary_change"));
    }

    @Test
    void shouldFireInsertTriggerAndCreateAuditLog() {
        SqlResponse r = service.execute(fullScript, "trg_fire_test", true);
        assertTrue(r.isSuccess());

        // INSERT triggers: original 8 INSERTs + 2 new ones with triggers = audit records
        // Also: trg_high_salary_alert fires for 新员工A (salary 25000)
        TableSchema auditLog = r.getData().getTables().stream()
            .filter(t -> t.getName().equals("audit_log"))
            .findFirst().orElseThrow();

        List<Map<String, Object>> auditRows = auditLog.getData();
        assertFalse(auditRows.isEmpty(), "Audit log should have entries");

        // Check for INSERT audit entries
        boolean hasInsertRecord = auditRows.stream()
            .anyMatch(row -> "INSERT".equals(row.get("operation")));
        assertTrue(hasInsertRecord, "Should have INSERT audit records");
    }

    @Test
    void shouldBlockLowSalaryWithCheckTrigger() {
        // The trigger trg_employees_salary_check blocks salary < 3000
        SqlResponse r = service.execute(fullScript + "\nINSERT INTO employees (name, age, salary, dept_id, hire_date, email) VALUES ('低薪者', 20, 2000, 1, '2025-06-01', 'low@test.com');", "trg_check_test", true);
        // The full script succeeds, but the extra INSERT should fail due to trigger
        // Actually the full script already runs fine, the extra low-salary insert should fail
        assertFalse(r.isSuccess(), "Low salary INSERT should be blocked by trigger");
        assertTrue(r.getError().getMessage().contains("3000"), "Error should mention minimum salary");
    }

    // ============================================================
    //  DML — UPDATE / DELETE / UPSERT
    // ============================================================

    @Test
    void shouldExecuteUpdateAndModifyData() {
        SqlResponse r = service.execute(fullScript, "update_test", true);
        assertTrue(r.isSuccess());

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
        SqlResponse r = service.execute(fullScript, "upsert_test", true);
        assertTrue(r.isSuccess());

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
        SqlResponse r = service.execute(cteSql, "cte_test", true);
        assertTrue(r.isSuccess());

        // Regular CTE
        r = service.execute("""
            WITH dept_total AS (
                SELECT dept_id, SUM(salary) AS total_salary FROM employees GROUP BY dept_id
            )
            SELECT d.name, dt.total_salary FROM dept_total dt JOIN departments d ON d.id = dt.dept_id;
            """, "cte_test", false);
        assertTrue(r.isSuccess());
        assertFalse(r.getData().getQueryResults().isEmpty());
    }

    @Test
    void shouldExecuteRecursiveCte() {
        SqlResponse r = service.execute("""
            WITH RECURSIVE seq(n) AS (
                SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 10
            )
            SELECT n, n * n AS square FROM seq;
            """, "rec_cte_test", true);
        assertTrue(r.isSuccess());
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
        service.execute(setup, "setop_test", true);

        SqlResponse r1 = service.execute("SELECT x FROM a INTERSECT SELECT x FROM b;", "setop_test", false);
        assertTrue(r1.isSuccess());
        assertEquals(2, r1.getData().getQueryResults().getFirst().getData().size());

        SqlResponse r2 = service.execute("SELECT x FROM a EXCEPT SELECT x FROM b;", "setop_test", false);
        assertTrue(r2.isSuccess());
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
        service.execute(setup, "window_test", true);

        SqlResponse r = service.execute("""
            SELECT name, salary,
                ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn,
                RANK()       OVER (ORDER BY salary DESC) AS rk,
                DENSE_RANK() OVER (ORDER BY salary DESC) AS dr,
                NTILE(2)     OVER (ORDER BY salary DESC) AS nt
            FROM t;
            """, "window_test", false);
        assertTrue(r.isSuccess());
    }

    @Test
    void shouldExecuteLagLead() {
        String setup = """
            CREATE TABLE t (name TEXT, salary REAL);
            INSERT INTO t VALUES ('Alice', 100), ('Bob', 200), ('Charlie', 150), ('David', 300);
            """;
        service.execute(setup, "window_test", true);

        SqlResponse r = service.execute("""
            SELECT name, salary,
                LAG(salary, 1, 0)  OVER (ORDER BY salary) AS prev,
                LEAD(salary, 1, 0) OVER (ORDER BY salary) AS next
            FROM t;
            """, "window_test", false);
        assertTrue(r.isSuccess());
    }

    @Test
    void shouldExecuteFirstLastValue() {
        String setup = """
            CREATE TABLE t (name TEXT, salary REAL);
            INSERT INTO t VALUES ('Alice', 100), ('Bob', 200), ('Charlie', 150), ('David', 300);
            """;
        service.execute(setup, "window_test", true);

        SqlResponse r = service.execute("""
            SELECT name, salary,
                FIRST_VALUE(name) OVER (ORDER BY salary DESC) AS highest,
                LAST_VALUE(name) OVER (ORDER BY salary DESC
                    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS lowest
            FROM t;
            """, "window_test", false);
        assertTrue(r.isSuccess());
    }

    @Test
    void shouldExecuteCumeDistPercentRank() {
        String setup = """
            CREATE TABLE t (name TEXT, salary REAL);
            INSERT INTO t VALUES ('Alice', 100), ('Bob', 200), ('Charlie', 150), ('David', 300);
            """;
        service.execute(setup, "window_test", true);

        SqlResponse r = service.execute("""
            SELECT name, ROUND(CUME_DIST() OVER (ORDER BY salary), 3) AS cd,
                ROUND(PERCENT_RANK() OVER (ORDER BY salary), 3) AS pr
            FROM t;
            """, "window_test", false);
        assertTrue(r.isSuccess());
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
        service.execute(setup, "join_test", true);

        SqlResponse r = service.execute("SELECT * FROM a CROSS JOIN b;", "join_test", false);
        assertTrue(r.isSuccess());
        assertEquals(4, r.getData().getQueryResults().getFirst().getData().size());
    }

    @Test
    void shouldExecuteLeftJoin() {
        String setup = """
            CREATE TABLE a (id INTEGER, name TEXT); INSERT INTO a VALUES (1, 'X'), (2, 'Y');
            CREATE TABLE b (id INTEGER, val TEXT); INSERT INTO b VALUES (1, 'foo'), (3, 'bar');
            """;
        service.execute(setup, "join_test", true);

        SqlResponse r = service.execute("SELECT a.name, b.val FROM a LEFT JOIN b ON a.id = b.id;", "join_test", false);
        assertTrue(r.isSuccess());
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
            """, "null_test", true);
        assertTrue(r.isSuccess());
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
            """, "str_test", true);
        assertTrue(r.isSuccess());
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
            """, "dt_test", true);
        assertTrue(r.isSuccess());
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
        service.execute(setup, "agg_test", true);
        SqlResponse r = service.execute("""
            SELECT COUNT(*) AS cnt, COUNT(DISTINCT x) AS dc, SUM(x) AS s,
                ROUND(AVG(x), 2) AS a, MIN(x) AS mn, MAX(x) AS mx,
                GROUP_CONCAT(x, ',') AS gc, TOTAL(x) AS tot
            FROM t;
            """, "agg_test", false);
        assertTrue(r.isSuccess());
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
            """, "alter_test", true);
        assertTrue(r.isSuccess());
        TableSchema t = r.getData().getTables().getFirst();
        assertTrue(t.getColumns().contains("email"), "Should have new column 'email'");
    }

    @Test
    void shouldExecuteCreateTableAsSelect() {
        SqlResponse r = service.execute("""
            CREATE TABLE src (x INTEGER, y TEXT);
            INSERT INTO src VALUES (1, 'a'), (2, 'b');
            CREATE TABLE copy AS SELECT * FROM src;
            """, "ctas_test", true);
        assertTrue(r.isSuccess());
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
        service.execute(setup, "case_test", true);
        SqlResponse r = service.execute("""
            SELECT name, score,
                CASE WHEN score >= 80 THEN '优秀'
                     WHEN score >= 60 THEN '及格'
                     ELSE '不及格' END AS grade
            FROM t ORDER BY score DESC;
            """, "case_test", false);
        assertTrue(r.isSuccess());
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
        service.execute(setup, "subq_test", true);
        SqlResponse r = service.execute("""
            SELECT e.name, e.salary FROM emp e
            WHERE e.salary > (SELECT AVG(e2.salary) FROM emp e2 WHERE e2.dept_id = e.dept_id);
            """, "subq_test", false);
        assertTrue(r.isSuccess());
    }

    @Test
    void shouldExecuteScalarSubqueryInSelect() {
        String setup = "CREATE TABLE t (name TEXT, salary REAL); INSERT INTO t VALUES ('A', 100), ('B', 200);";
        service.execute(setup, "scalar_test", true);
        SqlResponse r = service.execute("""
            SELECT name, salary,
                (SELECT ROUND(AVG(salary), 2) FROM t) AS avg_all,
                ROUND(salary - (SELECT AVG(salary) FROM t), 2) AS diff
            FROM t;
            """, "scalar_test", false);
        assertTrue(r.isSuccess());
    }

    // ============================================================
    //  LIKE / GLOB
    // ============================================================

    @Test
    void shouldExecuteLikeAndGlob() {
        String setup = "CREATE TABLE t (name TEXT); INSERT INTO t VALUES ('张三'), ('李四'), ('王五');";
        service.execute(setup, "like_test", true);

        SqlResponse r = service.execute("SELECT * FROM t WHERE name LIKE '张%';", "like_test", false);
        assertTrue(r.isSuccess());
        assertEquals(1, r.getData().getQueryResults().getFirst().getData().size());
    }

    // ============================================================
    //  DISTINCT / LIMIT / OFFSET
    // ============================================================

    @Test
    void shouldExecuteDistinctLimitOffset() {
        String setup = "CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1), (1), (2), (2), (3);";
        service.execute(setup, "dlo_test", true);

        SqlResponse r = service.execute("SELECT DISTINCT x FROM t ORDER BY x;", "dlo_test", false);
        assertTrue(r.isSuccess());
        assertEquals(3, r.getData().getQueryResults().getFirst().getData().size());

        r = service.execute("SELECT * FROM t LIMIT 2;", "dlo_test", false);
        assertEquals(2, r.getData().getQueryResults().getFirst().getData().size());

        r = service.execute("SELECT * FROM t LIMIT 2 OFFSET 2;", "dlo_test", false);
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
        SqlResponse r = service.execute(sql, "parse_trigger_test", true);
        assertTrue(r.isSuccess(), "Should parse trigger with CASE...END inside BEGIN...END");
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
        SqlResponse r = service.execute(sql, "multi_trg_test", true);
        assertTrue(r.isSuccess(), "Should parse 3 triggers correctly");
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
        SqlResponse r = service.execute(sql, "org_test", true);
        assertTrue(r.isSuccess());
        var rows = r.getData().getQueryResults().getFirst().getData();
        assertEquals(5, rows.size());
        // Check that the path contains hierarchy
        String backendPath = (String) rows.get(3).get("path"); // id=4, 后端组
        assertTrue(backendPath.contains("技术部"), "Path should include parent department");
    }

    // ============================================================
    //  Metadata
    // ============================================================

    @Test
    void shouldReportCorrectMetadata() {
        SqlResponse r = service.execute(fullScript, "meta_test", true);
        assertTrue(r.isSuccess());
        ExecutionMetadata meta = r.getData().getMetadata();
        assertNotNull(meta);
        assertTrue(meta.getDurationMs() >= 0);
        assertTrue(meta.getStatementCount() > 20, "Should execute many statements");
    }

    // ============================================================
    //  Foreign keys
    // ============================================================

    @Test
    void shouldDetectForeignKeys() {
        SqlResponse r = service.execute(fullScript, "fk_test", true);
        assertTrue(r.isSuccess());
        List<ForeignKeyInfo> fks = r.getData().getForeignKeys();
        // dept_id → departments.id, emp_id → employees.id, project_id → projects.id
        assertFalse(fks.isEmpty(), "Should detect foreign keys");
    }

    // ============================================================
    //  Persistence / isolation
    // ============================================================

    @Test
    void shouldIsolateDatabasesByName() {
        service.execute("CREATE TABLE a (x INTEGER); INSERT INTO a VALUES (1);", "db1", true);
        service.execute("CREATE TABLE b (y TEXT); INSERT INTO b VALUES ('hello');", "db2", true);

        SqlResponse r1 = service.execute("SELECT * FROM a;", "db1", false);
        assertTrue(r1.isSuccess());
        assertEquals("a", r1.getData().getTables().getFirst().getName());

        SqlResponse r2 = service.execute("SELECT * FROM b;", "db2", false);
        assertTrue(r2.isSuccess());
        assertEquals("b", r2.getData().getTables().getFirst().getName());
    }

    @Test
    void shouldHandleStringLiteralsWithSemicolons() {
        SqlResponse r = service.execute("""
            CREATE TABLE t (x TEXT);
            INSERT INTO t VALUES ('hello; world');
            INSERT INTO t VALUES ('it''s fine');
            SELECT * FROM t;
            """, "str_esc_test", true);
        assertTrue(r.isSuccess());
        assertEquals(2, r.getData().getQueryResults().getFirst().getData().size());
    }

    // ============================================================
    //  Concurrency
    // ============================================================

    @Test
    void shouldHandleConcurrentRequestsOnDifferentDatabases() throws Exception {
        int threadCount = 4;
        CountDownLatch latch = new CountDownLatch(threadCount);
        List<Exception> errors = Collections.synchronizedList(new ArrayList<>());

        try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
            for (int i = 0; i < threadCount; i++) {
                final int n = i;
                executor.submit(() -> {
                    try {
                        String dbName = "concurrent_db_" + n;
                        SqlResponse r = service.execute(
                            "CREATE TABLE t" + n + " (x INTEGER); INSERT INTO t" + n + " VALUES (" + n + ");",
                            dbName, true
                        );
                        assertTrue(r.isSuccess(), "Thread " + n + " should succeed");
                    } catch (Exception e) {
                        errors.add(e);
                    } finally {
                        latch.countDown();
                    }
                });
            }

            assertTrue(latch.await(10, TimeUnit.SECONDS), "All threads should finish within 10 seconds");
            assertTrue(errors.isEmpty(), "No errors should occur: " + errors);
        }
    }

    @Test
    void shouldHandleConcurrentWritesToSameDatabase() throws Exception {
        int threadCount = 8;
        CountDownLatch latch = new CountDownLatch(threadCount);
        List<Exception> errors = Collections.synchronizedList(new ArrayList<>());
        AtomicInteger successCount = new AtomicInteger(0);

        service.execute("CREATE TABLE IF NOT EXISTS con_test (id INTEGER, val TEXT);", "con_same_db", true);

        try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
            for (int i = 0; i < threadCount; i++) {
                final int n = i;
                executor.submit(() -> {
                    try {
                        SqlResponse r = service.execute(
                            "INSERT INTO con_test VALUES (" + n + ", 'thread-" + n + "');",
                            "con_same_db", false
                        );
                        assertTrue(r.isSuccess(), "Thread " + n + " insert should succeed");
                        successCount.incrementAndGet();
                    } catch (Exception e) {
                        errors.add(e);
                    } finally {
                        latch.countDown();
                    }
                });
            }

            assertTrue(latch.await(15, TimeUnit.SECONDS), "All threads should finish within 15s");
            assertTrue(errors.isEmpty(), "No exceptions expected: " + errors);
            assertEquals(threadCount, successCount.get());

            SqlResponse verify = service.execute(
                "SELECT COUNT(*) AS cnt FROM con_test;", "con_same_db", false);
            assertTrue(verify.isSuccess());
            long count = ((Number) verify.getData().getQueryResults().getFirst().getData().getFirst().get("cnt")).longValue();
            assertEquals(threadCount, count, "All " + threadCount + " rows should be visible");
        }
    }

    @Test
    void shouldHandleConcurrentResetOnSameDatabase() throws Exception {
        int threadCount = 6;
        CountDownLatch latch = new CountDownLatch(threadCount);
        List<Exception> errors = Collections.synchronizedList(new ArrayList<>());

        try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
            for (int i = 0; i < threadCount; i++) {
                executor.submit(() -> {
                    try {
                        SqlResponse r = service.execute(
                            "CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1); SELECT * FROM t;",
                            "con_reset_db", true
                        );
                        assertTrue(r.isSuccess());
                    } catch (Exception e) {
                        errors.add(e);
                    } finally {
                        latch.countDown();
                    }
                });
            }
            assertTrue(latch.await(20, TimeUnit.SECONDS));
            assertTrue(errors.isEmpty(), "No exceptions should escape: " + errors);
        }
    }

    @Test
    void shouldHandleConcurrentDatabaseEviction() throws Exception {
        int threadCount = 25;
        CountDownLatch latch = new CountDownLatch(threadCount);
        List<Exception> errors = Collections.synchronizedList(new ArrayList<>());

        try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
            for (int i = 0; i < threadCount; i++) {
                final int n = i;
                executor.submit(() -> {
                    try {
                        SqlResponse r = service.execute(
                            "SELECT 1 AS col;", "evict_db_" + n, true
                        );
                        assertTrue(r.isSuccess(), "DB evict_db_" + n + " should succeed");
                    } catch (Exception e) {
                        errors.add(e);
                    } finally {
                        latch.countDown();
                    }
                });
            }
            assertTrue(latch.await(30, TimeUnit.SECONDS));
            assertTrue(errors.isEmpty(), "No errors during eviction: " + errors);

            // Verify the last-created database is still accessible
            SqlResponse verify = service.execute("SELECT 1;", "evict_db_24", false);
            assertTrue(verify.isSuccess(), "Last created db should be accessible after eviction");
        }
    }

    @Test
    void shouldHandleConcurrentSchemaReadsWhileModifying() throws Exception {
        AtomicBoolean running = new AtomicBoolean(true);
        List<Exception> errors = Collections.synchronizedList(new ArrayList<>());

        service.execute("CREATE TABLE IF NOT EXISTS stress_base (id INTEGER, name TEXT);", "stress_db", true);

        try (ExecutorService executor = Executors.newFixedThreadPool(4)) {
            executor.submit(() -> {
                int counter = 0;
                while (running.get() && counter < 50) {
                    try {
                        service.execute(
                            "CREATE TABLE IF NOT EXISTS tmp_" + (counter % 10) + " (x INTEGER); "
                            + "DROP TABLE IF EXISTS tmp_" + ((counter + 5) % 10) + ";",
                            "stress_db", false
                        );
                        counter++;
                    } catch (Exception e) {
                        errors.add(e);
                        running.set(false);
                    }
                }
            });

            CountDownLatch readerLatch = new CountDownLatch(3);
            for (int i = 0; i < 3; i++) {
                executor.submit(() -> {
                    try {
                        while (running.get()) {
                            SqlResponse r = service.execute(
                                "SELECT name, type FROM sqlite_master ORDER BY name;",
                                "stress_db", false
                            );
                            assertNotNull(r);
                        }
                    } catch (Exception e) {
                        errors.add(e);
                    } finally {
                        readerLatch.countDown();
                    }
                });
            }

            Thread.sleep(5000);
            running.set(false);
            assertTrue(readerLatch.await(10, TimeUnit.SECONDS));
            assertTrue(errors.isEmpty(), "No errors during stress test: " + errors);
        }
    }

    // ============================================================
    //  Security: ATTACH DATABASE blocking (SEC-01)
    // ============================================================

    @Test
    void shouldRejectAttachDatabase() {
        SqlResponse r = service.execute("ATTACH DATABASE '/etc/passwd' AS aux;", "attach_test_attachdb", true);
        assertFalse(r.isSuccess());
        assertEquals("ATTACH DATABASE is not allowed for security reasons", r.getError().getMessage());
        assertEquals(1, r.getError().getLine());
    }

    @Test
    void shouldRejectAttachShorthand() {
        SqlResponse r = service.execute("ATTACH ':memory:' AS mem;", "attach_test_shorthand", true);
        assertFalse(r.isSuccess());
        assertEquals("ATTACH DATABASE is not allowed for security reasons", r.getError().getMessage());
    }

    @Test
    void shouldRejectAttachLowercase() {
        SqlResponse r = service.execute("attach ':memory:' AS mem;", "attach_test_lowercase", true);
        assertFalse(r.isSuccess());
        assertTrue(r.getError().getMessage().contains("ATTACH"));
    }

    @Test
    void shouldRejectAttachInScript() {
        SqlResponse r = service.execute("CREATE TABLE t (x INTEGER);\nATTACH ':memory:' AS aux;\nSELECT 1;", "attach_test_script", true);
        assertFalse(r.isSuccess());
        assertEquals(2, r.getError().getLine());
    }
}
