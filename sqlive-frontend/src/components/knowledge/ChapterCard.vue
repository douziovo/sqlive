<template>
  <div class="chapter-card" :class="{ 'chapter-card--locked': !unlocked }">
    <div class="chapter-card__header">
      <span class="chapter-card__icon">{{ unlocked ? '🏛' : '🔒' }}</span>
      <div class="chapter-card__title-group">
        <h3 class="chapter-card__title">{{ chapter.title }}</h3>
        <p class="chapter-card__desc">{{ chapter.description }}</p>
      </div>
      <span class="chapter-card__progress">
        {{ progress.completed }}/{{ chapter.topicCount }} 完成
      </span>
    </div>

    <!-- Progress bar -->
    <div class="chapter-card__bar-track">
      <div class="chapter-card__bar-fill" :style="{ width: progressPercent + '%' }" />
    </div>

    <div class="chapter-card__footer">
      <span class="chapter-card__reward">章节奖励：+{{ chapter.rewardXp }} XP</span>
      <button
        v-if="unlocked"
        class="chapter-card__btn"
        @click="handleOpenChapter"
      >
        开始学习 →
      </button>
      <span v-else class="chapter-card__lock-hint">
        需要 {{ levelName }} 等级解锁
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LearningChapter } from '@/data/learningChapters'
import { LEVEL_NAMES } from '@/composables/useKnowledgeGraph'

const props = defineProps<{
  chapter: LearningChapter
  progress: { completed: number; total: number }
  unlocked: boolean
  currentLevel: number
}>()

const emit = defineEmits<{
  (e: 'openChapter', chapterId: string): void
}>()

const progressPercent = computed(() => {
  if (props.chapter.topicCount === 0) return 0
  return Math.round((props.progress.completed / props.chapter.topicCount) * 100) || 0
})

const levelName = computed(() => {
  return LEVEL_NAMES[props.chapter.rankRequired] || '初级学者'
})

function handleOpenChapter(): void {
  emit('openChapter', props.chapter.id)
}
</script>

<style scoped>
.chapter-card {
  background: var(--secondary);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
}

.chapter-card--locked {
  opacity: 0.5;
  pointer-events: none;
}

.chapter-card__header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chapter-card__icon {
  font-size: 28px;
  flex-shrink: 0;
}

.chapter-card__title-group {
  flex: 1;
  min-width: 0;
}

.chapter-card__title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.chapter-card__desc {
  font-size: 13px;
  color: var(--muted-foreground);
  margin: 4px 0 0 0;
}

.chapter-card__progress {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  flex-shrink: 0;
}

.chapter-card__bar-track {
  height: 6px;
  background: var(--muted);
  border-radius: 999px;
  margin: 12px 0;
  overflow: hidden;
}

.chapter-card__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #52C41A, var(--primary));
  border-radius: 999px;
  transition: width 0.4s;
}

.chapter-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chapter-card__reward {
  font-size: 12px;
  color: var(--muted-foreground);
}

.chapter-card__btn {
  color: var(--primary);
  font-size: 13px;
  font-weight: 500;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s;
}

.chapter-card__btn:hover {
  opacity: 0.8;
}

.chapter-card__lock-hint {
  font-size: 12px;
  color: var(--muted-foreground);
}
</style>
