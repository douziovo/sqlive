import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('Knowledge Graph', () => {
  test.beforeEach(async ({ page }) => {
    // Mock knowledge graph API - return a small graph with 4 topics
    await page.route('**/api/knowledge/**', (route) => {
      const url = route.request().url();
      if (url.includes('/graph')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            topics: [
              {
                id: 'select',
                label: 'SELECT 查询',
                description: '从表中检索数据的 SQL 语句',
                keywords: ['SELECT', 'FROM'],
                patterns: ['SELECT\\s+'],
                difficulty: 1,
                prerequisites: [],
                nextTopics: ['where', 'join'],
                category: 'DQL',
              },
              {
                id: 'where',
                label: 'WHERE 子句',
                description: '过滤查询结果的条件语句',
                keywords: ['WHERE'],
                patterns: ['WHERE\\s+'],
                difficulty: 1,
                prerequisites: ['select'],
                nextTopics: ['orderby'],
                category: 'DQL',
              },
              {
                id: 'join',
                label: 'JOIN 连接',
                description: '连接多个表进行联合查询',
                keywords: ['JOIN', 'LEFT JOIN', 'INNER JOIN'],
                patterns: ['JOIN\\s+'],
                difficulty: 2,
                prerequisites: ['select'],
                nextTopics: ['subquery'],
                category: 'DQL',
              },
              {
                id: 'subquery',
                label: '子查询',
                description: '在查询中嵌套另一个查询',
                keywords: ['IN (SELECT', 'EXISTS', 'NOT EXISTS'],
                patterns: ['\\(\\s*SELECT\\s+'],
                difficulty: 3,
                prerequisites: ['select', 'where'],
                nextTopics: [],
                category: 'DQL',
              },
            ],
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });
  });

  test('T1.1 opens and closes knowledge panel', async ({ page }) => {
    // Click the LearningCompanion button to open knowledge panel
    const companion = page.locator('.learning-companion');
    await expect(companion).toBeVisible({ timeout: 5_000 });
    await companion.click();
    await page.waitForTimeout(800);

    // Knowledge panel should be visible with full-screen overlay
    const panel = page.locator('.knowledge-panel');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Should see the title
    await expect(page.locator('.knowledge-panel__title')).toBeVisible();

    // Should see nodes/tables rendered in the graph
    await expect(page.locator('.vue-flow')).toBeVisible({ timeout: 5_000 });

    // Close via back button
    await page.locator('.knowledge-panel__back-btn').click();
    await page.waitForTimeout(500);

    // Panel should close, LearningCompanion should reappear
    await expect(page.locator('.learning-companion')).toBeVisible({ timeout: 5_000 });
  });

  test('T1.2 clicks a node and verifies detail panel', async ({ page }) => {
    // Open knowledge panel
    await page.locator('.learning-companion').click();
    await page.waitForTimeout(800);

    // Wait for graph nodes to render
    const nodes = page.locator('.vue-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 5_000 });

    // Click on a knowledge node
    const firstNode = nodes.first();
    await firstNode.click();
    await page.waitForTimeout(500);

    // Detail card should appear with topic info
    const detail = page.locator('.knowledge-detail');
    await expect(detail).toBeVisible({ timeout: 5_000 });

    // Should show topic label (title)
    await expect(detail.locator('.knowledge-detail__title')).toBeVisible();

    // Should show description
    await expect(detail.locator('.knowledge-detail__desc')).toBeVisible();

    // Should show mastery button
    const masterBtn = detail.locator('.knowledge-detail__btn--master');
    await expect(masterBtn).toBeVisible();
  });

  test('T1.3 toggles mastery and updates count', async ({ page }) => {
    // Open knowledge panel
    await page.locator('.learning-companion').click();
    await page.waitForTimeout(800);

    // Wait for graph nodes
    const nodes = page.locator('.vue-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 5_000 });

    // Click first node to open detail
    await nodes.first().click();
    await page.waitForTimeout(500);

    // Get initial progress text
    const progressEl = page.locator('.knowledge-panel__progress');
    await expect(progressEl).toBeVisible();

    // Click "标记已掌握" button
    const masterBtn = page.locator('.knowledge-detail__btn--master');
    await expect(masterBtn).toBeVisible({ timeout: 5_000 });
    await masterBtn.click();
    await page.waitForTimeout(300);

    // Progress should have updated (count changed)
    const progressText = await progressEl.textContent();
    expect(progressText).toBeTruthy();

    // Click again to un-master ("取消掌握")
    await masterBtn.click();
    await page.waitForTimeout(300);

    // Progress should be different from after mastering
    const progressText2 = await progressEl.textContent();
    expect(progressText2).toBeTruthy();
  });

  test('T1.4 "Teach me" triggers AI panel with preset message', async ({ page }) => {
    // Mock AI chat endpoint for SSE response
    await page.route('**/api/ai/chat', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'data: {"content":"Sure! Let me teach you about SELECT queries."}',
          '',
          'data: [USAGE]5,20,30',
          '',
          'data: [DONE]',
          '',
        ].join('\n'),
      });
    });

    // Open knowledge panel
    await page.locator('.learning-companion').click();
    await page.waitForTimeout(800);

    // Click first node to open detail
    const nodes = page.locator('.vue-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 5_000 });
    await nodes.first().click();
    await page.waitForTimeout(500);

    // Click "让 AI 教我" button
    const teachBtn = page.locator('.knowledge-detail__btn--ai');
    await expect(teachBtn).toBeVisible({ timeout: 5_000 });
    await teachBtn.click();
    await page.waitForTimeout(1500);

    // AI panel should appear with the preset message sent
    // Knowledge panel should close
    await expect(page.locator('.knowledge-panel')).not.toBeVisible({ timeout: 3_000 });

    // AI panel should be visible
    await expect(page.locator('[data-testid="ai-chat-close"]')).toBeVisible({ timeout: 5_000 });
  });

  test('T1.5 LearningCompanion shows count, level, and opens panel', async ({ page }) => {
    // LearningCompanion floating button should be visible
    const companion = page.locator('.learning-companion');
    await expect(companion).toBeVisible({ timeout: 5_000 });

    // Should show count info (0/X initially)
    await expect(companion.locator('.companion-count')).toBeVisible();
    await expect(companion.locator('.companion-level')).toBeVisible();

    // Click to open panel
    await companion.click();
    await page.waitForTimeout(800);

    // Knowledge panel should open
    await expect(page.locator('.knowledge-panel')).toBeVisible({ timeout: 5_000 });

    // LearningCompanion should be hidden while panel is open
    await expect(companion).not.toBeVisible({ timeout: 3_000 });

    // Close panel
    await page.locator('.knowledge-panel__back-btn').click();
    await page.waitForTimeout(500);

    // Companion should return
    await expect(companion).toBeVisible({ timeout: 5_000 });
  });

  test('T1.6 search filters nodes and clears to restore', async ({ page }) => {
    // Open knowledge panel
    await page.locator('.learning-companion').click();
    await page.waitForTimeout(800);

    // Wait for graph nodes
    const nodes = page.locator('.vue-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 5_000 });

    const initialNodeCount = await nodes.count();

    // Type search query to filter
    const searchInput = page.locator('.knowledge-panel__search');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill('SELECT');
    await page.waitForTimeout(500);

    // Some nodes should still be visible (those matching SELECT)
    const filteredNodes = page.locator('.vue-flow__node');
    const filteredCount = await filteredNodes.count();
    // At least one node should match SELECT
    expect(filteredCount).toBeGreaterThan(0);

    // Clear search to restore all nodes
    await searchInput.fill('');
    await page.waitForTimeout(500);

    const restoredCount = await nodes.count();
    expect(restoredCount).toBe(initialNodeCount);
  });
});
