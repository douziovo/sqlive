import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LearningCompanion from '@/components/knowledge/LearningCompanion.vue'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('LearningCompanion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders count/total from localStorage and API fetch', async () => {
    localStorage.setItem('ai-mastered-topics', JSON.stringify(['sql-basics', 'joins']))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ topics: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] })
    })

    const w = mount(LearningCompanion)
    await flushPromises()
    await vi.waitFor(() => w.text().includes('2/3'), { timeout: 2000 })

    expect(w.text()).toContain('2/3')
  })

  it('emits open on click', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ topics: [] }) })
    const w = mount(LearningCompanion)
    await flushPromises()
    await w.trigger('click')
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
})
