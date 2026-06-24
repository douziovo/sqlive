import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  useKnowledgeTasks,
  type KnowledgeTask
} from '@/composables/useKnowledgeTasks'

beforeEach(() => {
  localStorage.clear()
})

// ── addTask ───────────────────────────────────────────────────────

describe('addTask', () => {
  it('creates a task with generated id, status=todo, and timestamps', () => {
    const { addTask } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Test',
      notes: '',
      priority: 'medium'
    })

    expect(task.id).toBeTruthy()
    expect(typeof task.id).toBe('string')
    expect(task.status).toBe('todo')
    expect(task.createdAt).toBeTruthy()
    expect(() => new Date(task.createdAt!)).not.toThrow()
    expect(task.completedAt).toBeUndefined()
  })

  it('defaults optional fields correctly', () => {
    const { addTask } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Minimal task',
      notes: '',
      priority: 'medium'
    })

    expect(task.notes).toBe('')
    expect(task.dueDate).toBeUndefined()
  })

  it('stores task in localStorage via useLocalStorage', async () => {
    const { addTask } = useKnowledgeTasks()
    addTask({
      topicId: 'joins',
      title: 'Persist me',
      notes: '',
      priority: 'low'
    })

    await nextTick()

    const raw = localStorage.getItem('ai-knowledge-tasks')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(1)
    expect(parsed[0].title).toBe('Persist me')
  })
})

// ── updateTask ────────────────────────────────────────────────────

describe('updateTask', () => {
  it('updates specific fields and preserves others', () => {
    const { addTask, updateTask, tasks } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Original',
      notes: '',
      priority: 'low'
    })

    updateTask(task.id, { title: 'Updated', priority: 'high' })

    const updated = tasks.value.find((t) => t.id === task.id)
    expect(updated).toBeTruthy()
    expect(updated!.title).toBe('Updated')
    expect(updated!.priority).toBe('high')
    expect(updated!.status).toBe('todo')
    expect(updated!.topicId).toBe('joins')
  })

  it('is a no-op for non-existent id', () => {
    const { addTask, updateTask, tasks } = useKnowledgeTasks()
    addTask({
      topicId: 'joins',
      title: 'Only task',
      notes: '',
      priority: 'medium'
    })

    const lengthBefore = tasks.value.length
    updateTask('nonexistent', { title: 'X' })
    expect(tasks.value.length).toBe(lengthBefore)
  })
})

// ── deleteTask ────────────────────────────────────────────────────

describe('deleteTask', () => {
  it('removes task by id', () => {
    const { addTask, deleteTask, tasks } = useKnowledgeTasks()
    const task1 = addTask({
      topicId: 'joins',
      title: 'Task 1',
      notes: '',
      priority: 'low'
    })
    const task2 = addTask({
      topicId: 'basics',
      title: 'Task 2',
      notes: '',
      priority: 'medium'
    })

    deleteTask(task1.id)

    expect(tasks.value.length).toBe(1)
    expect(tasks.value[0].id).toBe(task2.id)
  })

  it('is a no-op for non-existent id', () => {
    const { addTask, deleteTask, tasks } = useKnowledgeTasks()
    addTask({
      topicId: 'joins',
      title: 'Safe',
      notes: '',
      priority: 'high'
    })

    const lengthBefore = tasks.value.length
    deleteTask('nonexistent')
    expect(tasks.value.length).toBe(lengthBefore)
  })
})

// ── completeTask ──────────────────────────────────────────────────

describe('completeTask', () => {
  it('sets status to done and records completedAt', () => {
    const { addTask, completeTask, tasks } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'To complete',
      notes: '',
      priority: 'medium'
    })

    const result = completeTask(task.id)

    expect(result).not.toBeNull()
    expect(result!.task.status).toBe('done')
    expect(result!.task.completedAt).toBeTruthy()
    expect(() =>
      new Date(result!.task.completedAt!)
    ).not.toThrow()

    const persisted = tasks.value.find((t) => t.id === task.id)
    expect(persisted!.status).toBe('done')
  })

  it('returns null when task is already done (double-XP guard)', () => {
    const { addTask, completeTask } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Double complete',
      notes: '',
      priority: 'medium'
    })

    const first = completeTask(task.id)
    expect(first).not.toBeNull()

    const second = completeTask(task.id)
    expect(second).toBeNull()
  })

  it('returns null for non-existent id', () => {
    const { addTask, completeTask } = useKnowledgeTasks()
    addTask({
      topicId: 'joins',
      title: 'Present',
      notes: '',
      priority: 'low'
    })

    const result = completeTask('nonexistent')
    expect(result).toBeNull()
  })
})

