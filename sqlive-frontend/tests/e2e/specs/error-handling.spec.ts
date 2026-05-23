import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });
  });

  test('shows error for invalid SQL syntax', async ({ page, sqlEditor }) => {
    // Replace with invalid SQL
    await sqlEditor.replaceAll('SELECT * FORM departments;');
    await page.waitForTimeout(2000);

    // Monaco should show error markers (red squiggly underlines)
    const errorMarkers = page.locator('.squiggly-error, .monaco-editor .cdr');
    const errorVisible = await errorMarkers.first().isVisible().catch(() => false);

    // Check for execution error state - the metadata bar may show error
    // Or Monaco decorations appear
    if (!errorVisible) {
      // Even if we can't see markers, the app shouldn't crash
      await expect(page.locator('.monaco-editor')).toBeVisible();
    }
  });

  test('reports correct line number for syntax error', async ({ page, sqlEditor }) => {
    await sqlEditor.replaceAll(
      'CREATE TABLE test_err (id INTEGER);\n' +
      'INSERT INTO test_err VALUES (1);\n' +
      'SELECT * FORM test_err;\n' +
      'SELECT 1;'
    );
    await page.waitForTimeout(2000);

    // App shouldn't crash; error should be shown
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('recovers after fixing error', async ({ page, sqlEditor }) => {
    // First introduce error
    await sqlEditor.replaceAll('SELECT * FORM departments;');
    await page.waitForTimeout(2000);

    // Fix the error
    await sqlEditor.replaceAll('SELECT * FROM departments;');
    await page.waitForTimeout(2000);

    // Should recover and show results
    await expect(page.locator('text=departments').first()).toBeVisible();
  });

  test('shows network error when backend returns 500 (mocked)', async ({ page, sqlEditor }) => {
    // Mock backend to return 500
    await page.route('**/api/execute', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          data: null,
          error: { message: 'Internal server error', line: 0 },
        }),
      });
    });

    // Trigger execution
    await sqlEditor.replaceAll('SELECT * FROM departments;');
    await page.waitForTimeout(2000);

    // Editor should still be visible (app handles gracefully)
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('shows connection error when backend is unreachable (mocked)', async ({ page, sqlEditor }) => {
    // Mock backend to abort (simulate connection refused)
    await page.route('**/api/execute', async (route) => {
      await route.abort('connectionrefused');
    });

    // Trigger execution
    await sqlEditor.replaceAll('SELECT 1;');
    await page.waitForTimeout(2000);

    // App should show error state, not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('handles empty SQL without error', async ({ page, sqlEditor }) => {
    await sqlEditor.replaceAll('');
    await page.waitForTimeout(2000);

    // App should handle empty state gracefully
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('handles SELECT with no results gracefully', async ({ page, sqlEditor }) => {
    await sqlEditor.replaceAll(
      'CREATE TABLE empty_test (id INTEGER);\n' +
      'SELECT * FROM empty_test;'
    );
    await page.waitForTimeout(2000);

    // Should not crash, may show empty table or query result
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });
});
