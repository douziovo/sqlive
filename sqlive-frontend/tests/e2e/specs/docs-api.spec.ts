import {expect, test} from '../fixtures/sql-editor.fixture';

/**
 * Docs API E2E (D-04 — Scalar renders /v3/api-docs; error state on fetch failure).
 *
 * Test 1 requires the backend springdoc endpoint to be live (Plan 02 delivers this).
 * Test 2 mocks /v3/api-docs to return 500 → ApiPage shows error state + retry button.
 */
test.describe('Docs API', () => {
    test('Scalar renders /api/execute endpoint', async ({page}) => {
        // D-04: /docs/api loads Scalar, fetches /v3/api-docs, renders /api/execute
        await page.goto('/docs/api');

        // Wait for loading to finish + error state to NOT appear (proves fetch succeeded).
        // Scalar dynamic import + /v3/api-docs fetch — allow 15s.
        await expect(page.getByText('加载 API 文档...')).not.toBeVisible({timeout: 15_000});
        await expect(page.getByText('API 文档暂时不可用')).not.toBeVisible();

        // Scalar renders the OpenAPI spec — '/api/execute' path appears in the DOM
        // (may be in a collapsed section, so check attachment not visibility).
        const endpointPath = page.getByText('/api/execute').first();
        await endpointPath.waitFor({state: 'attached', timeout: 10_000});
        expect(await endpointPath.count()).toBeGreaterThan(0);
    });

    test('mock fetch failure shows error state + retry button', async ({page}) => {
        // D-04 Error Handling 4.2: both fetches fail → error state + retry button
        await page.route('**/v3/api-docs', (route) => {
            route.fulfill({status: 500});
        });

        await page.goto('/docs/api');

        // Error state appears (after first fetch + 500ms retry + second fetch all fail)
        await expect(page.getByText('API 文档暂时不可用')).toBeVisible({timeout: 10_000});

        // UI-SPEC FLAG 1: retry button text is "重新加载 API 文档" (verb+noun)
        const retryBtn = page.getByRole('button', {name: '重新加载 API 文档'});
        await expect(retryBtn).toBeVisible();
    });
});
