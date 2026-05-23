<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="ai-inline-result"
      :style="popoverStyle"
      @mousedown.stop
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-muted rounded-t-lg">
        <span class="text-sm font-semibold text-secondary-foreground">
          {{ modeLabel }}
        </span>
        <button
          class="text-muted-foreground/70 hover:text-muted-foreground text-lg leading-none p-1"
          @click="$emit('close')"
        >✕</button>
      </div>

      <!-- Content -->
      <div class="px-4 py-3 max-h-[400px] overflow-y-auto">
        <div v-if="loading" class="flex items-center gap-2 text-muted-foreground py-2">
          <span class="animate-spin inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></span>
          <span class="text-sm">{{ content || '加载中...' }}</span>
        </div>
        <div v-else class="ai-content text-sm leading-relaxed" v-html="renderedContent"></div>
      </div>

      <!-- Actions -->
      <div v-if="actions && actions.length > 0 && !loading" class="flex gap-2 px-4 py-2 border-t border-border bg-muted rounded-b-lg">
        <button
          v-for="action in actions"
          :key="action.action"
          class="px-3 py-1 text-xs rounded-md border transition-colors"
          :class="actionButtonClass(action.action)"
          @click="$emit('action', action.action)"
        >
          {{ action.label }}
        </button>
      </div>
    </div>

    <!-- Backdrop -->
    <div
      v-if="visible"
      class="fixed inset-0 z-40"
      @click="$emit('close')"
    ></div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import { AI_MODE_LABELS, type AiPanelMode } from '../viewmodel/useAiChat';

const props = withDefaults(defineProps<{
  visible: boolean;
  loading?: boolean;
  content?: string;
  mode?: AiPanelMode;
  actions?: { label: string; action: string }[];
  anchorRect?: { top: number; left: number; width: number; height: number } | null;
}>(), {
  content: '',
  mode: 'chat',
  actions: () => [],
});

defineEmits<{
  close: [];
  action: [action: string];
}>();

const modeLabel = computed(() => AI_MODE_LABELS[props.mode] || '🤖 AI 助手');

const popoverStyle = computed(() => {
  if (!props.anchorRect) {
    return { top: '20%', left: '50%', transform: 'translateX(-50%)' };
  }
  const { top, left, width, height } = props.anchorRect;
  return {
    top: `${top + height + 8}px`,
    left: `${Math.max(left, 20)}px`,
    maxWidth: `${Math.min(width * 1.2, 600)}px`,
    minWidth: `${Math.min(width, 400)}px`,
  };
});

const actionButtonClass = computed(() => (action: string) => {
  const base = 'hover:bg-opacity-80';
  if (action === 'apply-fix' || action === 'insert-code') {
    return `bg-primary text-white border-primary ${base}`;
  }
  if (action === 'copy') {
    return `bg-secondary text-secondary-foreground border-border hover:bg-secondary ${base}`;
  }
  if (action === 'follow-up') {
    return `bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 ${base}`;
  }
  if (action === 'retry') {
    return `bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100 ${base}`;
  }
  return `bg-secondary text-secondary-foreground border-border hover:bg-secondary ${base}`;
});

// Simple markdown-like rendering
const renderedContent = computed(() => {
  const raw = props.content;
  if (!raw) return '';
  // Normalize markdown: ensure space after #, drop empty headings
  const normalized = raw
    .replace(/([^\n])(#{1,6})([^\s#])/g, '$1\n$2 $3')
    .replace(/^(#{1,6})([^\s#])/gm, '$1 $2')
    .replace(/^#{1,6}\s*$/gm, '');
  return marked.parse(normalized, { async: false, breaks: true }) as string;
});
</script>

<style scoped>
.ai-inline-result {
  position: fixed;
  z-index: 100;
  background: var(--card);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border);
}

.ai-content :deep(h3) {
  font-size: 0.95rem;
  font-weight: 600;
  margin-top: 0.75rem;
  margin-bottom: 0.25rem;
  color: #1f2937;
}

.ai-content :deep(pre) {
  background: #1f2937;
  color: #e5e7eb;
  padding: 0.75rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 0.5rem 0;
}

.ai-content :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.8rem;
}
</style>
