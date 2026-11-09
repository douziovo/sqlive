<template>
    <div class="knowledge-graph-wrapper">
        <div v-if="nodes.length === 0" class="knowledge-graph-empty">
            <p class="text-sm text-muted-foreground">暂无知识图谱数据</p>
        </div>

        <div
            v-else
            class="knowledge-graph-container"
            :class="{ 'is-settling': viewport.isSettling.value }"
        >
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
                <MiniMap
                    position="bottom-left"
                    :width="160"
                    :height="110"
                    :node-color="miniMapNodeColor"
                    style="margin: 0 0 12px 12px"
                />
            </VueFlow>

            <KnowledgeGraphDetailCard
                :topic="selectedTopic"
                :mastered-topics="masteredTopics"
                @toggle-mastered="handleToggleMastered"
                @ask-ai="handleAskAi"
                @close="handleDetailClose"
                @view-all-tasks="handleViewAllTasks"
                @complete-task="handleTaskCompleteFromDetail"
                @navigate-to-topic="(topicId: string) => emit('navigate-to-topic', topicId)"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { VueFlow } from '@vue-flow/core'
import type { VueFlowStore } from '@vue-flow/core'
import type { Edge } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import { markRaw, nextTick, onMounted, onUnmounted, provide, shallowRef } from 'vue'

import ErSearchBar from '@/components/er/ErSearchBar.vue'
import { useGraphHover } from '@/composables/useGraphHover'
import { useGraphLOD } from '@/composables/useGraphLOD'
import { useGraphSearch } from '@/composables/useGraphSearch'
import { useGraphViewport } from '@/composables/useGraphViewport'
import type {
    KnowledgeNode as KnowledgeFlowNode,
    KnowledgeTopic
} from '@/composables/useKnowledgeGraph'

import KnowledgeGraphDetailCard from './graph/KnowledgeGraphDetailCard.vue'
import { useGraphEdgeStyling } from './graph/useGraphEdgeStyling'
import { useGraphLayoutManager } from './graph/useGraphLayoutManager'
import { useGraphNodeStyling } from './graph/useGraphNodeStyling'
import { useNodeCelebrationEffects } from './graph/useNodeCelebrationEffects'
import KnowledgeNode from './KnowledgeNode.vue'

const props = defineProps<{
    nodes: KnowledgeFlowNode[]
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

// `as any`: vue-flow's NodeComponent type does not structurally accept custom
// SFC node components (known upstream typing friction).
const nodeTypes = markRaw({ 'knowledge-node': KnowledgeNode }) as any
// Template ref on <VueFlow>: exposes the store's methods (fitView/setCenter/...)
// plus the component's $el (used for layout measurement). shallowRef keeps the
// store's nested ComputedRefs from being deeply unwrapped by ref()'s UnwrapRef.
const flowRef = shallowRef<(VueFlowStore & { $el?: HTMLElement }) | null>(null)
const displayNodes = shallowRef<KnowledgeFlowNode[]>([...props.nodes])

// ── Composables (split: hover/viewport/search/LOD) ───────
// NOTE: onResetView injects onPaneDblClick into useGraphSearch so Ctrl+0
// can reset the view without the composable knowing about hover/viewport.

const hover = useGraphHover(() => props.edges, displayNodes)
const viewport = useGraphViewport(flowRef, displayNodes)
const search = useGraphSearch(flowRef, displayNodes, { onResetView: onPaneDblClick })
const lod = useGraphLOD()

provide('zoomLevel', viewport.zoomLevel)
provide('viewportPos', viewport.viewportPos)

// ── Styled edges (zoom-tiered opacity + hover path highlight) ──

const { styledEdges } = useGraphEdgeStyling({
    edgesGetter: () => props.edges,
    zoomLevel: viewport.zoomLevel,
    edgeOpacityForZoom: lod.edgeOpacityForZoom,
    hoveredNodeId: hover.hoveredNodeId,
    nodeDataMap: hover.nodeDataMap,
    immediatePredecessors: hover.immediatePredecessors,
    immediateSuccessors: hover.immediateSuccessors
})

// ── Layout sync + viewport restore (dagre TB) ─────────────────

const { onPaneReady } = useGraphLayoutManager({
    flowRef,
    displayNodes,
    nodesGetter: () => props.nodes,
    edgesGetter: () => props.edges
})

// ── Styled nodes (search dimming + hover focus/highlight) ──────

const { styledNodes } = useGraphNodeStyling({
    displayNodes,
    searchQuery: search.searchQuery,
    matchNodes: search.matchNodes,
    currentIndex: search.currentIndex,
    hoveredNodeId: hover.hoveredNodeId,
    adjacencyMap: hover.adjacencyMap
})

// ── Spark particles / Unlock glow (-03) ────────────────

const { triggerSparkBurst, triggerUnlockGlow } = useNodeCelebrationEffects(displayNodes)

// ── VueFlow event handlers ─────────────────────────────────────

function onNodeClick(event: any): void {
    const topicId = event.node?.data?.topicId
    if (topicId) emit('node-select', topicId)
}

function onNodeMouseEnter(event: any): void {
    const topicId = event.node?.data?.topicId
    if (topicId) hover.setHoveredNode(topicId)
}

function onNodeMouseLeave(): void {
    hover.clearHoveredNode()
}
function onPaneClick(): void {
    emit('deselect-node')
}
function onPaneDblClick(): void {
    // reset all interaction state + fitView animation.
    // Called via dblclick listener and via useGraphSearch Ctrl+0 → opts.onResetView.
    hover.resetHoverState()
    if (search.showSearch.value) search.closeSearch()
    nextTick(() => viewport.fitView())
}

function miniMapNodeColor(_node: any): string {
    return '#94a3b8'
}
function getStyledEdges(): Edge[] {
    return styledEdges.value
}
function getStyledNodes(): KnowledgeFlowNode[] {
    return styledNodes.value
}

// ── KnowledgeDetail event forwarding ───────────────────────────

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

// ── Lifecycle: viewport dblclick listener only ────────────────
// document keydown listener moved to useGraphSearch onMounted.
// localStorage restore + initial fitView moved to useGraphViewport onMounted.

onMounted(async () => {
    // native dblclick on the viewport pane (vue-flow has no @pane-dblclick event).
    // Must use capture phase — D3 zoom intercepts bubble-phase dblclick.
    await nextTick()
    const vpEl = flowRef.value?.$el?.querySelector?.('.vue-flow__viewport') as
        | HTMLElement
        | undefined
    if (vpEl) vpEl.addEventListener('dblclick', onPaneDblClick, { capture: true })
})

onUnmounted(() => {
    const vpEl = flowRef.value?.$el?.querySelector?.('.vue-flow__viewport') as
        | HTMLElement
        | undefined
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
    triggerUnlockGlow
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

@keyframes knowledge-pulse {
    0% {
        outline: 2px solid rgb(59 130 246 / 70%);
        outline-offset: 2px;
    }

    50% {
        outline: 4px solid rgb(59 130 246 / 0%);
        outline-offset: 6px;
    }

    100% {
        outline: 2px solid rgb(59 130 246 / 70%);
        outline-offset: 2px;
    }
}
</style>

<style>
.knowledge-graph-container .vue-flow__edge path {
    transition:
        opacity 0.25s ease,
        stroke 0.25s ease,
        stroke-width 0.25s ease,
        stroke-dasharray 0.25s ease;
}

.knowledge-graph-container.is-settling .vue-flow__edge path {
    transition: none;
}
</style>
