<template>
  <div class="knowledge-graph-wrapper">
    <div v-if="nodes.length === 0" class="knowledge-graph-empty">
      <p class="text-sm text-muted-foreground">暂无知识图谱数据</p>
    </div>

    <div v-else class="knowledge-graph-container" :class="{ 'is-settling': viewport.isSettling.value }">
      <ErSearchBar
        v-model="search.searchQuery.value"
        :visible="search.showSearch.value"
        :total-count="displayNodes.length"
        :match-count="search.matchCount.value"
        :current-index="search.currentIndex.value"
        placeholder="搜索知识点..."
        @close="search.closeSearch"
        @prev="search.navigateMatch(-1)"
        @next="search.navigateMatch(1)"
      />
      <VueFlow
        ref="flowRef"
        :nodes="styledNodes"
        :edges="styledEdges"
        :node-types="nodeTypes"
        :default-viewport="{ x: 0, y: 0, zoom: 0.8 }"
        :fit-view-on-init="false"
        :min-zoom="0.1"
        :max-zoom="2"
        :nodes-draggable="false"
        @node-click="onNodeClick"
        @node-mouse-enter="onNodeMouseEnter"
        @node-mouse-leave="onNodeMouseLeave"
        @move="viewport.onMove"
        @pane-click="onPaneClick"
        @pane-ready="onPaneReady"
      >
        <Background :gap="20" :size="1" pattern-color="#e2e8f0" />
        <RegionBackground
          :positioned-nodes="displayNodes"
          :svg-bounds="svgBoundsForRegions"
        />
        <MiniMap
          position="bottom-left"
          :width="160"
          :height="110"
          :node-color="miniMapNodeColor"
          style="margin: 0 0 12px 12px;"
        />
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
          @view-all-tasks="handleViewAllTasks"
          @complete-task="handleTaskCompleteFromDetail"
          @navigate-to-topic="(topicId: string) => emit('navigate-to-topic', topicId)"
        />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import { VueFlow } from '@vue-flow/core'
import { computed, markRaw, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import type { Edge, Node } from '@vue-flow/core'
import { layoutNodes } from '@/composables/useDagreLayout'
import { useGraphHover } from '@/composables/useGraphHover'
import { useGraphViewport } from '@/composables/useGraphViewport'
import { useGraphSearch } from '@/composables/useGraphSearch'
import { useGraphLOD } from '@/composables/useGraphLOD'
import type { KnowledgeNodeData, KnowledgeTopic } from '@/composables/useKnowledgeGraph'
import ErSearchBar from '@/components/er/ErSearchBar.vue'
import KnowledgeDetail from './KnowledgeDetail.vue'
import KnowledgeNode from './KnowledgeNode.vue'
import RegionBackground from './RegionBackground.vue'

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
  (e: 'view-all-tasks'): void
  (e: 'complete-task', topicId: string): void
  (e: 'navigate-to-topic', topicId: string): void
}>()

const nodeTypes = markRaw({ 'knowledge-node': KnowledgeNode }) as any
const flowRef = ref<any>(null)
const displayNodes = ref<Node<KnowledgeNodeData>[]>([...props.nodes])

const svgBoundsForRegions = computed(() => {
  if (displayNodes.value.length === 0) return { minX: 0, minY: 0, width: 800, height: 600 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const node of displayNodes.value) {
    const cx = node.position.x + 60, cy = node.position.y + 22
    if (cx < minX) minX = cx
    if (cy < minY) minY = cy
    if (cx > maxX) maxX = cx
    if (cy > maxY) maxY = cy
  }
  const padding = 200
  return { minX: minX - padding, minY: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 }
})

// ── Composables (D-10 split: hover/viewport/search/LOD) ───────
// NOTE: onResetView injects onPaneDblClick into useGraphSearch so Ctrl+0
// can reset the view without the composable knowing about hover/viewport.

