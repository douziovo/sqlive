import { test as base, Page } from '@playwright/test';

export class SqlEditor {
  constructor(private page: Page) {}

  async click() {
    await this.page.locator('.monaco-editor').first().click();
  }

  async type(sql: string) {
    await this.click();
    await this.page.keyboard.type(sql, { delay: 10 });
  }

  async replaceAll(sql: string) {
    await this.click();
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.insertText(sql);
  }

  async setText(sql: string) {
    await this.page.evaluate((code) => {
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (!editors?.length) return;
      editors[0].setValue(code);
    }, sql);
  }

  async getText(): Promise<string> {
    return await this.page.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.();
      if (!editors?.length) return '';
      // Try focused editor first, fallback to first
      const focused = editors.find((e: any) => e.hasTextFocus?.());
      return (focused ?? editors[0]).getValue() ?? '';
    });
  }

  async waitForText(timeout = 10_000): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const text = await this.getText();
      if (text) return text;
      await new Promise(r => setTimeout(r, 200));
    }
    return '';
  }

  async waitForExecution(timeout = 15_000) {
    // Wait for loading indicator to disappear and tables or error to appear
    await this.page.waitForFunction(
      () => {
        const metadata = document.querySelector('.text-xs.text-gray-400');
        const error = document.querySelector('.monaco-editor .squiggly-error');
        return metadata || error;
      },
      { timeout },
    );
  }

  async rightClickEditor() {
    await this.page.locator('.monaco-editor').first().click({ button: 'right' });
    // Wait for context menu to appear
    await this.page.locator('.monaco-context-menu, .context-menu, [role="menu"]').first().waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {});
  }

  async importSql(filepath: string) {
    // Opens file picker via context menu and imports a .sql file
    await this.rightClickEditor();
    const importOption = this.page.locator('text=导入 SQL 文件');
    if (await importOption.isVisible().catch(() => false)) {
      const [fileChooser] = await Promise.all([
        this.page.waitForEvent('filechooser', { timeout: 5_000 }),
        importOption.click(),
      ]);
      await fileChooser.setFiles(filepath);
      // Wait for file import to be processed — no deterministic DOM signal
      await this.page.waitForTimeout(1000); // animation debounce, no DOM signal
    }
  }
}

export async function gotoApp(page: Page, path = '/?e2e=1') {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  // Wait for the initial SQL auto-execute.  Under heavy concurrency the
  // in-memory SQLite backend may queue requests; retry once if needed.
  await page.waitForSelector('#table-departments', { timeout: 25_000 })
}

export const test = base.extend<{ sqlEditor: SqlEditor }>({
  sqlEditor: async ({ page }, use) => {
    await use(new SqlEditor(page));
  },
});

export { expect } from '@playwright/test';
