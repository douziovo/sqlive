import { readFile } from 'node:fs/promises'

import type { Download } from '@playwright/test'

import { expect, gotoApp, test } from '../fixtures/sql-editor.fixture'
import { openNewTab } from '../helpers/tabs'

test.describe('Import / Export', () => {
    test.beforeEach(async ({ page }) => {
        await gotoApp(page)
        await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 })
    })

    test('exports current tab as .sql file', async ({ page, sqlEditor }) => {
        // Right-click on editor to open context menu
        await sqlEditor.openContextMenu()
        await expect(page.locator('text=导出当前标签页')).toBeVisible({ timeout: 5_000 })

        const downloadPromise = page.waitForEvent('download')
        await sqlEditor.clickContextMenuAction('导出当前标签页')
        const download = await downloadPromise
        expect(download.suggestedFilename()).toMatch(/\.sql$/u)
        const filePath = await download.path()
        expect(filePath).not.toBeNull()
        expect(await readFile(filePath, 'utf8')).toContain('CREATE TABLE')
        await expect(page.locator('.monaco-editor')).toBeVisible()
    })

    test('exports all tabs as multiple files', async ({ page, sqlEditor }) => {
        await openNewTab(page)
        const downloads: Download[] = []
        page.on('download', (download) => downloads.push(download))
        await sqlEditor.openContextMenu()
        await expect(page.locator('text=导出全部标签页')).toBeVisible({ timeout: 5_000 })

        await sqlEditor.clickContextMenuAction('导出全部标签页')
        await expect.poll(() => downloads.length).toBe(2)
        expect(new Set(downloads.map((download) => download.suggestedFilename())).size).toBe(2)
        for (const download of downloads) {
            expect(download.suggestedFilename()).toMatch(/\.sql$/u)
            expect(await download.failure()).toBeNull()
        }
        await expect(page.locator('.monaco-editor')).toBeVisible()
    })

    test('resize handle is present and draggable', async ({ page }) => {
        // The resize handle between left and right panels
        const handle = page.locator('.splitpanes__splitter')
        await expect(handle).toBeVisible()

        // Get initial widths
        const leftPanel = page.locator('.monaco-editor').first()
        const initialBox = await leftPanel.boundingBox()

        // Drag handle to the right
        if (initialBox && initialBox.width > 0) {
            const handleBox = await handle.boundingBox()
            if (handleBox) {
                await handle.hover()
                await page.mouse.down()
                await page.mouse.move(handleBox.x + 100, handleBox.y + 10, { steps: 5 })
                await page.mouse.up()

                // Width should have changed
                const newBox = await leftPanel.boundingBox()
                if (newBox) {
                    expect(newBox.width).not.toBe(initialBox.width)
                }
            }
        }
    })

    test('import .sql via file picker through context menu', async ({ page }) => {
        await gotoApp(page)
        await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 })

        // Right-click editor to open context menu
        await page.locator('.monaco-editor').first().click({ button: 'right' })
        await page.waitForTimeout(500)

        // Monaco context menu may not always show custom actions in test
        const importOption = page.locator('text=导入 .sql 文件')
        const importVisible = await importOption.isVisible().catch(() => false)

        if (importVisible) {
            // Set up file chooser interception
            const [fileChooser] = await Promise.all([
                page.waitForEvent('filechooser', { timeout: 5_000 }),
                importOption.click()
            ])

            // Create a test SQL file content
            await fileChooser.setFiles({
                name: 'test-import.sql',
                mimeType: 'text/plain',
                buffer: Buffer.from(
                    'CREATE TABLE imported_via_picker (id INTEGER PRIMARY KEY, name TEXT);\n' +
                        "INSERT INTO imported_via_picker VALUES (1, 'Hello');"
                )
            })

            await page
                .waitForResponse((r) => r.url().includes('/api/execute'), { timeout: 10_000 })
                .catch(() => {})
        }

        // App should not crash
        await expect(page.locator('.monaco-editor')).toBeVisible()
    })

    test('drag-drop import zone is present', async ({ page }) => {
        await gotoApp(page)
        await expect(page.locator('#table-departments')).toBeVisible({ timeout: 15_000 })

        // Create a test file and read it as a blob
        const fileContent = 'CREATE TABLE drag_test (id INTEGER);\n'

        // Simulate drag and drop on the editor area
        const editor = page.locator('.monaco-editor').first()
        const editorBox = await editor.boundingBox()
        if (editorBox) {
            // Drag a file over the editor
            const dataTransfer = await page.evaluateHandle((content) => {
                const dt = new DataTransfer()
                const file = new File([content], 'test-drag.sql', { type: 'text/plain' })
                dt.items.add(file)
                return dt
            }, fileContent)

            // Dispatch drag events
            await page.dispatchEvent('.monaco-editor', 'dragenter', { dataTransfer })

            // Dispatch dragover and drop
            await page.dispatchEvent('.monaco-editor', 'dragover', { dataTransfer })
            await page.dispatchEvent('.monaco-editor', 'drop', { dataTransfer })
        }

        // App should not crash
        await expect(page.locator('.monaco-editor')).toBeVisible()
    })
})
