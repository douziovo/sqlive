import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'
import { nanoid } from 'nanoid'

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

  function addTask(
    input: Omit<KnowledgeTask, 'id' | 'createdAt' | 'completedAt' | 'status'>
  ): KnowledgeTask {
    const newTask: KnowledgeTask = {
      ...input,
      id: nanoid(),
      status: 'todo',
      createdAt: new Date().toISOString(),
      completedAt: undefined
    }
    tasks.value = [...tasks.value, newTask]
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

  // ── Derived helpers ──────────────────

  function tasksByTopic(topicId: string) {
    return computed(() => tasks.value.filter((t) => t.topicId === topicId))
  }

  const pendingCount = computed(
    () => tasks.value.filter((t) => t.status === 'todo').length
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
    tasksByTopic,
    pendingCount,
    sortedByCategoryGroup,
    isOverdue
  }
}
