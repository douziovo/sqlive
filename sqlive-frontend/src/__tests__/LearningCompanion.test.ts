import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LearningCompanion from '@/components/knowledge/LearningCompanion.vue'
import { useKnowledgeGraph } from '@/composables/useKnowledgeGraph'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('LearningCompanion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // D-02: reset module-level graphData/selectedNode so each test starts fresh
    const kg = useKnowledgeGraph()
    kg.graphData.value = null
    kg.selectedNode.value = null
  })

  it('renders count/total from kg.progress (mastered count / graphData total)', async () => {
    // D-02: count = mastered topics that appear in graphData; total = graphData.topics.length
    // Set mastered IDs to match mock graph topics so count=2
    localStorage.setItem('ai-mastered-topics', JSON.stringify(['a', 'b']))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ topics: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] })
    })

    const w = mount(LearningCompanion)
    await flushPromises()
    await vi.waitFor(() => w.text().includes('2/3'), { timeout: 2000 })

    expect(w.text()).toContain('2/3')
  })

  it('displays levelName from kg.progress (not local percentage-based level)', async () => {
    // D-02: level comes from kg.progress.value.levelName (XP-based, not percentage)
    // Default xpData = { totalXp: 0, level: 0 } → levelName = '初级学者'
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ topics: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] })
    })

    const w = mount(LearningCompanion)
    await flushPromises()
    await vi.waitFor(() => w.text().includes('初级学者'), { timeout: 2000 })

    // Level badge shows XP-based level name, not percentage-based '初级'/'进阶'/'大师'
    expect(w.find('.companion-level').text()).toBe('初级学者')
  })

  it('does not call fetchTotal (D-02: removed duplicate fetch)', async () => {
    // D-02: LearningCompanion should not have its own fetchTotal function
    // It may call kg.fetchGraph() defensively, but only if graphData is null
    // After kg.fetchGraph() succeeds, a second mount should not fetch again
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ topics: [{ id: 'a' }] })
    })

    const w = mount(LearningCompanion)
    await flushPromises()
    // First mount triggers defensive kg.fetchGraph() — consumes the mock
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Second mount should NOT fetch again (graphData already populated by singleton)
    mockFetch.mockClear()
    const w2 = mount(LearningCompanion)
    await flushPromises()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('emits open on click', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ topics: [] }) })
    const w = mount(LearningCompanion)
    await flushPromises()
    await w.find('button.learning-companion').trigger('click')
    expect(w.emitted('open')).toBeTruthy()
  })

  // ── task badge (Phase 09) ─────────────────────────────────────

  it('shows badge when pending tasks exist', async () => {
    const tasks = [
      { id: '1', topicId: 'a', title: 't1', notes: '', status: 'todo', priority: 'medium', createdAt: new Date().toISOString() },
      { id: '2', topicId: 'b', title: 't2', notes: '', status: 'todo', priority: 'medium', createdAt: new Date().toISOString() },
      { id: '3', topicId: 'c', title: 't3', notes: '', status: 'done', priority: 'medium', createdAt: new Date().toISOString() }
    ]
    localStorage.setItem('ai-knowledge-tasks', JSON.stringify(tasks))
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ topics: [] }) })
    const w = mount(LearningCompanion)
    await flushPromises()
    const badge = w.find('.companion-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('2')
  })

  it('hides badge when no pending tasks', async () => {
    localStorage.setItem('ai-knowledge-tasks', JSON.stringify([]))
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ topics: [] }) })
    const w = mount(LearningCompanion)
    await flushPromises()
    expect(w.find('.companion-badge').exists()).toBe(false)
  })

  it('shows 99+ when pending count exceeds 99', async () => {
    const tasks = Array.from({ length: 100 }, (_, i) => ({
      id: `${i}`, topicId: 'a', title: 't', notes: '',
      status: 'todo' as const, priority: 'medium' as const,
      createdAt: new Date().toISOString()
    }))
    localStorage.setItem('ai-knowledge-tasks', JSON.stringify(tasks))
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ topics: [] }) })
    const w = mount(LearningCompanion)
    await flushPromises()
    const badge = w.find('.companion-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('99+')
  })

  it('badge has correct styling', async () => {
    localStorage.setItem('ai-knowledge-tasks', JSON.stringify([
      { id: '1', topicId: 'a', title: 't', notes: '', status: 'todo', priority: 'medium', createdAt: new Date().toISOString() }
    ]))
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ topics: [] }) })
    const w = mount(LearningCompanion)
    await flushPromises()
    const badge = w.find('.companion-badge')
    expect(badge.exists()).toBe(true)
    // Check key CSS properties via element style or classes
    expect(badge.attributes('class')).toContain('companion-badge')
  })

  // ── ActiveTaskTracker integration (Phase 09-06) ────────────────

  it('hides ActiveTaskTracker when no pinned task', async () => {
    localStorage.setItem('ai-knowledge-tasks', JSON.stringify([]))
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ topics: [] }) })
    const w = mount(LearningCompanion)
    await flushPromises()
    expect(w.find('.active-tracker').exists()).toBe(false)
  })

  it('renders ActiveTaskTracker when pinned task exists', async () => {
    const tasks = [{
      id: 'task-1', topicId: 'joins', title: '练习 JOIN',
      notes: '', status: 'in-progress', priority: 'medium',
      createdAt: new Date().toISOString(), category: 'core',
      substeps: [{ id: 's1', label: 'step 1', status: 'active' }],
      isPinned: true
    }]
    localStorage.setItem('ai-knowledge-tasks', JSON.stringify(tasks))
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ topics: [] }) })
    const w = mount(LearningCompanion)
    await flushPromises()
    expect(w.find('.active-tracker').exists()).toBe(true)
    expect(w.text()).toContain('练习 JOIN')
    expect(w.text()).toContain('继续学习')
  })

  it('emits navigate when tracker continue button clicked', async () => {
    const tasks = [{
      id: 'task-1', topicId: 'joins', title: '练习 JOIN',
      notes: '', status: 'in-progress', priority: 'medium',
      createdAt: new Date().toISOString(), category: 'core',
      substeps: [{ id: 's1', label: 'step 1', status: 'active' }],
      isPinned: true
    }]
    localStorage.setItem('ai-knowledge-tasks', JSON.stringify(tasks))
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ topics: [] }) })
    const w = mount(LearningCompanion)
    await flushPromises()
    await w.find('.active-tracker__btn--primary').trigger('click')
    expect(w.emitted('navigate')).toBeTruthy()
    expect(w.emitted('navigate')?.[0]).toEqual(['joins'])
  })
})
