<template>
  <div class="journal">
    <!-- Category tabs -->
    <div class="journal__tabs">
      <button
        v-for="cat in CATEGORY_TABS"
        :key="cat"
        class="journal__tab"
        :class="{ 'journal__tab--active': activeCategory === cat }"
        :style="activeCategory === cat ? { '--tab-accent': TASK_CATEGORY_COLORS[cat] } : {}"
        @click="handleCategoryChange(cat)"
      >
        {{ TASK_CATEGORY_LABELS[cat] }}
        <RedDotBadge :show="hasCategoryDot(cat)" />
      </button>
    </div>

    <!-- Dual panel body -->
    <div class="journal__body">
      <!-- Left: task list -->
      <div class="journal__list">
        <div v-if="filteredTasksByCategory.length === 0" class="journal__list-empty">
          <ClipboardList class="journal__list-empty-icon" :size="36" />
          <p>暂无{{ TASK_CATEGORY_LABELS[activeCategory] }}任务</p>
        </div>
        <button
          v-for="task in filteredTasksByCategory"
          :key="task.id"
          class="journal__list-item"
          :class="{ 'journal__list-item--selected': task.id === selectedTaskId }"
          :style="{ '--item-accent': TASK_CATEGORY_COLORS[task.category] }"
          @click="handleSelectTask(task.id)"
        >
          <span class="journal__list-item-title" :class="{ 'text-red-500': isOverdue(task) }">
            {{ task.title }}
          </span>
          <span class="journal__list-item-meta">
            <span v-if="task.substeps.length > 0" class="journal__list-item-steps">
              {{ task.substeps.filter(s => s.status === 'done').length }}/{{ task.substeps.length }}
            </span>
            <span class="journal__list-item-priority" :class="priorityDotClass(task.priority)" />
            <RedDotBadge :show="hasTaskDot(task.id)" />
          </span>
        </button>
      </div>

      <!-- Right: task detail -->
      <div v-if="selectedTask" class="journal__detail">
        <div class="journal__detail-header">
          <h3 class="journal__detail-title">{{ selectedTask.title }}</h3>
          <span
            class="journal__detail-badge"
            :style="{ background: TASK_CATEGORY_COLORS[selectedTask.category] }"
          >
            {{ TASK_CATEGORY_LABELS[selectedTask.category] }}
          </span>
          <span v-if="topicForSelectedTask" class="journal__detail-topic">
            {{ topicForSelectedTask.label }} &middot; {{ DIFFICULTY_LABELS[topicForSelectedTask.difficulty] || '入门' }}
          </span>
        </div>

        <StepProgress
          v-if="selectedTask.substeps.length > 0"
          :substeps="selectedTask.substeps"
          :editable="true"
          @toggle-step="handleSubstepToggle"
        />

        <div class="journal__detail-reward">
          奖励：+{{ getTaskXp(selectedTask) }} XP
        </div>

        <div class="journal__detail-actions">
          <button class="journal__btn journal__btn--primary" @click="handleNavigate">
            定位知识点
          </button>
          <button class="journal__btn journal__btn--secondary" @click="handlePinTaskClick(selectedTask.id)">
            {{ selectedTask.isPinned ? '已置顶' : '置顶追踪' }}
          </button>
          <button
            v-if="allSubstepsDone(selectedTask) && selectedTask.status !== 'done'"
            class="journal__btn journal__btn--complete"
            @click="handleTaskComplete(selectedTask.id)"
          >
            标记完成
          </button>
        </div>
      </div>

      <!-- Right: empty state -->
      <div v-else class="journal__detail-empty">
        <!-- D-06: guided empty state when no tasks exist at all -->
        <template v-if="allTasks.length === 0">
          <ClipboardList class="journal__detail-empty-icon" :size="56" />
          <p class="journal__detail-empty-heading">还没有学习任务</p>
          <button class="journal__detail-empty-btn" @click="showCreateForm = true">
            创建你的第一个任务
          </button>
          <TaskCreateForm
            v-if="showCreateForm"
            mode="global"
            :topics="topics"
            @create="handleGlobalCreate"
            @cancel="showCreateForm = false"
          />
        </template>
        <!-- D-08 will default-select first task in 10-03; this branch is rare post-D-08 -->
        <template v-else>
          <ClipboardList class="journal__detail-empty-icon" :size="56" />
          <p>选择一个任务查看详情</p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ClipboardList } from 'lucide-vue-next'
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'
import type { KnowledgeTask, TaskSubstep } from '@/composables/useKnowledgeTasks'
import { useKnowledgeTasks } from '@/composables/useKnowledgeTasks'
import { useRedDot } from '@/composables/useRedDot'
import { TASK_CATEGORY_COLORS, TASK_CATEGORY_LABELS } from '@/data/taskCategories'
import StepProgress from './StepProgress.vue'
import TaskCreateForm from './TaskCreateForm.vue'
import RedDotBadge from './RedDotBadge.vue'

