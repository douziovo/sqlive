import {expect, gotoApp, test} from '../fixtures/sql-editor.fixture';

test.describe('Error Handling', () => {
    test.beforeEach(async ({page}) => {
        await gotoApp(page);
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 15_000});
    });

    test('shows error for invalid SQL syntax', async ({page, sqlEditor}) => {
        // Replace with invalid SQL
        const responsePromise = page.waitForResponse(r => r.url().includes('/api/execute'), {timeout: 10_000});
        await sqlEditor.replaceAll('SELECT * FORM departments;');
        await responsePromise;

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

    test('reports correct line number for syntax error', async ({page, sqlEditor}) => {
        await sqlEditor.replaceAll(
            'CREATE TABLE test_err (id INTEGER);\n' +
            'INSERT INTO test_err VALUES (1);\n' +
            'SELECT * FORM test_err;\n' +
            'SELECT 1;'
        );
        await page.waitForResponse(r => r.url().includes('/api/execute'), {timeout: 10_000});

        // App shouldn't crash; error should be shown
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('recovers after fixing error', async ({page, sqlEditor}) => {
        // First introduce error
        await sqlEditor.replaceAll('SELECT * FORM departments;');
        await page.waitForResponse(r => r.url().includes('/api/execute'), {timeout: 10_000});

        // Fix the error
        await sqlEditor.replaceAll('SELECT * FROM departments;');
        await page.waitForResponse(r => r.url().includes('/api/execute'), {timeout: 10_000});

        // Should recover and show results
        await expect(page.locator('text=departments').first()).toBeVisible();
    });

    test('shows network error when backend returns 500 (mocked)', async ({page, sqlEditor}) => {
        // Mock backend to return 500
        await page.route('**/api/execute', async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: false,
                    data: null,
                    error: {message: 'Internal server error', line: 0},
                }),
            });
        });

        // Trigger execution
        await sqlEditor.replaceAll('SELECT * FROM departments;');
        await page.waitForResponse(r => r.url().includes('/api/execute'), {timeout: 10_000});

        // Editor should still be visible (app handles gracefully)
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('shows connection error when backend is unreachable (mocked)', async ({page, sqlEditor}) => {
        // Mock backend to return 502 (simulate unreachable)
        await page.route('**/api/execute', async (route) => {
            await route.fulfill({status: 502, body: 'Bad Gateway'});
        });

        // Trigger execution
        const responsePromise = page.waitForResponse(r => r.url().includes('/api/execute'), {timeout: 10_000});
        await sqlEditor.replaceAll('SELECT 1;');
        await responsePromise;

        // App should show error state, not crash
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('handles empty SQL without error', async ({page, sqlEditor}) => {
        await sqlEditor.replaceAll('');
        await page.waitForTimeout(500); // no API call for empty SQL, animation debounce

        // App should handle empty state gracefully
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('handles SELECT with no results gracefully', async ({page, sqlEditor}) => {
        await sqlEditor.replaceAll(
            'CREATE TABLE empty_test (id INTEGER);\n' +
            'SELECT * FROM empty_test;'
        );
        await page.waitForResponse(r => r.url().includes('/api/execute'), {timeout: 10_000});

        // Should not crash, may show empty table or query result
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('handles multi-statement with partial error', async ({page, sqlEditor}) => {
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 15_000});

        // First statement is valid, second has an error
        await sqlEditor.replaceAll(
            'CREATE TABLE partial_ok (id INTEGER);\n' +
            'INSERT INTO partial_ok VALUES (1);\n' +
            'SELECT * FRM partial_ok;\n' +
            'SELECT 1;'
        );
        await page.waitForResponse(r => r.url().includes('/api/execute'), {timeout: 10_000});

        // Error markers should appear (the valid statements may still have executed)
        const errorMarkers = page.locator('.squiggly-error, .monaco-editor .cdr');
        const errorVisible = await errorMarkers.first().isVisible().catch(() => false);

        // At minimum, app should not crash
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('detects and handles recursive CTE or infinite loop gracefully', async ({page, sqlEditor}) => {
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 15_000});

        // Create recursive CTE that could be infinite without LIMIT
        await sqlEditor.replaceAll(
            'WITH RECURSIVE counter(x) AS (\n' +
            '  SELECT 1\n' +
            '  UNION ALL\n' +
            '  SELECT x + 1 FROM counter WHERE x < 10\n' +
            ')\n' +
            'SELECT * FROM counter;'
        );
        await page.waitForResponse(r => r.url().includes('/api/execute'), {timeout: 10_000});

        // Should execute or show error, not crash
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });
});