const hover = useGraphHover(() => props.edges, displayNodes)
const viewport = useGraphViewport(flowRef, displayNodes)
const search = useGraphSearch(flowRef, displayNodes, { onResetView: onPaneDblClick })
const lod = useGraphLOD()

provide('zoomLevel', viewport.zoomLevel)
provide('viewportPos', viewport.viewportPos)
provide('svgTransform', viewport.svgTransform)

// ── Styled edges (zoom-tiered opacity + hover path highlight) ──

// ── D-02: styledEdges cache (watch+ref pattern, computed stays pure) ──
// Watch writes to styledEdgesCache; computed reads ref.value. Avoids cache
// heuristic that lost reactivity to props.edges (CR-01). { immediate: true }
// ensures cache is populated on mount before first render.
const styledEdgesCache = ref<Edge[]>([])

watch(
  [() => props.edges, () => lod.edgeOpacityForZoom(viewport.zoomLevel.value), () => hover.hoveredNodeId.value],
  () => {
    const baseOpacity = lod.edgeOpacityForZoom(viewport.zoomLevel.value)

    // 计算 hover 时前驱/后继路径集合（仅一层）
    let predSet = new Set<string>()
    let succSet = new Set<string>()
    if (hover.hoveredNodeId.value) {
      predSet = hover.immediatePredecessors(hover.hoveredNodeId.value)
      succSet = hover.immediateSuccessors(hover.hoveredNodeId.value)
    }

    styledEdgesCache.value = props.edges.map((edge) => {
      const sourceId = edge.source.replace(/^topic-/, '')
      const targetId = edge.target.replace(/^topic-/, '')

      // 大陆连线：跨 category 的连线，更宽更明显
      const srcData = hover.nodeDataMap.value.get(sourceId)
      const tgtData = hover.nodeDataMap.value.get(targetId)
      const isContinent = srcData && tgtData && srcData.category !== tgtData.category

      const isPred = hover.hoveredNodeId.value && predSet.has(sourceId) && targetId === hover.hoveredNodeId.value
      const isSucc = hover.hoveredNodeId.value && succSet.has(targetId) && sourceId === hover.hoveredNodeId.value

      if (isSucc) {
        return {
          ...edge,
          style: {
            ...edge.style,
            opacity: 1,
            stroke: '#3b82f6',
            strokeWidth: 2,
            strokeDasharray: 'none',
            filter: 'drop-shadow(0 0 5px rgba(59,130,246,0.5))'
          }
        }
      }

      if (isPred) {
        return {
          ...edge,
          style: {
            ...edge.style,
            opacity: 1,
            stroke: '#f59e0b',
            strokeWidth: 2,
            strokeDasharray: 'none',
            filter: 'drop-shadow(0 0 5px rgba(245,158,11,0.5))'
          }
        }
      }

      // 默认：大陆宽虚线 / 前置边近透明 / 节点内部细虚线
      const prereq = (edge as any).data?.isPrereq
      return {
        ...edge,
        type: 'smoothstep',
        style: {
          ...edge.style,
          opacity: isContinent ? baseOpacity * 1.2 : prereq ? 0.06 : baseOpacity,
          stroke: isContinent ? '#94a3b8' : prereq ? '#e2e8f0' : '#cbd5e1',
          strokeWidth: isContinent ? 2.5 : 1,
          strokeDasharray: isContinent ? '8 4' : prereq ? '1 8' : '3 6'
        }
      }
    })
  },
  { immediate: true }
)

const styledEdges = computed<Edge[]>(() => styledEdgesCache.value)

// Sync displayNodes when props.nodes change, re-run dagre TB layout
watch(
  () => props.nodes,
  async (newNodes) => {
    displayNodes.value = [...newNodes]
    if (newNodes.length === 0) return
    await nextTick()
    const el = flowRef.value?.$el as HTMLElement | undefined
    const layouted = layoutNodes(displayNodes.value as any, props.edges, el, { rankdir: 'TB', ranksep: 120, nodesep: 80, marginx: 60, marginy: 60 })
    displayNodes.value = layouted as Node<KnowledgeNodeData>[]
  },
  { deep: true }
)