// ── pendingCount ──────────────────────────────────────────────────

describe('pendingCount', () => {
  it('counts only todo-status tasks', () => {
    const { addTask, updateTask, pendingCount } = useKnowledgeTasks()
    const task1 = addTask({
      topicId: 'joins',
      title: 'Todo 1',
      notes: '',
      priority: 'medium'
    })
    addTask({
      topicId: 'basics',
      title: 'Todo 2',
      notes: '',
      priority: 'low'
    })

    updateTask(task1.id, { status: 'in-progress' })

    expect(pendingCount.value).toBe(1)
  })

  it('returns 0 when all tasks are done', () => {
    const { addTask, completeTask, pendingCount } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Finish me',
      notes: '',
      priority: 'high'
    })

    completeTask(task.id)
    expect(pendingCount.value).toBe(0)
  })
})

// ── isOverdue ─────────────────────────────────────────────────────

describe('isOverdue', () => {
  it('returns true for past due date', () => {
    const { addTask, isOverdue, tasks } = useKnowledgeTasks()
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 7)
    addTask({
      topicId: 'joins',
      title: 'Overdue task',
      notes: '',
      priority: 'medium',
      dueDate: pastDate.toISOString()
    })

    expect(isOverdue(tasks.value[0])).toBe(true)
  })

  it('returns false for future due date', () => {
    const { addTask, isOverdue, tasks } = useKnowledgeTasks()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 7)
    addTask({
      topicId: 'joins',
      title: 'Future task',
      notes: '',
      priority: 'low',
      dueDate: futureDate.toISOString()
    })

    expect(isOverdue(tasks.value[0])).toBe(false)
  })

  it('returns false when task is done even if overdue', () => {
    const { addTask, completeTask, isOverdue, tasks } = useKnowledgeTasks()
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 7)
    const task = addTask({
      topicId: 'joins',
      title: 'Completed overdue',
      notes: '',
      priority: 'medium',
      dueDate: pastDate.toISOString()
    })

    completeTask(task.id)

    const doneTask = tasks.value.find((t) => t.id === task.id)
    expect(isOverdue(doneTask!)).toBe(false)
  })

  it('returns false when dueDate is undefined', () => {
    const { addTask, isOverdue, tasks } = useKnowledgeTasks()
    addTask({
      topicId: 'joins',
      title: 'No deadline',
      notes: '',
      priority: 'low'
    })

    expect(isOverdue(tasks.value[0])).toBe(false)
  })

  it('uses day granularity (same day is NOT overdue)', () => {
    const { addTask, isOverdue, tasks } = useKnowledgeTasks()
    const today = new Date().toISOString()
    addTask({
      topicId: 'joins',
      title: 'Due today',
      notes: '',
      priority: 'high',
      dueDate: today
    })

    expect(isOverdue(tasks.value[0])).toBe(false)
  })
})

// ── sortedByCategoryGroup ─────────────────────────────────────────

describe('sortedByCategoryGroup', () => {
  it('sorts by category order then createdAt desc', () => {
    const { addTask, sortedByCategoryGroup, tasks } = useKnowledgeTasks()

    const categoryMap = new Map<string, string>([
      ['joins', 'query'],
      ['basics', 'basics'],
      ['adv', 'advanced']
    ])

    // basics task (oldest)
    addTask({
      topicId: 'basics',
      title: 'Basics task',
      notes: '',
      priority: 'low'
    })
    // query task
    addTask({
      topicId: 'joins',
      title: 'Query task',
      notes: '',
      priority: 'medium'
    })
    // advanced task
    addTask({
      topicId: 'adv',
      title: 'Advanced task',
      notes: '',
      priority: 'high'
    })

    const sorted = sortedByCategoryGroup(categoryMap)
    const order = sorted.value.map((t) => t.title)

    expect(order[0]).toBe('Basics task')
    expect(order[1]).toBe('Query task')
    expect(order[2]).toBe('Advanced task')
  })

  it('places unknown categories at end with position 99', () => {
    const { addTask, sortedByCategoryGroup } = useKnowledgeTasks()

    const categoryMap = new Map<string, string>([
      ['basics', 'basics'],
      ['unknown', 'nonexistent-category']
    ])

    addTask({
      topicId: 'basics',
      title: 'Known category',
      notes: '',
      priority: 'medium'
    })
    addTask({
      topicId: 'unknown',
      title: 'Unknown category',
      notes: '',
      priority: 'low'
    })

    const sorted = sortedByCategoryGroup(categoryMap)
    const order = sorted.value.map((t) => t.title)

    expect(order[0]).toBe('Known category')
    expect(order[1]).toBe('Unknown category')
  })
})

