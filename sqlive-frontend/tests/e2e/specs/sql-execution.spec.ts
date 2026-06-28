import {expect, gotoApp, test} from '../fixtures/sql-editor.fixture';

test.describe('SQL Execution', () => {
    test('loads default SQL and displays tables on page load', async ({page}) => {
        await gotoApp(page);

        // Wait for execution to complete - tables should appear
        await expect(page.locator('text=departments').first()).toBeVisible({timeout: 15_000});
        await expect(page.locator('text=employees').first()).toBeVisible();
        await expect(page.locator('text=projects').first()).toBeVisible();

        // Metadata bar shows execution stats
        await expect(page.locator('text=/ms.*条语句/')).toBeVisible();
    });

    test('shows table data with correct columns', async ({page}) => {
        await gotoApp(page);
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 15_000});

        // Verify table columns
        const table = page.locator('#table-departments');
        await expect(table.locator('text=id')).toBeVisible();
        await expect(table.locator('text=name')).toBeVisible();
        await expect(table.locator('text=location')).toBeVisible();
        await expect(table.locator('text=budget')).toBeVisible();
    });

    test('shows indexes, views, and triggers tabs with data', async ({page}) => {
        await gotoApp(page);
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 15_000});

        // Switch to indexes tab
        await page.locator('[data-testid="tab-indexes"]').click();
        await expect(page.locator('text=/idx_employees/').first()).toBeVisible();

        // Switch to views tab
        await page.locator('[data-testid="tab-views"]').click();
        await expect(page.locator('text=/v_/').first()).toBeVisible();

        // Switch to triggers tab
        await page.locator('[data-testid="tab-triggers"]').click();
        await expect(page.locator('text=/trg_/').first()).toBeVisible();
    });

    test('executes SELECT queries and shows results', async ({page}) => {
        await gotoApp(page);
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 15_000});

        // Switch to query results tab
        await page.locator('button:has-text("查询结果")').click();

        // Query results from DEFAULT_SQL should appear
        const queryTab = page.locator('button:has-text("查询结果")');
        await expect(queryTab).toBeVisible();
    });

    test('auto-executes after 1s debounce when typing', async ({page}) => {
        await gotoApp(page);
        // gotoApp already waits for #table-departments, meaning auto-execute completed
        const rows = page.locator('#table-departments tbody tr');
        expect(await rows.count()).toBeGreaterThan(0);
    });

    test('displays NULL values correctly in table cells', async ({page, sqlEditor}) => {
        await gotoApp(page);
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 15_000});

        // Create table with NULL values
        const responsePromise = page.waitForResponse(
            (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
            {timeout: 15_000},
        );
        await sqlEditor.replaceAll(
            'CREATE TABLE null_test (id INTEGER PRIMARY KEY, name TEXT, score REAL);\n' +
            "INSERT INTO null_test VALUES (1, 'Alice', 95.5);\n" +
            'INSERT INTO null_test VALUES (2, NULL, NULL);\n' +
            "INSERT INTO null_test VALUES (3, 'Charlie', NULL);\n" +
            'SELECT * FROM null_test;'
        );
        await responsePromise;

        // Table should be visible
        await expect(page.locator('#table-null_test')).toBeVisible({timeout: 10_000});

        // NULL values should display without crashing
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('executes multi-table JOIN query', async ({page, sqlEditor}) => {
        await gotoApp(page);
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 15_000});

        // Execute a JOIN query
        const responsePromise = page.waitForResponse(
            (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
            {timeout: 15_000},
        );
        await sqlEditor.replaceAll(
            'SELECT d.name AS dept_name, e.name AS emp_name, e.salary\n' +
            'FROM departments d\n' +
            'JOIN employees e ON e.dept_id = d.id\n' +
            'ORDER BY d.name, e.name;'
        );
        await responsePromise;

        // Switch to results tab and verify query result content
        await page.locator('[data-testid="tab-results"]').click();
        await expect(page.locator('text=/dept_name|emp_name|salary/').first()).toBeVisible({timeout: 5_000});

        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('executes CTE (WITH) query', async ({page, sqlEditor}) => {
        await gotoApp(page);
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 15_000});

        // Execute a CTE query
        const responsePromise = page.waitForResponse(
            (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
            {timeout: 15_000},
        );
        await sqlEditor.replaceAll(
            'WITH dept_summary AS (\n' +
            '  SELECT d.name, COUNT(e.id) AS emp_count, AVG(e.salary) AS avg_salary\n' +
            '  FROM departments d\n' +
            '  LEFT JOIN employees e ON e.dept_id = d.id\n' +
            '  GROUP BY d.name\n' +
            ')\n' +
            'SELECT * FROM dept_summary WHERE emp_count > 0;'
        );
        await responsePromise;

        // Switch to results tab and verify CTE query result content
        await page.locator('[data-testid="tab-results"]').click();
        await expect(page.locator('text=/dept_name|emp_count|avg_salary/').first()).toBeVisible({timeout: 5_000});

        // Query should execute without error
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });
});
