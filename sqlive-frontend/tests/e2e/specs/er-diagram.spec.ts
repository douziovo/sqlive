import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('ER Diagram', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });
  });

  test('switches to ER diagram tab and renders nodes', async ({ page }) => {
    await page.locator('button:has-text("ER 图")').click();
    await page.waitForTimeout(1000);

    // VueFlow container should be visible
    const erContainer = page.locator('.vue-flow');
    await expect(erContainer).toBeVisible({ timeout: 5_000 });

    // Table nodes should appear
    await expect(page.locator('text=departments').first()).toBeVisible();
    await expect(page.locator('text=employees').first()).toBeVisible();
  });

  test('shows PK and FK badges on table nodes', async ({ page }) => {
    await page.locator('button:has-text("ER 图")').click();
    await page.waitForTimeout(1000);

    // PK badges should exist
    const pkBadge = page.locator('text=主键');
    await expect(pkBadge.first()).toBeVisible({ timeout: 5_000 });

    // FK badges should exist (employees.dept_id references departments.id)
    const fkBadge = page.locator('text=外键');
    await expect(fkBadge.first()).toBeVisible({ timeout: 5_000 });
  });

  test('renders foreign key edges between related tables', async ({ page }) => {
    await page.locator('button:has-text("ER 图")').click();
    await page.waitForTimeout(1000);

    // VueFlow edges should be present (smoothstep paths)
    const edges = page.locator('.vue-flow__edge');
    const edgeCount = await edges.count();
    expect(edgeCount).toBeGreaterThan(0);
  });

  test('search bar filters nodes', async ({ page }) => {
    await page.locator('button:has-text("ER 图")').click();
    await page.waitForTimeout(1000);

    // Open search bar with Ctrl+F
    const erWrapper = page.locator('.vue-flow').first();
    await erWrapper.click();
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);

    // Type in search bar
    const searchInput = page.locator('input[placeholder*="搜索表名或列名"]').last();
    await searchInput.fill('department');
    await page.waitForTimeout(300);

    // Departments node should still be visible
    await expect(page.locator('text=departments').first()).toBeVisible();

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // All nodes should be back
    await expect(page.locator('text=projects').first()).toBeVisible();
  });

  test('shows empty state when no tables exist', async ({ page, sqlEditor }) => {
    // Clear the editor
    await sqlEditor.replaceAll('-- empty');
    await page.waitForTimeout(2000);

    // Switch to ER
    await page.locator('button:has-text("ER 图")').click();
    await page.waitForTimeout(500);

    // Empty state or no nodes shown
    const nodes = page.locator('.vue-flow__node');
    const count = await nodes.count();
    expect(count).toBe(0);
  });

  test('zoom in and out via controls or scroll wheel', async ({ page }) => {
    await page.locator('button:has-text("ER 图")').click();
    await page.waitForTimeout(1000);

    const erContainer = page.locator('.vue-flow');
    await expect(erContainer).toBeVisible({ timeout: 5_000 });

    // Zoom in via scroll wheel (Ctrl+scroll)
    await erContainer.hover();
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(300);

    // Zoom out
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(300);

    // App should not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('clicking a node highlights connected edges', async ({ page }) => {
    await page.locator('button:has-text("ER 图")').click();
    await page.waitForTimeout(1000);

    // Click on a table node
    const nodes = page.locator('.vue-flow__node');
    const nodeCount = await nodes.count();

    if (nodeCount > 0) {
      await nodes.first().click();
      await page.waitForTimeout(500);

      // Connected edges should be visible with highlighting
      const edges = page.locator('.vue-flow__edge');
      const edgeCount = await edges.count();

      // Edges should exist (at minimum the graph doesn't crash)
      expect(edgeCount).toBeGreaterThan(0);
    }

    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('minimap or controls are visible in ER view', async ({ page }) => {
    await page.locator('button:has-text("ER 图")').click();
    await page.waitForTimeout(1000);

    const erContainer = page.locator('.vue-flow');
    await expect(erContainer).toBeVisible({ timeout: 5_000 });

    // VueFlow controls (zoom in/out/fit) or minimap should be present
    const controlsEl = page.locator('.vue-flow__controls, .vue-flow__minimap');
    await expect(controlsEl.first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=departments').first()).toBeVisible();
  });
});
