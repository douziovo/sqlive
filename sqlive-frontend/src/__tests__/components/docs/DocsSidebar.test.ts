import {mount} from '@vue/test-utils'
import {describe, expect, it, vi, beforeEach} from 'vitest'

// Mock vue-router: useRoute returns a mutable object, useRouter returns a
// push spy. Tests can mutate mockRoute.path per-test to exercise different
// active routes (pattern from AppHeader.test.ts).
const push = vi.fn().mockResolvedValue(undefined)
const mockRoute = {path: '/docs/intro'}
vi.mock('vue-router', () => ({
    useRoute: () => mockRoute,
    useRouter: () => ({push}),
}))

import DocsSidebar from '@/components/docs/DocsSidebar.vue'

describe('DocsSidebar', () => {
    beforeEach(() => {
        push.mockClear()
        mockRoute.path = '/docs/intro'
    })

    it('renders all 6 navigation item titles', () => {
        // D-05: sidebar renders every NavItem from navigation.ts
        const w = mount(DocsSidebar)
        const text = w.text()
        expect(text).toContain('项目介绍')
        expect(text).toContain('编辑器')
        expect(text).toContain('数据可视化')
        expect(text).toContain('AI 助手')
        expect(text).toContain('知识图谱')
        expect(text).toContain('变更日志')
    })

    it('highlights the current route with bg-primary/10 class', () => {
        // D-05: active item gets 'bg-primary/10 text-primary font-semibold'
        mockRoute.path = '/docs/intro'
        const w = mount(DocsSidebar)
        const introBtn = w.find('[data-testid="nav-intro"]')
        expect(introBtn.exists()).toBe(true)
        expect(introBtn.classes()).toContain('bg-primary/10')
        expect(introBtn.attributes('aria-current')).toBe('page')
    })

    it('calls router.push with correct path when nav button clicked', async () => {
        // D-05: clicking a nav item calls router.push (handler function, not inline)
        const w = mount(DocsSidebar)
        const editorBtn = w.find('[data-testid="nav-usage-editor"]')
        expect(editorBtn.exists()).toBe(true)
        await editorBtn.trigger('click')
        expect(push).toHaveBeenCalledWith('/docs/usage/editor')
    })

    it('renders category headers (项目介绍, 使用手册, 变更日志)', () => {
        // D-05: items grouped by category; 'api' category has no items → skipped
        const w = mount(DocsSidebar)
        const text = w.text()
        // 使用手册 is the usage category header (not an item title) — proves grouping
        expect(text).toContain('使用手册')
        // 项目介绍 and 变更日志 are both category headers AND item titles
        expect(text).toContain('项目介绍')
        expect(text).toContain('变更日志')
        // 'API 文档' category header should NOT appear (no items in that category)
        expect(text).not.toContain('API 文档')
    })
})
