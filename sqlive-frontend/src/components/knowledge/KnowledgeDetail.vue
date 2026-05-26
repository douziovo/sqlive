<template>
  <transition name="detail-slide">
    <div v-if="topic" class="knowledge-detail">
      <div class="knowledge-detail__header">
        <h3 class="knowledge-detail__title">{{ topic.label }}</h3>
        <span class="knowledge-detail__difficulty">
          <span v-for="i in 3" :key="i" :class="{ 'opacity-20': i > topic.difficulty }">&#9733;</span>
          <span class="text-xs text-muted-foreground ml-1">{{ diffLabel }}</span>
        </span>
      </div>

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
          @click="$emit('toggle-mastered', topic.id)"
        >
          {{ isMastered ? '取消掌握' : '标记已掌握' }}
        </button>
        <button
          class="knowledge-detail__btn knowledge-detail__btn--ai"
          @click="$emit('ask-ai', topic.label)"
        >
          让 AI 教我
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph';

const DIFF_LABELS: Record<number, string> = { 1: '入门', 2: '进阶', 3: '高级' };

const props = defineProps<{
  topic: KnowledgeTopic | null;
  isMastered: boolean;
}>();

const diffLabel = computed(() => DIFF_LABELS[props.topic?.difficulty ?? 1] || '');

defineEmits<{
  (e: 'toggle-mastered', topicId: string): void;
  (e: 'ask-ai', label: string): void;
}>();
</script>

<style scoped>
.knowledge-detail {
  background: white;
  border: 1px solid var(--border);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
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

.detail-slide-enter-active { transition: all 0.25s ease-out; }
.detail-slide-leave-active { transition: all 0.15s ease-in; }
.detail-slide-enter-from { opacity: 0; transform: translateY(8px); }
.detail-slide-leave-to { opacity: 0; transform: translateY(8px); }
</style>
