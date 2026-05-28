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
        :nodes-draggable="false"
        @node-click="onNodeClick"
        @move="onMove"
        @pane-click="onPaneClick"
        @pane-ready="onPaneReady"
      >
        <Background :gap="20" :size="1" pattern-color="#e2e8f0" />
      </VueFlow>

      <Transition name="card-pop">
        <KnowledgeDetail
          v-if="selectedTopic"
          class="knowledge-graph__detail-card"
          :topic="selectedTopic"
          :is-mastered="masteredTopics.includes(selectedTopic!.id)"
          @toggle-mastered="handleToggleMastered"
          @ask-ai="handleAskAi"
          @close="handleDetailClose"
        />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { VueFlow } from '@vue-flow/core'
import { computed, markRaw, nextTick, provide, ref, watch } from 'vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import type { Edge, Node } from '@vue-flow/core'
import { layoutNodes } from '@/composables/useDagreLayout'
import type { KnowledgeNodeData, KnowledgeTopic } from '@/composables/useKnowledgeGraph'
import KnowledgeDetail from './KnowledgeDetail.vue'
import KnowledgeNode from './KnowledgeNode.vue'

const props = defineProps<{
  nodes: Node<KnowledgeNodeData>[]
  edges: Edge[]
  searchQuery?: string
  selectedTopic: KnowledgeTopic | null
  masteredTopics: string[]
}>()

const emit = defineEmits<{
  (e: 'node-select', topicId: string): void
  (e: 'toggle-mastered', topicId: string): void
  (e: 'ask-ai', label: string): void
  (e: 'deselect-node'): void
}>()

const nodeTypes = markRaw({ 'knowledge-node': KnowledgeNode }) as any
const flowRef = ref<any>(null)
const displayNodes = ref<Node<KnowledgeNodeData>[]>([...props.nodes])

const zoomLevel = ref(0.8)
provide('zoomLevel', zoomLevel)

// Sync displayNodes when props.nodes change, re-run layout
watch(
  () => props.nodes,
  async (newNodes) => {
    displayNodes.value = [...newNodes]
    if (newNodes.length === 0) return
    await nextTick()
    const el = flowRef.value?.$el as HTMLElement | undefined
    const layouted = layoutNodes(displayNodes.value as any, props.edges, el, {
      rankdir: 'LR',
      ranksep: 160,
      nodesep: 100
    })
    displayNodes.value = layouted as Node<KnowledgeNodeData>[]
  },
  { deep: true }
)

const filteredNodes = computed(() => {
  if (!props.searchQuery) return displayNodes.value
  const q = props.searchQuery.toLowerCase()
  return displayNodes.value.map((node) => {
    const matches = node.data.label.toLowerCase().includes(q) || (node.data.description || '').toLowerCase().includes(q)
    return {
      ...node,
      style: { ...node.style, opacity: matches ? 1 : 0.2 }
    }
  })
})

function onNodeClick(event: any): void {
  const topicId = event.node?.data?.topicId
  if (topicId) {
    emit('node-select', topicId)
  }
}

function onPaneClick(): void {
  emit('deselect-node')
}

function handleDetailClose(): void {
  emit('deselect-node')
}

function handleToggleMastered(topicId: string): void {
  emit('toggle-mastered', topicId)
}

function handleAskAi(label: string): void {
  emit('ask-ai', label)
}

function onMove(_event: any, viewport: any): void {
  zoomLevel.value = viewport.zoom
}

async function onPaneReady(): Promise<void> {
  await nextTick()
  const el = flowRef.value?.$el as HTMLElement | undefined
  const layouted = layoutNodes(displayNodes.value as any, props.edges, el, {
    rankdir: 'LR',
    ranksep: 160,
    nodesep: 100
  })
  displayNodes.value = layouted as Node<KnowledgeNodeData>[]
}

function fitView(): void {
  if (flowRef.value) {
    flowRef.value.fitView({ duration: 300 })
  }
}

function focusNode(topicId: string): void {
  const nodeId = `topic-${topicId}`
  const node = displayNodes.value.find((n) => n.id === nodeId)
  if (flowRef.value && node) {
    flowRef.value.setCenter(node.position.x + 60, node.position.y + 30, { zoom: 1.2, duration: 400 })
  }
}

defineExpose({ fitView, focusNode })
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

.knowledge-graph__detail-card {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 320px;
  max-height: 60vh;
  z-index: 10;
}

/* Card pop transition */
.card-pop-enter-active { transition: opacity 0.2s ease-out, transform 0.2s ease-out; }
.card-pop-leave-active { transition: opacity 0.15s ease-in, transform 0.15s ease-in; }
.card-pop-enter-from { opacity: 0; transform: translateY(12px) scale(0.95); }
.card-pop-leave-to   { opacity: 0; transform: translateY(12px) scale(0.95); }
</style>
