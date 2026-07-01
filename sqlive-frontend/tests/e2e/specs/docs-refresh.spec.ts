import {expect, test} from '../fixtures/sql-editor.fixture';

test.describe('Docs Deep Link Refresh', () => {
    test('deep link survives refresh (SPA fallback)', async ({page}) => {
        // D-02: /docs/usage/editor URL is shareable + refreshable.
        // In dev mode, Vite dev server provides SPA fallback (serves index.html
        // for unknown routes). In production, Spring Boot's NoResourceFoundException
        // handler (Plan 02, D-10) forwards to /index.html.
        await page.goto('/docs/usage/editor');
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});
        const h1Before = await page.locator('article h1').first().textContent();

        // Refresh — URL + content must survive
        await page.reload();
        await expect(page).toHaveURL(/\/docs\/usage\/editor/);
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});
        const h1After = await page.locator('article h1').first().textContent();

        expect(h1After).toBe(h1Before);
    });

    test('deep link to /docs/intro survives refresh', async ({page}) => {
        // D-02: shallow docs link also refreshable
        await page.goto('/docs/intro');
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});

        await page.reload();
        await expect(page).toHaveURL(/\/docs\/intro/);
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});
    });
});
