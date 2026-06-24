import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'
import { nanoid } from 'nanoid'
import { useRedDot } from './useRedDot'

// ── TaskSubstep interface ────────────────────────────────────────

export interface TaskSubstep {
  id: string
  label: string
  status: 'locked' | 'active' | 'done'
}

// ── KnowledgeTask interface ──────────────────────────────────────

export interface KnowledgeTask {
  id: string
  topicId: string
  title: string
  dueDate?: string
  notes: string
  status: 'todo' | 'in-progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  completedAt?: string
  category: 'core' | 'deep-dive' | 'daily'
  substeps: TaskSubstep[]
  isPinned: boolean
}

// ── AddTask input type ───────────────────────────────────────────

type AddTaskInput = Omit<
  KnowledgeTask,
  'id' | 'createdAt' | 'completedAt' | 'status' | 'category' | 'substeps' | 'isPinned'
> & {
  category?: KnowledgeTask['category']
  substeps?: TaskSubstep[] | string[]
  isPinned?: KnowledgeTask['isPinned']
}

// ── Category sort order ──────────────────────────────────────────

const CATEGORY_ORDER: Record<string, number> = {
  basics: 0,
  query: 1,
  ddl: 2,
  dml: 3,
  advanced: 4,
  performance: 5
}

// ── useKnowledgeTasks composable ─────────────────────────────────

export function useKnowledgeTasks() {
  const tasks = useLocalStorage<KnowledgeTask[]>('ai-knowledge-tasks', [])

  // ── CRUD operations ──────────────────

  function addTask(input: AddTaskInput): KnowledgeTask {
    // Normalize substeps: string[] → TaskSubstep[], first active, rest locked
    let substeps: TaskSubstep[] = []
    if (Array.isArray(input.substeps) && input.substeps.length > 0) {
      if (typeof input.substeps[0] === 'string') {
        substeps = (input.substeps as string[]).map((label, i) => ({
          id: nanoid(),
          label,
          status: i === 0 ? 'active' : 'locked'
        }))
      } else {
        substeps = input.substeps as TaskSubstep[]
      }
    }

    const { category, isPinned, substeps: _, ...rest } = input
    const newTask: KnowledgeTask = {
      ...rest,
      category: category ?? 'core',
      substeps,
      isPinned: isPinned ?? false,
      id: nanoid(),
      status: 'todo',
      createdAt: new Date().toISOString(),
      completedAt: undefined
    }
    tasks.value = [...tasks.value, newTask]

    // Mark red dots for new task
    const redDot = useRedDot()
    redDot.show(`task:${newTask.id}`)
    redDot.show(`category:${newTask.category}`)
    redDot.show('tab:tasks')

    return newTask
  }

  function updateTask(id: string, updates: Partial<KnowledgeTask>): void {
    const idx = tasks.value.findIndex((t) => t.id === id)
    if (idx !== -1) {
      tasks.value[idx] = { ...tasks.value[idx], ...updates }
      tasks.value = [...tasks.value]
    }
  }

  function deleteTask(id: string): void {
    tasks.value = tasks.value.filter((t) => t.id !== id)
  }

  function completeTask(
    id: string
  ): { task: KnowledgeTask; xpGained: number } | null {
    const idx = tasks.value.findIndex((t) => t.id === id)
    if (idx === -1 || tasks.value[idx].status === 'done') return null

    const task: KnowledgeTask = {
      ...tasks.value[idx],
      status: 'done',
      completedAt: new Date().toISOString()
    }
    tasks.value[idx] = task
    tasks.value = [...tasks.value]
    return { task, xpGained: 0 }
  }

  // ── Substep operations ──────────────

  function updateSubstep(
    taskId: string,
    substepId: string,
    status: TaskSubstep['status']
  ): void {
    const taskIdx = tasks.value.findIndex((t) => t.id === taskId)
    if (taskIdx === -1) return

    const task = tasks.value[taskIdx]
    const substepIdx = task.substeps.findIndex((s) => s.id === substepId)
    if (substepIdx === -1) return

    const oldStatus = task.substeps[substepIdx].status

    const newSubsteps = [...task.substeps]
    newSubsteps[substepIdx] = { ...newSubsteps[substepIdx], status }

    // Mark red dots when substep transitions from locked → active
    if (oldStatus === 'locked' && status === 'active') {
      const redDot = useRedDot()
      redDot.show(`task:${taskId}`)

      // Check if this is the first active substep — also mark category and tab
      const hasOtherActive = task.substeps.some(
        (s, i) => i !== substepIdx && s.status === 'active'
      )
      if (!hasOtherActive) {
        redDot.show(`category:${task.category}`)
        redDot.show('tab:tasks')
      }
    }

    const allDone = newSubsteps.every((s) => s.status === 'done')
    const updates: Partial<KnowledgeTask> = { substeps: newSubsteps }
    if (allDone && task.status !== 'done') {
      updates.status = 'done'
      updates.completedAt = new Date().toISOString()
    }

    tasks.value[taskIdx] = { ...task, ...updates }
    tasks.value = [...tasks.value]
  }

  // ── Pin operations ──────────────────

  function pinTask(taskId: string): void {
    tasks.value = tasks.value.map((t) => ({
      ...t,
      isPinned: t.id === taskId
    }))
  }

  function unpinTask(): void {
    tasks.value = tasks.value.map((t) => ({
      ...t,
      isPinned: false
    }))
  }

  // ── Chapter progress ────────────────

  function getChapterProgress(categoryKey: string): {
    completed: number
    total: number
  } {
    const chapterTasks = tasks.value.filter((t) => t.category === categoryKey)
    const completed = chapterTasks.filter((t) => t.status === 'done').length
    return { completed, total: chapterTasks.length }
  }

  // ── Derived helpers ──────────────────

  function tasksByTopic(topicId: string) {
    return computed(() => tasks.value.filter((t) => t.topicId === topicId))
  }

  const pendingCount = computed(
    () => tasks.value.filter((t) => t.status === 'todo').length
  )

  const getPinnedTask = computed(() =>
    tasks.value.find((t) => t.isPinned) ?? null
  )

  function isOverdue(task: KnowledgeTask): boolean {
    if (!task.dueDate || task.status === 'done') return false
    return (
      new Date(task.dueDate).setHours(0, 0, 0, 0) <
      new Date().setHours(0, 0, 0, 0)
    )
  }

  function sortedByCategoryGroup(topicCategoryMap: Map<string, string>) {
    return computed(() =>
      [...tasks.value].sort((a, b) => {
        const catA =
          CATEGORY_ORDER[topicCategoryMap.get(a.topicId) ?? ''] ?? 99
        const catB =
          CATEGORY_ORDER[topicCategoryMap.get(b.topicId) ?? ''] ?? 99
        if (catA !== catB) return catA - catB
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      })
    )
  }

  // ── Return ────────────────────────────

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    updateSubstep,
    pinTask,
    unpinTask,
    getPinnedTask,
    getChapterProgress,
    tasksByTopic,
    pendingCount,
    sortedByCategoryGroup,
    isOverdue
  }
}
