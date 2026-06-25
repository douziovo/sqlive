<template>
  <div class="knowledge-graph-wrapper">
    <div v-if="nodes.length === 0" class="knowledge-graph-empty">
      <p class="text-sm text-muted-foreground">暂无知识图谱数据</p>
    </div>

    <div v-else class="knowledge-graph-container" :class="{ 'is-settling': isSettling }">
      <ErSearchBar
        v-model="searchQueryRef"
        :visible="showSearch"
        :total-count="totalCount"
        :match-count="matchCount"
        :current-index="currentIndex"
        placeholder="搜索知识点..."
        @close="closeSearch"
        @prev="navigateMatch(-1)"
        @next="navigateMatch(1)"
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
        @move="onMove"
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
import { computed, markRaw, nextTick, onMounted, onUnmounted, provide, reactive, ref, watch } from 'vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'

import type { Edge, Node } from '@vue-flow/core'
import { layoutNodes } from '@/composables/useDagreLayout'
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
  if (displayNodes.value.length === 0) {
    return { minX: 0, minY: 0, width: 800, height: 600 }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of displayNodes.value) {
    const cx = node.position.x + 60
    const cy = node.position.y + 22
    if (cx < minX) minX = cx
    if (cy < minY) minY = cy
    if (cx > maxX) maxX = cx
    if (cy > maxY) maxY = cy
  }
  const padding = 200
  return {
    minX: minX - padding,
    minY: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2
  }
})

const zoomLevel = ref(0.8)
const viewportPos = reactive({ x: 0, y: 0 })
const svgTransform = ref('')
const isSettling = ref(false)
provide('zoomLevel', zoomLevel)
provide('viewportPos', viewportPos)
provide('svgTransform', svgTransform)

let lastMoveTs = 0
let pendingSave: ReturnType<typeof setTimeout> | null = null
let settleTimer: ReturnType<typeof setTimeout> | null = null

// ── Search state ─────────────────────────────────────────────

const showSearch = ref(false)
const searchQueryRef = ref('')
const matchIndex = ref(0)
const previousViewport = ref<{ x: number; y: number; zoom: number } | null>(null)

const totalCount = computed(() => displayNodes.value.length)

const matchNodes = computed(() => {
  if (!searchQueryRef.value) return [] as Node<KnowledgeNodeData>[]
  const q = searchQueryRef.value.toLowerCase()
  return displayNodes.value.filter((node) =>
    node.data.label.toLowerCase().includes(q) ||
    (node.data.description || '').toLowerCase().includes(q)
  )
})

const matchCount = computed(() => matchNodes.value.length)

const currentIndex = computed(() => {
  if (!searchQueryRef.value || matchCount.value === 0) return -1
  return matchIndex.value
})

function onGlobalKeydown(e: KeyboardEvent): void {
  // Escape closes search regardless of focus target (keyboard-only users need this)
  if (e.key === 'Escape' && showSearch.value) {
    e.preventDefault()
    e.stopPropagation()
    closeSearch()
    return
  }

  // Threat model T-05-01: only intercept Ctrl+F when focus is not inside input/textarea
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

  // D-12: Ctrl+0 resets view (keyboard equivalent of dblclick) — same guard as Ctrl+F
  if ((e.ctrlKey || e.metaKey) && e.key === '0') {
    e.preventDefault()
    e.stopPropagation()
    onPaneDblClick()
    return
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    e.stopPropagation()
    showSearch.value = true
    const vp = flowRef.value?.getViewport?.()
    if (vp) {
      previousViewport.value = vp
    }
  }
}

function closeSearch(): void {
  showSearch.value = false
  searchQueryRef.value = ''
  matchIndex.value = 0
  restoreViewport()
}

function restoreViewport(): void {
  if (previousViewport.value) {
    flowRef.value?.setViewport?.(previousViewport.value, { duration: 200 })
    previousViewport.value = null
  }
}

function centerOnMatch(index: number): void {
  if (matchNodes.value.length === 0 || index < 0 || index >= matchNodes.value.length) return
  const node = matchNodes.value[index]
  if (node) {
    flowRef.value?.setCenter?.(node.position.x + 60, node.position.y + 30, { zoom: 1.2, duration: 300 })
  }
}

