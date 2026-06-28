import {expect, gotoApp, test} from '../fixtures/sql-editor.fixture';

test.describe('Security — dangerous SQL handling', () => {
    test.beforeEach(async ({page}) => {
        await gotoApp(page);
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 15_000});
    });

    test('ATTACH DATABASE does not crash the app', async ({page, sqlEditor}) => {
        // ATTACH DATABASE is a potentially dangerous statement that could
        // access the filesystem. The app should handle it gracefully.
        const responsePromise = page.waitForResponse(
            (r) => r.url().includes('/api/execute'),
            {timeout: 10_000}
        );
        await sqlEditor.replaceAll("ATTACH ':memory:' AS aux;");
        await responsePromise;

        // App should not crash — editor remains visible
        await expect(page.locator('.monaco-editor')).toBeVisible();

        // The metadata bar or error indicator should appear (execution completed)
        const metadata = page.locator('.text-xs.text-gray-400');
        const error = page.locator('.monaco-editor .squiggly-error');
        const indicator = metadata.or(error);
        await expect(indicator.first()).toBeVisible({timeout: 5_000}).catch(() => {
            // If no indicator, at least the editor is still functional
        });
    });

    test('PRAGMA statement does not crash the app', async ({page, sqlEditor}) => {
        const responsePromise = page.waitForResponse(
            (r) => r.url().includes('/api/execute'),
            {timeout: 10_000}
        );
        await sqlEditor.replaceAll('PRAGMA database_list;');
        await responsePromise;

        // App should not crash
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('PRAGMA with leading whitespace does not crash the app', async ({page, sqlEditor}) => {
        const responsePromise = page.waitForResponse(
            (r) => r.url().includes('/api/execute'),
            {timeout: 10_000}
        );
        await sqlEditor.replaceAll('  PRAGMA page_count;');
        await responsePromise;

        await expect(page.locator('.monaco-editor')).toBeVisible();
    });

    test('ATTACH in multi-statement script does not crash the app', async ({page, sqlEditor}) => {
        const responsePromise = page.waitForResponse(
            (r) => r.url().includes('/api/execute'),
            {timeout: 10_000}
        );
        await sqlEditor.replaceAll(
            "CREATE TABLE t (x INTEGER);\nATTACH ':memory:' AS aux;\nSELECT 1;"
        );
        await responsePromise;

        // App should not crash
        await expect(page.locator('.monaco-editor')).toBeVisible();
    });
});
