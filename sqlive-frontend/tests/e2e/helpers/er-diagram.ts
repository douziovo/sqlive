import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 切到"ER 图"页签并等待 VueFlow 容器渲染，返回容器 locator 供后续交互使用。
 * 各 ER 用例的点击目标与超时保持一致，避免重复。
 */
export async function openErDiagram(page: Page) {
    await page.locator('button:has-text("ER 图")').click()
    // Wait for VueFlow container to render
    const container = page.locator('.vue-flow')
    await expect(container).toBeVisible({ timeout: 5_000 })
    return container
}
