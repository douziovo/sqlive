import {expect, gotoApp, test} from '../fixtures/sql-editor.fixture';

/**
 * Docs Search E2E (D-07 search, D-13 Ctrl+K / `/` shortcuts).
 *
 * Verifies the full search flow: type → dropdown → click → navigate.
 * Verifies keyboard shortcuts: Ctrl+K global, `/` docs-scoped, `/` not on playground.
 */
test.describe('Docs Search', () => {
    test('search finds editor article', async ({page}) => {
        // D-07: type '编辑' → dropdown shows '编辑器' → click → /docs/usage/editor
        // Rule 1 deviation: plan says fill 'editor' but stub content is Chinese-only
        // ('编辑器 编写中'). MiniSearch prefix/fuzzy can't bridge EN→ZH, so use the
        // Chinese query that matches the actual .md content. See SUMMARY deviations.
        await page.goto('/docs/intro');
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});

        const searchInput = page.locator('[data-testid="docs-search-input"]');
        await searchInput.focus();
        // D-07: focus triggers ensureIndex (lazy MiniSearch build). Wait for the
        // index to be ready before typing — the input exposes data-index-ready.
        await expect(searchInput).toHaveAttribute('data-index-ready', 'true', {timeout: 5_000});
        await searchInput.fill('编辑');

        // Dropdown results appear
        const results = page.locator('[data-testid="search-results"]');
        await expect(results).toBeVisible({timeout: 5_000});
        await expect(results).toContainText('编辑器');

        // Click the result → navigate to /docs/usage/editor
        await results.locator('button', {hasText: '编辑器'}).click();
        await expect(page).toHaveURL(/\/docs\/usage\/editor/);
    });

    test('Ctrl+K focuses search box', async ({page}) => {
        // D-13: Ctrl+K is global — focuses search on any docs route
        await page.goto('/docs/intro');
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});

        await page.keyboard.press('Control+k');
        await expect(page.locator('[data-testid="docs-search-input"]')).toBeFocused();
    });

    test('slash focuses search in docs subtree', async ({page}) => {
        // D-13: `/` focuses search when in /docs/* subtree
        await page.goto('/docs/intro');
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});

        // Press `/` — should focus search input (target is body, not input/textarea)
        await page.keyboard.press('/');
        await expect(page.locator('[data-testid="docs-search-input"]')).toBeFocused();
    });

    test('slash does not focus search on playground', async ({page}) => {
        // D-13 (Pitfall 10): `/` does NOT focus search on / route (avoids editor conflict).
        // On `/` route, DocsSearchBox is not rendered at all (it lives in DocsSidebar,
        // which is only in /docs/* routes). Verify the input doesn't exist —
        // this is the strongest assertion that `/` can't trigger search focus.
        await gotoApp(page);
        await expect(page.locator('#table-departments')).toBeVisible({timeout: 15_000});

        await page.keyboard.press('/');
        // Search input should NOT exist on the playground route
        await expect(page.locator('[data-testid="docs-search-input"]')).toHaveCount(0);
    });
});
