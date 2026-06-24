<template>
  <div
    class="task-item"
    :class="{ 'task-item--completed': task.status === 'done' }"
  >
    <span
      class="task-item__priority-dot"
      :class="priorityDotColor"
    />

    <span class="task-item__title" :class="{ 'text-red-500': isOverdue }">
      {{ task.title }}
    </span>

    <span v-if="task.dueDate" class="task-item__due">
      {{ task.dueDate }}
      <span v-if="isOverdue" class="task-item__overdue-badge">已逾期</span>
    </span>

    <button class="task-item__status" :class="statusBadgeClass" @click="handleStatusToggle">
      {{ statusLabel }}
    </button>

    <button class="task-item__delete" @click="handleDelete">删除</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'

const props = defineProps<{
  task: KnowledgeTask
  topicLabel: string
  isOverdue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:task', id: string, updates: Partial<KnowledgeTask>): void
  (e: 'delete:task', id: string): void
  (e: 'complete:task', id: string): void
}>()

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
  if (confirm('确定删除此任务？此操作不可撤销。')) {
    emit('delete:task', props.task.id)
  }
}
</script>

<style scoped>
.task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  transition: background 0.15s;
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
</style>
