<template>
  <!-- dot-only: zoom < 0.5 -->
  <div
    v-if="zoomLevel < 0.5"
    class="knowledge-node-dot"
    :class="`knowledge-node-dot--difficulty-${data.difficulty}`"
  />
  <!-- compact: 0.5 <= zoom < 1.2 -->
  <div
    v-else-if="zoomLevel < 1.2"
    class="knowledge-node"
    :class="[
      `knowledge-node--difficulty-${data.difficulty}`,
      `knowledge-node--status-${data.status}`,
    ]"
  >
    <span class="knowledge-node__label">{{ data.label }}</span>
    <span class="knowledge-node__dot" :class="`knowledge-node__dot--${data.status}`"></span>
  </div>
  <!-- expanded: zoom >= 1.2 -->
  <div
    v-else
    class="knowledge-node knowledge-node--expanded"
    :class="[
      `knowledge-node--difficulty-${data.difficulty}`,
      `knowledge-node--status-${data.status}`,
    ]"
  >
    <div class="knowledge-node__header">
      <span class="knowledge-node__label">{{ data.label }}</span>
      <span class="knowledge-node__dot" :class="`knowledge-node__dot--${data.status}`"></span>
    </div>
    <span v-if="data.description" class="knowledge-node__desc">{{ truncatedDesc }}</span>
    <span class="knowledge-node__diff-tag">{{ difficultyLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph'

const DIFF_LABELS: Record<number, string> = { 1: '入门', 2: '进阶', 3: '高级' }

const props = defineProps<{
  id: string
  data: KnowledgeNodeData
  selected?: boolean
}>()

const zoomLevel = inject<number>('zoomLevel', 1)

const truncatedDesc = computed(() => {
  const d = props.data.description || ''
  return d.length > 30 ? `${d.slice(0, 30)}...` : d
})

const difficultyLabel = computed(() => DIFF_LABELS[props.data.difficulty] || '')
</script>

<style scoped>
.knowledge-node {
  background: white;
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 8px 14px;
  min-width: 110px;
  position: relative;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.knowledge-node:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Difficulty backgrounds */
.knowledge-node--difficulty-1 { background: #ecfdf5; }
.knowledge-node--difficulty-2 { background: #eef2ff; }
.knowledge-node--difficulty-3 { background: #fff1f2; }

/* Status borders — mastered (solid green family) */
.knowledge-node--status-mastered.knowledge-node--difficulty-1 { border-color: #6ee7b7; border-style: solid; }
.knowledge-node--status-mastered.knowledge-node--difficulty-2 { border-color: #a5b4fc; border-style: solid; }
.knowledge-node--status-mastered.knowledge-node--difficulty-3 { border-color: #fda4af; border-style: solid; }

/* Status borders — in-progress (solid, same family as mastered) */
.knowledge-node--status-in-progress.knowledge-node--difficulty-1 { border-color: #6ee7b7; border-style: solid; }
.knowledge-node--status-in-progress.knowledge-node--difficulty-2 { border-color: #a5b4fc; border-style: solid; }
.knowledge-node--status-in-progress.knowledge-node--difficulty-3 { border-color: #fda4af; border-style: solid; }

/* Status borders — unlearned (dashed, lighter family + 0.7 opacity) */
.knowledge-node--status-unlearned { opacity: 0.7; border-style: dashed; }
.knowledge-node--status-unlearned.knowledge-node--difficulty-1 { border-color: #a7f3d0; }
.knowledge-node--status-unlearned.knowledge-node--difficulty-2 { border-color: #c7d2fe; }
.knowledge-node--status-unlearned.knowledge-node--difficulty-3 { border-color: #fecdd3; }

/* Status dot */
.knowledge-node__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-left: auto;
}
.knowledge-node__dot--mastered { background: #10b981; }
.knowledge-node__dot--in-progress { background: #fbbf24; }
.knowledge-node__dot--unlearned { background: transparent; border: 2px solid #94a3b8; }

/* Dot-only mode (zoom < 0.5) */
.knowledge-node-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s;
}
.knowledge-node-dot:hover {
  transform: scale(1.15);
}
.knowledge-node-dot--difficulty-1 { background: #a7f3d0; }
.knowledge-node-dot--difficulty-2 { background: #c7d2fe; }
.knowledge-node-dot--difficulty-3 { background: #fecdd3; }

/* Expanded mode header row */
.knowledge-node--expanded {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 140px;
  padding: 10px 14px;
}
.knowledge-node__header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.knowledge-node__desc {
  font-size: 11px;
  font-weight: 400;
  color: #64748b;
  line-height: 1.4;
}
.knowledge-node__diff-tag {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
  color: #475569;
}
</style>
