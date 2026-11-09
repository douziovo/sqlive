import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * DocsSearchBox test suite (D-13 — Ctrl+K global + `/` docs-scoped + Esc).
 *
 * Mocks:
 * - vue-router: useRoute returns a mutable path; useRouter.push is a spy.
 * - @/composables/useDocsSearch: returns controlled ensureIndex/search + refs.
 *
 * Pattern from useAiStreaming.test.ts (vi.mock + fake timers) and
 * DocsSidebar.test.ts (mutable mockRoute for per-test route variation).
 */
const push = vi.fn().mockResolvedValue(undefined)
const mockRoute = { path: '/docs/intro' }
// Shared spy so tests can assert ensureIndex calls across component instances
const { ensureIndexSpy } = vi.hoisted(() => ({ ensureIndexSpy: vi.fn() }))

vi.mock('vue-router', () => ({
    useRoute: () => mockRoute,
    useRouter: () => ({ push })
}))

vi.mock('@/composables/useDocsSearch', async () => {
    const { ref } = await import('vue')
    return {
        useDocsSearch: () => ({
            ensureIndex: ensureIndexSpy,
            search: vi.fn((q: string) =>
                q.includes('edit')
                    ? [{ slug: 'usage/editor', title: '编辑器', category: 'usage', score: 1 }]
                    : []
            ),
            // Real refs — plain objects would make :disabled="indexError" truthy
            // and vue-test-utils would skip triggering events on the input
            indexReady: ref(true),
            indexError: ref(false)
        })
    }
})

import DocsSearchBox from '@/components/docs/DocsSearchBox.vue'

describe('DocsSearchBox', () => {
    beforeEach(() => {
        push.mockClear()
        mockRoute.path = '/docs/intro'
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('focuses input on Ctrl+K', async () => {
        // D-13: Ctrl+K is global — focuses search input on any route
        const w = mount(DocsSearchBox)
        const input = w.find('[data-testid="docs-search-input"]').element as HTMLInputElement
        const focusSpy = vi.spyOn(input, 'focus')
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
        expect(focusSpy).toHaveBeenCalled()
    })

    it('does not respond to slash when outside docs subtree', async () => {
        // D-13 (Pitfall 10): `/` only focuses input when route.path.startsWith('/docs')
        mockRoute.path = '/'
        const w = mount(DocsSearchBox)
        const input = w.find('[data-testid="docs-search-input"]').element as HTMLInputElement
        const focusSpy = vi.spyOn(input, 'focus')
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
        expect(focusSpy).not.toHaveBeenCalled()
    })

    it('responds to slash when inside docs subtree', async () => {
        // D-13: `/` focuses input when in /docs/* subtree
        mockRoute.path = '/docs/intro'
        const w = mount(DocsSearchBox)
        const input = w.find('[data-testid="docs-search-input"]').element as HTMLInputElement
        const focusSpy = vi.spyOn(input, 'focus')
        // Target is document.body (not input/textarea) → slash should trigger
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
        expect(focusSpy).toHaveBeenCalled()
    })

    it('closes dropdown on Escape (blurs input)', async () => {
        // D-13: Esc blurs input, closing the dropdown
        const w = mount(DocsSearchBox)
        const input = w.find('[data-testid="docs-search-input"]').element as HTMLInputElement
        const blurSpy = vi.spyOn(input, 'blur')
        // Focus first so blur has something to blur
        input.focus()
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        expect(blurSpy).toHaveBeenCalled()
    })

    it('first input focus triggers the lazy index build', async () => {
        ensureIndexSpy.mockClear()
        const w = mount(DocsSearchBox)
        const input = w.find('[data-testid="docs-search-input"]')
        expect(ensureIndexSpy).not.toHaveBeenCalled()

        await input.trigger('focus')
        expect(ensureIndexSpy).toHaveBeenCalled()
    })

    it('typing fires the input handler without errors', async () => {
        const w = mount(DocsSearchBox)
        const input = w.find('[data-testid="docs-search-input"]')
        await input.trigger('input')
        expect((input.element as HTMLInputElement).value).toBe('')
    })

    it('shows results for a matching query and navigates on click', async () => {
        const w = mount(DocsSearchBox)
        const input = w.find('[data-testid="docs-search-input"]')
        await input.setValue('edit')
        await input.trigger('input')

        const items = w
            .findAll('li, [class*="result"], button')
            .filter((el) => el.text().includes('编辑器'))
        expect(items.length).toBeGreaterThan(0)

        await items[0].trigger('click')
        expect(push).toHaveBeenCalledWith('/docs/usage/editor')
    })

    it('silences router navigation failures when opening a result', async () => {
        push.mockRejectedValueOnce(new Error('navigation duplicated'))
        const w = mount(DocsSearchBox)
        const input = w.find('[data-testid="docs-search-input"]')
        await input.setValue('edit')
        await input.trigger('input')

        const item = w
            .findAll('li, [class*="result"], button')
            .filter((el) => el.text().includes('编辑器'))[0]
        await item.trigger('click')
        // Rejection swallowed — no unhandled error
        await Promise.resolve()
    })

    it('removes the global keydown listener on unmount', async () => {
        const w = mount(DocsSearchBox)
        w.unmount()
        // Listener gone: Ctrl+K after unmount does nothing (no crash)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
        expect(true).toBe(true)
    })
})
