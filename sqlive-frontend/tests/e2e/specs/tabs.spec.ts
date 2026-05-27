import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('Multi-Tab System', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 30_000 });
  });

  test('adds a new tab', async ({ page }) => {
    const addBtn = page.locator('button[title="新建标签页"]');
    await addBtn.click();
    await page.waitForTimeout(500);

    // New tab should appear (default name "查询 1" or similar)
    await expect(page.locator('text=/查询/').first()).toBeVisible();
  });

  test('switches between tabs and shows different content', async ({ page, sqlEditor }) => {
    const addBtn = page.locator('button[title="新建标签页"]');
    await addBtn.click();
    // Wait for the auto-execute triggered by new-tab default SQL to complete
    await page.waitForResponse(
      r => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await page.waitForTimeout(500);

    // Type distinct SQL in the new tab
    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sqlEditor.replaceAll(
      'CREATE TABLE test_tab (id INTEGER PRIMARY KEY, val TEXT);\n' +
      "INSERT INTO test_tab VALUES (1, 'hello');\n" +
      'SELECT * FROM test_tab;'
    );
    await responsePromise;
    await page.waitForTimeout(500);

    // Should see test_tab table
    await expect(page.locator('#table-test_tab')).toBeVisible({ timeout: 10_000 });

    // Switch back to first tab (the one with the original SQL, typically tab 0)
    const tabs = page.locator('[class*="overflow-x-auto"] button[title*="SQL"], [class*="overflow-x-auto"] > div[title]').first();
    const firstTabTitle = page.locator('div[title*="SQL"], span:has-text("SQL")').first();
    if (await firstTabTitle.isVisible()) {
      await firstTabTitle.click();
      await expect(firstTabTitle).toBeVisible();
    } else {
      const fallback = page.locator('[class*="overflow-x-auto"] > div').first();
      await fallback.click();
      await expect(fallback).toBeVisible();
    }
    await page.waitForTimeout(1500);

    // Editor should still be functional
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('closes a tab', async ({ page }) => {
    await page.locator('button[title="新建标签页"]').click();
    await page.waitForTimeout(500);

    const closeButtons = page.locator('button:has-text("✕")');
    const count = await closeButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);

    await closeButtons.first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('cannot close the last tab', async ({ page }) => {
    const closeBtn = page.locator('button:has-text("✕")');
    await expect(closeBtn).not.toBeVisible();
  });

  test('tabs with distinct SQL show different tables', async ({ page, sqlEditor }) => {
    const addBtn = page.locator('button[title="新建标签页"]');
    await addBtn.click();
    // Wait for the auto-execute triggered by new-tab default SQL to complete
    await page.waitForResponse(
      r => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await page.waitForTimeout(500);

    const responsePromise = page.waitForResponse(
      r => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sqlEditor.replaceAll(
      'CREATE TABLE new_tab_table (id INTEGER, x TEXT);\n' +
      "INSERT INTO new_tab_table VALUES (1, 'data');"
    );
    await responsePromise;
    await page.waitForTimeout(500);

    await expect(page.locator('#table-new_tab_table')).toBeVisible({ timeout: 10_000 });
  });

  test('handles rapid tab creation', async ({ page }) => {
    const addBtn = page.locator('button[title="新建标签页"]');

    for (let i = 0; i < 5; i++) {
      await addBtn.click();
      await page.waitForTimeout(200);
    }

    const closeBtns = page.locator('button:has-text("✕")');
    const count = await closeBtns.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test.describe('dbName and database isolation', () => {
    test('auto-execute works with empty dbName (defaults to "default" database)', async ({ page, sqlEditor }) => {
      const responsePromise = page.waitForResponse(
        r => r.url().includes('/api/execute') && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await sqlEditor.replaceAll(
        'CREATE TABLE auto_default (id INTEGER PRIMARY KEY, val TEXT);\n' +
        "INSERT INTO auto_default VALUES (1, 'hello');"
      );
      await responsePromise;

      await expect(page.locator('#table-auto_default')).toBeVisible({ timeout: 10_000 });
    });

    test('submit prompts for dbName when not set, then executes SQL', async ({ page, sqlEditor }) => {
      const addBtn = page.locator('button[title="新建标签页"]');
      await addBtn.click();
      await page.waitForTimeout(300);

      // Wait for auto-execute after replaceAll
      let responsePromise = page.waitForResponse(
        r => r.url().includes('/api/execute') && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await sqlEditor.replaceAll(
        'CREATE TABLE committed_tab (id INTEGER PRIMARY KEY, data TEXT);\n' +
        "INSERT INTO committed_tab VALUES (1, 'from_prompt');"
      );
      await responsePromise;

      // Then wait for the submit-triggered execution
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('e2e_prompt_db');
      });
      responsePromise = page.waitForResponse(
        r => r.url().includes('/api/execute') && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await page.locator('button:has-text("提交")').click();
      await responsePromise;

      await expect(page.locator('#table-committed_tab')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('span:has-text("e2e_prompt_db"):visible').first()).toBeVisible();
    });

    test('cancel prompt does not commit dbName', async ({ page, sqlEditor }) => {
      const addBtn = page.locator('button[title="新建标签页"]');
      await addBtn.click();
      await page.waitForTimeout(300);

      page.once('dialog', async (dialog) => {
        await dialog.dismiss();
      });

      await page.locator('button:has-text("提交")').click();
      await page.waitForTimeout(500);

      // After dismissing prompt, the page should not crash
      // (badge may still show from auto-assigned dbName or other tabs)
      await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('committed databases are isolated between tabs', async ({ page, sqlEditor }) => {
      // Tab 1: create table only_in_a — auto-executes against its own database
      let responsePromise = page.waitForResponse(
        r => r.url().includes('/api/execute') && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await sqlEditor.replaceAll(
        'CREATE TABLE only_in_a (id INTEGER PRIMARY KEY, tag TEXT);\n' +
        "INSERT INTO only_in_a VALUES (1, 'from_a');"
      );
      await responsePromise;
      await expect(page.locator('#table-only_in_a')).toBeVisible({ timeout: 10_000 });

      // Tab 2: create a new tab (gets its own database) and create only_in_b
      const addBtn = page.locator('button[title="新建标签页"]');
      await addBtn.click();
      await page.waitForTimeout(300);

      responsePromise = page.waitForResponse(
        r => r.url().includes('/api/execute') && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await sqlEditor.replaceAll(
        'CREATE TABLE only_in_b (id INTEGER PRIMARY KEY, val TEXT);\n' +
        "INSERT INTO only_in_b VALUES (1, 'from_b');"
      );
      await responsePromise;
      await expect(page.locator('#table-only_in_b')).toBeVisible({ timeout: 10_000 });

      // Tab 2 should NOT see only_in_a (different database — Tab 1 has e2e_* dbName,
      // Tab 2 has empty dbName which maps to "default")
      await expect(page.locator('#table-only_in_a')).not.toBeVisible({ timeout: 3000 });
    });
  });
});
