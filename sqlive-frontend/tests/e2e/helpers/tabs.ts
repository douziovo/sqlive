import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 点击"新建标签页"并等待标签数变为 2（初始 1 个 + 新增 1 个）。
 * 各标签页用例的选择器与超时保持一致，避免重复。
 */
export async function openNewTab(page: Page) {
    const addBtn = page.locator('button[title="新建标签页"]')
    await addBtn.click()
    await expect(page.locator('[data-testid="tab-close-btn"]')).toHaveCount(2, {
        timeout: 5_000
    })
}
