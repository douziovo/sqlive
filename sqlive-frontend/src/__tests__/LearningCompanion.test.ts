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
})
