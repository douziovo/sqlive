<template>
  <div v-if="topic" class="knowledge-detail">
    <div class="knowledge-detail__header">
      <h3 class="knowledge-detail__title">{{ topic.label }}</h3>
      <button class="knowledge-detail__close" @click="handleClose" title="关闭">&times;</button>
    </div>

    <span class="knowledge-detail__difficulty">
      <span v-for="i in 3" :key="i" :class="{ 'opacity-20': i > topic.difficulty }">&#9733;</span>
      <span class="text-xs text-muted-foreground ml-1">{{ diffLabel }}</span>
    </span>

    <p class="knowledge-detail__desc">{{ topic.description }}</p>

    <div v-if="topic.prerequisites && topic.prerequisites.length > 0" class="knowledge-detail__meta">
      <span class="text-xs text-muted-foreground">前置知识：</span>
      <span class="text-xs">{{ topic.prerequisites.join(', ') }}</span>
    </div>

    <div v-if="topic.nextTopics && topic.nextTopics.length > 0" class="knowledge-detail__meta">
      <span class="text-xs text-muted-foreground">推荐下一步：</span>
      <span class="text-xs">{{ topic.nextTopics.join(', ') }}</span>
    </div>

    <div class="knowledge-detail__actions">
      <button
        class="knowledge-detail__btn knowledge-detail__btn--master"
        @click="handleToggleMastered"
      >
        {{ isMastered ? '取消掌握' : '标记已掌握' }}
      </button>
      <button
        class="knowledge-detail__btn knowledge-detail__btn--ai"
        @click="handleAskAi"
      >
        让 AI 教我
      </button>
    </div>

    <!-- Task section -->
    <div class="knowledge-detail__tasks">
      <div class="knowledge-detail__tasks-header">
        <span class="text-sm font-semibold">学习任务</span>
        <div class="knowledge-detail__tasks-header-actions">
          <button class="knowledge-detail__locate-btn" @click="handleNavigateToTopic">
            定位知识点
          </button>
          <button v-if="!showCreateForm" class="knowledge-detail__add-task-btn" @click="handleAddTaskClick">
            + 添加任务
          </button>
        </div>
      </div>

      <TaskCreateForm
        v-if="showCreateForm"
        mode="detail"
        :topic-id="topic?.id"
        @create="handleTaskCreate"
        @cancel="handleTaskCancel"
      />

      <div v-if="displayTasks.length > 0" class="knowledge-detail__task-list">
        <TaskItem
          v-for="task in displayTasks"
          :key="task.id"
          :task="task"
          :topic-label="topic?.label ?? ''"
          :is-overdue="isOverdue(task)"
          @update:task="handleTaskUpdate"
          @delete:task="handleTaskDelete"
          @complete:task="handleTaskComplete"
        />
      </div>

      <button v-if="hasMoreTasks" class="knowledge-detail__view-all" @click="handleViewAllTasks">
        查看全部 &rarr;
      </button>
    </div>

    <!-- Completed task history -->
    <div v-if="completedTopicTasks.length > 0" class="knowledge-detail__history">
      <button class="knowledge-detail__history-toggle" @click="toggleHistory">
        {{ showHistory ? '收起' : '展开' }} 已完成 ({{ completedTopicTasks.length }})
      </button>
      <div v-if="showHistory" class="knowledge-detail__history-list">
        <div v-for="task in completedTopicTasks" :key="task.id" class="knowledge-detail__history-item">
          <span class="line-through opacity-60">{{ task.title }}</span>
          <span class="text-xs text-muted-foreground">{{ task.completedAt?.slice(0, 10) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'
import { useKnowledgeTasks } from '@/composables/useKnowledgeTasks'
import TaskCreateForm from './TaskCreateForm.vue'
import TaskItem from './TaskItem.vue'

const DIFF_LABELS: Record<number, string> = { 1: '入门', 2: '进阶', 3: '高级' }

const props = defineProps<{
  topic: KnowledgeTopic | null
  isMastered: boolean
}>()

const { addTask, updateTask, deleteTask, completeTask, tasksByTopic, isOverdue } = useKnowledgeTasks()

// ── Task state ──────────────────────────────────────────────────

const showCreateForm = ref(false)
const showHistory = ref(false)

// ── Task computeds ──────────────────────────────────────────────

const topicTasks = computed(() => props.topic ? tasksByTopic(props.topic.id) : [])

const activeTopicTasks = computed(() => topicTasks.value.filter(t => t.status !== 'done'))

const completedTopicTasks = computed(() => topicTasks.value.filter(t => t.status === 'done'))

const displayTasks = computed(() => activeTopicTasks.value.slice(0, 3))

const hasMoreTasks = computed(() => activeTopicTasks.value.length > 3)

const diffLabel = computed(() => DIFF_LABELS[props.topic?.difficulty ?? 1] || '')

const emit = defineEmits<{
  (e: 'toggle-mastered', topicId: string): void
  (e: 'ask-ai', label: string): void
  (e: 'close'): void
  (e: 'complete-task', topicId: string): void
  (e: 'view-all-tasks'): void
  (e: 'navigate-to-topic', topicId: string): void
}>()

function handleClose(): void {
  emit('close')
}

function handleToggleMastered(): void {
  if (props.topic) emit('toggle-mastered', props.topic.id)
}

function handleAskAi(): void {
  if (props.topic) emit('ask-ai', props.topic.label)
}

// ── Task handlers ──────────────────────────────────────────────

function handleAddTaskClick(): void {
  showCreateForm.value = true
}

function handleTaskCreate(payload: {
  title: string
  dueDate?: string
  notes: string
  priority: KnowledgeTask['priority']
  topicId: string
}): void {
  addTask(payload)
  showCreateForm.value = false
}

function handleTaskCancel(): void {
  showCreateForm.value = false
}

function handleTaskUpdate(id: string, updates: Partial<KnowledgeTask>): void {
  updateTask(id, updates)
}

function handleTaskDelete(id: string): void {
  deleteTask(id)
}

function handleTaskComplete(id: string): void {
  completeTask(id)
  if (props.topic) emit('complete-task', props.topic.id)
}

function handleViewAllTasks(): void {
  emit('view-all-tasks')
}

function handleNavigateToTopic(): void {
  if (props.topic?.id) {
    emit('navigate-to-topic', props.topic.id)
  }
}

function toggleHistory(): void {
  showHistory.value = !showHistory.value
}
</script>

<style scoped>
.knowledge-detail {
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
}

.knowledge-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.knowledge-detail__title {
  font-size: 16px;
  font-weight: 700;
}

.knowledge-detail__close {
  font-size: 20px;
  color: var(--muted-foreground);
  border: none;
  background: none;
  cursor: pointer;
  line-height: 1;
  padding: 0 2px;
}
.knowledge-detail__close:hover {
  color: var(--foreground);
}

.knowledge-detail__difficulty {
  font-size: 12px;
  color: #f59e0b;
  display: flex;
  align-items: center;
}

.knowledge-detail__desc {
  font-size: 13px;
  color: var(--muted-foreground);
  line-height: 1.6;
}

.knowledge-detail__meta {
  font-size: 12px;
}

.knowledge-detail__actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.knowledge-detail__btn {
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.knowledge-detail__btn--master {
  background: var(--secondary);
  color: var(--foreground);
  border: 1px solid var(--border);
}
.knowledge-detail__btn--master:hover {
  background: var(--muted);
}

.knowledge-detail__btn--ai {
  background: var(--primary);
  color: white;
  border: none;
}
.knowledge-detail__btn--ai:hover {
  opacity: 0.9;
}

/* ── Task section ──────────────────────────── */

.knowledge-detail__tasks {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.knowledge-detail__tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.knowledge-detail__tasks-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.knowledge-detail__locate-btn {
  font-size: 12px;
  color: var(--primary);
  border: none;
  background: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.knowledge-detail__locate-btn:hover {
  background: var(--muted);
}

.knowledge-detail__add-task-btn {
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  border: none;
  background: none;
  padding: 2px 6px;
  border-radius: 4px;
}

.knowledge-detail__add-task-btn:hover {
  background: var(--muted);
}

.knowledge-detail__task-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.knowledge-detail__view-all {
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  text-align: center;
  padding: 4px;
  background: none;
  border: none;
  width: 100%;
}

.knowledge-detail__view-all:hover {
  text-decoration: underline;
}

/* ── History section ───────────────────────── */

.knowledge-detail__history {
  margin-top: 8px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.knowledge-detail__history-toggle {
  font-size: 12px;
  color: var(--muted-foreground);
  cursor: pointer;
  border: none;
  background: none;
}

.knowledge-detail__history-item {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
  font-size: 12px;
}
</style>