// ── Props / Emits ───────────────────────────────────────────────

const props = withDefaults(defineProps<{
  topics: KnowledgeTopic[]
  getTopicLabel?: (topicId: string) => string
}>(), {
  getTopicLabel: undefined
})

const emit = defineEmits<{
  (e: 'completeTask', topicId: string): void
  (e: 'pinTask', taskId: string): void
  (e: 'navigateToTopic', topicId: string): void
}>()

// ── Constants ───────────────────────────────────────────────────

const CATEGORY_TABS = ['core', 'deep-dive', 'daily'] as const

const DIFFICULTY_LABELS: Record<number, string> = {
  1: '入门',
  2: '进阶',
  3: '高级',
}

// ── Composables ─────────────────────────────────────────────────

const { tasks, addTask, updateTask, deleteTask, completeTask, updateSubstep, pinTask, isOverdue } = useKnowledgeTasks()
const { isVisible: isRedDotVisible, clear: clearRedDot } = useRedDot()

// ── Internal state ──────────────────────────────────────────────

const selectedTaskId = ref<string | null>(null)
const activeCategory = ref<'core' | 'deep-dive' | 'daily'>('core')
const showFilteredOnly = ref(false)
// D-06: controls TaskCreateForm visibility in empty-state right panel
const showCreateForm = ref(false)

// ── Computed ────────────────────────────────────────────────────

const allTasks = computed(() => tasks.value)

const filteredTasksByCategory = computed(() => {
  let result = allTasks.value.filter((t) => t.category === activeCategory.value)
  // Pinned tasks always appear first
  result = [...result].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  return result
})

const selectedTask = computed(() => {
  if (!selectedTaskId.value) return null
  return allTasks.value.find((t) => t.id === selectedTaskId.value) ?? null
})

const topicForSelectedTask = computed(() => {
  if (!selectedTask.value) return null
  return props.topics.find((t) => t.id === selectedTask.value!.topicId) ?? null
})

// ── Helpers ─────────────────────────────────────────────────────

function allSubstepsDone(task: KnowledgeTask): boolean {
  if (task.substeps.length === 0) return false
  return task.substeps.every((s) => s.status === 'done')
}

function hasTaskDot(taskId: string): boolean {
  return isRedDotVisible('task:' + taskId)
}

function hasCategoryDot(cat: string): boolean {
  return isRedDotVisible('category:' + cat)
}

function getTaskXp(task: KnowledgeTask): number {
  const baseXp = { low: 20, medium: 30, high: 50 }[task.priority] ?? 30
  const substepBonus = task.substeps.filter((s) => s.status === 'done').length * 5
  return baseXp + substepBonus
}

function priorityDotClass(priority: string): string {
  return (
    {
      low: 'journal__dot--low',
      medium: 'journal__dot--medium',
      high: 'journal__dot--high',
    }[priority] ?? 'journal__dot--low'
  )
}

// ── Handlers ────────────────────────────────────────────────────

function handleSelectTask(taskId: string): void {
  selectedTaskId.value = taskId
  clearRedDot('task:' + taskId)
}

function handleCategoryChange(cat: 'core' | 'deep-dive' | 'daily'): void {
  activeCategory.value = cat
  selectedTaskId.value = null
  clearRedDot('category:' + cat)
}

function handleSubstepToggle(substepId: string): void {
  if (!selectedTask.value) return
  const substep = selectedTask.value.substeps.find((s) => s.id === substepId)
  if (!substep) return

  let nextStatus: TaskSubstep['status']
  if (substep.status === 'active') {
    nextStatus = 'done'
  } else if (substep.status === 'done') {
    nextStatus = 'active'
  } else {
    nextStatus = 'active'
  }

  updateSubstep(selectedTask.value.id, substepId, nextStatus)
}

