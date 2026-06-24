<template>
  <div class="task-create-form">
    <div class="task-create-form__row">
      <input
        v-model="title"
        type="text"
        class="task-create-form__input task-create-form__input--title"
        placeholder="输入任务标题..."
        @keydown.enter="handleCreate"
        @keydown.escape="handleCancel"
      />
      <input
        v-model="dueDate"
        type="date"
        class="task-create-form__input task-create-form__input--date"
        placeholder="截止日期（可选）"
      />
      <select v-model="priority" class="task-create-form__select">
        <option value="low">低优先级</option>
        <option value="medium">中优先级</option>
        <option value="high">高优先级</option>
      </select>
      <TaskTopicSelector
        v-if="mode === 'global'"
        v-model="selectedTopicId"
        :topics="topics ?? []"
        class="task-create-form__topic-selector"
      />
    </div>
    <div class="task-create-form__row">
      <input
        v-model="notes"
        type="text"
        class="task-create-form__input task-create-form__input--notes"
        placeholder="添加备注（可选）..."
      />
    </div>
    <div class="task-create-form__actions">
      <button class="task-create-form__btn task-create-form__btn--primary" @click="handleCreate">
        创建
      </button>
      <button class="task-create-form__btn task-create-form__btn--cancel" @click="handleCancel">
        Esc 取消
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'
import TaskTopicSelector from './TaskTopicSelector.vue'

const props = withDefaults(defineProps<{
  topicId?: string
  mode?: 'detail' | 'global'
  topics?: KnowledgeTopic[]
}>(), {
  mode: 'detail'
})

const emit = defineEmits<{
  (e: 'create', payload: {
    title: string
    dueDate?: string
    notes: string
    priority: KnowledgeTask['priority']
    topicId: string
  }): void
  (e: 'cancel'): void
}>()

const title = ref('')
const dueDate = ref('')
const notes = ref('')
const priority = ref<KnowledgeTask['priority']>('medium')
const selectedTopicId = ref(props.topicId ?? '')

watch(() => props.topicId, (val) => {
  selectedTopicId.value = val ?? ''
})

function handleCreate(): void {
  if (!title.value.trim()) return
  emit('create', {
    title: title.value.trim(),
    dueDate: dueDate.value || undefined,
    notes: notes.value,
    priority: priority.value,
    topicId: props.mode === 'detail' ? (props.topicId ?? '') : selectedTopicId.value
  })
  title.value = ''
  dueDate.value = ''
  notes.value = ''
  priority.value = 'medium'
  selectedTopicId.value = props.topicId ?? ''
}

function handleCancel(): void {
  emit('cancel')
}
</script>

<style scoped>
.task-create-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--secondary);
}

.task-create-form__row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.task-create-form__input {
  font-size: 13px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 8px;
  background: white;
  color: var(--foreground);
}

.task-create-form__input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}

.task-create-form__input--title {
  flex: 1;
  min-width: 180px;
}

.task-create-form__input--date {
  width: 150px;
  flex-shrink: 0;
}

.task-create-form__input--notes {
  width: 100%;
}

.task-create-form__select {
  font-size: 13px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 8px;
  background: white;
  color: var(--foreground);
  cursor: pointer;
  min-width: 100px;
}

.task-create-form__select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}

.task-create-form__topic-selector {
  min-width: 160px;
}

.task-create-form__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.task-create-form__btn {
  padding: 4px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  border: none;
}

.task-create-form__btn:hover {
  opacity: 0.9;
}

.task-create-form__btn--primary {
  background: var(--primary);
  color: white;
}

.task-create-form__btn--cancel {
  background: transparent;
  color: var(--muted-foreground);
  border: 1px solid var(--border);
}

.task-create-form__btn--cancel:hover {
  background: var(--secondary);
  opacity: 1;
}
</style>
