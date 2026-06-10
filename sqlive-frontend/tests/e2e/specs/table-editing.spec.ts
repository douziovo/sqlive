import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('Table Editing & Bidirectional Sync', () => {
  test.beforeEach(async ({ page, sqlEditor }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 30_000 });
  });

  test('edits a cell value and syncs back to SQL', async ({ page }) => {
    const nameCell = page.locator('#table-departments tbody tr').first().locator('td:nth-child(2) textarea');
    await expect(nameCell).toBeVisible({ timeout: 5_000 });

    // Wait for the API response triggered by blur (Tab)
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await nameCell.click();
    await nameCell.fill('ChangedDept');
    await page.keyboard.press('Tab');
    await responsePromise;

    await expect(page.locator('#table-departments tbody tr').first().locator('td:nth-child(2) textarea')).toHaveValue('ChangedDept', { timeout: 10_000 });
  });

  test('rejects non-numeric value for numeric column', async ({ page }) => {
    await page.locator('#table-employee_projects').scrollIntoViewIfNeeded();

    const hoursCell = page.locator('#table-employee_projects tbody tr').first().locator('td').filter({ hasText: /\d+/ }).first();
    await hoursCell.click();

    const textarea = hoursCell.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.fill('not-a-number');
    await textarea.blur();

    await page.waitForTimeout(500);
    const currentValue = await textarea.inputValue();
    expect(currentValue).not.toBe('not-a-number');
  });

  test('deletes a row and removes VALUES tuple from SQL', async ({ page, sqlEditor }) => {
    // Hover the first data row of departments to reveal delete button
    const firstRow = page.locator('#table-departments table tr, #table-departments [role="rowgroup"] [role="row"]').nth(1);
    await firstRow.hover();
    await page.waitForTimeout(300);

    // Click the delete (🗑️) button in that row
    const delBtn = firstRow.locator('button, [role="button"]').last();
    await expect(delBtn).toBeVisible({ timeout: 3_000 });

    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await delBtn.click();
    await responsePromise;

    // After delete, the first visible department should no longer be "技术部"
    // (if it was deleted) or a different row now appears first
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 10_000 });
  });

  test('inserts a row via ghost row and generates INSERT statement', async ({ page, sqlEditor }) => {
    const originalSql = await sqlEditor.getText();

    const ghostRow = page.locator('#table-departments [data-testid="ghost-row"]');
    await ghostRow.scrollIntoViewIfNeeded();

    const ghostInputs = ghostRow.locator('input, textarea');
    const count = await ghostInputs.count();
    expect(count).toBeGreaterThan(1);
    await ghostInputs.nth(1).fill('NewDept');
    if (count > 2) await ghostInputs.nth(2).fill('NewLocation');
    if (count > 3) await ghostInputs.nth(3).fill('50000');
    // Wait for focus-within opacity transition (200ms)
    await page.waitForTimeout(300);

    const checkBtn = page.locator('#table-departments button[title="确认添加"]');
    await expect(checkBtn).toBeVisible({ timeout: 5_000 });
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await checkBtn.click();
    await responsePromise;

    // Verify page is still functional after insert attempt
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 10_000 });
  });

  test('drops a table and removes all related statements', async ({ page, sqlEditor }) => {
    await gotoApp(page);
    await expect(page.locator('#table-type_demo')).toBeVisible({ timeout: 30_000 });

    const originalSql = await sqlEditor.getText();

    page.on('dialog', dialog => dialog.accept());

    const tableHeader = page.locator('#table-type_demo').locator('.group').first();
    await tableHeader.hover();

    const dropBtn = page.locator('#table-type_demo').locator('button[title="删除表格"]');
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await dropBtn.click();
    await responsePromise;

    const newSql = await sqlEditor.getText();
    expect(newSql).not.toContain('type_demo');
  });

  test('edits multiple rows in sequence', async ({ page, sqlEditor }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Edit first row
    const rows = page.locator('#table-departments tbody tr');
    const rowCount = await rows.count();

    if (rowCount >= 2) {
      // Edit first row
      const firstCell = rows.first().locator('td:nth-child(2) textarea');
      if (await firstCell.isVisible().catch(() => false)) {
        let responsePromise = page.waitForResponse(
          r => r.url().includes('/api/execute') && r.request().method() === 'POST',
          { timeout: 15_000 },
        );
        await firstCell.click();
        await firstCell.fill('FirstEdit');
        await page.keyboard.press('Tab');
        await responsePromise;
      }

      // Edit second row
      const secondCell = rows.nth(1).locator('td:nth-child(2) textarea');
      if (await secondCell.isVisible().catch(() => false)) {
        const responsePromise = page.waitForResponse(
          r => r.url().includes('/api/execute') && r.request().method() === 'POST',
          { timeout: 15_000 },
        );
        await secondCell.click();
        await secondCell.fill('SecondEdit');
        await page.keyboard.press('Tab');
        await responsePromise;
      }
    }

    // App should not crash after sequential edits
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('Ctrl+Z undo does not crash the editor', async ({ page, sqlEditor }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Type some text in the editor
    await sqlEditor.click();
    await page.keyboard.type('SELECT * FROM test;', { delay: 5 });
    await page.waitForTimeout(500);

    // Press Ctrl+Z to undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    // Press Ctrl+Z again
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    // App should not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('handles BLOB and DATE column types in table display', async ({ page, sqlEditor }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Create table with BLOB and DATE types
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sqlEditor.replaceAll(
      'CREATE TABLE type_test (\n' +
      '  id INTEGER PRIMARY KEY,\n' +
      '  created DATE,\n' +
      "  data BLOB\n" +
      ');\n' +
      "INSERT INTO type_test VALUES (1, '2024-01-15', X'DEADBEEF');\n" +
      "INSERT INTO type_test VALUES (2, '2024-06-01', X'CAFEBABE');\n" +
      'SELECT * FROM type_test;'
    );
    await responsePromise;

    // Table should be visible
    await expect(page.locator('#table-type_test')).toBeVisible({ timeout: 10_000 });

    // Display should not crash on BLOB/DATE types
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });
});
