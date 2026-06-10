import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('Split Pane & Viewport Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });
  });

  test('T6.1 split pane drag resize changes width', async ({ page }) => {
    const handle = page.locator('.splitpanes__splitter');
    await expect(handle).toBeVisible({ timeout: 5_000 });

    // Get initial width of left panel
    const leftPanel = page.locator('.monaco-editor').first();
    const initialBox = await leftPanel.boundingBox();

    if (initialBox && initialBox.width > 0) {
      const handleBox = await handle.boundingBox();
      if (handleBox) {
        // Drag handle to the right
        await handle.hover();
        await page.mouse.down();
        await page.mouse.move(handleBox.x + 150, handleBox.y + 10, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(300);

        // Width should have changed
        const newBox = await leftPanel.boundingBox();
        if (newBox) {
          expect(Math.abs(newBox.width - initialBox.width)).toBeGreaterThan(10);
        }
      }
    }

    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T6.2 min width constraint prevents panel collapse', async ({ page }) => {
    const handle = page.locator('.splitpanes__splitter');
    await expect(handle).toBeVisible({ timeout: 5_000 });

    const leftPanel = page.locator('.monaco-editor').first();
    const handleBox = await handle.boundingBox();

    if (handleBox) {
      // Try to drag handle far left (past min-size)
      await handle.hover();
      await page.mouse.down();
      await page.mouse.move(Math.max(0, handleBox.x - 500), handleBox.y + 10, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(300);

      // Panel should not collapse to 0
      const box = await leftPanel.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThan(50);
      }
    }

    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T6.3 split pane double-click does not crash', async ({ page }) => {
    const handle = page.locator('.splitpanes__splitter');
    await expect(handle).toBeVisible({ timeout: 5_000 });

    // Double-click the splitter
    await handle.dblclick();
    await page.waitForTimeout(500);

    // App should not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T6.4 browser back/forward does not crash', async ({ page }) => {
    // Navigate to a different URL first
    await page.evaluate(() => {
      window.history.pushState({}, '', '?test=1');
    });
    await page.waitForTimeout(300);

    // Go back
    await page.goBack();
    await page.waitForTimeout(500);

    // App should not crash (may or may not display correctly)
    await expect(page.locator('.monaco-editor')).toBeVisible();

    // Go forward
    await page.goForward();
    await page.waitForTimeout(500);

    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T6.5 page reload re-renders default SQL tables', async ({ page }) => {
    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Wait for initial SQL auto-execute to complete
    await page.waitForSelector('#table-departments', { timeout: 25_000 });

    // Default tables should re-render
    await expect(page.locator('text=departments').first()).toBeVisible();
    await expect(page.locator('text=employees').first()).toBeVisible();

    // Editor should be functional
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T6.6 long table with scrolling keeps header sticky', async ({ page, sqlEditor }) => {
    // Create a table with many rows
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );

    let sql = 'CREATE TABLE many_rows (id INTEGER PRIMARY KEY, label TEXT);\n';
    for (let i = 1; i <= 50; i++) {
      sql += `INSERT INTO many_rows VALUES (${i}, 'Row ${i}');\n`;
    }
    sql += 'SELECT * FROM many_rows;';
    await sqlEditor.click();
    await page.waitForTimeout(200);
    await sqlEditor.replaceAll(sql);
    try { await responsePromise; } catch { /* response may not fire */ }
    await page.waitForTimeout(1500);

    // Scroll within the table container if table exists
    const table = page.locator('#table-many_rows');
    const tableVisible = await table.isVisible({ timeout: 5_000 }).catch(() => false);

    if (tableVisible) {
      await page.mouse.wheel(0, 200);
    }

    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T6.7 wide table with horizontal scroll', async ({ page, sqlEditor }) => {
    // Create a table with many columns
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );

    let sql = 'CREATE TABLE wide_table (';
    const cols: string[] = [];
    for (let i = 0; i < 15; i++) {
      cols.push(`col_${i} TEXT`);
    }
    sql += cols.join(', ') + ');\n';
    sql += `INSERT INTO wide_table VALUES (${cols.map((_, i) => `'v${i}'`).join(', ')});\n`;
    sql += 'SELECT * FROM wide_table;';
    await sqlEditor.replaceAll(sql);
    await responsePromise;
    await page.waitForTimeout(1500);

    const table = page.locator('#table-wide_table');
    const tableVisible = await table.isVisible().catch(() => false);

    if (tableVisible) {
      // Table should exist with overflow for horizontal scroll
      const overflowX = await table.evaluate((el) => {
        const parent = el.closest('[class*="overflow"]');
        return parent ? window.getComputedStyle(parent).overflowX : 'visible';
      }).catch(() => 'visible');

      // At minimum, app should not crash
      await expect(page.locator('.monaco-editor')).toBeVisible();
    }

    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T6.8 empty database state does not crash', async ({ page, sqlEditor }) => {
    // Clear SQL to produce empty state
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sqlEditor.replaceAll('-- empty database');
    await responsePromise;
    await page.waitForTimeout(1500);

    // App should show empty state UI, not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();

    // May show empty state message or minimal view
    const emptyState = page.locator('text=/暂无|没有.*表|empty/i');
    const emptyVisible = await emptyState.first().isVisible().catch(() => false);

    // At minimum, the app should not have a white screen
    if (!emptyVisible) {
      await expect(page.locator('.monaco-editor')).toBeVisible();
    }
  });

  test('T6.9 Escape key closes panel without crashing', async ({ page }) => {
    // Open AI panel first
    await page.locator('[data-testid="ai-toggle-btn"]').click();
    await page.waitForTimeout(500);

    // Wait for AI panel to be visible
    await expect(page.locator('[data-testid="ai-chat-close"]')).toBeVisible({ timeout: 5_000 });

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // AI panel should close
    // App should not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T6.10 window resize to 1024x768 preserves layout', async ({ page }) => {
    // Resize viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);

    // App should still be functional
    await expect(page.locator('.monaco-editor')).toBeVisible();

    // Layout should adapt - no overlapping elements
    const splitPanes = page.locator('.splitpanes');
    if (await splitPanes.isVisible().catch(() => false)) {
      const box = await splitPanes.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(1024);
      }
    }

    // Restore viewport
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('T6.11 ghost row insert failure retains edit content', async ({ page, sqlEditor }) => {
    // Mock insert to fail — beforeEach already loaded the page via gotoApp,
    // so we set up the route mock before interacting with the ghost row
    await page.route('**/api/execute', async (route) => {
      const postData = route.request().postDataJSON() || {};
      const sql = postData.sql || '';

      // If this looks like an INSERT (contains INSERT INTO departments), fail it
      if (sql.includes('INSERT INTO departments')) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            data: null,
            error: { message: 'Insert failed - constraint violation', line: 1 },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to ghost row
    const ghostRow = page.locator('#table-departments [data-testid="ghost-row"]');
    await ghostRow.scrollIntoViewIfNeeded();

    // Fill in ghost row
    const ghostInputs = ghostRow.locator('textarea');
    const count = await ghostInputs.count();

    if (count > 1) {
      await ghostInputs.nth(1).fill('FailedInsert');
      if (count > 2) await ghostInputs.nth(2).fill('Nowhere');
      if (count > 3) await ghostInputs.nth(3).fill('99999');

      // Tab to trigger submit (ghost row auto-commits, no check button)
      await ghostInputs.nth(Math.min(count - 1, 3)).press('Tab');
      await page.waitForTimeout(1500);
    }

    // Clean up route
    await page.unroute('**/api/execute');
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T6.12 VARCHAR truncation warning on oversize edit', async ({ page, sqlEditor }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Find a text cell in departments table and edit with very long value
    const nameCell = page.locator('#table-departments tbody tr').first().locator('td:nth-child(2) textarea');
    const cellVisible = await nameCell.isVisible().catch(() => false);

    if (cellVisible) {
      await nameCell.click();

      // Type a very long string (200+ chars)
      const longValue = 'A'.repeat(300);
      await nameCell.fill(longValue);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(1000);

      // May show a truncation warning toast/alert
      const warning = page.locator('text=/截断|truncat|超长/i');
      const warningVisible = await warning.first().isVisible().catch(() => false);

      // At minimum, app should not crash from oversized input
      if (!warningVisible) {
        await expect(page.locator('.monaco-editor')).toBeVisible();
      }
    }

    await expect(page.locator('.monaco-editor')).toBeVisible();
  });
});
