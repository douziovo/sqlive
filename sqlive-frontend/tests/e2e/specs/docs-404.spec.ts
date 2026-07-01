import {expect, test} from '../fixtures/sql-editor.fixture';

/**
 * Docs 404 E2E (Error Handling 4.1 — unknown doc redirects to not-found).
 *
 * Verifies NotFoundPage renders heading + recommendation list + back-to-playground.
 */
test.describe('Docs 404', () => {
    test('unknown doc redirects to not-found with recommendations', async ({page}) => {
        // Error Handling 4.1: /docs/nonexistent → redirect to /docs/not-found
        await page.goto('/docs/nonexistent');

        await expect(page).toHaveURL(/\/docs\/not-found/);
        await expect(page.getByText('文档不存在')).toBeVisible();

        // Recommendation list with 5 items
        const list = page.locator('[data-testid="recommendation-list"]');
        await expect(list).toBeVisible();
        const items = list.locator('li');
        await expect(items).toHaveCount(5);
    });

    test('back-to-playground button navigates to /', async ({page}) => {
        // NotFoundPage CTA: "返回主玩法" → router.push('/')
        await page.goto('/docs/not-found');
        await expect(page.getByText('文档不存在')).toBeVisible();

        const cta = page.getByRole('button', {name: '返回主玩法'});
        await cta.click();
        await expect(page).toHaveURL(/\/$/);
    });
});