const styledNodes = computed(() => {
  const matches = search.matchNodes.value
  const matchIdSet = new Set(matches.map((m) => m.id))
  const activeId = search.currentIndex.value >= 0 ? matches[search.currentIndex.value]?.id : null

  return displayNodes.value.map((node) => {
    let data = { ...node.data }
    let style = { ...node.style }
    let searchDimmed = false

    // Step 1: Local search filter
    if (search.searchQuery.value) {
      const isMatch = matchIdSet.has(node.id)
      const isActive = activeId === node.id
      style = { ...style, opacity: isMatch ? 1 : 0.2 }
      searchDimmed = !isMatch
      data = { ...data, isSearchMatch: isMatch, isActiveMatch: isActive }
    } else {
      data = { ...data, isSearchMatch: undefined, isActiveMatch: undefined }
    }    // Step 2: Hover state (overrides search opacity for connected nodes)
    if (hover.hoveredNodeId.value) {
      const tid = data.topicId
      const adj = hover.adjacencyMap.value.get(hover.hoveredNodeId.value) || new Set()
      if (tid === hover.hoveredNodeId.value) {
        data = { ...data, isFocused: true, isHighlighted: false, isDimmed: false }; style = { ...style, opacity: 1 }
      } else if (adj.has(tid)) {
        data = { ...data, isHighlighted: true, isFocused: false, isDimmed: false }; style = { ...style, opacity: 1 }
      } else {
        data = { ...data, isDimmed: true, isFocused: false, isHighlighted: false }; style = { ...style, opacity: 0.12 }
      }
    } else {
      data = { ...data, isFocused: false, isHighlighted: false, isDimmed: false }
      if (!searchDimmed && style.opacity === undefined) style = { ...style, opacity: 1 }
    }

    data = { ...data, isPathHighlighted: false }
    return { ...node, data, style }
  })
})

// ── VueFlow event handlers ─────────────────────────────────────

function onNodeClick(event: any): void {
  const topicId = event.node?.data?.topicId
  if (topicId) emit('node-select', topicId)
}

function onNodeMouseEnter(event: any): void {
  const topicId = event.node?.data?.topicId
  if (topicId) hover.setHoveredNode(topicId)
}

function onNodeMouseLeave(): void { hover.clearHoveredNode() }
function onPaneClick(): void { emit('deselect-node') }
function onPaneDblClick(): void {
  // D-32: reset all interaction state + fitView animation.
  // Called via dblclick listener and via useGraphSearch Ctrl+0 → opts.onResetView.
  hover.resetHoverState()
  if (search.showSearch.value) search.closeSearch()
  nextTick(() => viewport.fitView())
}

function miniMapNodeColor(_node: any): string { return '#94a3b8' }
function getStyledEdges(): Edge[] { return styledEdges.value }
function getStyledNodes(): ReturnType<typeof styledNodes.value> { return styledNodes.value }

// ── Spark particles / Unlock glow (Phase 05-03) ────────────────

function triggerSparkBurst(topicId: string): void {
  const node = displayNodes.value.find((n) => n.id === `topic-${topicId}`)
  if (!node) return
  node.data = { ...node.data, triggerSparkBurst: true }
  setTimeout(() => { node.data = { ...node.data, triggerSparkBurst: false } }, 700)
}

function triggerUnlockGlow(topicId: string): void {
  const topic = displayNodes.value.find((n) => n.data.topicId === topicId)
  if (!topic) return
  for (const nextId of topic.data.nextTopics || []) {
    const nextNode = displayNodes.value.find((n) => n.data.topicId === nextId)
    if (!nextNode) continue
    nextNode.data = { ...nextNode.data, triggerUnlockGlow: true }
    setTimeout(() => { nextNode.data = { ...nextNode.data, triggerUnlockGlow: false } }, 800)
  }
}

// ── KnowledgeDetail event forwarding ───────────────────────────

