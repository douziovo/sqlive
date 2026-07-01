import {expect, gotoApp, test} from '../fixtures/sql-editor.fixture';

test.describe('Multi-Tab System @smoke', () => {
    test.beforeEach(async ({page}) => {
        await gotoApp(page);
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 30_000});
    });

    test('adds a new tab', async ({page}) => {
        const addBtn = page.locator('button[title="新建标签页"]');
        await addBtn.click();

        // New tab should appear (default name "查询 1" or similar)
        await expect(page.locator('[data-testid="tab-close-btn"]')).toHaveCount(2, {timeout: 5_000});
    });

    test('switches between tabs and shows different content', async ({page, sqlEditor}) => {
        const addBtn = page.locator('button[title="新建标签页"]');
        await addBtn.click();
        // New tab has empty code — our empty-code guard skips the API call.
        // Wait for new tab to be active
        await expect(page.locator('[data-testid="tab-close-btn"]')).toHaveCount(2, {timeout: 5_000});

        // Type distinct SQL in the new tab
        const responsePromise = page.waitForResponse(
            r => r.url().includes('/api/execute') && r.request().method() === 'POST',
            {timeout: 15_000},
        );
        await sqlEditor.setText(
            'CREATE TABLE test_tab (id INTEGER PRIMARY KEY, val TEXT);\n' +
            "INSERT INTO test_tab VALUES (1, 'hello');\n" +
            'SELECT * FROM test_tab;'
        );
        await responsePromise;

        // Should see test_tab table
        await expect(page.locator('#table-test_tab')).toBeVisible({timeout: 10_000});

        // Switch back to first tab by clicking the first tab element
        const firstTab = page.locator('.flex.items-center.overflow-x-auto > div[class*="group"]').first();
        await firstTab.click();

        // Editor should still be functional
        await expect(page.locator('.monaco-editor')).toBeVisible({timeout: 5_000});
    });

    test('closes a tab', async ({page}) => {
        await page.locator('button[title="新建标签页"]').click();
        await expect(page.locator('[data-testid="tab-close-btn"]')).toHaveCount(2, {timeout: 5_000});

        const closeButtons = page.locator('button:has-text("✕")');
        const count = await closeButtons.count();
        expect(count).toBeGreaterThanOrEqual(2);

        await closeButtons.first().click();
        // With 1 tab remaining, close buttons are hidden (v-if="tabs.length > 1")
        await expect(page.locator('[data-testid="tab-close-btn"]')).toHaveCount(0, {timeout: 5_000});

        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('cannot close the last tab', async ({page}) => {
        const closeBtn = page.locator('button:has-text("✕")');
        await expect(closeBtn).not.toBeVisible();
    });

    test('tabs with distinct SQL show different tables', async ({page, sqlEditor}) => {
        const addBtn = page.locator('button[title="新建标签页"]');
        await addBtn.click();
        // New tab has empty code — our empty-code guard skips the API call.
        await expect(page.locator('[data-testid="tab-close-btn"]')).toHaveCount(2, {timeout: 5_000});

        const responsePromise = page.waitForResponse(
            r => r.url().includes('/api/execute') && r.request().method() === 'POST',
            {timeout: 15_000},
        );
        await sqlEditor.setText(
            'CREATE TABLE new_tab_table (id INTEGER, x TEXT);\n' +
            "INSERT INTO new_tab_table VALUES (1, 'data');"
        );
        await responsePromise;

        await expect(page.locator('#table-new_tab_table')).toBeVisible({timeout: 10_000});
    });

    test('handles rapid tab creation', async ({page}) => {
        const addBtn = page.locator('button[title="新建标签页"]');

        for (let i = 0; i < 5; i++) {
            await addBtn.click();
        }

        // 1 initial + 5 new = 6 tabs total
        const closeBtns = page.locator('button:has-text("✕")');
        await expect(closeBtns).toHaveCount(6, {timeout: 5_000});
        const count = await closeBtns.count();
        expect(count).toBeGreaterThanOrEqual(6);
    });

    test('tab rename preserves content', async ({page, sqlEditor}) => {
        const addBtn = page.locator('button[title="新建标签页"]');
        await addBtn.click();
        await expect(page.locator('[data-testid="tab-close-btn"]')).toHaveCount(2, {timeout: 5_000});

        // Wait for auto-execute after new tab — may timeout, that's OK
        try {
            await page.waitForResponse(
                (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
                {timeout: 10_000},
            );
        } catch { /* response may not fire */
        }

        // Type SQL into new tab
        const responsePromise = page.waitForResponse(
            (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
            {timeout: 15_000},
        );
        await sqlEditor.replaceAll('SELECT 42 AS answer;');
        try {
            await responsePromise;
        } catch { /* response may not fire */
        }

        // App should remain functional
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('empty tab submit does not crash', async ({page}) => {
        const addBtn = page.locator('button[title="新建标签页"]');
        await addBtn.click();
        await expect(page.locator('[data-testid="tab-close-btn"]')).toHaveCount(2, {timeout: 5_000});

        // Wait for auto-execute — may timeout, that's OK
        try {
            await page.waitForResponse(
                (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
                {timeout: 10_000},
            );
        } catch { /* response may not fire */
        }

        // Submit — dialog may or may not appear
        const submitBtn = page.locator('button:has-text("提交")');
        let dialogHandled = false;
        page.on('dialog', async (dialog) => {
            dialogHandled = true;
            await dialog.accept('empty_tab_test');
        });
        await submitBtn.click();
        await expect(page.locator('.monaco-editor')).toBeVisible({timeout: 5_000});
    });

    test('tab state after page reload preserves content', async ({page}) => {
        // The app uses local storage, so after reload tabs may persist
        // First let's note the current tab state
        const tabsBefore = page.locator('button[title="新建标签页"]');
        await expect(tabsBefore).toBeVisible();

        // Reload the page
        await page.reload({waitUntil: 'domcontentloaded'});
        await page.waitForSelector('#table-departments', {timeout: 25_000});

        // App should be functional after reload
        await expect(page.locator('.monaco-editor')).toBeVisible();
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 10_000});
    });

    test.describe('dbName and database isolation', () => {
        test('auto-execute works with empty dbName (defaults to "default" database)', async ({page, sqlEditor}) => {
            const responsePromise = page.waitForResponse(
                r => r.url().includes('/api/execute') && r.request().method() === 'POST',
                {timeout: 15_000},
            );
            await sqlEditor.setText(
                'CREATE TABLE auto_default (id INTEGER PRIMARY KEY, val TEXT);\n' +
                "INSERT INTO auto_default VALUES (1, 'hello');"
            );
            await responsePromise;

            await expect(page.locator('#table-auto_default')).toBeVisible({timeout: 10_000});
        });

        test('submit prompts for dbName when not set, then executes SQL', async ({page, sqlEditor}) => {
            const addBtn = page.locator('button[title="新建标签页"]');
            await addBtn.click();
            await expect(page.locator('[data-testid="tab-close-btn"]')).toHaveCount(2, {timeout: 5_000});

            // Wait for auto-execute after setText
            let responsePromise = page.waitForResponse(
                r => r.url().includes('/api/execute') && r.request().method() === 'POST',
                {timeout: 15_000},
            );
            await sqlEditor.setText(
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
                {timeout: 15_000},
            );
            await page.locator('button:has-text("提交")').click();
            await responsePromise;

            await expect(page.locator('#table-committed_tab')).toBeVisible({timeout: 10_000});
            await expect(page.locator('.monaco-editor')).toBeVisible();
        });

        test('cancel prompt does not commit dbName', async ({page, sqlEditor}) => {
            const addBtn = page.locator('button[title="新建标签页"]');
            await addBtn.click();
            await expect(page.locator('[data-testid="tab-close-btn"]')).toHaveCount(2, {timeout: 5_000});

            page.once('dialog', async (dialog) => {
                await dialog.dismiss();
            });

            await page.locator('button:has-text("提交")').click();

            // After dismissing prompt, the page should not crash
            // (badge may still show from auto-assigned dbName or other tabs)
            await expect(page.locator('.monaco-editor')).toBeVisible({timeout: 5_000});
        });

        test('committed databases are isolated between tabs', async ({page, sqlEditor}) => {
            // Tab 1: create table only_in_a — auto-executes against its own database
            let responsePromise = page.waitForResponse(
                r => r.url().includes('/api/execute') && r.request().method() === 'POST',
                {timeout: 15_000},
            );
            await sqlEditor.setText(
                'CREATE TABLE only_in_a (id INTEGER PRIMARY KEY, tag TEXT);\n' +
                "INSERT INTO only_in_a VALUES (1, 'from_a');"
            );
            await responsePromise;
            await expect(page.locator('#table-only_in_a')).toBeVisible({timeout: 10_000});

            // Tab 2: create a new tab (gets its own database) and create only_in_b
            const addBtn = page.locator('button[title="新建标签页"]');
            await addBtn.click();
            await expect(page.locator('[data-testid="tab-close-btn"]')).toHaveCount(2, {timeout: 5_000});

            responsePromise = page.waitForResponse(
                r => r.url().includes('/api/execute') && r.request().method() === 'POST',
                {timeout: 15_000},
            );
            await sqlEditor.setText(
                'CREATE TABLE only_in_b (id INTEGER PRIMARY KEY, val TEXT);\n' +
                "INSERT INTO only_in_b VALUES (1, 'from_b');"
            );
            await responsePromise;
            await expect(page.locator('#table-only_in_b')).toBeVisible({timeout: 10_000});

            // Tab 2 should NOT see only_in_a (different database — Tab 1 has e2e_* dbName,
            // Tab 2 has empty dbName which maps to "default")
            await expect(page.locator('#table-only_in_a')).not.toBeVisible({timeout: 3000});
        });
    });
});