function navigateMatch(dir: 1 | -1): void {
  const matches = matchNodes.value
  if (matches.length === 0) return
  matchIndex.value = (matchIndex.value + dir + matches.length) % matches.length
  centerOnMatch(matchIndex.value)
}

watch(searchQueryRef, (val) => {
  if (val) {
    matchIndex.value = 0
    nextTick(() => centerOnMatch(0))
  } else {
    matchIndex.value = 0
  }
})

onMounted(async () => {
  document.addEventListener('keydown', onGlobalKeydown, true)

  // D-32: native dblclick on the viewport pane (vue-flow has no @pane-dblclick event)
  // Must use capture phase — D3 zoom intercepts bubble-phase dblclick
  await nextTick()
  const viewport = flowRef.value?.$el?.querySelector?.('.vue-flow__viewport') as HTMLElement | undefined
  if (viewport) {
    viewport.addEventListener('dblclick', onPaneDblClick, { capture: true })
  }

  // D-31: auto-fit on first visit when no saved viewport exists
  // Viewport restore (when saved) happens in onPaneReady after layout
  try {
    const saved = localStorage.getItem('kg-viewport')
    if (!saved) {
      await nextTick()
      flowRef.value?.fitView?.({ duration: 300 })
    }
  } catch {
    await nextTick()
    flowRef.value?.fitView?.({ duration: 300 })
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onGlobalKeydown, true)
  if (settleTimer) clearTimeout(settleTimer)
  if (pendingSave) clearTimeout(pendingSave)
  const viewport = flowRef.value?.$el?.querySelector?.('.vue-flow__viewport') as HTMLElement | undefined
  if (viewport) {
    viewport.removeEventListener('dblclick', onPaneDblClick)
  }
})

// ── Hover state ──────────────────────────────────────────────

const hoveredNodeId = ref<string | null>(null)

/**
 * Build adjacency map from edges: topicId → Set<connected topicId>
 */
const adjacencyMap = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const edge of props.edges) {
    const sourceId = edge.source.replace(/^topic-/, '')
    const targetId = edge.target.replace(/^topic-/, '')
    if (!map.has(sourceId)) map.set(sourceId, new Set())
    if (!map.has(targetId)) map.set(targetId, new Set())
    map.get(sourceId)!.add(targetId)
    map.get(targetId)!.add(sourceId)
  }
  return map
})

// ── 节点数据 lookup（供路径遍历和类别判断） ──────────────────

const nodeDataMap = computed(() => {
  const map = new Map<string, KnowledgeNodeData>()
  for (const node of displayNodes.value) {
    map.set(node.data.topicId, node.data as KnowledgeNodeData)
  }
  return map
})

// Count how many nodes list `tid` as a prerequisite (hub score)
const hubCount = computed(() => {
  const counts = new Map<string, number>()
  for (const data of nodeDataMap.value.values()) {
    for (const prereq of data.prerequisites) {
      counts.set(prereq, (counts.get(prereq) || 0) + 1)
    }
  }
  return counts
})

/** Score an edge from `fromId` to `toId`. Higher = more important. */
function edgeWeight(fromId: string, toId: string): number {
  const fromCat = nodeDataMap.value.get(fromId)?.category
  const toCat = nodeDataMap.value.get(toId)?.category
  let w = 0
  if (fromCat && toCat && fromCat === toCat) w += 3
  else w += 1
  if ((hubCount.value.get(fromId) || 0) >= 3) w += 2
  return w
}

/** Top N by weight, descending. `fromSource` = edge goes from neighbor → topicId. */
function topKneighbors(topicId: string, neighborIds: string[], k: number, fromSource: boolean): Set<string> {
  const scored = neighborIds.map(id => ({
    id,
    weight: fromSource ? edgeWeight(id, topicId) : edgeWeight(topicId, id)
  }))
  scored.sort((a, b) => b.weight - a.weight)
  return new Set(scored.slice(0, k).map(s => s.id))
}

