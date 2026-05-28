import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import KnowledgePanel from '@/components/knowledge/KnowledgePanel.vue'
import { SQL_CONTEXT_KEY } from '@/model/injectionKeys'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockProvide = {
  [SQL_CONTEXT_KEY as symbol]: { tabs: { value: [] }, activeTabId: { value: '1' } }
}

describe('KnowledgePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('renders when isOpen is true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          topics: [
            {
              id: 'a',
              label: 'SQL 基础',
              description: '',
              keywords: [],
              patterns: [],
              difficulty: 1,
              prerequisites: [],
              nextTopics: [],
              category: 'basics'
            }
          ]
        })
    })
    const w = mount(KnowledgePanel, {
      props: { isOpen: true },
      global: { provide: mockProvide, stubs: { teleport: true } }
    })
    await vi.waitFor(() => w.find('.knowledge-panel__topbar').exists(), { timeout: 2000 })

    expect(w.find('.knowledge-panel__title').text()).toBe('知识图谱')
    expect(w.find('.knowledge-panel__search').exists()).toBe(true)
    expect(w.find('.knowledge-panel__filters').exists()).toBe(true)
  })

  it('does not render when isOpen is false', () => {
    const w = mount(KnowledgePanel, {
      props: { isOpen: false },
      global: { provide: mockProvide, stubs: { teleport: true } }
    })
    expect(w.find('.knowledge-panel__topbar').exists()).toBe(false)
  })

  it('emits close on backdrop click', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ topics: [] }) })
    const w = mount(KnowledgePanel, {
      props: { isOpen: true },
      global: { provide: mockProvide, stubs: { teleport: true } }
    })
    await vi.waitFor(() => w.find('.knowledge-panel__backdrop').exists(), { timeout: 2000 })
    await w.find('.knowledge-panel__backdrop').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })

  it('filters nodes by difficulty on filter click', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          topics: [
            {
              id: 'a',
              label: 'SQL 基础',
              description: '',
              keywords: [],
              patterns: [],
              difficulty: 1,
              prerequisites: [],
              nextTopics: [],
              category: 'basics'
            },
            {
              id: 'b',
              label: 'JOIN',
              description: '',
              keywords: [],
              patterns: [],
              difficulty: 2,
              prerequisites: [],
              nextTopics: [],
              category: 'query'
            }
          ]
        })
    })
    const w = mount(KnowledgePanel, {
      props: { isOpen: true },
      global: { provide: mockProvide, stubs: { teleport: true } }
    })
    await vi.waitFor(() => w.find('.knowledge-panel__filter-btn').exists(), { timeout: 2000 })

    const filterBtns = w.findAll('.knowledge-panel__filter-btn')
    await filterBtns[1].trigger('click')
    await nextTick()

    expect(filterBtns[1].classes()).toContain('knowledge-panel__filter-btn--active')
  })

  it('supports cross-filtering by difficulty and status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          topics: [
            {
              id: 'a',
              label: 'SQL 基础',
              description: '',
              keywords: [],
              patterns: [],
              difficulty: 1,
              prerequisites: [],
              nextTopics: [],
              category: 'basics'
            },
            {
              id: 'b',
              label: 'JOIN',
              description: '',
              keywords: [],
              patterns: [],
              difficulty: 2,
              prerequisites: [],
              nextTopics: [],
              category: 'query'
            }
          ]
        })
    })
    const w = mount(KnowledgePanel, {
      props: { isOpen: true },
      global: { provide: mockProvide, stubs: { teleport: true } }
    })
    await vi.waitFor(() => w.find('.knowledge-panel__filter-btn').exists(), { timeout: 2000 })

    const filterBtns = w.findAll('.knowledge-panel__filter-btn')
    await filterBtns[0].trigger('click')
    await filterBtns[3].trigger('click')
    await nextTick()

    expect(filterBtns[0].classes()).toContain('knowledge-panel__filter-btn--active')
    expect(filterBtns[3].classes()).toContain('knowledge-panel__filter-btn--active')
  })
})