function handleDetailClose(): void { emit('deselect-node') }
function handleToggleMastered(topicId: string): void { emit('toggle-mastered', topicId) }
function handleAskAi(label: string): void { emit('ask-ai', label) }
function handleViewAllTasks(): void { emit('view-all-tasks') }
function handleTaskCompleteFromDetail(topicId: string): void { emit('complete-task', topicId) }

// ── Layout + viewport restore on pane ready ───────────────────

async function onPaneReady(): Promise<void> {
  await nextTick()
  const el = flowRef.value?.$el as HTMLElement | undefined
  const layouted = layoutNodes(displayNodes.value as any, props.edges, el, { rankdir: 'TB', ranksep: 120, nodesep: 80 })
  displayNodes.value = layouted as Node<KnowledgeNodeData>[]
  // D-31: restore saved viewport after layout
  try {
    const saved = localStorage.getItem('kg-viewport')
    if (saved) {
      const vp = JSON.parse(saved) as { x: number; y: number; zoom: number }
      await nextTick()
      flowRef.value?.setViewport?.(vp, { duration: 0 })
    }
  } catch { /* localStorage unavailable */ }
}

// ── Lifecycle: viewport dblclick listener only ────────────────
// document keydown listener moved to useGraphSearch onMounted.
// localStorage restore + initial fitView moved to useGraphViewport onMounted.

onMounted(async () => {
  // D-32: native dblclick on the viewport pane (vue-flow has no @pane-dblclick event).
  // Must use capture phase — D3 zoom intercepts bubble-phase dblclick.
  await nextTick()
  const vpEl = flowRef.value?.$el?.querySelector?.('.vue-flow__viewport') as HTMLElement | undefined
  if (vpEl) vpEl.addEventListener('dblclick', onPaneDblClick, { capture: true })
})

onUnmounted(() => {
  const vpEl = flowRef.value?.$el?.querySelector?.('.vue-flow__viewport') as HTMLElement | undefined
  if (vpEl) vpEl.removeEventListener('dblclick', onPaneDblClick)
})

defineExpose({
  fitView: viewport.fitView,
  focusNode: viewport.focusNode,
  flyToNode: viewport.flyToNode,
  hoveredNodeId: hover.hoveredNodeId,
  styledEdges,
  styledNodes,
  setHoveredNode: hover.setHoveredNode,
  clearHoveredNode: hover.clearHoveredNode,
  resetHoverState: hover.resetHoverState,
  getStyledEdges,
  getStyledNodes,
  showSearch: search.showSearch,
  searchQuery: search.searchQuery,
  matchCount: search.matchCount,
  currentIndex: search.currentIndex,
  navigateMatch: search.navigateMatch,
  miniMapNodeColor,
  triggerSparkBurst,
  triggerUnlockGlow,
})
</script>

<style scoped>
.knowledge-graph-wrapper {
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #f8f6f0;
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

.card-pop-enter-active { transition: opacity 0.2s ease-out, transform 0.2s ease-out; }
.card-pop-leave-active { transition: opacity 0.15s ease-in, transform 0.15s ease-in; }
.card-pop-enter-from { opacity: 0; transform: translateY(12px) scale(0.95); }
.card-pop-leave-to   { opacity: 0; transform: translateY(12px) scale(0.95); }

@keyframes knowledge-pulse {
  0% { outline: 2px solid rgba(59, 130, 246, 0.7); outline-offset: 2px; }
  50% { outline: 4px solid rgba(59, 130, 246, 0); outline-offset: 6px; }
  100% { outline: 2px solid rgba(59, 130, 246, 0.7); outline-offset: 2px; }
}
</style>

<style>
.knowledge-graph-container .vue-flow__edge path {
  transition: opacity 0.25s ease, stroke 0.25s ease, stroke-width 0.25s ease, stroke-dasharray 0.25s ease;
}
.knowledge-graph-container.is-settling .vue-flow__edge path {
  transition: none;
}
</style>
