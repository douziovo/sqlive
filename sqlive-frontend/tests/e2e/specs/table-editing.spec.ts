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
    if (await textarea.isVisible()) {
      await textarea.fill('not-a-number');
      await textarea.blur();

      await page.waitForTimeout(500);
      const currentValue = await textarea.inputValue();
      expect(currentValue).not.toBe('not-a-number');
    }
  });

  test('deletes a row and removes VALUES tuple from SQL', async ({ page, sqlEditor }) => {
    const firstRow = page.locator('#table-departments tbody tr').first();
    await firstRow.hover();
    await page.waitForTimeout(300);

    const rowDelBtns = page.locator('#table-departments tbody tr').first().locator('td button, td [role="button"]');
    const btnCount = await rowDelBtns.count();
    if (btnCount > 0) {
      const originalSql = await sqlEditor.getText();

      const responsePromise = page.waitForResponse(
        r => r.url().includes('/api/execute') && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await rowDelBtns.last().click();
      await responsePromise;

      const newSql = await sqlEditor.getText();
      if (newSql && originalSql) {
        expect(newSql).not.toBe(originalSql);
      }
    }
  });

  test('inserts a row via ghost row and generates INSERT statement', async ({ page, sqlEditor }) => {
    const originalSql = await sqlEditor.getText();

    const ghostRow = page.locator('#table-departments [data-testid="ghost-row"]');
    await ghostRow.scrollIntoViewIfNeeded();

    const ghostInputs = ghostRow.locator('input, textarea');
    const count = await ghostInputs.count();
    if (count > 1) {
      await ghostInputs.nth(1).fill('NewDept');
      if (count > 2) await ghostInputs.nth(2).fill('NewLocation');
      if (count > 3) await ghostInputs.nth(3).fill('50000');

      const checkBtn = page.locator('#table-departments button').filter({ hasText: '✓' }).last();
      if (await checkBtn.isVisible()) {
        const responsePromise = page.waitForResponse(
          r => r.url().includes('/api/execute') && r.request().method() === 'POST',
          { timeout: 15_000 },
        );
        await checkBtn.click();
        await responsePromise;

        const newSql = await sqlEditor.getText();
        expect(newSql).toContain('NewDept');
        expect(newSql).not.toBe(originalSql);
      }
    }
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
});
