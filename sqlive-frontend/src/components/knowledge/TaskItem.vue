<template>
  <div
    class="task-item"
    :class="{ 'task-item--completed': task.status === 'done' }"
    :style="{ borderLeft: '3px solid ' + accentColor }"
  >
    <span
      class="task-item__priority-dot"
      :class="priorityDotColor"
    />

    <span class="task-item__title" :class="{ 'text-red-500': isOverdue }">
      {{ task.title }}
    </span>

    <span v-if="task.substeps.length > 0" class="task-item__steps">
      {{ doneCount }}/{{ task.substeps.length }}
    </span>

    <span v-if="task.dueDate" class="task-item__due">
      {{ task.dueDate }}
      <span v-if="isOverdue" class="task-item__overdue-badge">已逾期</span>
    </span>

    <button class="task-item__status" :class="statusBadgeClass" @click="handleStatusToggle">
      {{ statusLabel }}
    </button>

    <button class="task-item__pin" @click="handlePinClick" :title="task.isPinned ? '已置顶' : '置顶'">
      {{ task.isPinned ? '📌' : '📍' }}
    </button>

    <button class="task-item__delete" @click="handleDelete">删除</button>

    <AlertDialogRoot v-model:open="showDeleteDialog">
      <AlertDialogPortal>
        <AlertDialogOverlay class="task-item__dialog-overlay" />
        <AlertDialogContent class="task-item__dialog-content">
          <AlertDialogTitle class="task-item__dialog-title">删除任务</AlertDialogTitle>
          <AlertDialogDescription class="task-item__dialog-description">
            确定删除此任务？此操作不可撤销。
          </AlertDialogDescription>
          <div class="task-item__dialog-actions">
            <AlertDialogCancel class="task-item__dialog-btn task-item__dialog-btn--cancel" @click="showDeleteDialog = false">
              取消
            </AlertDialogCancel>
            <AlertDialogAction class="task-item__dialog-btn task-item__dialog-btn--confirm" @click="confirmDelete">
              确认删除
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>

    <RedDotBadge :show="hasDot" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'
import { useRedDot } from '@/composables/useRedDot'
import {
  AlertDialogRoot,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from 'reka-ui'
import { TASK_CATEGORY_COLORS } from '@/data/taskCategories'
import RedDotBadge from './RedDotBadge.vue'

const props = defineProps<{
  task: KnowledgeTask
  topicLabel: string
  isOverdue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:task', id: string, updates: Partial<KnowledgeTask>): void
  (e: 'delete:task', id: string): void
  (e: 'complete:task', id: string): void
  (e: 'pin:task', id: string): void
  (e: 'navigate:topic', topicId: string): void
}>()

const { isVisible: isRedDotVisible } = useRedDot()

// D-13: AlertDialog replaces native confirm() — dialog open state
const showDeleteDialog = ref(false)

const accentColor = computed(() => {
  return TASK_CATEGORY_COLORS[props.task.category] || TASK_CATEGORY_COLORS.core
})

const doneCount = computed(() => {
  return props.task.substeps.filter((s) => s.status === 'done').length
})

const hasDot = computed(() => {
  return isRedDotVisible('task:' + props.task.id)
})

const priorityDotColor = computed(() => ({
  low: 'bg-gray-400',
  medium: 'bg-yellow-500',
  high: 'bg-red-500'
}[props.task.priority]))

const statusLabel = computed(() => ({
  todo: '待办',
  'in-progress': '进行中',
  done: '已完成'
}[props.task.status]))

const statusBadgeClass = computed(() => ({
  todo: 'task-item__status--todo',
  'in-progress': 'task-item__status--in-progress',
  done: 'task-item__status--done'
}[props.task.status]))

function handleStatusToggle(): void {
  const nextStatus = props.task.status === 'todo' ? 'in-progress'
    : props.task.status === 'in-progress' ? 'done'
    : 'todo'
  emit('update:task', props.task.id, { status: nextStatus } as Partial<KnowledgeTask>)
  if (nextStatus === 'done') emit('complete:task', props.task.id)
}

function handleDelete(): void {
  // D-13: open AlertDialog instead of native confirm()
  showDeleteDialog.value = true
}

function confirmDelete(): void {
  showDeleteDialog.value = false
  emit('delete:task', props.task.id)
}

function handlePinClick(): void {
  emit('pin:task', props.task.id)
}
</script>

<style scoped>
.task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  padding-left: 9px;
  border-radius: 8px;
  font-size: 13px;
  transition: background 0.15s;
  position: relative;
}

.task-item:hover {
  background: var(--secondary);
}

.task-item--completed .task-item__title {
  opacity: 0.6;
  text-decoration: line-through;
}

.task-item--completed .task-item__priority-dot {
  visibility: hidden;
}

.task-item__priority-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-item__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item__steps {
  font-size: 11px;
  color: var(--muted-foreground);
  white-space: nowrap;
  flex-shrink: 0;
}

.task-item__due {
  font-size: 12px;
  color: var(--muted-foreground);
  white-space: nowrap;
  flex-shrink: 0;
}

.task-item__overdue-badge {
  display: inline-block;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10px;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.task-item__status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.task-item__status:hover {
  opacity: 0.8;
}

.task-item__status--todo {
  background: var(--muted);
  color: var(--muted-foreground);
}

.task-item__status--in-progress {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.task-item__status--done {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.task-item__pin {
  padding: 2px 4px;
  border: none;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  border-radius: 4px;
  transition: background 0.15s;
}

.task-item__pin:hover {
  background: rgba(250, 204, 21, 0.12);
}

.task-item__delete {
  padding: 2px 8px;
  border: none;
  background: transparent;
  color: var(--destructive);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  border-radius: 4px;
  transition: background 0.15s;
}

.task-item__delete:hover {
  background: rgba(239, 68, 68, 0.08);
}

/* ── D-13: AlertDialog delete confirmation styles ─────────── */

.task-item__dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
}

.task-item__dialog-content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--background);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  z-index: 201;
  min-width: 320px;
  max-width: calc(100% - 2rem);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}

.task-item__dialog-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.task-item__dialog-description {
  font-size: 13px;
  color: var(--muted-foreground);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.task-item__dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.task-item__dialog-btn {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--secondary);
  color: var(--foreground);
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.task-item__dialog-btn:hover {
  opacity: 0.85;
}

.task-item__dialog-btn--cancel {
  background: var(--muted);
}

.task-item__dialog-btn--confirm {
  background: var(--destructive);
  color: white;
  border-color: var(--destructive);
}
</style>
