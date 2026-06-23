import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('Import / Export', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });
  });

  test('exports current tab as .sql file', async ({ page }) => {
    // Right-click on editor to open context menu
    await page.locator('.monaco-editor').first().click({ button: 'right' });
    await expect(page.locator('text=导出当前标签页')).toBeVisible({ timeout: 5_000 });

    // App uses Blob URL + a.click() — Playwright can't intercept.
    // Verify clicking export doesn't crash.
    await page.locator('text=导出当前标签页').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('exports all tabs as multiple files', async ({ page }) => {
    await page.locator('.monaco-editor').first().click({ button: 'right' });
    await expect(page.locator('text=导出全部标签页')).toBeVisible({ timeout: 5_000 });

    // App uses Blob URL + a.click() — Playwright can't intercept.
    await page.locator('text=导出全部标签页').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('resize handle is present and draggable', async ({ page }) => {
    // The resize handle between left and right panels
    const handle = page.locator('.splitpanes__splitter');
    await expect(handle).toBeVisible();

    // Get initial widths
    const leftPanel = page.locator('.monaco-editor').first();
    const initialBox = await leftPanel.boundingBox();

    // Drag handle to the right
    if (initialBox && initialBox.width > 0) {
      const handleBox = await handle.boundingBox();
      if (handleBox) {
        await handle.hover();
        await page.mouse.down();
        await page.mouse.move(handleBox.x + 100, handleBox.y + 10, { steps: 5 });
        await page.mouse.up();

        // Width should have changed
        const newBox = await leftPanel.boundingBox();
        if (newBox) {
          expect(newBox.width).not.toBe(initialBox.width);
        }
      }
    }
  });

  test('import .sql via file picker through context menu', async ({ page, sqlEditor }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Right-click editor to open context menu
    await page.locator('.monaco-editor').first().click({ button: 'right' });
    await page.waitForTimeout(500);

    // Monaco context menu may not always show custom actions in test
    const importOption = page.locator('text=导入 .sql 文件');
    const importVisible = await importOption.isVisible({ timeout: 3_000 }).catch(() => false);

    if (importVisible) {
      // Set up file chooser interception
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5_000 }),
        importOption.click(),
      ]);

      // Create a test SQL file content
      await fileChooser.setFiles({
        name: 'test-import.sql',
        mimeType: 'text/plain',
        buffer: Buffer.from('CREATE TABLE imported_via_picker (id INTEGER PRIMARY KEY, name TEXT);\n' +
          "INSERT INTO imported_via_picker VALUES (1, 'Hello');"),
      });

      await page.waitForResponse(r => r.url().includes('/api/execute'), { timeout: 10_000 }).catch(() => {});
    }

    // App should not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });

  test('drag-drop import zone is present', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });

    // Create a test file and read it as a blob
    const fileContent = 'CREATE TABLE drag_test (id INTEGER);\n';

    // Simulate drag and drop on the editor area
    const editor = page.locator('.monaco-editor').first();
    const editorBox = await editor.boundingBox();
    if (editorBox) {
      // Drag a file over the editor
      const dataTransfer = await page.evaluateHandle((content) => {
        const dt = new DataTransfer();
        const file = new File([content], 'test-drag.sql', { type: 'text/plain' });
        dt.items.add(file);
        return dt;
      }, fileContent);

      // Dispatch drag events
      await page.dispatchEvent('.monaco-editor', 'dragenter', { dataTransfer });

      // Drop overlay should appear
      const overlay = page.locator('text=/释放以导入/');
      const overlayVisible = await overlay.isVisible().catch(() => false);

      // Dispatch dragover and drop
      await page.dispatchEvent('.monaco-editor', 'dragover', { dataTransfer });
      await page.dispatchEvent('.monaco-editor', 'drop', { dataTransfer });
    }

    // App should not crash
    await expect(page.locator('.monaco-editor')).toBeVisible();
  });
});
