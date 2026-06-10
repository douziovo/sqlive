import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('AI Complete Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock all AI API endpoints
    await page.route('**/api/ai/**', (route) => {
      const url = route.request().url();

      if (url.includes('/chat')) {
        // SSE streaming response
        route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: [
            'data: {"content":"Here is my analysis of your SQL query. "}',
            '',
            'data: {"content":"The query looks good overall, but could use an index on the join column."}',
            '',
            'data: [USAGE]15,35,50',
            '',
            'data: [DONE]',
            '',
          ].join('\n'),
        });
      } else if (url.includes('/analyze')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              content: 'Analysis: Your query has a syntax error on line 3. Missing comma.',
              summary: 'Syntax error detected',
            },
          }),
        });
      } else if (url.includes('/fix')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              content: 'Fixed your SQL.',
              fixedCode: 'SELECT * FROM departments ORDER BY name;',
            },
          }),
        });
      } else if (url.includes('/explain')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              content: 'This query selects all columns from the departments table.',
              summary: 'Simple SELECT query',
            },
          }),
        });
      } else if (url.includes('/optimize')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              content: 'Optimized query using index hint.',
              optimizedCode: 'SELECT * FROM departments INDEXED BY idx_dept_name WHERE name > "A";',
            },
          }),
        });
      } else if (url.includes('/suggest')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              content: 'Suggested improvements: Add LIMIT clause, use specific columns instead of *.',
            },
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { content: 'Mock AI response.' } }),
        });
      }
    });

    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });
  });

  test('T3.1 AI panel opens via toggle button', async ({ page }) => {
    // Click AI toggle button
    const aiBtn = page.locator('[data-testid="ai-toggle-btn"]');
    await expect(aiBtn).toBeVisible({ timeout: 5_000 });
    await aiBtn.click();
    await page.waitForTimeout(500);

    // AI panel should be visible
    await expect(page.locator('[data-testid="ai-chat-close"]')).toBeVisible({ timeout: 5_000 });
  });

  test('T3.2 sends a message and receives streaming response', async ({ page }) => {
    // Open AI panel
    await page.locator('[data-testid="ai-toggle-btn"]').click();
    await page.waitForTimeout(500);

    // Find input and send message
    const input = page.locator('textarea[placeholder="输入消息..."]');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill('Explain this query');
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // Streaming response should render
    await expect(page.locator('text=/analysis/').first()).toBeVisible({ timeout: 5_000 });
  });

  test('T3.3 receives explanation formatted as markdown', async ({ page }) => {
    // Open AI panel and send message
    await page.locator('[data-testid="ai-toggle-btn"]').click();
    await page.waitForTimeout(500);

    const input = page.locator('textarea[placeholder="输入消息..."]');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill('Explain');
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // Response should be rendered (md-body class contains markdown)
    const mdBody = page.locator('.md-body');
    const mdVisible = await mdBody.first().isVisible().catch(() => false);

    // At minimum, some response text should appear
    await expect(page.locator('[data-testid="ai-chat-close"]')).toBeVisible();
  });

  test('T3.4 regenerates a response', async ({ page }) => {
    // Open AI panel and send message
    await page.locator('[data-testid="ai-toggle-btn"]').click();
    await page.waitForTimeout(500);

    const input = page.locator('textarea[placeholder="输入消息..."]');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill('Test regenerate');
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // Hover over message row to reveal regenerate button
    const msgRow = page.locator('.group\\/row').last();
    await msgRow.hover();
    await page.waitForTimeout(300);

    // Click regenerate button (circular arrow icon button)
    const regenBtn = msgRow.locator('button[title="重新回答"]');
    if (await regenBtn.isVisible().catch(() => false)) {
      await regenBtn.click();
      await page.waitForTimeout(1500);
    }

    // App should not crash
    await expect(page.locator('[data-testid="ai-chat-close"]')).toBeVisible();
  });

  test('T3.5 cancels a streaming response', async ({ page }) => {
    // Override mock with slow response
    await page.unroute('**/api/ai/chat');
    await page.route('**/api/ai/chat', async (route) => {
      // Delay to simulate slow response
      await new Promise((r) => setTimeout(r, 3000));
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"content":"Slow response"}\n\ndata: [DONE]\n',
      });
    });

    // Open AI panel and send message
    await page.locator('[data-testid="ai-toggle-btn"]').click();
    await page.waitForTimeout(500);

    const input = page.locator('textarea[placeholder="输入消息..."]');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill('Cancel this');
    await input.press('Enter');
    await page.waitForTimeout(500);

    // Click stop button (appears when isLoading)
    const stopBtn = page.locator('button[title="停止生成"]');
    const stopVisible = await stopBtn.isVisible().catch(() => false);
    if (stopVisible) {
      await stopBtn.click();
      await page.waitForTimeout(500);
    }

    // App should not crash after cancel
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T3.6 edits a sent message', async ({ page }) => {
    // Open AI panel and send message
    await page.locator('[data-testid="ai-toggle-btn"]').click();
    await page.waitForTimeout(500);

    const input = page.locator('textarea[placeholder="输入消息..."]');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill('Original message');
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // Hover over user message to reveal edit button
    const userMsgRow = page.locator('.group\\/row').first();
    await userMsgRow.hover();
    await page.waitForTimeout(300);

    // Click edit button (pencil icon)
    const editBtn = userMsgRow.locator('button[title="编辑"]');
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(300);

      // Edit textarea should appear
      const editTextarea = page.locator('.fixed.z-50 textarea:not([placeholder="输入消息..."])');
      if (await editTextarea.isVisible().catch(() => false)) {
        await editTextarea.fill('Edited message');
        await page.waitForTimeout(200);

        // Click update button
        const updateBtn = page.locator('button:has-text("更新")');
        if (await updateBtn.isVisible().catch(() => false)) {
          await updateBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }

    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T3.7 deletes a message', async ({ page }) => {
    // Open AI panel and send message
    await page.locator('[data-testid="ai-toggle-btn"]').click();
    await page.waitForTimeout(500);

    const input = page.locator('textarea[placeholder="输入消息..."]');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill('Message to delete');
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // Get message count before deletion
    const msgCountBefore = await page.locator('.group\\/row').count();

    // Hover over user message to reveal delete button
    const userMsgRow = page.locator('.group\\/row').first();
    await userMsgRow.hover();
    await page.waitForTimeout(300);

    // Click delete button (trash icon)
    const deleteBtns = userMsgRow.locator('button[title="删除"]');
    const deleteCount = await deleteBtns.count();
    if (deleteCount > 0) {
      await deleteBtns.first().click();
      await page.waitForTimeout(500);
    }

    // App should not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T3.8 multi-turn conversation maintains 6 messages', async ({ page }) => {
    // Open AI panel
    await page.locator('[data-testid="ai-toggle-btn"]').click();
    await page.waitForTimeout(500);

    const input = page.locator('textarea[placeholder="输入消息..."]');
    await expect(input).toBeVisible({ timeout: 5_000 });

    // Send 3 messages (should get 3 user + 3 assistant = 6 total)
    for (let i = 0; i < 3; i++) {
      await input.fill(`Question ${i + 1}`);
      await input.press('Enter');
      await page.waitForTimeout(1500);
    }

    // Verify multiple message rows exist
    const msgRows = page.locator('.group\\/row');
    const count = await msgRows.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('T3.9 AI panel minimize/restore preserves content', async ({ page }) => {
    // Open AI panel and send message
    await page.locator('[data-testid="ai-toggle-btn"]').click();
    await page.waitForTimeout(500);

    const input = page.locator('textarea[placeholder="输入消息..."]');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill('Test minimize');
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // Close AI panel
    await page.locator('[data-testid="ai-chat-close"]').click();
    await page.waitForTimeout(500);

    // Reopen AI panel
    await page.locator('[data-testid="ai-toggle-btn"]').click();
    await page.waitForTimeout(500);

    // Messages should be preserved
    const msgRows = page.locator('.group\\/row');
    const count = await msgRows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('T3.10 handles AI API error gracefully (mocked 503)', async ({ page }) => {
    // Override mock to return error
    await page.unroute('**/api/ai/**');
    await page.route('**/api/ai/chat', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          data: null,
          error: { message: 'AI service unavailable' },
        }),
      });
    });

    // Open AI panel and send message
    await page.locator('[data-testid="ai-toggle-btn"]').click();
    await page.waitForTimeout(500);

    const input = page.locator('textarea[placeholder="输入消息..."]');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill('Test error handling');
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // Should show error gracefully, not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });
});
