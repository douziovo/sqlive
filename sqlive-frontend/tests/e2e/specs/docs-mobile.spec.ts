import {expect, test} from '../fixtures/sql-editor.fixture';

/**
 * Docs Mobile Responsive E2E (D-12 — sidebar hidden on mobile, hamburger opens drawer).
 *
 * Verifies:
 * - At 375px viewport, sidebar is hidden (CSS-driven md:flex/md:hidden).
 * - Hamburger button opens drawer with sidebar.
 * - Selecting an article auto-closes the drawer.
 * - document.title updates per route.
 */
test.describe('Docs Mobile Responsive', () => {
    test('mobile viewport hides sidebar, hamburger opens drawer, navigate auto-closes', async ({page}) => {
        // D-12: 375px viewport → sidebar hidden, hamburger visible
        await page.setViewportSize({width: 375, height: 667});
        await page.goto('/docs/intro');
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});

        // Desktop sidebar (hidden via `hidden md:flex`) — use .first() to avoid
        // strict-mode violation (mobile drawer also renders a sidebar, but inside
        // a closed Dialog so not visible until hamburger clicked).
        const desktopSidebar = page.locator('nav[aria-label="文档导航"]').first();
        await expect(desktopSidebar).not.toBeVisible();

        // Click hamburger (mobile-menu-btn from DocsLayout Plan 03)
        const hamburger = page.locator('[data-testid="mobile-menu-btn"]');
        await hamburger.click();

        // Drawer opens — the mobile drawer sidebar (inside [role="dialog"]) is visible
        const drawerSidebar = page.locator('[role="dialog"] nav[aria-label="文档导航"]');
        await expect(drawerSidebar).toBeVisible({timeout: 5_000});

        // Click an article → drawer auto-closes (@navigate handler)
        const editorNav = drawerSidebar.locator('[data-testid="nav-usage-editor"]');
        await editorNav.click();
        await expect(page).toHaveURL(/\/docs\/usage\/editor/);
        // Drawer auto-closes after navigation
        await expect(drawerSidebar).not.toBeVisible({timeout: 5_000});
    });

    test('document.title changes per route', async ({page}) => {
        // D-12: document.title = '{H1} · sqlive docs' per route
        await page.goto('/docs/intro');
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});
        const introTitle = await page.title();
        expect(introTitle).toContain('sqlive docs');

        await page.goto('/docs/usage/editor');
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});
        const editorTitle = await page.title();
        expect(editorTitle).toContain('sqlive docs');
        // Title should differ between routes (different H1)
        expect(editorTitle).not.toBe(introTitle);
    });
});
