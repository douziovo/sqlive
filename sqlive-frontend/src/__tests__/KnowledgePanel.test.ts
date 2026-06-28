import {mount} from '@vue/test-utils'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {nextTick} from 'vue'
import KnowledgePanel from '@/components/knowledge/KnowledgePanel.vue'
import {SQL_CONTEXT_KEY} from '@/model/injectionKeys'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockProvide = {
    [SQL_CONTEXT_KEY as symbol]: {tabs: {value: []}, activeTabId: {value: '1'}}
}

const mockTopics = [
    {
        id: 'a',
        label: 'SQL 基础',
        description: '',
        keywords: [],
        patterns: [],
        difficulty: 1,
        prerequisites: [],
        nextTopics: ['b'],
        category: 'query'
    },
    {
        id: 'b',
        label: 'JOIN',
        description: '',
        keywords: [],
        patterns: [],
        difficulty: 2,
        prerequisites: ['a'],
        nextTopics: [],
        category: 'query'
    },
    {
        id: 'c',
        label: 'INSERT',
        description: '',
        keywords: [],
        patterns: [],
        difficulty: 1,
        prerequisites: [],
        nextTopics: [],
        category: 'dml'
    }
]

const mockResolve = (topics = mockTopics) => {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({topics})
    })
}

async function mountWithData(topics = mockTopics) {
    mockResolve(topics)
    const w = mount(KnowledgePanel, {
        props: {isOpen: true},
        global: {provide: mockProvide, stubs: {teleport: true}}
    })
    await vi.waitFor(() => (w.vm.filteredNodes as any[]).length > 0, {timeout: 2000})
    return w
}

