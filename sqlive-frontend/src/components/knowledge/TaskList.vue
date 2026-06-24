<template>
  <div class="task-list">
    <!-- Header -->
    <div class="task-list__header">
      <button class="task-list__create-btn" @click="handleToggleCreate">
        新建任务
      </button>
    </div>

    <!-- Status filter bar -->
    <div class="task-list__filters">
      <button
        v-for="chip in statusChips"
        :key="chip.key"
        class="task-list__filter-btn"
        :class="{ 'task-list__filter-btn--active': statusFilter === chip.key }"
        @click="handleFilterClick(chip.key)"
      >
        {{ chip.label }}
      </button>
    </div>

    <!-- Inline create form -->
    <TaskCreateForm
      v-if="showCreateForm"
      mode="global"
      :topics="topics"
      @create="handleGlobalCreate"
      @cancel="handleCancelCreate"
    />

    <!-- Empty state: no tasks at all -->
    <div v-if="allTasks.length === 0" class="task-list__empty">
      <div class="task-list__empty-illustration">📋</div>
      <p class="task-list__empty-heading">还没有学习任务</p>
      <p class="task-list__empty-hint">在知识点详情中添加你的第一个任务吧</p>
    </div>

    <!-- Filtered empty: tasks exist but none match filter -->
    <div v-else-if="filteredTasks.length === 0" class="task-list__filtered-empty">
      <p class="task-list__filtered-empty-text">没有符合筛选条件的任务</p>
      <button class="task-list__filtered-empty-clear" @click="handleClearFilter">清除筛选</button>
    </div>

    <!-- Task items -->
    <div v-else class="task-list__body">
      <TaskItem
        v-for="task in filteredTasks"
        :key="task.id"
        :task="task"
        :topic-label="defaultGetTopicLabel(task.topicId)"
        :is-overdue="isTaskOverdue(task)"
        @update:task="handleTaskUpdate"
        @delete:task="handleTaskDelete"
        @complete:task="handleTaskComplete"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'
import { useKnowledgeTasks } from '@/composables/useKnowledgeTasks'
import TaskItem from './TaskItem.vue'
import TaskCreateForm from './TaskCreateForm.vue'

const props = withDefaults(defineProps<{
  topics: KnowledgeTopic[]
  getTopicLabel?: (topicId: string) => string
}>(), {
  getTopicLabel: undefined
})

const emit = defineEmits<{
  (e: 'completeTask', topicId: string): void
}>()

const {
  tasks,
  addTask,
  updateTask,
  deleteTask,
  completeTask,
  sortedByCategoryGroup,
  isOverdue
} = useKnowledgeTasks()

// ── Category map for sorting ─────────────────────────────────────

const topicCategoryMap = computed(() =>
  new Map(props.topics.map((t) => [t.id, t.category]))
)

// ── Sorted list ──────────────────────────────────────────────────

const sortedList = sortedByCategoryGroup(topicCategoryMap.value as Map<string, string>)

// ── Status filter ────────────────────────────────────────────────

const statusFilter = ref<'all' | 'todo' | 'in-progress' | 'done'>('all')

const statusChips = [
  { key: 'all' as const, label: '全部' },
  { key: 'todo' as const, label: '待办' },
  { key: 'in-progress' as const, label: '进行中' },
  { key: 'done' as const, label: '已完成' }
]

function handleFilterClick(key: 'all' | 'todo' | 'in-progress' | 'done'): void {
  statusFilter.value = statusFilter.value === key ? 'all' : key
}

function handleClearFilter(): void {
  statusFilter.value = 'all'
}

// ── Filtered tasks ───────────────────────────────────────────────

const filteredTasks = computed(() => {
  if (statusFilter.value === 'all') return sortedList.value
  return sortedList.value.filter((t) => t.status === statusFilter.value)
})

// ── All tasks (for empty state check) ────────────────────────────

const allTasks = computed(() => tasks.value)

// ── Topic label lookup ───────────────────────────────────────────

function defaultGetTopicLabel(topicId: string): string {
  if (props.getTopicLabel) return props.getTopicLabel(topicId)
  const topic = props.topics.find((t) => t.id === topicId)
  return topic?.label ?? topicId
}

// ── Overdue check ────────────────────────────────────────────────

function isTaskOverdue(task: KnowledgeTask): boolean {
  return isOverdue(task)
}

// ── Create form ──────────────────────────────────────────────────

const showCreateForm = ref(false)

function handleToggleCreate(): void {
  showCreateForm.value = !showCreateForm.value
}

function handleCancelCreate(): void {
  showCreateForm.value = false
}

function handleGlobalCreate(payload: {
  title: string
  dueDate?: string
  notes: string
  priority: KnowledgeTask['priority']
  topicId: string
}): void {
  addTask(payload)
  showCreateForm.value = false
}

// ── Task actions ─────────────────────────────────────────────────

function handleTaskUpdate(id: string, updates: Partial<KnowledgeTask>): void {
  updateTask(id, updates)
}

function handleTaskDelete(id: string): void {
  deleteTask(id)
}

function handleTaskComplete(id: string): void {
  const result = completeTask(id)
  if (result) {
    emit('completeTask', result.task.topicId)
  }
}
</script>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  height: 100%;
  overflow-y: auto;
}

.task-list__header {
  display: flex;
  justify-content: flex-end;
}

.task-list__create-btn {
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: var(--primary);
  color: white;
  border: none;
  transition: opacity 0.15s;
}

.task-list__create-btn:hover {
  opacity: 0.9;
}

.task-list__filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.task-list__filter-btn {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: var(--muted);
  color: var(--muted-foreground);
  cursor: pointer;
  transition: all 0.15s;
}

.task-list__filter-btn:hover {
  background: var(--secondary);
  color: var(--foreground);
}

.task-list__filter-btn--active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* ── Empty state ──────────────────────────────────── */

.task-list__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 20px;
}

.task-list__empty-illustration {
  font-size: 48px;
  opacity: 0.3;
  margin-bottom: 8px;
}

.task-list__empty-heading {
  font-size: 16px;
  font-weight: 600;
  color: var(--muted-foreground);
  margin: 0;
}

.task-list__empty-hint {
  font-size: 14px;
  font-weight: 400;
  color: var(--muted-foreground);
  margin: 0;
  text-align: center;
}

/* ── Filtered empty state ────────────────────────── */

.task-list__filtered-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 20px;
}

.task-list__filtered-empty-text {
  font-size: 14px;
  color: var(--muted-foreground);
  margin: 0;
}

.task-list__filtered-empty-clear {
  padding: 4px 14px;
  border-radius: 6px;
  font-size: 13px;
  border: 1px solid var(--border);
  background: var(--muted);
  color: var(--foreground);
  cursor: pointer;
  transition: background 0.15s;
}

.task-list__filtered-empty-clear:hover {
  background: var(--secondary);
}

/* ── Task body ────────────────────────────────────── */

.task-list__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