// ── localStorage persistence ──────────────────────────────────────

describe('localStorage persistence', () => {
  it('survives composable re-creation', async () => {
    const first = useKnowledgeTasks()
    first.addTask({
      topicId: 'joins',
      title: 'Persist test',
      notes: '',
      priority: 'medium'
    })

    await nextTick()

    // Simulate page refresh by creating a new composable instance
    const second = useKnowledgeTasks()
    expect(second.tasks.value.length).toBe(1)
    expect(second.tasks.value[0].title).toBe('Persist test')
  })

  it('handles empty localStorage gracefully', () => {
    localStorage.clear()
    const { tasks } = useKnowledgeTasks()
    expect(tasks.value).toEqual([])
  })
})

// ── Chapter 09-04: substeps, pin, chapters (Genshin redesign) ──

// ── category defaults ────────────────────────────────────────────

describe('category and isPinned defaults', () => {
  it("addTask defaults category to 'core'", () => {
    const { addTask } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Default category',
      notes: '',
      priority: 'medium'
    })
    expect(task.category).toBe('core')
  })

  it("addTask accepts category 'deep-dive' and 'daily'", () => {
    const { addTask } = useKnowledgeTasks()
    const dd = addTask({
      topicId: 'joins',
      title: 'Deep dive',
      notes: '',
      priority: 'medium',
      category: 'deep-dive'
    })
    const daily = addTask({
      topicId: 'basics',
      title: 'Daily task',
      notes: '',
      priority: 'low',
      category: 'daily'
    })
    expect(dd.category).toBe('deep-dive')
    expect(daily.category).toBe('daily')
  })

  it('addTask defaults isPinned to false', () => {
    const { addTask } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Not pinned',
      notes: '',
      priority: 'low'
    })
    expect(task.isPinned).toBe(false)
  })

  it('addTask accepts isPinned=true', () => {
    const { addTask } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Pinned task',
      notes: '',
      priority: 'high',
      isPinned: true
    })
    expect(task.isPinned).toBe(true)
  })
})

// ── substeps ─────────────────────────────────────────────────────

describe('substeps', () => {
  it('addTask creates task with empty substeps by default', () => {
    const { addTask } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'No substeps',
      notes: '',
      priority: 'medium'
    })
    expect(task.substeps).toEqual([])
  })

  it('addTask creates task with substeps from string array (first active, rest locked)', () => {
    const { addTask } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Has steps',
      notes: '',
      priority: 'medium',
      substeps: ['Read docs', 'Complete exercise', 'Write query']
    })

    expect(task.substeps.length).toBe(3)
    expect(task.substeps[0].label).toBe('Read docs')
    expect(task.substeps[0].status).toBe('active')
    expect(task.substeps[1].label).toBe('Complete exercise')
    expect(task.substeps[1].status).toBe('locked')
    expect(task.substeps[2].label).toBe('Write query')
    expect(task.substeps[2].status).toBe('locked')
  })

  it('addTask accepts pre-built TaskSubstep[]', () => {
    const { addTask } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Custom steps',
      notes: '',
      priority: 'medium',
      substeps: [
        { id: 's1', label: 'Step 1', status: 'done' },
        { id: 's2', label: 'Step 2', status: 'active' }
      ]
    })
    expect(task.substeps.length).toBe(2)
    expect(task.substeps[0].status).toBe('done')
    expect(task.substeps[1].status).toBe('active')
  })

  it('updateSubstep toggles substep status correctly', () => {
    const { addTask, updateSubstep, tasks } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Step test',
      notes: '',
      priority: 'medium',
      substeps: ['Step A', 'Step B']
    })

    const substepId = task.substeps[0].id
    updateSubstep(task.id, substepId, 'done')

    const updated = tasks.value.find((t) => t.id === task.id)!
    expect(updated.substeps[0].status).toBe('done')
    expect(updated.substeps[1].status).toBe('locked')
  })

  it('auto-completes task when all substeps are done', () => {
    const { addTask, updateSubstep, tasks } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'All done',
      notes: '',
      priority: 'medium',
      substeps: ['Step A', 'Step B']
    })

    // Complete both substeps
    updateSubstep(task.id, task.substeps[0].id, 'done')
    updateSubstep(task.id, task.substeps[1].id, 'done')

    const updated = tasks.value.find((t) => t.id === task.id)!
    expect(updated.status).toBe('done')
    expect(updated.completedAt).toBeTruthy()
  })

  it('updateSubstep is a no-op for non-existent taskId', () => {
    const { addTask, updateSubstep, tasks } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Safe',
      notes: '',
      priority: 'medium',
      substeps: ['Step A']
    })

    const lengthBefore = tasks.value.length
    updateSubstep('nonexistent', task.substeps[0].id, 'done')
    expect(tasks.value.length).toBe(lengthBefore)
    expect(tasks.value[0].substeps[0].status).toBe('active')
  })

  it('updateSubstep is a no-op for non-existent substepId', () => {
    const { addTask, updateSubstep, tasks } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Safe',
      notes: '',
      priority: 'medium',
      substeps: ['Step A']
    })

    updateSubstep(task.id, 'nonexistent', 'done')
    expect(tasks.value[0].substeps[0].status).toBe('active')
  })
})

