<template>
  <div
    class="knowledge-node"
    :class="[
      `knowledge-node--difficulty-${data.difficulty}`,
      `knowledge-node--status-${data.status}`,
    ]"
  >
    <span class="knowledge-node__label">{{ data.label }}</span>
    <span class="knowledge-node__dot" :class="`knowledge-node__dot--${data.status}`"></span>
  </div>
</template>

<script setup lang="ts">
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph';

defineProps<{
  id: string;
  data: KnowledgeNodeData;
  selected?: boolean;
}>();
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
</style>