function handleTaskComplete(taskId: string): void {
  const result = completeTask(taskId)
  if (result) {
    emit('completeTask', result.task.topicId)
  }
}

function handlePinTaskClick(taskId: string): void {
  pinTask(taskId)
  emit('pinTask', taskId)
}

function handleNavigate(): void {
  if (selectedTask.value) {
    emit('navigateToTopic', selectedTask.value.topicId)
  }
}

// D-06: handle TaskCreateForm submit from empty-state right panel
function handleGlobalCreate(payload: {
  title: string
  dueDate?: string
  notes: string
  priority: KnowledgeTask['priority']
  topicId: string
  category?: KnowledgeTask['category']
  substeps?: string[]
}): void {
  addTask(payload)
  showCreateForm.value = false
}
</script>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────── */

.journal {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ── Category tabs ────────────────────────────────────────────── */

.journal__tabs {
  display: flex;
  gap: 0;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  padding: 0 16px;
}

.journal__tab {
  position: relative;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted-foreground);
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.journal__tab--active {
  color: var(--foreground);
  border-bottom-color: var(--tab-accent);
}

.journal__tab:hover:not(.journal__tab--active) {
  color: var(--foreground);
}

/* ── Body (dual panel) ────────────────────────────────────────── */

.journal__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* ── Left panel: task list ────────────────────────────────────── */

.journal__list {
  width: 280px;
  min-width: 200px;
  border-right: 1px solid var(--border);
  overflow-y: auto;
}

.journal__list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  gap: 8px;
  color: var(--muted-foreground);
  font-size: 14px;
}

.journal__list-empty-icon {
  /* D-06: SVG icon (ClipboardList) replaces 📋 emoji */
  color: var(--muted-foreground);
  opacity: 0.4;
}

.journal__list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-left: 3px solid var(--item-accent);
  border-radius: 0;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
  font-size: 13px;
  position: relative;
}

.journal__list-item--selected {
  background: var(--secondary);
}

.journal__list-item:hover {
  background: var(--muted);
}

.journal__list-item-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.journal__list-item-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.journal__list-item-steps {
  font-size: 11px;
  color: var(--muted-foreground);
  white-space: nowrap;
}

.journal__list-item-priority {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.journal__dot--low {
  background: #9ca3af;
}

.journal__dot--medium {
  background: #eab308;
}

.journal__dot--high {
  background: #ef4444;
}

/* ── Right panel: task detail ─────────────────────────────────── */

.journal__detail {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.journal__detail-header {
  margin-bottom: 16px;
}

.journal__detail-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 12px 0;
}

.journal__detail-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: white;
  margin-right: 8px;
}

.journal__detail-topic {
  font-size: 13px;
  color: var(--muted-foreground);
}

.journal__detail-reward {
  font-size: 13px;
  color: var(--muted-foreground);
  margin-top: 12px;
  padding: 8px;
  background: var(--muted);
  border-radius: 6px;
}

.journal__detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

/* ── Detail empty state ───────────────────────────────────────── */

.journal__detail-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--muted-foreground);
  font-size: 14px;
}

.journal__detail-empty-icon {
  /* D-06: SVG icon (ClipboardList) replaces 📋 emoji */
  color: var(--muted-foreground);
  opacity: 0.25;
}

.journal__detail-empty-heading {
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
  margin: 8px 0 0 0;
}

.journal__detail-empty-btn {
  margin-top: 12px;
  padding: 8px 20px;
  border-radius: 6px;
  border: none;
  background: var(--primary);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.journal__detail-empty-btn:hover {
  opacity: 0.9;
}

/* ── Buttons ──────────────────────────────────────────────────── */

.journal__btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: opacity 0.15s;
}

.journal__btn:hover {
  opacity: 0.9;
}

.journal__btn--primary {
  background: var(--primary);
  color: white;
}

.journal__btn--secondary {
  background: var(--muted);
  color: var(--foreground);
}

.journal__btn--complete {
  background: #52C41A;
  color: white;
}
</style>
