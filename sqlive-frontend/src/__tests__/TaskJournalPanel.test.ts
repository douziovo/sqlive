import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'

// ── Mock useKnowledgeTasks with a shared ref ───────────────────
// vi.hoisted runs before any import, so the holder object exists when
// the vi.mock factory runs (during TaskJournalPanel import). The ref is
// created lazily inside the factory via dynamic import('vue') so we don't
// depend on hoisted static imports.

const { mockTasksHolder } = vi.hoisted(() => ({ mockTasksHolder: { ref: null as any } }))

vi.mock('@/composables/useKnowledgeTasks', async () => {
  const { ref } = await import('vue')
  if (!mockTasksHolder.ref) mockTasksHolder.ref = ref<KnowledgeTask[]>([])
  return {
    useKnowledgeTasks: () => ({
      tasks: mockTasksHolder.ref,
      addTask: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      completeTask: vi.fn(),
      updateSubstep: vi.fn(),
      pinTask: vi.fn(),
      unpinTask: vi.fn(),
      getPinnedTask: { value: null },
      getChapterProgress: () => ({ completed: 0, total: 0 }),
      tasksByTopic: () => ({ value: [] }),
      pendingCount: { value: 0 },
      sortedByCategoryGroup: () => ({ value: [] }),
      isOverdue: () => false,
      seedPresetTasksIfFirstRun: () => false
    })
  }
})

vi.mock('@/composables/useRedDot', () => ({
  useRedDot: () => ({
    isVisible: () => false,
    clear: vi.fn(),
    show: vi.fn(),
    hasDotInPrefix: () => false,
    clearAll: vi.fn(),
    keyParents: { value: {} }
  })
}))

// Import after mocks are registered
import TaskJournalPanel from '@/components/knowledge/TaskJournalPanel.vue'

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

function setTasks(tasks: KnowledgeTask[]): void {
  mockTasksHolder.ref.value = tasks
}

describe('TaskJournalPanel — D-08 default-select first task', () => {
  beforeEach(() => {
    mockTasksHolder.ref.value = []
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
