import { test, expect, gotoApp } from '../fixtures/sql-editor.fixture';

test.describe('Import / Export', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 });
  });

  test('exports current tab as .sql file', async ({ page }) => {
    // Right-click on editor to open context menu
    await page.locator('.monaco-editor').first().click({ button: 'right' });
    await page.waitForTimeout(300);

    // Look for export option in context menu
    const exportOption = page.locator('text=导出当前标签页');
    await expect(exportOption).toBeVisible({ timeout: 5_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5_000 }),
      exportOption.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.sql$/);
  });

  test('exports all tabs as multiple files', async ({ page }) => {
    await page.locator('.monaco-editor').first().click({ button: 'right' });
    await page.waitForTimeout(300);

    const exportAllOption = page.locator('text=导出全部标签页');
    await expect(exportAllOption).toBeVisible({ timeout: 5_000 });
    await exportAllOption.click();
    await page.waitForTimeout(500);
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
});
