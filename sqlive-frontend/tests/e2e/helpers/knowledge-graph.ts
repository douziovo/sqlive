import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 点击 LearningCompanion 悬浮按钮打开知识面板，并等待面板可见。
 * 各知识图谱用例的点击目标与超时保持一致，避免重复。
 */
export async function openKnowledgePanel(page: Page) {
    await page.locator('.learning-companion').click()
    await expect(page.locator('.knowledge-panel')).toBeVisible({ timeout: 8_000 })
}

/** 点开第一个知识节点详情，并点击"让 AI 教我"按钮 */
export async function openFirstNodeAndTeach(page: Page) {
    const nodes = page.locator('.vue-flow__node')
    await expect(nodes.first()).toBeVisible({ timeout: 5_000 })
    await nodes.first().click()
    await expect(page.locator('.knowledge-detail')).toBeVisible({ timeout: 5_000 })

    const teachBtn = page.locator('.knowledge-detail__btn--ai')
    await expect(teachBtn).toBeVisible({ timeout: 5_000 })
    await teachBtn.click()
}
