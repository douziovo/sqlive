import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock vue-router: useRoute returns '/' by default, useRouter returns a
// push spy. Tests can override these via vi.mocked per-test.
const push = vi.fn().mockResolvedValue(undefined)
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/' }),
  useRouter: () => ({ push }),
}))

import AppHeader from '@/components/AppHeader.vue'

describe('AppHeader', () => {
  beforeEach(() => {
    push.mockClear()
  })

  it('renders a Docs button with data-testid "docs-link-btn" containing text "文档"', () => {
    const w = mount(AppHeader)
    const btn = w.find('[data-testid="docs-link-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('文档')
  })

  it('renders a GitHub anchor with correct href, target, rel', () => {
    const w = mount(AppHeader)
    const a = w.find('[data-testid="github-link"]')
    expect(a.exists()).toBe(true)
    expect(a.attributes('href')).toBe('https://github.com/douziovo/sqlive')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toBe('noopener noreferrer')
  })

  it('Docs button click calls router.push("/docs/intro")', async () => {
    const w = mount(AppHeader)
    const btn = w.find('[data-testid="docs-link-btn"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(push).toHaveBeenCalledWith('/docs/intro')
  })

  it('wordmark "sqlive" click calls router.push("/")', async () => {
    const w = mount(AppHeader)
    // wordmark is the first button in the left side; find by text
    const buttons = w.findAll('button')
    const wordmark = buttons.find(b => b.text().includes('sqlive'))
    expect(wordmark).toBeDefined()
    await wordmark!.trigger('click')
    expect(push).toHaveBeenCalledWith('/')
  })

  it('wraps GitHub label in a span with class "hidden md:inline" (mobile icon only per D-12)', () => {
    const w = mount(AppHeader)
    const a = w.find('[data-testid="github-link"]')
    expect(a.exists()).toBe(true)
    const label = a.find('span.hidden.md\\:inline')
    expect(label.exists()).toBe(true)
    expect(label.text()).toBe('GitHub')
  })
})
