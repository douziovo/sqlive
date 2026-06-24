// ── imports ────────────────────────────────────────────────────────

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskItem from '@/components/knowledge/TaskItem.vue'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'

// ── mock data ─────────────────────────────────────────────────────

const mockTask: KnowledgeTask = {
  id: 'task-1',
  topicId: 'joins',
  title: '练习 JOIN 查询',
  dueDate: '2026-06-30',
  notes: '',
  status: 'todo',
  priority: 'medium',
  createdAt: '2026-06-24T00:00:00.000Z',
  completedAt: undefined,
  category: 'core',
  substeps: [],
  isPinned: false
}

// ── TaskItem ──────────────────────────────────────────────────────

describe('TaskItem', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders task title and topic label', () => {
    const w = mount(TaskItem, {
      props: { task: mockTask, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    expect(w.text()).toContain('练习 JOIN 查询')
  })

  // ── priority dot color ──────────────────────────────────────

  it.each([
    ['low', 'bg-gray-400'],
    ['medium', 'bg-yellow-500'],
    ['high', 'bg-red-500']
  ])('shows priority dot with %s color as %s', (priority, expectedClass) => {
    const task = { ...mockTask, priority: priority as KnowledgeTask['priority'] }
    const w = mount(TaskItem, {
      props: { task, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    const dot = w.find('.task-item__priority-dot')
    expect(dot.classes()).toContain(expectedClass)
  })

  // ── overdue styling ─────────────────────────────────────────

  it('shows title in red when overdue', () => {
    const w = mount(TaskItem, {
      props: { task: mockTask, topicLabel: 'JOIN 查询', isOverdue: true }
    })
    const title = w.find('.task-item__title')
    expect(title.classes()).toContain('text-red-500')
  })

  // ── due date ────────────────────────────────────────────────

  it('shows due date when present', () => {
    const w = mount(TaskItem, {
      props: { task: mockTask, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    expect(w.text()).toContain('2026-06-30')
  })

  it('does not show due date when absent', () => {
    const task = { ...mockTask, dueDate: undefined }
    const w = mount(TaskItem, {
      props: { task, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    const dueEl = w.find('.task-item__due')
    expect(dueEl.exists()).toBe(false)
  })

  // ── status toggle ───────────────────────────────────────────

  it('cycles status on badge click from todo to in-progress', async () => {
    const w = mount(TaskItem, {
      props: { task: mockTask, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    await w.find('.task-item__status').trigger('click')
    expect(w.emitted('update:task')).toBeTruthy()
    expect(w.emitted('update:task')?.[0]).toEqual(['task-1', { status: 'in-progress' }])
  })

  it('emits complete:task when transitioning to done', async () => {
    const task = { ...mockTask, status: 'in-progress' as const }
    const w = mount(TaskItem, {
      props: { task, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    await w.find('.task-item__status').trigger('click')
    expect(w.emitted('complete:task')).toBeTruthy()
    expect(w.emitted('complete:task')?.[0]).toEqual(['task-1'])
  })

  // ── delete ──────────────────────────────────────────────────

  it('shows confirm dialog on delete click and emits delete:task', async () => {
    const confirmSpy = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmSpy)
    const w = mount(TaskItem, {
      props: { task: mockTask, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    await w.find('.task-item__delete').trigger('click')
    expect(confirmSpy).toHaveBeenCalledWith('确定删除此任务？此操作不可撤销。')
    expect(w.emitted('delete:task')).toBeTruthy()
  })

  it('does not emit delete when confirm cancelled', async () => {
    vi.stubGlobal('confirm', () => false)
    const w = mount(TaskItem, {
      props: { task: mockTask, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    await w.find('.task-item__delete').trigger('click')
    expect(w.emitted('delete:task')).toBeFalsy()
  })

  // ── completed styling ───────────────────────────────────────

  it('completed task has strikethrough styling', () => {
    const task = { ...mockTask, status: 'done' as const }
    const w = mount(TaskItem, {
      props: { task, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    expect(w.find('.task-item--completed').exists()).toBe(true)
  })

  // ── New: accent border color (Task 3) ───────────────────────

  it('shows accent border color for core category', () => {
    const task = { ...mockTask, category: 'core' as const }
    const w = mount(TaskItem, {
      props: { task, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    const item = w.find('.task-item')
    // jsdom normalizes hex colors to rgb
    expect(item.attributes('style')).toContain('rgb(255, 204, 50)')
  })

  it('shows accent border color for deep-dive category', () => {
    const task = { ...mockTask, category: 'deep-dive' as const }
    const w = mount(TaskItem, {
      props: { task, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    const item = w.find('.task-item')
    // jsdom normalizes hex colors to rgb
    expect(item.attributes('style')).toContain('rgb(81, 136, 214)')
  })

  // ── New: step progress count (Task 3) ───────────────────────

  it('shows step progress count when task has substeps', () => {
    const task = {
      ...mockTask,
      substeps: [
        { id: 's1', label: 'Step 1', status: 'done' as const },
        { id: 's2', label: 'Step 2', status: 'active' as const },
        { id: 's3', label: 'Step 3', status: 'locked' as const }
      ]
    }
    const w = mount(TaskItem, {
      props: { task, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    const steps = w.find('.task-item__steps')
    expect(steps.exists()).toBe(true)
    expect(steps.text()).toBe('1/3')
  })

  it('does not show step progress when task has no substeps', () => {
    const task = { ...mockTask, substeps: [] }
    const w = mount(TaskItem, {
      props: { task, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    expect(w.find('.task-item__steps').exists()).toBe(false)
  })

  // ── New: pin button emit (Task 3) ───────────────────────────

  it('emits pin:task when pin button clicked', async () => {
    const w = mount(TaskItem, {
      props: { task: mockTask, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    await w.find('.task-item__pin').trigger('click')
    expect(w.emitted('pin:task')).toBeTruthy()
    expect(w.emitted('pin:task')?.[0]).toEqual(['task-1'])
  })

  // ── New: pin icon shows pinned state (Task 3) ───────────────

  it('shows filled pin icon when task is pinned', () => {
    const task = { ...mockTask, isPinned: true }
    const w = mount(TaskItem, {
      props: { task, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    const pin = w.find('.task-item__pin')
    expect(pin.text()).toBe('📌')
  })

  it('shows outline pin icon when task is not pinned', () => {
    const w = mount(TaskItem, {
      props: { task: mockTask, topicLabel: 'JOIN 查询', isOverdue: false }
    })
    const pin = w.find('.task-item__pin')
    expect(pin.text()).toBe('📍')
  })
})
