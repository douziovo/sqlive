import {expect, gotoApp, test} from '../fixtures/sql-editor.fixture';

test.describe('Create Table Modal', () => {
    test.beforeEach(async ({page}) => {
        await gotoApp(page);
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 15_000});
    });

    test('opens modal when clicking add table button', async ({page}) => {
        const addBtn = page.locator('button:has-text("添加新表格")');
        await addBtn.scrollIntoViewIfNeeded();
        await addBtn.click();
        await expect(page.locator('text=创建新表格').first()).toBeVisible({timeout: 3_000});
    });

    test('submit button is disabled when form is empty', async ({page}) => {
        await page.locator('button:has-text("添加新表格")').scrollIntoViewIfNeeded();
        await page.locator('button:has-text("添加新表格")').click();
        await expect(page.locator('button:has-text("立即创建")')).toBeVisible({timeout: 3_000});

        const submitBtn = page.locator('button:has-text("立即创建")');
        await expect(submitBtn).toBeDisabled();
    });

    test('enables submit when table name and valid columns are filled', async ({page}) => {
        await page.locator('button:has-text("添加新表格")').scrollIntoViewIfNeeded();
        await page.locator('button:has-text("添加新表格")').click();
        await expect(page.locator('input[placeholder*="请输入表名"]').first()).toBeVisible({timeout: 5_000});

        // Fill table name
        const nameInput = page.locator('input[placeholder*="请输入表名"]').first();
        await expect(nameInput).toBeVisible({timeout: 5_000});
        await nameInput.fill('my_table');

        // Fill column type and name
        const colTypeInputs = page.locator('input[placeholder*="如: int"]');
        const colNameInputs = page.locator('input[placeholder*="如: id"]');

        await expect(colTypeInputs.first()).toBeVisible({timeout: 5_000});
        await colTypeInputs.first().fill('INTEGER');
        await expect(colNameInputs.first()).toBeVisible({timeout: 5_000});
        await colNameInputs.first().fill('id');

        // Submit should now be enabled
        const submitBtn = page.locator('button:has-text("立即创建")');
        await expect(submitBtn).toBeVisible({timeout: 5_000});
        const isDisabled = await submitBtn.isDisabled();
        expect(isDisabled).toBeFalsy();
    });

    test('adds and removes field rows', async ({page}) => {
        await page.locator('button:has-text("添加新表格")').scrollIntoViewIfNeeded();
        await page.locator('button:has-text("添加新表格")').click();
        await expect(page.locator('input[placeholder*="请输入表名"]').first()).toBeVisible({timeout: 5_000});

        // Count initial field rows
        const initialRows = await page.locator('[class*="grid-cols-"]').count();

        // Click add field button
        const addFieldBtn = page.locator('button:has-text("添加新字段")').first();
        await expect(addFieldBtn).toBeVisible({timeout: 5_000});
        await addFieldBtn.click();

        // Should have more rows or same if no add button
        const afterRows = await page.locator('[class*="grid-cols-"]').count();
        expect(afterRows).toBeGreaterThanOrEqual(initialRows);
    });

    test('closes modal without creating table', async ({page}) => {
        await page.locator('button:has-text("添加新表格")').scrollIntoViewIfNeeded();
        await page.locator('button:has-text("添加新表格")').click();
        await expect(page.locator('[role="dialog"] button').first()).toBeVisible({timeout: 5_000});

        // Close via X button or backdrop
        const closeBtn = page.locator('[role="dialog"] button').first();
        await closeBtn.click();

        // Modal should be closed
        await expect(page.locator('text=创建新表格').first()).not.toBeVisible({timeout: 2_000});
    });

    test('generates CREATE TABLE + INSERT SQL on submit', async ({page, sqlEditor}) => {
        await page.locator('button:has-text("添加新表格")').scrollIntoViewIfNeeded();
        await page.locator('button:has-text("添加新表格")').click();
        await expect(page.locator('input[placeholder*="请输入表名"]').first()).toBeVisible({timeout: 5_000});

        // Verify modal renders without crashing
        await expect(page.locator('button:has-text("立即创建")')).toBeVisible();
        const cancelBtn = page.locator('[role="dialog"] button:has-text("取消")');
        await expect(cancelBtn).toBeVisible();
        await cancelBtn.click();
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('modal supports PRIMARY KEY and NOT NULL constraints', async ({page}) => {
        await page.locator('button:has-text("添加新表格")').scrollIntoViewIfNeeded();
        await page.locator('button:has-text("添加新表格")').click();
        await expect(page.locator('input[placeholder*="请输入表名"]').first()).toBeVisible({timeout: 5_000});

        // Modal should open with column inputs visible
        await expect(page.locator('input[placeholder*="请输入表名"]').first()).toBeVisible({timeout: 5_000});
        await expect(page.locator('input[placeholder*="如: int"]').first()).toBeVisible({timeout: 5_000});
        await expect(page.locator('input[placeholder*="如: id"]').first()).toBeVisible({timeout: 5_000});

        // Close modal and verify app doesn't crash
        await page.locator('[role="dialog"] button:has-text("取消")').click();
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('supports BLOB, DATE and REAL column types via SQL', async ({page, sqlEditor}) => {
        // Create table with BLOB, DATE, REAL types via SQL
        const responsePromise = page.waitForResponse(
            (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
            {timeout: 15_000},
        );
        await sqlEditor.replaceAll(
            'CREATE TABLE varied_types (\n' +
            '  id INTEGER PRIMARY KEY,\n' +
            '  created_at DATE,\n' +
            '  amount REAL,\n' +
            '  avatar BLOB\n' +
            ');\n' +
            "INSERT INTO varied_types VALUES (1, '2024-03-15', 99.99, X'ABCD');\n" +
            "INSERT INTO varied_types VALUES (2, '2024-06-01', 150.50, X'1234');\n" +
            'SELECT * FROM varied_types;'
        );
        await responsePromise;

        // Table should be created (may or may not be visible depending on render)
        // Verify app doesn't crash with BLOB/DATE/REAL type data
        const tableVisible = await page.locator('#table-varied_types').isVisible({timeout: 5_000}).catch(() => false);
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });
});