function immediatePredecessors(topicId: string): Set<string> {
  const data = nodeDataMap.value.get(topicId)
  return topKneighbors(topicId, data?.prerequisites ?? [], 2, true)
}

function immediateSuccessors(topicId: string): Set<string> {
  const data = nodeDataMap.value.get(topicId)
  return topKneighbors(topicId, data?.nextTopics ?? [], 2, false)
}

function edgeOpacityForZoom(zoom: number): number {
  if (zoom < 0.3) return 0
  if (zoom < 0.5) return ((zoom - 0.3) / 0.2) * 0.12
  if (zoom < 1.2) return 0.12
  if (zoom < 1.5) return 0.12 + ((zoom - 1.2) / 0.3) * 0.06
  return 0.18
}

const _edgeCacheKey = ref('')
const _edgeCache = ref<Edge[]>([])

const styledEdges = computed<Edge[]>(() => {
  // Round opacity to 2 decimals to avoid recompute on negligible zoom changes
  const baseOpacity = Math.round(edgeOpacityForZoom(zoomLevel.value) * 100) / 100
  const cacheKey = `${baseOpacity}|${hoveredNodeId.value || ''}`

  if (cacheKey === _edgeCacheKey.value && _edgeCache.value.length) {
    return _edgeCache.value
  }
  _edgeCacheKey.value = cacheKey

  // 计算 hover 时前驱/后继路径集合（仅一层）
  let predSet = new Set<string>()
  let succSet = new Set<string>()
  if (hoveredNodeId.value) {
    predSet = immediatePredecessors(hoveredNodeId.value)
    succSet = immediateSuccessors(hoveredNodeId.value)
  }

  const result = props.edges.map((edge) => {
    const sourceId = edge.source.replace(/^topic-/, '')
    const targetId = edge.target.replace(/^topic-/, '')

    // 大陆连线：跨 category 的连线，更宽更明显
    const srcData = nodeDataMap.value.get(sourceId)
    const tgtData = nodeDataMap.value.get(targetId)
    const isContinent = srcData && tgtData && srcData.category !== tgtData.category

    const isPred = hoveredNodeId.value && predSet.has(sourceId) && targetId === hoveredNodeId.value
    const isSucc = hoveredNodeId.value && succSet.has(targetId) && sourceId === hoveredNodeId.value

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

  _edgeCache.value = result
  return result
})

// Sync displayNodes when props.nodes change, re-run layout
watch(
  () => props.nodes,
  async (newNodes) => {
    displayNodes.value = [...newNodes]
    if (newNodes.length === 0) return
    await nextTick()
    const el = flowRef.value?.$el as HTMLElement | undefined
    const layouted = layoutNodes(displayNodes.value as any, props.edges, el, {
      rankdir: 'TB',
      ranksep: 120,
      nodesep: 80,
      marginx: 60,
      marginy: 60
    })
    displayNodes.value = layouted as Node<KnowledgeNodeData>[]
  },
  { deep: true }
)

/**
 * Nodes with local search filter and hover state:
 * - Search: non-matching nodes dimmed (opacity 0.2), matching get isSearchMatch/isActiveMatch
 * - Hover: focused/highlighted/dimmed states with opacity control
 * - Hover overrides search opacity for connected nodes
 */
const styledNodes = computed(() => {
  const matches = matchNodes.value
  const matchIdSet = new Set(matches.map(m => m.id))
  const activeId = currentIndex.value >= 0 ? matches[currentIndex.value]?.id : null

  return displayNodes.value.map((node) => {
    let data = { ...node.data }
    let style = { ...node.style }
    let searchDimmed = false

    // Step 1: Local search filter
    if (searchQueryRef.value) {
      const isMatch = matchIdSet.has(node.id)
      const isActive = activeId === node.id
      style = { ...style, opacity: isMatch ? 1 : 0.2 }
      searchDimmed = !isMatch
      data = { ...data, isSearchMatch: isMatch, isActiveMatch: isActive }
    } else {
      data = { ...data, isSearchMatch: undefined, isActiveMatch: undefined }
    }

    // Step 2: Hover state (overrides search opacity for connected nodes)
    if (hoveredNodeId.value) {
      const tid = data.topicId
      const adj = adjacencyMap.value.get(hoveredNodeId.value) || new Set()

      if (tid === hoveredNodeId.value) {
        data = { ...data, isFocused: true, isHighlighted: false, isDimmed: false }
        style = { ...style, opacity: 1 }
      } else if (adj.has(tid)) {
        data = { ...data, isHighlighted: true, isFocused: false, isDimmed: false }
        style = { ...style, opacity: 1 }
      } else {
        data = { ...data, isDimmed: true, isFocused: false, isHighlighted: false }
        style = { ...style, opacity: 0.12 }
      }
    } else {
      data = { ...data, isFocused: false, isHighlighted: false, isDimmed: false }
      // Preserve search dimming (opacity 0.2) if active, otherwise default to 1
      // Preserve filter dimming from panel when no hover/search (opacity already set by filteredNodes)
      if (!searchDimmed && style.opacity === undefined) {
        style = { ...style, opacity: 1 }
      }
    }

    data = { ...data, isPathHighlighted: false }

    return { ...node, data, style }
  })
})

function onNodeClick(event: any): void {
  const topicId = event.node?.data?.topicId
  if (topicId) {
    emit('node-select', topicId)
  }
}

function onNodeMouseEnter(event: any): void {
  const topicId = event.node?.data?.topicId
  if (topicId) {
    hoveredNodeId.value = topicId
  }
}

function onNodeMouseLeave(): void {
  hoveredNodeId.value = null
}

function onPaneClick(): void {
  emit('deselect-node')
}

function onPaneDblClick(): void {
  // D-32: 重置所有交互状态 + fitView 动画复位
  hoveredNodeId.value = null

  // Reset search if active
  if (showSearch.value) {
    showSearch.value = false
    searchQueryRef.value = ''
    matchIndex.value = 0
    previousViewport.value = null
  }

  // Fit-view with 300ms animation
  nextTick(() => {
    flowRef.value?.fitView?.({ duration: 300 })
  })
}

// ── Test hooks ───────────────────────────────────────────────

function setHoveredNode(topicId: string): void {
  hoveredNodeId.value = topicId
}

function clearHoveredNode(): void {
  hoveredNodeId.value = null
}

function resetHoverState(): void {
  hoveredNodeId.value = null
}

function miniMapNodeColor(_node: any): string {
  return '#94a3b8'
}

/** Expose computed values via methods so vue-test-utils can read them */
function getStyledEdges(): Edge[] {
  return styledEdges.value
}

function getStyledNodes(): ReturnType<typeof styledNodes.value> {
  return styledNodes.value
}

// ── Spark particles / Unlock glow (Phase 05-03) ────────────────

function triggerSparkBurst(topicId: string): void {
  const nodeId = `topic-${topicId}`
  const node = displayNodes.value.find((n) => n.id === nodeId)
  if (node) {
    node.data = { ...node.data, triggerSparkBurst: true }
    setTimeout(() => {
      node.data = { ...node.data, triggerSparkBurst: false }
    }, 700)
  }
}

function triggerUnlockGlow(topicId: string): void {
  const topic = displayNodes.value.find((n) => n.data.topicId === topicId)
  if (!topic) return
  const nextIds = topic.data.nextTopics || []
  for (const nextId of nextIds) {
    const nextNode = displayNodes.value.find((n) => n.data.topicId === nextId)
    if (nextNode) {
      nextNode.data = { ...nextNode.data, triggerUnlockGlow: true }
      setTimeout(() => {
        nextNode.data = { ...nextNode.data, triggerUnlockGlow: false }
      }, 800)
    }
  }
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

function handleViewAllTasks(): void {
  emit('view-all-tasks')
}

function handleTaskCompleteFromDetail(topicId: string): void {
  emit('complete-task', topicId)
}

function onMove(moveEvent: { event: any; flowTransform: { x: number; y: number; zoom: number } }): void {
  const vp = moveEvent.flowTransform
  viewportPos.x = vp.x; viewportPos.y = vp.y

  // Sync svg transform for RegionBackground (replaces its rAF polling)
  const pane = (flowRef.value?.$el as HTMLElement)?.querySelector?.('.vue-flow__transformationpane') as HTMLElement | null
  if (pane && pane.style.transform) {
    svgTransform.value = pane.style.transform
  }

  isSettling.value = true
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => { isSettling.value = false }, 150)

  const now = performance.now()
  if (now - lastMoveTs > 100) {
    lastMoveTs = now
    zoomLevel.value = vp.zoom
  }

  if (pendingSave) clearTimeout(pendingSave)
  pendingSave = setTimeout(() => {
    try { localStorage.setItem('kg-viewport', JSON.stringify({ x: vp.x, y: vp.y, zoom: vp.zoom })) } catch { /* */ }
  }, 300)
}

async function onPaneReady(): Promise<void> {
  await nextTick()
  const el = flowRef.value?.$el as HTMLElement | undefined
  const layouted = layoutNodes(displayNodes.value as any, props.edges, el, {
    rankdir: 'TB',
    ranksep: 120,
    nodesep: 80
  })
  displayNodes.value = layouted as Node<KnowledgeNodeData>[]

  // D-31: restore saved viewport after layout (must wait for pane to be ready)
  try {
    const saved = localStorage.getItem('kg-viewport')
    if (saved) {
      const vp = JSON.parse(saved) as { x: number; y: number; zoom: number }
      await nextTick()
      flowRef.value?.setViewport?.(vp, { duration: 0 })
    }
  } catch {
    /* localStorage unavailable — skip restore */
  }
}

function fitView(): void {
  if (flowRef.value) {
    flowRef.value.fitView({ duration: 300 })
  }
}

function focusNode(topicId: string): void {
  const nodeId = `topic-${topicId}`
  const node = displayNodes.value.find((n) => n.id === nodeId)
  if (node) {
    flowRef.value?.setCenter?.(node.position.x + 60, node.position.y + 30, { zoom: 1.2, duration: 400 })
  }
}

function flyToNode(topicId: string): void {
  const nodeId = `topic-${topicId}`
  const node = displayNodes.value.find((n) => n.id === nodeId)
  if (!node) return

  flowRef.value?.setCenter?.(
    node.position.x + 75,
    node.position.y + 20,
    { zoom: 1.5, duration: 600 }
  )
}

defineExpose({
  fitView,
  focusNode,
  flyToNode,
  hoveredNodeId,
  styledEdges,
  styledNodes,
  setHoveredNode,
  clearHoveredNode,
  resetHoverState,
  getStyledEdges,
  getStyledNodes,
  // Search state (for testing)
  showSearch,
  searchQuery: searchQueryRef,
  matchCount,
  currentIndex,
  navigateMatch,
  // MiniMap (for testing)
  miniMapNodeColor,
  // Spark / Glow (Phase 05-03)
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

/* Card pop transition */
.card-pop-enter-active { transition: opacity 0.2s ease-out, transform 0.2s ease-out; }
.card-pop-leave-active { transition: opacity 0.15s ease-in, transform 0.15s ease-in; }
.card-pop-enter-from { opacity: 0; transform: translateY(12px) scale(0.95); }
.card-pop-leave-to   { opacity: 0; transform: translateY(12px) scale(0.95); }

/* ── Pulse animation for search match (outline = GPU-cheap, no repaint) ── */

@keyframes knowledge-pulse {
  0% { outline: 2px solid rgba(59, 130, 246, 0.7); outline-offset: 2px; }
  50% { outline: 4px solid rgba(59, 130, 246, 0); outline-offset: 6px; }
  100% { outline: 2px solid rgba(59, 130, 246, 0.7); outline-offset: 2px; }
}
</style>

<style>
/* Smooth edge transitions when zoom-driven LOD changes opacity/stroke */
.knowledge-graph-container .vue-flow__edge path {
  transition: opacity 0.25s ease, stroke 0.25s ease, stroke-width 0.25s ease, stroke-dasharray 0.25s ease;
}
/* Disable during pan/zoom to avoid layout thrashing */
.knowledge-graph-container.is-settling .vue-flow__edge path {
  transition: none;
}
</style>
