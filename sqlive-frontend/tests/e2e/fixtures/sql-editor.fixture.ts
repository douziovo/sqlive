import { test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

export class SqlEditor {
    private page: Page

    constructor(page: Page) {
        this.page = page
    }

    async click() {
        await this.page.locator('.monaco-editor').first().click()
    }

    async openContextMenu() {
        await this.page
            .locator('.monaco-editor .view-lines')
            .first()
            .click({
                button: 'right',
                position: { x: 25, y: 10 }
            })
    }

    async clickContextMenuAction(name: string) {
        // Monaco enables menu mouseup handlers after a 100ms accidental-click guard.
        await this.page.getByRole('menuitem', { name, exact: true }).click({ delay: 150 })
    }

    async type(sql: string) {
        await this.click()
        await this.page.keyboard.type(sql, { delay: 10 })
    }

    async replaceAll(sql: string) {
        await this.click()
        await this.page.keyboard.press('Control+a')
        await this.page.keyboard.insertText(sql)
    }

    async setText(sql: string) {
        await this.page.evaluate((code) => {
            const editors = (window as any).monaco?.editor?.getEditors?.()
            if (!editors?.length) return
            editors[0].setValue(code)
        }, sql)
    }

    async getText(): Promise<string> {
        return await this.page.evaluate(() => {
            const editors = (window as any).monaco?.editor?.getEditors?.()
            if (!editors?.length) return ''
            // Try focused editor first, fallback to first
            const focused = editors.find((e: any) => e.hasTextFocus?.())
            return (focused ?? editors[0]).getValue() ?? ''
        })
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
        await use(new SqlEditor(page))
    }
})

export { expect } from '@playwright/test'