// ── pin/unpin ────────────────────────────────────────────────────

describe('pin/unpin', () => {
  it('pinTask sets isPinned=true and unpins others', () => {
    const { addTask, pinTask, tasks } = useKnowledgeTasks()
    const t1 = addTask({
      topicId: 'joins',
      title: 'Task 1',
      notes: '',
      priority: 'low',
      isPinned: true
    })
    const t2 = addTask({
      topicId: 'basics',
      title: 'Task 2',
      notes: '',
      priority: 'medium'
    })

    pinTask(t2.id)

    const task1 = tasks.value.find((t) => t.id === t1.id)!
    const task2 = tasks.value.find((t) => t.id === t2.id)!
    expect(task1.isPinned).toBe(false)
    expect(task2.isPinned).toBe(true)
  })

  it('unpinTask clears pinned state', () => {
    const { addTask, pinTask, unpinTask, tasks } = useKnowledgeTasks()
    const task = addTask({
      topicId: 'joins',
      title: 'Pinned',
      notes: '',
      priority: 'high',
      isPinned: true
    })

    unpinTask()

    const updated = tasks.value.find((t) => t.id === task.id)!
    expect(updated.isPinned).toBe(false)
  })

  it('getPinnedTask returns pinned task or null', () => {
    const { addTask, pinTask, getPinnedTask } = useKnowledgeTasks()
    const t1 = addTask({
      topicId: 'joins',
      title: 'Task 1',
      notes: '',
      priority: 'low'
    })

    // No pinned task initially
    expect(getPinnedTask.value).toBeNull()

    pinTask(t1.id)
    expect(getPinnedTask.value?.id).toBe(t1.id)
  })

  it('unpinTask is safe even when nothing is pinned', () => {
    const { addTask, unpinTask, tasks } = useKnowledgeTasks()
    addTask({
      topicId: 'joins',
      title: 'Not pinned',
      notes: '',
      priority: 'low'
    })

    expect(() => unpinTask()).not.toThrow()
    expect(tasks.value[0].isPinned).toBe(false)
  })
})

// ── chapter progress ─────────────────────────────────────────────

describe('chapter progress', () => {
  it('getChapterProgress counts completed/total for a chapter', () => {
    const { addTask, completeTask, getChapterProgress } = useKnowledgeTasks()
    addTask({
      topicId: 'joins',
      title: 'Query task 1',
      notes: '',
      priority: 'medium',
      category: 'core'
    })
    const t2 = addTask({
      topicId: 'basics',
      title: 'Query task 2',
      notes: '',
      priority: 'low',
      category: 'core'
    })
    addTask({
      topicId: 'adv',
      title: 'Advanced task',
      notes: '',
      priority: 'high',
      category: 'deep-dive'
    })

    completeTask(t2.id)

    const progress = getChapterProgress('core')
    expect(progress.total).toBe(2)
    expect(progress.completed).toBe(1)
  })

  it('getChapterProgress returns 0/0 for chapter with no tasks', () => {
    const { addTask, getChapterProgress } = useKnowledgeTasks()
    addTask({
      topicId: 'joins',
      title: 'Only core',
      notes: '',
      priority: 'medium',
      category: 'core'
    })

    const progress = getChapterProgress('daily')
    expect(progress.total).toBe(0)
    expect(progress.completed).toBe(0)
  })

  it('getChapterProgress handles a fully completed chapter', () => {
    const { addTask, completeTask, getChapterProgress } = useKnowledgeTasks()
    const t1 = addTask({
      topicId: 'joins',
      title: 'Task A',
      notes: '',
      priority: 'medium',
      category: 'daily'
    })
    const t2 = addTask({
      topicId: 'basics',
      title: 'Task B',
      notes: '',
      priority: 'low',
      category: 'daily'
    })

    completeTask(t1.id)
    completeTask(t2.id)

    const progress = getChapterProgress('daily')
    expect(progress.total).toBe(2)
    expect(progress.completed).toBe(2)
  })
})
