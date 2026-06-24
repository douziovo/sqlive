// ── imports ────────────────────────────────────────────────────────

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskList from '@/components/knowledge/TaskList.vue'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'

// ── mock data ─────────────────────────────────────────────────────

const mockTopics: KnowledgeTopic[] = [
  {
    id: 'joins',
    label: 'JOIN 查询',
    description: '',
    keywords: [],
    patterns: [],
    difficulty: 2,
    prerequisites: [],
    nextTopics: [],
    category: 'query'
  },
  {
    id: 'subqueries',
    label: '子查询',
    description: '',
    keywords: [],
    patterns: [],
    difficulty: 3,
    prerequisites: ['joins'],
    nextTopics: [],
    category: 'advanced'
  }
]

const todoTask: KnowledgeTask = {
  id: 'task-1',
  topicId: 'joins',
  title: '练习 JOIN 查询',
  dueDate: '2026-06-30',
  notes: '',
  status: 'todo',
  priority: 'medium',
  createdAt: '2026-06-24T00:00:00.000Z',
  completedAt: undefined
}

const doneTask: KnowledgeTask = {
  id: 'task-2',
  topicId: 'subqueries',
  title: '练习子查询',
  notes: '',
  status: 'done',
  priority: 'high',
  createdAt: '2026-06-23T00:00:00.000Z',
  completedAt: '2026-06-23T12:00:00.000Z'
}

// ── helpers ───────────────────────────────────────────────────────

function setTasksInStorage(tasks: KnowledgeTask[]): void {
  localStorage.setItem('ai-knowledge-tasks', JSON.stringify(tasks))
}

// ── TaskList ──────────────────────────────────────────────────────

describe('TaskList', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // ── empty state ─────────────────────────────────────────────

  it('renders empty state when no tasks', () => {
    const w = mount(TaskList, {
      props: { topics: [] }
    })
    expect(w.text()).toContain('还没有学习任务')
    expect(w.text()).toContain('在知识点详情中添加你的第一个任务吧')
    expect(w.find('.task-list__empty-illustration').exists()).toBe(true)
  })

  // ── populated list ──────────────────────────────────────────

  it('renders task items when tasks exist', () => {
    setTasksInStorage([todoTask])
    const w = mount(TaskList, {
      props: { topics: mockTopics }
    })
    expect(w.text()).toContain('练习 JOIN 查询')
  })

  // ── filter chips ────────────────────────────────────────────

  it('shows filter chips', () => {
    const w = mount(TaskList, {
      props: { topics: [] }
    })
    expect(w.text()).toContain('全部')
    expect(w.text()).toContain('待办')
    expect(w.text()).toContain('进行中')
    expect(w.text()).toContain('已完成')
  })

  // ── status filter ───────────────────────────────────────────

  it('filters by status on chip click', async () => {
    setTasksInStorage([todoTask, doneTask])
    const w = mount(TaskList, {
      props: { topics: mockTopics }
    })

    // Click "已完成" chip to filter
    const chips = w.findAll('.task-list__filter-btn')
    const doneChip = chips.find((c) => c.text() === '已完成')
    expect(doneChip).toBeTruthy()
    await doneChip!.trigger('click')

    // Only done task should be visible
    expect(w.text()).toContain('练习子查询')
    expect(w.text()).not.toContain('练习 JOIN 查询')
  })

  // ── filtered empty state ────────────────────────────────────

  it('shows filtered empty message when filter returns no results', async () => {
    setTasksInStorage([todoTask])
    const w = mount(TaskList, {
      props: { topics: mockTopics }
    })

    // Click "已完成" chip — no done tasks exist
    const chips = w.findAll('.task-list__filter-btn')
    const doneChip = chips.find((c) => c.text() === '已完成')
    await doneChip!.trigger('click')

    expect(w.text()).toContain('没有符合筛选条件的任务')
    expect(w.text()).toContain('清除筛选')
  })

  // ── completeTask bubbling ───────────────────────────────────

  it('emits completeTask when child task completes', async () => {
    setTasksInStorage([{ ...todoTask, status: 'in-progress' }])
    const w = mount(TaskList, {
      props: { topics: mockTopics }
    })

    // Find the TaskItem and trigger complete:task
    const taskItem = w.findComponent({ name: 'TaskItem' })
    expect(taskItem.exists()).toBe(true)
    await taskItem.vm.$emit('complete:task', 'task-1')

    expect(w.emitted('completeTask')).toBeTruthy()
    expect(w.emitted('completeTask')?.[0]).toEqual(['joins'])
  })

  // ── create form toggle ──────────────────────────────────────

  it('shows create form when new task button clicked', async () => {
    const w = mount(TaskList, {
      props: { topics: mockTopics }
    })

    await w.find('.task-list__create-btn').trigger('click')
    expect(w.findComponent({ name: 'TaskCreateForm' }).exists()).toBe(true)
  })
})
