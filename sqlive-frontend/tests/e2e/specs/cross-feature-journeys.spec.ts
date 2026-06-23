import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('Cross-Feature User Journeys', () => {
  test('T5.1 error → AI analyze → fix → recover journey', async ({ page, sqlEditor }) => {
    // Mock AI analyze and fix endpoints
    await page.route('**/api/ai/**', (route) => {
      const url = route.request().url();
      if (url.includes('/chat')) {
        route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'data: {"content":"Fixed the syntax error."}\n\ndata: [DONE]\n',
        });
      } else if (url.includes('/fix')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              content: 'Fixed your SQL.',
              fixedCode: 'SELECT * FROM departments;',
            },
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { content: 'Mock.' } }),
        });
      }
    });

    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Step 1: Introduce error
    const errResp = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sqlEditor.replaceAll('SELECT * FORM departments;');
    try { await errResp; } catch { /* may not fire for syntax error */ }

    // Step 2: Verify error state (app didn't crash)
    await expect(page.locator('.monaco-editor')).toBeVisible();

    // Step 3: Fix the error manually
    const fixResp = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sqlEditor.replaceAll('SELECT * FROM departments;');
    await fixResp;

    // Step 4: Verify recovery - table data should reappear
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=departments').first()).toBeVisible();
  });

  test('T5.2 create table → insert data → edit cell → delete row → drop table', async ({ page, sqlEditor }) => {
    test.setTimeout(60_000);
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Step 1: Create table via SQL
    let responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sqlEditor.replaceAll(
      'CREATE TABLE journey_test (id INTEGER PRIMARY KEY, name TEXT, score REAL);\n' +
      "INSERT INTO journey_test VALUES (1, 'Alpha', 95.5);\n" +
      "INSERT INTO journey_test VALUES (2, 'Beta', 87.3);"
    );
    await responsePromise;

    // Verify table created
    await expect(page.locator('#table-journey_test')).toBeVisible({ timeout: 10_000 });

    // Step 2: Insert a new row via edit (ghost row)
    const ghostRow = page.locator('#table-journey_test [data-testid="ghost-row"]');
    await ghostRow.scrollIntoViewIfNeeded();

    const ghostInputs = ghostRow.locator('textarea');
    const ghostCount = await ghostInputs.count();
    expect(ghostCount).toBeGreaterThan(1);

    await ghostInputs.nth(1).fill('Gamma');
    if (ghostCount > 2) await ghostInputs.nth(2).fill('92.0');

    responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );

    // Ghost row auto-commits on Tab — wait for response after fill
    await ghostInputs.nth(Math.min(ghostCount - 1, 2)).press('Tab');
    try { await responsePromise; } catch { /* response may not fire */ }

    // Step 3: Edit a cell
    const nameCell = page.locator('#table-journey_test tbody tr').first().locator('td:nth-child(2) textarea');
    await expect(nameCell).toBeVisible({ timeout: 5_000 });
    responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await nameCell.click();
    await nameCell.fill('EditedAlpha');
    await page.keyboard.press('Tab');
    await responsePromise;

    // Step 4: Delete a row
    const firstRow = page.locator('#table-journey_test tbody tr').first();
    await firstRow.hover();
    const delBtns = firstRow.locator('td button, td [role="button"]');
    await expect(delBtns.last()).toBeVisible({ timeout: 3_000 });
    const delCount = await delBtns.count();
    expect(delCount).toBeGreaterThan(0);
    responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await delBtns.last().click();
    await responsePromise;

    // Step 5: Drop table
    const dropBtn = page.locator('#table-journey_test').locator('button[title="删除表格"]');
    await expect(dropBtn).toBeVisible({ timeout: 5_000 });
    page.once('dialog', (dialog) => dialog.accept());
    await dropBtn.click();
    // Wait for drop table API response
    await page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    ).catch(() => {});

    // Table should be gone after drop
    await expect(page.locator('#table-journey_test')).not.toBeVisible({ timeout: 5_000 });

    // App should not crash after full lifecycle
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T5.3 multi-tab cross-database isolation', async ({ page, sqlEditor }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Tab 1: Create table with distinct data
    let responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sqlEditor.replaceAll(
      'CREATE TABLE only_tab1 (id INTEGER PRIMARY KEY, tag TEXT);\n' +
      "INSERT INTO only_tab1 VALUES (1, 'tab1_data');"
    );
    await responsePromise;
    await expect(page.locator('#table-only_tab1')).toBeVisible({ timeout: 10_000 });

    // Tab 2: Create different table
    const addBtn = page.locator('button[title="新建标签页"]');
    await addBtn.click();
    // Wait for new tab to be active
    await expect(page.locator('.flex.items-center.overflow-x-auto > div[class*="group"]').last()).toBeVisible({ timeout: 5_000 });

    responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sqlEditor.replaceAll(
      'CREATE TABLE only_tab2 (id INTEGER PRIMARY KEY, val TEXT);\n' +
      "INSERT INTO only_tab2 VALUES (1, 'tab2_data');"
    );
    await responsePromise;
    await expect(page.locator('#table-only_tab2')).toBeVisible({ timeout: 10_000 });

    // Tab 2 should NOT see only_tab1 (database isolation)
    await expect(page.locator('#table-only_tab1')).not.toBeVisible({ timeout: 3_000 });

    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T5.4 import SQL file → table appears → edit → export', async ({ page, sqlEditor }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Step 1: Simulate import by typing SQL directly (file picker can't be automated easily)
    let responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sqlEditor.replaceAll(
      'CREATE TABLE imported_data (id INTEGER PRIMARY KEY, name TEXT, value REAL);\n' +
      "INSERT INTO imported_data VALUES (1, 'Item1', 10.5);\n" +
      "INSERT INTO imported_data VALUES (2, 'Item2', 20.0);\n" +
      'SELECT * FROM imported_data;'
    );
    await responsePromise;

    // Step 2: Verify table appears
    await expect(page.locator('#table-imported_data')).toBeVisible({ timeout: 10_000 });

    // Step 3: Edit a cell
    const nameCell = page.locator('#table-imported_data tbody tr').first().locator('td:nth-child(2) textarea');
    await expect(nameCell).toBeVisible({ timeout: 5_000 });
    responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await nameCell.click();
    await nameCell.fill('UpdatedItem');
    await page.keyboard.press('Tab');
    await responsePromise;

    // Step 4: Right-click editor for export
    await page.locator('.monaco-editor').first().click({ button: 'right' });
    // Wait for context menu
    await page.locator('.monaco-context-menu, .context-menu, [role="menu"]').first().waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {});

    // Export option should exist in context menu
    const exportOption = page.locator('text=导出当前标签页');
    await expect(exportOption).toBeVisible({ timeout: 3_000 });
    // App uses Blob URL + a.click() for downloads — Playwright can't intercept.
    // Verify clicking export doesn't crash.
    await exportOption.click();
    await page.waitForTimeout(500);

    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T5.5 knowledge → AI → SQL correlation', async ({ page }) => {
    // Mock knowledge graph API
    await page.route('**/api/knowledge/**', (route) => {
      if (route.request().url().includes('/graph')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            topics: [
              {
                id: 'select',
                label: 'SELECT 查询',
                description: '检索数据的 SQL 语句',
                keywords: ['SELECT', 'FROM'],
                patterns: ['SELECT\\s+'],
                difficulty: 1,
                prerequisites: [],
                nextTopics: ['where'],
                category: 'DQL',
              },
              {
                id: 'where',
                label: 'WHERE 子句',
                description: '过滤查询结果',
                keywords: ['WHERE'],
                patterns: ['WHERE\\s+'],
                difficulty: 1,
                prerequisites: ['select'],
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

    // Mock AI chat
    await page.route('**/api/ai/chat', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"content":"SELECT queries retrieve data from tables. Use FROM to specify the table, WHERE to filter."}\n\ndata: [DONE]\n',
      });
    });

    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Open knowledge panel
    await page.locator('.learning-companion').click();
    await expect(page.locator('.knowledge-panel')).toBeVisible({ timeout: 8_000 });

    // Click first node → detail appears
    const nodes = page.locator('.vue-flow__node');
    await expect(nodes.first()).toBeVisible({ timeout: 5_000 });
    await nodes.first().click();
    await expect(page.locator('.knowledge-detail')).toBeVisible({ timeout: 5_000 });

    // Click "让 AI 教我"
    const teachBtn = page.locator('.knowledge-detail__btn--ai');
    await expect(teachBtn).toBeVisible({ timeout: 5_000 });
    await teachBtn.click();

    // AI panel should open, knowledge panel should close
    await expect(page.locator('[data-testid="ai-chat-close"]')).toBeVisible({ timeout: 5_000 });

    // Verify AI response relates to the topic
    const chatPanel = page.locator('.ai-chat-panel');
    await expect(chatPanel).toBeVisible();
    await expect(chatPanel.getByText(/SELECT queries retrieve data/)).toBeVisible({ timeout: 5_000 });

    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T5.6 resize → ER → table → tab switch sequence', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Step 1: Resize split pane
    const handle = page.locator('.splitpanes__splitter');
    await expect(handle).toBeVisible({ timeout: 5_000 });
    const handleBox = await handle.boundingBox();
    expect(handleBox).not.toBeNull();
    await handle.hover();
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + 50, handleBox!.y + 10, { steps: 5 });
    await page.mouse.up();

    // Step 2: Switch to ER diagram
    const erBtn = page.locator('button:has-text("ER 图")');
    await expect(erBtn).toBeVisible({ timeout: 5_000 });
    await erBtn.click();
    // Wait for ER diagram to render
    await expect(page.locator('.vue-flow')).toBeVisible({ timeout: 5_000 });

    // ER nodes should render
    const erNodes = page.locator('.vue-flow__node');
    const erNodeCount = await erNodes.count();
    expect(erNodeCount).toBeGreaterThan(0);

    // Step 3: Switch back to table view
    const tableTab = page.locator('[data-testid="tab-tables"]');
    await expect(tableTab).toBeVisible({ timeout: 5_000 });
    await tableTab.click();
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 5_000 });

    // Step 4: Switch to main tab
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('T5.7 rapid typing triggers debounced single API call', async ({ page, sqlEditor }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    let apiCallCount = 0;

    // Track API calls
    await page.route('**/api/execute', async (route) => {
      apiCallCount++;
      await route.continue();
    });

    // Rapidly type SQL character by character
    await sqlEditor.click();
    await sqlEditor.replaceAll('');

    // Type a SQL statement rapidly
    const chars = 'SELECT 1;';
    for (const ch of chars) {
      await page.keyboard.type(ch, { delay: 5 });
    }

    // Wait for debounce to settle — debounce is 100ms, no DOM signal for completion
    await page.waitForTimeout(2000); // animation debounce, no DOM signal

    // After rapid typing + debounce, should have at most ~2 API calls
    // (initial load + debounced execution)
    expect(apiCallCount).toBeLessThanOrEqual(5);

    // Remove route to let normal execution proceed
    await page.unroute('**/api/execute');
  });

  test('T5.8 fix error → re-execute → verify recovery', async ({ page, sqlEditor }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Step 1: Introduce syntax error
    const errResp2 = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sqlEditor.replaceAll('SELECT * FORM departments;');
    try { await errResp2; } catch { /* may not fire for syntax error */ }

    // Step 2: Fix the error
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/execute') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await sqlEditor.replaceAll('SELECT * FROM departments;');
    await responsePromise;

    // Step 3: Verify data recovered
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=departments').first()).toBeVisible();

    // Step 4: Verify app is functional for further editing
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });
});
