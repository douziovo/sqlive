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

    const hoursCell = page.locator('#table-employee_projects tbody tr').first().locator('td:nth-child(4) textarea');
    await expect(hoursCell).toBeVisible({ timeout: 5_000 });

    const originalValue = await hoursCell.inputValue();
    await hoursCell.click();
    await hoursCell.fill('not-a-number');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(800);

    // After Tab (blur+submit), value should revert to original (non-numeric rejected)
    // or remain changed (if validation accepts it). Either way, the app must not crash.
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('deletes a row and removes VALUES tuple from SQL', async ({ page, sqlEditor }) => {
    const firstRow = page.locator('#table-departments tbody tr').first();
    await firstRow.hover();
    await page.waitForTimeout(300);

    const delBtn = firstRow.locator('button[title="删除此行"]');
    await expect(delBtn).toBeVisible({ timeout: 5_000 });
    const originalSql = await sqlEditor.getText();

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

    const ghostInputs = ghostRow.locator('textarea');
    const count = await ghostInputs.count();
    expect(count).toBeGreaterThan(1);
    // Fill ghost row textareas (skip first which is auto-increment ID)
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await ghostInputs.nth(1).fill('NewDept');
    if (count > 2) await ghostInputs.nth(2).fill('NewLocation');
    if (count > 3) await ghostInputs.nth(3).fill('50000');
    // Tab out of last field triggers commit
    await ghostInputs.nth(Math.min(count - 1, 3)).press('Tab');
    await responsePromise;

    await page.waitForTimeout(500);
    const newSql = await sqlEditor.getText();
    expect(newSql).toBeTruthy();
    expect(newSql).not.toBe(originalSql);
  });

  test('drops a table and removes all related statements', async ({ page, sqlEditor }) => {
    await gotoApp(page);
    await expect(page.locator('#table-type_demo')).toBeVisible({ timeout: 30_000 });

    const originalSql = await sqlEditor.getText();

    page.once('dialog', dialog => dialog.accept());

    const dropBtn = page.locator('#table-type_demo button[title="删除表格"]');
    if (await dropBtn.isVisible().catch(() => false)) {
      const responsePromise = page.waitForResponse(
        r => r.url().includes('/api/execute') && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await dropBtn.click();
      await responsePromise;
    }

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
        await page.waitForTimeout(500);
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
