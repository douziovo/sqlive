import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AchievementToast from '@/components/knowledge/AchievementToast.vue'

function getToastEl(): Element | null {
  return document.body.querySelector('.achievement-toast')
}

const DEFAULT_PROPS = { visible: false, streak: 0, xp: 30, label: 'SELECT', isHighDifficulty: false }

describe('AchievementToast', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('不渲染当 visible 为 false', () => {
    mount(AchievementToast, { props: DEFAULT_PROPS })
    expect(getToastEl()).toBeNull()
  })

  it('渲染当 visible 为 true', async () => {
    mount(AchievementToast, { props: { ...DEFAULT_PROPS, visible: true, streak: 1 } })
    await vi.dynamicImportSettled()
    expect(getToastEl()).not.toBeNull()
  })

  it('1 连击显示 "新知识点掌握！"', async () => {
    mount(AchievementToast, { props: { ...DEFAULT_PROPS, visible: true, streak: 1 } })
    await vi.dynamicImportSettled()
    expect(getToastEl()?.textContent).toContain('新知识点掌握')
  })

  it('显示 XP 和 label 在副标题', async () => {
    mount(AchievementToast, { props: { visible: true, streak: 1, xp: 50, label: 'JOIN', isHighDifficulty: false } })
    await vi.dynamicImportSettled()
    expect(getToastEl()?.textContent).toContain('JOIN')
    expect(getToastEl()?.textContent).toContain('50 XP')
  })

  it('3 连击显示 "⚡ 3连击！保持势头！"', async () => {
    mount(AchievementToast, { props: { ...DEFAULT_PROPS, visible: true, streak: 3 } })
    await vi.dynamicImportSettled()
    expect(getToastEl()?.textContent).toContain('保持势头')
  })

  it('5 连击显示 "🔥 5连击！势不可挡！"', async () => {
    mount(AchievementToast, { props: { ...DEFAULT_PROPS, visible: true, streak: 5 } })
    await vi.dynamicImportSettled()
    expect(getToastEl()?.textContent).toContain('势不可挡')
  })

  it('高阶知识点显示 "💎 高阶知识点解锁！"', async () => {
    mount(AchievementToast, { props: { ...DEFAULT_PROPS, visible: true, streak: 1, isHighDifficulty: true } })
    await vi.dynamicImportSettled()
    expect(getToastEl()?.textContent).toContain('高阶知识点解锁')
  })

  it('5 连击使用 achievement-toast--fire class', async () => {
    mount(AchievementToast, { props: { ...DEFAULT_PROPS, visible: true, streak: 5 } })
    await vi.dynamicImportSettled()
    expect(getToastEl()?.classList.contains('achievement-toast--fire')).toBe(true)
  })

  it('3 连击使用 achievement-toast--electric class', async () => {
    mount(AchievementToast, { props: { ...DEFAULT_PROPS, visible: true, streak: 3 } })
    await vi.dynamicImportSettled()
    expect(getToastEl()?.classList.contains('achievement-toast--electric')).toBe(true)
  })

  it('高阶使用 achievement-toast--high-diff class', async () => {
    mount(AchievementToast, { props: { ...DEFAULT_PROPS, visible: true, streak: 1, isHighDifficulty: true } })
    await vi.dynamicImportSettled()
    expect(getToastEl()?.classList.contains('achievement-toast--high-diff')).toBe(true)
  })

  it('空 label 不渲染副标题 div', async () => {
    mount(AchievementToast, { props: { visible: true, streak: 1, xp: 30, label: '', isHighDifficulty: false } })
    await vi.dynamicImportSettled()
    const toast = getToastEl()
    expect(toast).not.toBeNull()
    const subDiv = toast?.querySelector('.achievement-toast__sub')
    expect(subDiv).toBeNull()
  })

  it('streak=2 非高阶显示默认图标和标题，无特殊 CSS class', async () => {
    mount(AchievementToast, { props: { visible: true, streak: 2, xp: 30, label: 'INSERT', isHighDifficulty: false } })
    await vi.dynamicImportSettled()
    const toast = getToastEl()
    expect(toast).not.toBeNull()
    expect(toast?.textContent).toContain('🌟')
    expect(toast?.textContent).toContain('新知识点掌握')
    expect(toast?.classList.contains('achievement-toast--fire')).toBe(false)
    expect(toast?.classList.contains('achievement-toast--electric')).toBe(false)
    expect(toast?.classList.contains('achievement-toast--high-diff')).toBe(false)
  })

  // ── D-11 a11y: role=status + aria-live=polite ─────────────

  it('root element has role=status for screen readers', async () => {
    mount(AchievementToast, { props: { visible: true, streak: 1, xp: 30, label: 'SELECT', isHighDifficulty: false } })
    await vi.dynamicImportSettled()
    const toast = getToastEl()
    expect(toast).not.toBeNull()
    expect(toast?.getAttribute('role')).toBe('status')
  })

  it('root element has aria-live=polite for screen readers', async () => {
    mount(AchievementToast, { props: { visible: true, streak: 1, xp: 30, label: 'SELECT', isHighDifficulty: false } })
    await vi.dynamicImportSettled()
    const toast = getToastEl()
    expect(toast).not.toBeNull()
    expect(toast?.getAttribute('aria-live')).toBe('polite')
  })
})
