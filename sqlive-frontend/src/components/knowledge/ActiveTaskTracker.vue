<template>
  <div v-if="pinnedTask" class="active-tracker">
    <div class="active-tracker__header">
      <span class="active-tracker__icon">⭐</span>
      <div class="active-tracker__info">
        <span class="active-tracker__title">{{ pinnedTask.title }}</span>
        <span class="active-tracker__step">
          {{ doneCount }}/{{ pinnedTask.substeps.length }} 步骤
        </span>
      </div>
    </div>

    <!-- 当前步骤 -->
    <div v-if="currentStepLabel" class="active-tracker__current">
      <span class="active-tracker__step-indicator">▶</span>
      <span>{{ currentStepLabel }}</span>
    </div>

    <div class="active-tracker__actions">
      <button class="active-tracker__btn active-tracker__btn--primary" @click="handleContinue">
        继续学习
      </button>
      <button class="active-tracker__btn active-tracker__btn--ghost" @click="handleUnpin">
        取消追踪
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'
import { computed } from 'vue'

const props = defineProps<{
  pinnedTask: KnowledgeTask | null
  topicLabel: string
  currentStepLabel: string
}>()

const emit = defineEmits<{
  (e: 'unpin'): void
  (e: 'navigate', topicId: string): void
}>()

const doneCount = computed(() =>
  props.pinnedTask ? props.pinnedTask.substeps.filter((s) => s.status === 'done').length : 0
)

function handleContinue(): void {
  if (props.pinnedTask) {
    emit('navigate', props.pinnedTask.topicId)
  }
}

function handleUnpin(): void {
  emit('unpin')
}
</script>

<style scoped>
.active-tracker {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
  width: 260px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
  animation: tracker-slide-up 0.25s ease-out;
}

@keyframes tracker-slide-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.active-tracker__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.active-tracker__icon {
  font-size: 18px;
}

.active-tracker__info {
  display: flex;
  flex-direction: column;
}

.active-tracker__title {
  font-size: 13px;
  font-weight: 600;
}

.active-tracker__step {
  font-size: 11px;
  color: var(--muted-foreground);
}

.active-tracker__current {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--muted);
  border-radius: 8px;
  font-size: 12px;
}

.active-tracker__step-indicator {
  color: var(--primary);
  font-size: 10px;
}

.active-tracker__actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.active-tracker__btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.active-tracker__btn--primary {
  background: var(--primary);
  color: white;
}

.active-tracker__btn--ghost {
  background: transparent;
  color: var(--muted-foreground);
}
</style>
