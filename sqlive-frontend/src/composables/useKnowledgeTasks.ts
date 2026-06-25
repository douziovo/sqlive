import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'
import { nanoid } from 'nanoid'
import { useRedDot } from './useRedDot'
import { buildPresetTasks } from '@/data/presetTasks'
import { getChapterById } from '@/data/learningChapters'

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

// ── useKnowledgeTasks composable ─────────────────────────────────

export function useKnowledgeTasks() {
  const tasks = useLocalStorage<KnowledgeTask[]>('ai-knowledge-tasks', [])

  // D-11: hoist useRedDot to setup scope so useLocalStorage's storage event
  // listener registers under the component's effect scope and cleans up on
  // unmount. Previously addTask/updateSubstep called useRedDot() inside
  // function bodies (invocation time, not setup time), leaking listeners and
  // causing each call to construct a fresh useLocalStorage ref that overwrote
  // prior writes before they flushed to localStorage.
  const redDot = useRedDot()

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

    // D-03: single show() with parent chain — clear('task:X') will auto-propagate
    // up to category and tab when this is the last task under that category.
    redDot.show(`task:${newTask.id}`, [`category:${newTask.category}`, 'tab:tasks'])

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
    // D-07: clear task redDot before removing — triggers parent cascade
    // (category: / tab:tasks) via useRedDot.clear when this was the last
    // visible child. Previously deleteTask left tab:tasks badge stale.
    redDot.clear('task:' + id)
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
      // D-03: single show() with parent chain replaces the old triple-show +
      // first-active-substep check. show() is idempotent — repeating the same
      // key is a no-op. The parents chain lets clear('task:X') auto-propagate
      // to category and tab when the last task under that category is cleared.
      // D-11: uses hoisted redDot (setup scope) — no per-call useRedDot().
      redDot.show(`task:${taskId}`, [`category:${task.category}`, 'tab:tasks'])
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
  // WR-01 (D-05): chapter-progress function migrated to useKnowledgeGraph.
  // New semantic: counts mastered topics (not done tasks) under
  // chapter.categoryKey / chapter.topicCount. Callers (KnowledgePanel)
  // now source it from kg (the useKnowledgeGraph return object).

  // ── Derived helpers ──────────────────

  // D-18 (IN-07): return plain array instead of computed. Previously
  // returned computed(() => tasks.value.filter(...)) — caller (KnowledgeDetail)
  // used .value inside another computed, creating a new inner computed on
  // every re-evaluation that was never cleaned up (computed-in-computed leak).
  // Caller now owns the memoization via its own computed wrapper.
  function tasksByTopic(topicId: string): KnowledgeTask[] {
    return tasks.value.filter((t) => t.topicId === topicId)
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

  // ── Preset task seeding (first run only) ──────────────

  /**
   * Seeds 8 built-in preset tasks on the very first run.
   * Idempotent — guarded by `ai-knowledge-tasks-seeded` localStorage flag.
   * Returns true if seeding happened, false if already seeded.
   *
   * Call this once at app startup (e.g., in KnowledgePanel's setup).
   * After first run, user can delete all tasks freely — re-seeding
   * will NOT happen because the flag remains 'true'.
   */
  function seedPresetTasksIfFirstRun(): boolean {
    const flag = localStorage.getItem('ai-knowledge-tasks-seeded')
    if (flag === 'true') return false
    // Only seed when flag is null (never run before). If flag was set to
    // 'false' explicitly (e.g., user wiped via a future "reset" action),
    // we also skip seeding to respect the user's empty state.
    if (flag !== null) return false

    const preset = buildPresetTasks()
    tasks.value = [...tasks.value, ...preset]
    localStorage.setItem('ai-knowledge-tasks-seeded', 'true')
    return true
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
    tasksByTopic,
    pendingCount,
    isOverdue,
    seedPresetTasksIfFirstRun
  }
}
