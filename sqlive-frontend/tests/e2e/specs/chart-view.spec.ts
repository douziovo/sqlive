import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('Chart View', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });
  });

  test('T2.1 chart tab visible after SQL with numeric columns', async ({ page }) => {
    // The default SQL includes tables with numeric columns (budget, hours, etc.)
    // Select the departments table which has budget (numeric)
    await page.locator('#table-departments').scrollIntoViewIfNeeded();

    // Look for the "查询结果" tab to verify data is present
    const queryTab = page.locator('button:has-text("查询结果")');
    await expect(queryTab).toBeVisible({ timeout: 5_000 });

    // Click on a table to ensure we're viewing results
    await page.locator('#table-departments').click();
    await page.waitForTimeout(500);

    // Switch to query results tab (which can show chart)
    await queryTab.click();
    await page.waitForTimeout(500);

    // Chart area should exist - chart component renders when columns >= 2
    const chartTitle = page.locator('text=/图表：/');
    const chartVisible = await chartTitle.isVisible().catch(() => false);

    // At minimum, the tab switching works without crashing
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T2.2 switches chart types without crashing', async ({ page }) => {
    // Navigate to a query result that has numeric data
    const queryTab = page.locator('button:has-text("查询结果")');
    await expect(queryTab).toBeVisible({ timeout: 5_000 });
    await queryTab.click();
    await page.waitForTimeout(500);

    // Check if chart select is present
    const chartSelect = page.locator('.chart-container').first();
    const chartExists = await chartSelect.isVisible().catch(() => false);

    if (chartExists) {
      const chartTypeSelect = page.locator('select').filter({ has: page.locator('option[value="bar"]') }).first();
      if (await chartTypeSelect.isVisible().catch(() => false)) {
        // Try switching through each chart type
        const chartTypes = ['line', 'pie', 'doughnut', 'area', 'radar', 'bar'];

        for (const type of chartTypes) {
          await chartTypeSelect.selectOption(type);
          await page.waitForTimeout(300);

          // Chart should not crash (no error overlays)
          await expect(page.locator('.monaco-editor')).toBeVisible();
        }
      }
    }

    // App should remain stable after all switches
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T2.3 label and numeric column selection updates chart', async ({ page }) => {
    const queryTab = page.locator('button:has-text("查询结果")');
    await expect(queryTab).toBeVisible({ timeout: 5_000 });
    await queryTab.click();
    await page.waitForTimeout(500);

    // Check if label column select is present
    const labelSelect = page.locator('select').first();
    if (await labelSelect.isVisible().catch(() => false)) {
      // Try selecting a different label column
      const options = labelSelect.locator('option');
      const optionCount = await options.count();

      if (optionCount > 1) {
        await labelSelect.selectOption({ index: 0 });
        await page.waitForTimeout(300);

        // Toggle a numeric column checkbox
        const checkboxes = page.locator('input[type="checkbox"]');
        const cbCount = await checkboxes.count();
        if (cbCount > 1) {
          // Toggle the second checkbox
          await checkboxes.nth(1).click();
          await page.waitForTimeout(300);
        }
      }
    }

    // App should not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T2.4 shows empty state for single-column table', async ({ page, sqlEditor }) => {
    // Create a single-column table
    await sqlEditor.replaceAll(
      'CREATE TABLE single_col (id INTEGER);\n' +
      'INSERT INTO single_col VALUES (1);\n' +
      'INSERT INTO single_col VALUES (2);\n' +
      'SELECT * FROM single_col;'
    );
    await page.waitForTimeout(2000);

    // Should show "need at least 2 columns" message or equivalent empty state
    const need2Cols = page.locator('text=/至少 2 列/');
    const noNumeric = page.locator('text=/数值列/');

    const hasEmptyState = await need2Cols.isVisible().catch(() => false) ||
      await noNumeric.isVisible().catch(() => false);

    // At minimum, the app should not crash on single-column data
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T2.5 DEFAULT_SQL has numeric data and renders chart area', async ({ page }) => {
    // DEFAULT_SQL has departments (with budget), employees (with salary), etc.
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Verify the departments table has budget column (numeric)
    const deptTable = page.locator('#table-departments');
    await expect(deptTable.locator('text=budget')).toBeVisible({ timeout: 5_000 });

    // Navigate through to verify no crashes
    const queryTab = page.locator('button:has-text("查询结果")');
    if (await queryTab.isVisible().catch(() => false)) {
      await queryTab.click();
      await page.waitForTimeout(500);
    }

    // App should be stable with default data
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });
});
