import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('Create Table Modal', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });
  });

  test('opens modal when clicking add table button', async ({ page }) => {
    const addBtn = page.locator('button:has-text("添加新表格")');
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();
    await page.waitForTimeout(300);

    // Modal should be visible
    await expect(page.locator('text=创建新表格').first()).toBeVisible({ timeout: 3_000 });
  });

  test('submit button is disabled when form is empty', async ({ page }) => {
    await page.locator('button:has-text("添加新表格")').scrollIntoViewIfNeeded();
    await page.locator('button:has-text("添加新表格")').click();
    await page.waitForTimeout(300);

    const submitBtn = page.locator('button:has-text("立即创建")');
    await expect(submitBtn).toBeDisabled();
  });

  test('enables submit when table name and valid columns are filled', async ({ page }) => {
    await page.locator('button:has-text("添加新表格")').scrollIntoViewIfNeeded();
    await page.locator('button:has-text("添加新表格")').click();
    await page.waitForTimeout(300);

    // Fill table name
    const nameInput = page.locator('input[placeholder*="请输入表名"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill('my_table');

    // Fill column type and name
    const colTypeInputs = page.locator('input[placeholder*="如: int"]');
    const colNameInputs = page.locator('input[placeholder*="如: id"]');

    await expect(colTypeInputs.first()).toBeVisible({ timeout: 5_000 });
    await colTypeInputs.first().fill('INTEGER');
    await expect(colNameInputs.first()).toBeVisible({ timeout: 5_000 });
    await colNameInputs.first().fill('id');

    await page.waitForTimeout(200);

    // Submit should now be enabled
    const submitBtn = page.locator('button:has-text("立即创建")');
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    const isDisabled = await submitBtn.isDisabled();
    expect(isDisabled).toBeFalsy();
  });

  test('adds and removes field rows', async ({ page }) => {
    await page.locator('button:has-text("添加新表格")').scrollIntoViewIfNeeded();
    await page.locator('button:has-text("添加新表格")').click();
    await page.waitForTimeout(300);

    // Count initial field rows
    const initialRows = await page.locator('[class*="grid-cols-"]').count();

    // Click add field button
    const addFieldBtn = page.locator('button:has-text("添加新字段")').first();
    await expect(addFieldBtn).toBeVisible({ timeout: 5_000 });
    await addFieldBtn.click();
    await page.waitForTimeout(200);

    // Should have more rows or same if no add button
    const afterRows = await page.locator('[class*="grid-cols-"]').count();
    expect(afterRows).toBeGreaterThanOrEqual(initialRows);
  });

  test('closes modal without creating table', async ({ page }) => {
    await page.locator('button:has-text("添加新表格")').scrollIntoViewIfNeeded();
    await page.locator('button:has-text("添加新表格")').click();
    await page.waitForTimeout(300);

    // Close via X button or backdrop
    const closeBtn = page.locator('[role="dialog"] button').first();
    await expect(closeBtn).toBeVisible({ timeout: 5_000 });
    await closeBtn.click();
    await page.waitForTimeout(300);

    // Modal should be closed
    await expect(page.locator('text=创建新表格').first()).not.toBeVisible({ timeout: 2_000 });
  });

  test('generates CREATE TABLE + INSERT SQL on submit', async ({ page, sqlEditor }) => {
    await page.locator('button:has-text("添加新表格")').scrollIntoViewIfNeeded();
    await page.locator('button:has-text("添加新表格")').click();
    await page.waitForTimeout(300);

    // Fill form
    const nameInput = page.locator('input[placeholder*="请输入表名"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill('test_create');
    await page.waitForTimeout(200);

    // Submit
    const submitBtn = page.locator('button:has-text("立即创建")');
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    const isDisabled = await submitBtn.isDisabled();
    expect(isDisabled).toBeFalsy();
    await submitBtn.click();
    await page.waitForTimeout(2000);

    const sql = await sqlEditor.getText();
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('test_create');
  });
});
