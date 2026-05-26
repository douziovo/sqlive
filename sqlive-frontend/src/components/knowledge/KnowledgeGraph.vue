<template>
  <div class="knowledge-graph-wrapper">
    <div v-if="nodes.length === 0" class="knowledge-graph-empty">
      <p class="text-sm text-muted-foreground">暂无知识图谱数据</p>
    </div>

    <div v-else class="knowledge-graph-container">
      <VueFlow
        ref="flowRef"
        :nodes="filteredNodes"
        :edges="edges"
        :node-types="nodeTypes"
        :default-viewport="{ x: 0, y: 0, zoom: 0.8 }"
        :fit-view-on-init="true"
        :min-zoom="0.1"
        :max-zoom="2"
        @node-click="onNodeClick"
        @pane-ready="onPaneReady"
      >
        <Background :gap="20" :size="1" pattern-color="#e2e8f0" />
        <Controls position="bottom-left" />
        <MiniMap
          v-if="showMinimap"
          position="bottom-right"
          :node-color="miniMapNodeColor"
          :width="180"
          :height="120"
        />
      </VueFlow>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, markRaw, nextTick } from 'vue';
import { VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/minimap/dist/style.css';
import '@vue-flow/controls/dist/style.css';

import KnowledgeNode from './KnowledgeNode.vue';
import { layoutNodes } from '@/composables/useDagreLayout';
import type { Node, Edge } from '@vue-flow/core';
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph';

const props = defineProps<{
  nodes: Node<KnowledgeNodeData>[];
  edges: Edge[];
  searchQuery?: string;
}>();

const emit = defineEmits<{
  (e: 'node-select', topicId: string): void;
}>();

const nodeTypes = markRaw({ 'knowledge-node': KnowledgeNode }) as any;
const flowRef = ref<any>(null);
const showMinimap = ref(true);
const displayNodes = ref<Node<KnowledgeNodeData>[]>([...props.nodes]);

// Sync displayNodes when props.nodes change
watch(() => props.nodes, (newNodes) => {
  displayNodes.value = [...newNodes];
}, { deep: true });

const filteredNodes = computed(() => {
  if (!props.searchQuery) return displayNodes.value;
  const q = props.searchQuery.toLowerCase();
  return displayNodes.value.map(node => {
    const matches = node.data.label.toLowerCase().includes(q)
      || (node.data.description || '').toLowerCase().includes(q);
    return {
      ...node,
      style: { ...node.style, opacity: matches ? 1 : 0.2 },
    };
  });
});

function miniMapNodeColor(node: any): string {
  const d = node.data?.difficulty;
  if (d === 1) return '#10b981';
  if (d === 2) return '#f59e0b';
  return '#ef4444';
}

function onNodeClick(event: any): void {
  const topicId = event.node?.data?.topicId;
  if (topicId) {
    emit('node-select', topicId);
  }
}

async function onPaneReady(): Promise<void> {
  await nextTick();
  const el = flowRef.value?.$el as HTMLElement | undefined;
  const layouted = layoutNodes(displayNodes.value as any, props.edges, el, { rankdir: 'LR', ranksep: 160, nodesep: 100 });
  displayNodes.value = layouted as Node<KnowledgeNodeData>[];
}

function fitView(): void {
  if (flowRef.value) {
    flowRef.value.fitView({ duration: 300 });
  }
}

function focusNode(topicId: string): void {
  const nodeId = `topic-${topicId}`;
  const node = displayNodes.value.find(n => n.id === nodeId);
  if (flowRef.value && node) {
    flowRef.value.setCenter(node.position.x + 60, node.position.y + 30, { zoom: 1.2, duration: 400 });
  }
}

defineExpose({ fitView, focusNode });
</script>

<style scoped>
.knowledge-graph-wrapper {
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: white;
  flex: 1;
}

.knowledge-graph-container {
  position: absolute;
  inset: 0;
}

.knowledge-graph-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
