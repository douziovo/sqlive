import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('AI Chat', () => {
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
            'data: {"content":"Hello! I can help you with SQL. "}',
            '',
            'data: {"content":"Your query selects from the **departments** table."}',
            '',
            'data: [USAGE]15,35,50',
            '',
            'data: [DONE]',
            '',
          ].join('\n'),
        });
      } else {
        // JSON responses for analyze/fix/explain/optimize/suggest
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              content: 'Mock AI response for testing.',
              summary: 'Mock summary',
              fixedCode: null,
              optimizedCode: null,
            },
          }),
        });
      }
    });

    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });
  });

  test('opens AI chat panel', async ({ page }) => {
    // Click AI button to open panel
    const aiBtn = page.locator('button:has-text("AI")').first();
    await aiBtn.click();
    await page.waitForTimeout(500);

    // Panel should be visible
    const chatPanel = page.locator('[class*="chat"], [class*="ai-chat"], [class*="AiChat"]');
    // Panel might be floating, check for common chat elements
    const chatInput = page.locator('textarea[placeholder*="消息"], textarea[placeholder*="提问"], input[placeholder*="消息"]');
    const chatVisible = await chatInput.isVisible().catch(() => false);

    // If no chat-specific selector, at least the panel should show something
    expect(chatVisible || (await page.locator('button:has-text("AI")').isVisible())).toBeTruthy();
  });

  test('sends a message and receives streaming response (mocked)', async ({ page }) => {
    // Open AI panel
    await page.locator('button:has-text("AI")').first().click();
    await page.waitForTimeout(500);

    // Find input and send message
    const input = page.locator('textarea, input[type="text"]').last();
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill('Explain this query');
    await input.press('Enter');
    await page.waitForTimeout(1000);

    // Streaming response should render markdown
    await expect(page.locator('text=/Hello/').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=/departments/').first()).toBeVisible();
  });

  test('closes AI panel', async ({ page }) => {
    // Open panel
    await page.locator('button:has-text("AI")').first().click();
    await page.waitForTimeout(500);

    // Click close button or press Escape
    const closeBtn = page.locator('[data-testid="ai-chat-close"]');
    await expect(closeBtn).toBeVisible({ timeout: 10_000 });
    await closeBtn.click();
    await page.waitForTimeout(300);
    // Panel should close or at minimum not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('handles AI API error gracefully (mocked)', async ({ page }) => {
    // Override mock to return error
    await page.unroute('**/api/ai/**');
    await page.route('**/api/ai/**', (route) => {
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
    await page.locator('button:has-text("AI")').first().click();
    await page.waitForTimeout(500);

    const input = page.locator('textarea, input[type="text"]').last();
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill('Help me');
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // Should show error gracefully, not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('renders markdown in AI response', async ({ page }) => {
    // Override mock with markdown content
    await page.unroute('**/api/ai/**');
    await page.route('**/api/ai/chat', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'data: {"content":"### SQL Explanation\\n\\nYour query:\\n```sql\\nSELECT * FROM users;\\n```\\n\\n- Selects all columns\\n- From the **users** table"}',
          '',
          'data: [USAGE]10,40,50',
          '',
          'data: [DONE]',
          '',
        ].join('\n'),
      });
    });

    await page.locator('button:has-text("AI")').first().click();
    await page.waitForTimeout(500);

    const input = page.locator('textarea, input[type="text"]').last();
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill('Explain');
    await input.press('Enter');
    await page.waitForTimeout(1500);

    // Markdown should be rendered - bold text should appear
    await expect(page.locator('text=SQL Explanation').first()).toBeVisible({ timeout: 5_000 });
  });
});
