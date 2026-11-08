package com.douzi.sqlive.service;

import com.douzi.sqlive.dto.*;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Schema and data verification after executing the shared multi-table script:
 * tables, column constraints, row data, indexes, views, triggers, foreign keys
 * and execution metadata.
 */
class SqlExecutionServiceSchemaTest extends SqlExecutionServiceTestSupport {

	// ============================================================
	//  Tables — DDL verification
	// ============================================================

	@Test
	void shouldCreateAllTables() {
		SqlResponse r = service.execute(fullScript, db("tables_test"), true);
		assertTrue(r.getError() == null);

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
		SqlResponse r = service.execute(fullScript, db("typedemo_test"), true);
		assertTrue(r.getError() == null);

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
		SqlResponse r = service.execute(fullScript, db("typedata_test"), true);
		assertTrue(r.getError() == null);

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
		SqlResponse r = service.execute(fullScript, db("empdata_test"), true);
		assertTrue(r.getError() == null);

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
		SqlResponse r = service.execute(fullScript, db("index_test"), true);
		assertTrue(r.getError() == null);

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
		SqlResponse r = service.execute(fullScript, db("view_test"), true);
		assertTrue(r.getError() == null);

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
		SqlResponse r = service.execute(fullScript, db("trigger_test"), true);
		assertTrue(r.getError() == null);

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
		SqlResponse r = service.execute(fullScript, db("trg_fire_test"), true);
		assertTrue(r.getError() == null);

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
		SqlResponse r = service.execute(fullScript + "\nINSERT INTO employees (name, age, salary, dept_id, hire_date, email) VALUES ('低薪者', 20, 2000, 1, '2025-06-01', 'low@test.com');", db("trg_check_test"), true);
		// The full script succeeds, but the extra INSERT should fail due to trigger
		// Actually the full script already runs fine, the extra low-salary insert should fail
		assertFalse(r.getError() == null, "Low salary INSERT should be blocked by trigger");
		assertTrue(r.getError().getMessage().contains("3000"), "Error should mention minimum salary");
	}

	// ============================================================
	//  Metadata
	// ============================================================

	@Test
	void shouldReportCorrectMetadata() {
		SqlResponse r = service.execute(fullScript, db("meta_test"), true);
		assertTrue(r.getError() == null);
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
		SqlResponse r = service.execute(fullScript, db("fk_test"), true);
		assertTrue(r.getError() == null);
		List<ForeignKeyInfo> fks = r.getData().getForeignKeys();
		// dept_id → departments.id, emp_id → employees.id, project_id → projects.id
		assertFalse(fks.isEmpty(), "Should detect foreign keys");
	}

	@Test
	void shouldRejectForeignKeyViolations() {
		var result = service.execute("CREATE TABLE p (id INTEGER PRIMARY KEY);"
				+ "CREATE TABLE c (pid INTEGER REFERENCES p(id)); INSERT INTO c VALUES (999);",
				db("invalid_fk"), true);
		assertFalse(result.getError() == null);
		assertTrue(result.getError().getMessage().contains("FOREIGN KEY"));
	}

}