describe('KnowledgePanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        document.body.innerHTML = ''
    })

    it('renders when isOpen is true', async () => {
        mockResolve()
        const w = mount(KnowledgePanel, {
            props: {isOpen: true},
            global: {provide: mockProvide, stubs: {teleport: true}}
        })
        await vi.waitFor(() => w.find('.knowledge-panel__topbar').exists(), {timeout: 2000})

        expect(w.find('.knowledge-panel__title').text()).toBe('知识图谱')
        expect(w.find('.knowledge-panel__search').exists()).toBe(true)
        expect(w.find('.knowledge-panel__filters').exists()).toBe(true)
    })

    it('does not render when isOpen is false', () => {
        const w = mount(KnowledgePanel, {
            props: {isOpen: false},
            global: {provide: mockProvide, stubs: {teleport: true}}
        })
        expect(w.find('.knowledge-panel__topbar').exists()).toBe(false)
    })

    it('emits close on backdrop click', async () => {
        mockResolve()
        const w = mount(KnowledgePanel, {
            props: {isOpen: true},
            global: {provide: mockProvide, stubs: {teleport: true}}
        })
        await vi.waitFor(() => w.find('.knowledge-panel__backdrop').exists(), {timeout: 2000})
        await w.find('.knowledge-panel__backdrop').trigger('click')
        expect(w.emitted('close')).toBeTruthy()
    })

    it('shows 全部 button as active by default (no filter selected)', async () => {
        mockResolve()
        const w = mount(KnowledgePanel, {
            props: {isOpen: true},
            global: {provide: mockProvide, stubs: {teleport: true}}
        })
        await vi.waitFor(() => w.find('.knowledge-panel__filter-btn').exists(), {timeout: 2000})

        const allBtn = w.findAll('.knowledge-panel__filter-btn')[0]
        expect(allBtn.text()).toBe('全部')
        expect(allBtn.classes()).toContain('knowledge-panel__filter-btn--active')
    })

    it('difficulty chips toggle activeDifficulty on click', async () => {
        mockResolve()
        const w = mount(KnowledgePanel, {
            props: {isOpen: true},
            global: {provide: mockProvide, stubs: {teleport: true}}
        })
        await vi.waitFor(() => w.find('.knowledge-panel__filter-btn').exists(), {timeout: 2000})

        const diffBtn = w.findAll('.knowledge-panel__filter-btn')[1] // 入门 L1
        expect(diffBtn.text()).toBe('入门 L1')
        expect(w.vm.activeDifficulty).toBeNull()

        await diffBtn.trigger('click')
        await nextTick()
        expect(diffBtn.classes()).toContain('knowledge-panel__filter-btn--active')
        expect(w.vm.activeDifficulty).toBe('1')

        // Click again to toggle off
        await diffBtn.trigger('click')
        await nextTick()
        expect(w.vm.activeDifficulty).toBeNull()
    })

    it('category chips toggle activeCategory on click', async () => {
        mockResolve()
        const w = mount(KnowledgePanel, {
            props: {isOpen: true},
            global: {provide: mockProvide, stubs: {teleport: true}}
        })
        await vi.waitFor(() => w.find('.knowledge-panel__filter-btn').exists(), {timeout: 2000})

        const catBtn = w.findAll('.knowledge-panel__filter-btn')[4] // 查询类
        expect(catBtn.text()).toBe('查询类')
        expect(w.vm.activeCategory).toBeNull()

        await catBtn.trigger('click')
        await nextTick()
        expect(catBtn.classes()).toContain('knowledge-panel__filter-btn--active')
        expect(w.vm.activeCategory).toBe('query')
    })

    it('difficulty + category filters can be combined', async () => {
        mockResolve()
        const w = mount(KnowledgePanel, {
            props: {isOpen: true},
            global: {provide: mockProvide, stubs: {teleport: true}}
        })
        await vi.waitFor(() => w.find('.knowledge-panel__filter-btn').exists(), {timeout: 2000})

        const btns = w.findAll('.knowledge-panel__filter-btn')
        const diffBtn = btns[2] // 进阶 L2
        const catBtn = btns[4] // 查询类

        await diffBtn.trigger('click')
        await catBtn.trigger('click')
        await nextTick()

        expect(diffBtn.classes()).toContain('knowledge-panel__filter-btn--active')
        expect(catBtn.classes()).toContain('knowledge-panel__filter-btn--active')
        expect(w.vm.activeDifficulty).toBe('2')
        expect(w.vm.activeCategory).toBe('query')
    })

    it('全部 button resets all filters', async () => {
        mockResolve()
        const w = mount(KnowledgePanel, {
            props: {isOpen: true},
            global: {provide: mockProvide, stubs: {teleport: true}}
        })
        await vi.waitFor(() => w.find('.knowledge-panel__filter-btn').exists(), {timeout: 2000})

        const btns = w.findAll('.knowledge-panel__filter-btn')
        const allBtn = btns[0]
        const diffBtn = btns[2] // 进阶 L2

        // Set a filter
        await diffBtn.trigger('click')
        await nextTick()
        expect(w.vm.activeDifficulty).toBe('2')
        expect(allBtn.classes()).not.toContain('knowledge-panel__filter-btn--active')

        // Click 全部
        await allBtn.trigger('click')
        await nextTick()
        expect(w.vm.activeDifficulty).toBeNull()
        expect(w.vm.activeCategory).toBeNull()
        expect(allBtn.classes()).toContain('knowledge-panel__filter-btn--active')
    })

    it('non-matching nodes are dimmed (opacity 0.12) not hidden', async () => {
        const w = await mountWithData()

        // All nodes visible when no filter
        const allNodes = w.vm.filteredNodes as any[]
        expect(allNodes.length).toBe(3)

        // Filter to difficulty=2 (only JOIN matches)
        const btns = w.findAll('.knowledge-panel__filter-btn')
        await btns[2].trigger('click') // 进阶 L2
        await nextTick()

        const filtered = w.vm.filteredNodes as any[]
        expect(filtered.length).toBe(3) // still 3 nodes (not filtered out)

        const dimmed = filtered.filter((n: any) => n.style.opacity === 0.12)
        const visible = filtered.filter((n: any) => n.style.opacity === 1)

        expect(dimmed.length).toBe(2) // SQL 基础 (diff=1) + INSERT (diff=1)
        expect(visible.length).toBe(1) // JOIN (diff=2)
    })

    it('category filter dims non-matching nodes', async () => {
        const w = await mountWithData()

        const btns = w.findAll('.knowledge-panel__filter-btn')
        await btns[5].trigger('click') // 增删改
        await nextTick()

        const filtered = w.vm.filteredNodes as any[]
        expect(filtered.length).toBe(3)

        const visible = filtered.filter((n: any) => n.style.opacity === 1)
        expect(visible.length).toBe(1) // only INSERT (category: dml)
        expect(visible[0].data.label).toBe('INSERT')
    })

    it('组合筛选时边只显示两端节点都匹配的', async () => {
        const w = await mountWithData([
            {
                id: 'a',
                label: 'A',
                description: '',
                keywords: [],
                patterns: [],
                difficulty: 1,
                prerequisites: [],
                nextTopics: ['b'],
                category: 'query'
            },
            {
                id: 'b',
                label: 'B',
                description: '',
                keywords: [],
                patterns: [],
                difficulty: 2,
                prerequisites: ['a'],
                nextTopics: [],
                category: 'query'
            }
        ])

        const btns = w.findAll('.knowledge-panel__filter-btn')
        await btns[1].trigger('click') // 入门 L1 — only A matches
        await nextTick()

        const edges = w.vm.filteredEdges as any[]
        // Edge A→B should be hidden since B is dimmed
        expect(edges.length).toBe(0)
    })

    // ── WR-06: xpBarPercent negative guard (D-10) ─────────────────
    it('xpBarPercent returns 0 (not negative) with corrupted localStorage level:99', async () => {
        // Corrupted localStorage: level=99, totalXp=100. Without guards:
        //   currentLevelXp = 99 * 750 = 74250
        //   xpInLevel = 100 - 74250 = -74150 → xpBarPercent would be ~-9873
        // With D-10 guards (xpData.level clamp + Math.max on xpInLevel):
        //   level clamps to 3 → currentLevelXp = 2250 → xpInLevel = 100-2250 = -2150
        //   Math.max(0, -2150) = 0 → xpBarPercent = 0
        localStorage.setItem('ai-knowledge-xp', JSON.stringify({
            totalXp: 100, level: 99, streak: 0, masteredLog: []
        }))
        mockResolve()
        const w = mount(KnowledgePanel, {
            props: {isOpen: true},
            global: {provide: mockProvide, stubs: {teleport: true}}
        })
        await vi.waitFor(() => (w.vm as any).xpBarPercent !== undefined, {timeout: 2000})
        await nextTick() // let immediate watch clamp level
        expect((w.vm as any).xpBarPercent).toBe(0)
    })
})
