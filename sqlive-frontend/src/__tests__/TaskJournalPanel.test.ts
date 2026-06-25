import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import TaskJournalPanel from '@/components/knowledge/TaskJournalPanel.vue'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'

const stubs = {
  StepProgress: true,
  RedDotBadge: true,
  TaskCreateForm: true
}

function makeTask(overrides: Partial<KnowledgeTask> = {}): KnowledgeTask {
  return {
    id: 't1',
    topicId: 'a',
    title: 'Task 1',
    notes: '',
    status: 'todo',
    priority: 'low',
    createdAt: '2024-01-01T00:00:00.000Z',
    category: 'core',
    substeps: [],
    isPinned: false,
    ...overrides
  }
}

/**
 * Write tasks to localStorage AND dispatch a storage event so vueuse's
 * useLocalStorage ref (used inside useKnowledgeTasks) re-reads the value.
 * jsdom doesn't fire storage events for same-window writes automatically.
 */
function setTasks(tasks: KnowledgeTask[]): void {
  const serialized = JSON.stringify(tasks)
  localStorage.setItem('ai-knowledge-tasks', serialized)
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'ai-knowledge-tasks',
    newValue: serialized
  }))
}

describe('TaskJournalPanel — D-08 default-select first task', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('auto-selects first task when tasks exist on mount', () => {
    setTasks([makeTask({ id: 't1' }), makeTask({ id: 't2' })])

    const wrapper = mount(TaskJournalPanel, {
      props: { topics: [] },
      global: { stubs }
    })

    const selected = wrapper.find('.journal__list-item--selected')
    expect(selected.exists()).toBe(true)
  })

  it('does not auto-select when tasks empty', () => {
    const wrapper = mount(TaskJournalPanel, {
      props: { topics: [] },
      global: { stubs }
    })

    expect(wrapper.find('.journal__list-item--selected').exists()).toBe(false)
    // Right panel shows D-06 guided empty state (create button)
    expect(wrapper.find('.journal__detail-empty-btn').exists()).toBe(true)
  })

  it('auto-selects when tasks arrive after mount via watch', async () => {
    const wrapper = mount(TaskJournalPanel, {
      props: { topics: [] },
      global: { stubs }
    })

    expect(wrapper.find('.journal__list-item--selected').exists()).toBe(false)

    setTasks([makeTask({ id: 't1' })])
    await nextTick()
    await nextTick()  // extra tick for watch + re-render

    expect(wrapper.find('.journal__list-item--selected').exists()).toBe(true)
  })
})
