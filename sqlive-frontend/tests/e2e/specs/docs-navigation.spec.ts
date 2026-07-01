import {expect, gotoApp, test} from '../fixtures/sql-editor.fixture';

test.describe('Docs Navigation', () => {
    test('navigates from playground to docs and back', async ({page}) => {
        // D-06: AppHeader Docs button → /docs/intro; sidebar nav → /docs/usage/editor; wordmark → /
        await gotoApp(page);

        // Click AppHeader Docs button → navigate to /docs/intro
        const docsBtn = page.locator('[data-testid="docs-link-btn"]');
        await docsBtn.click();
        await expect(page).toHaveURL(/\/docs\/intro/);
        // Article H1 renders (markdown loaded + sanitized + v-html)
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});

        // Sidebar nav click → /docs/usage/editor
        const editorNav = page.locator('[data-testid="nav-usage-editor"]');
        await editorNav.click();
        await expect(page).toHaveURL(/\/docs\/usage\/editor/);
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});

        // Wordmark click → back to / (AppHeader is in RootLayout, single instance)
        const wordmark = page.locator('header button', {hasText: 'sqlive'}).first();
        await wordmark.click();
        await expect(page).toHaveURL(/\/$/);
    });

    test('sidebar highlights current route', async ({page}) => {
        // D-05: active nav item has bg-primary/10 class
        await page.goto('/docs/intro');
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});

        const introNav = page.locator('[data-testid="nav-intro"]');
        await expect(introNav).toHaveClass(/bg-primary\/10/);
        await expect(introNav).toHaveAttribute('aria-current', 'page');
    });

    test('all 6 navigation items visible in sidebar', async ({page}) => {
        // D-05: sidebar renders every NavItem from navigation.ts
        await page.goto('/docs/intro');
        await expect(page.locator('article h1').first()).toBeVisible({timeout: 10_000});

        const sidebar = page.locator('nav[aria-label="文档导航"]');
        const text = await sidebar.textContent();
        expect(text).toContain('项目介绍');
        expect(text).toContain('编辑器');
        expect(text).toContain('数据可视化');
        expect(text).toContain('AI 助手');
        expect(text).toContain('知识图谱');
        expect(text).toContain('变更日志');
    });
});
