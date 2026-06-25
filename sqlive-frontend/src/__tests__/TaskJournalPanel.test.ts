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

// ── WR-05: chapterCategoryFilter union-list mode (D-09/D-09a/D-09b) ──

describe('TaskJournalPanel — WR-05 chapterCategoryFilter union-list mode', () => {
  beforeEach(() => {
    mockTasksHolder.ref.value = []
  })

  it('filters tasks to union of chapterCategoryFilter categories', () => {
    setTasks([
      makeTask({ id: 't1', category: 'core' }),
      makeTask({ id: 't2', category: 'deep-dive' }),
      makeTask({ id: 't3', category: 'daily' })
    ])
    const wrapper = mount(TaskJournalPanel, {
      props: { topics: [], chapterCategoryFilter: ['core', 'deep-dive'] },
      global: { stubs }
    })
    const items = wrapper.findAll('.journal__list-item')
    expect(items.length).toBe(2) // t1 (core) + t2 (deep-dive), t3 (daily) excluded
  })

  it('no category tab highlighted when chapterCategoryFilter is set', () => {
    setTasks([makeTask({ id: 't1', category: 'core' })])
    const wrapper = mount(TaskJournalPanel, {
      props: { topics: [], chapterCategoryFilter: ['core'] },
      global: { stubs }
    })
    const activeTabs = wrapper.findAll('.journal__tab--active')
    expect(activeTabs.length).toBe(0) // union mode: no single tab highlighted
  })

  it('auto-selects first task in union-filtered list', () => {
    setTasks([
      makeTask({ id: 't1', category: 'core' }),
      makeTask({ id: 't2', category: 'deep-dive' }),
      makeTask({ id: 't3', category: 'daily' })
    ])
    const wrapper = mount(TaskJournalPanel, {
      props: { topics: [], chapterCategoryFilter: ['core', 'deep-dive'] },
      global: { stubs }
    })
    const selected = wrapper.find('.journal__list-item--selected')
    expect(selected.exists()).toBe(true)
  })

  it('falls back to activeCategory single-filter when chapterCategoryFilter is undefined', () => {
    setTasks([
      makeTask({ id: 't1', category: 'core' }),
      makeTask({ id: 't2', category: 'deep-dive' })
    ])
    const wrapper = mount(TaskJournalPanel, {
      props: { topics: [] }, // no chapterCategoryFilter
      global: { stubs }
    })
    const items = wrapper.findAll('.journal__list-item')
    expect(items.length).toBe(1) // only core (default activeCategory)
  })
})
