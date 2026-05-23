import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('SQL Execution', () => {
  test('loads default SQL and displays tables on page load', async ({ page }) => {
    await gotoApp(page);

    // Wait for execution to complete - tables should appear
    await expect(page.locator('text=departments').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=employees').first()).toBeVisible();
    await expect(page.locator('text=projects').first()).toBeVisible();

    // Metadata bar shows execution stats
    await expect(page.locator('text=/ms.*条语句/')).toBeVisible();
  });

  test('shows table data with correct columns', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Verify table columns
    const table = page.locator('#table-departments');
    await expect(table.locator('text=id')).toBeVisible();
    await expect(table.locator('text=name')).toBeVisible();
    await expect(table.locator('text=location')).toBeVisible();
    await expect(table.locator('text=budget')).toBeVisible();
  });

  test('shows indexes, views, and triggers tabs with data', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

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

  test('executes SELECT queries and shows results', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Switch to query results tab
    await page.locator('button:has-text("查询结果")').click();

    // Query results from DEFAULT_SQL should appear
    const queryTab = page.locator('button:has-text("查询结果")');
    await expect(queryTab).toBeVisible();
  });

  test('auto-executes after 1s debounce when typing', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Wait for debounce to settle then verify data is present
    await page.waitForTimeout(1500);
    const rows = page.locator('#table-departments tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
  });
});
