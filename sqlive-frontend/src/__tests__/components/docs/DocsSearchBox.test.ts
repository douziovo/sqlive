import {mount} from '@vue/test-utils'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

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
const mockRoute = {path: '/docs/intro'}

vi.mock('vue-router', () => ({
    useRoute: () => mockRoute,
    useRouter: () => ({push}),
}))

vi.mock('@/composables/useDocsSearch', () => ({
    useDocsSearch: () => ({
        ensureIndex: vi.fn().mockResolvedValue(undefined),
        search: vi.fn((q: string) =>
            q.includes('edit')
                ? [{slug: 'usage/editor', title: '编辑器', category: 'usage', score: 1}]
                : [],
        ),
        indexReady: {value: true},
        indexError: {value: false},
    }),
}))

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
        window.dispatchEvent(new KeyboardEvent('keydown', {key: 'k', ctrlKey: true}))
        expect(focusSpy).toHaveBeenCalled()
    })

    it('does not respond to slash when outside docs subtree', async () => {
        // D-13 (Pitfall 10): `/` only focuses input when route.path.startsWith('/docs')
        mockRoute.path = '/'
        const w = mount(DocsSearchBox)
        const input = w.find('[data-testid="docs-search-input"]').element as HTMLInputElement
        const focusSpy = vi.spyOn(input, 'focus')
        window.dispatchEvent(new KeyboardEvent('keydown', {key: '/', bubbles: true}))
        expect(focusSpy).not.toHaveBeenCalled()
    })

    it('responds to slash when inside docs subtree', async () => {
        // D-13: `/` focuses input when in /docs/* subtree
        mockRoute.path = '/docs/intro'
        const w = mount(DocsSearchBox)
        const input = w.find('[data-testid="docs-search-input"]').element as HTMLInputElement
        const focusSpy = vi.spyOn(input, 'focus')
        // Target is document.body (not input/textarea) → slash should trigger
        window.dispatchEvent(new KeyboardEvent('keydown', {key: '/', bubbles: true}))
        expect(focusSpy).toHaveBeenCalled()
    })

    it('closes dropdown on Escape (blurs input)', async () => {
        // D-13: Esc blurs input, closing the dropdown
        const w = mount(DocsSearchBox)
        const input = w.find('[data-testid="docs-search-input"]').element as HTMLInputElement
        const blurSpy = vi.spyOn(input, 'blur')
        // Focus first so blur has something to blur
        input.focus()
        window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
        expect(blurSpy).toHaveBeenCalled()
    })
})
