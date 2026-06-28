import type {Ref} from 'vue'
import {getCurrentInstance, nextTick, onMounted, onUnmounted, reactive, ref} from 'vue'
import type {Node} from '@vue-flow/core'
import type {KnowledgeNodeData} from '@/composables/useKnowledgeGraph'

// D-19 (IN-08): extracted node half-dimensions for centering math.
// Node size assumed 120x60 (KnowledgeNode.vue width/height).
// focusNode uses these directly; flyToNode uses +75/+20 offsets because
// zoom 1.5 crops tighter and a slight upward shift keeps the node label
// visible below the center crosshair (visual centering differs by zoom).
const NODE_HALF_W = 60
const NODE_HALF_H = 30

/**
 * useGraphViewport — viewport persistence + flyToNode + fitView for the
 * knowledge graph.
 *
 * Owns:
 *   - zoomLevel / viewportPos / svgTransform / isSettling reactive state
 *   - onMove handler (syncs svgTransform for RegionBackground, throttles
 *     zoomLevel updates, debounces localStorage kg-viewport writes)
 *   - fitView / focusNode / flyToNode (with flowRef null guards — T-10-11)
 *   - onMounted: restore localStorage kg-viewport OR fitView if none
 *   - onUnmounted: clear pendingSave / settleTimer
 *
 * NOTE: displayNodes is required as a second arg so focusNode/flyToNode can
 * translate topicId → node position. The plan signature omitted it; this is
 * a Rule 3 deviation (blocking — focusNode/flyToNode cannot work otherwise).
 *
 * Lifecycle hooks are guarded by `getCurrentInstance()` so the composable
 * can be unit-tested outside a component setup without Vue warnings.
 */
export function useGraphViewport(
    flowRef: Ref<any>,
    displayNodes: Ref<Node<KnowledgeNodeData>[]>
): {
    zoomLevel: Ref<number>
    viewportPos: { x: number; y: number }
    svgTransform: Ref<string>
    isSettling: Ref<boolean>
    onMove: (moveEvent: { event: any; flowTransform: { x: number; y: number; zoom: number } }) => void
    fitView: () => void
    focusNode: (topicId: string) => void
    flyToNode: (topicId: string) => void
} {
    const zoomLevel = ref(0.8)
    const viewportPos = reactive({x: 0, y: 0})
    const svgTransform = ref('')
    const isSettling = ref(false)

    let lastMoveTs = 0
    let pendingSave: ReturnType<typeof setTimeout> | null = null
    let settleTimer: ReturnType<typeof setTimeout> | null = null

    function onMove(moveEvent: { event: any; flowTransform: { x: number; y: number; zoom: number } }): void {
        const vp = moveEvent.flowTransform
        viewportPos.x = vp.x
        viewportPos.y = vp.y

        // Sync svg transform for RegionBackground (replaces its rAF polling)
        const pane = (flowRef.value?.$el as HTMLElement)?.querySelector?.('.vue-flow__transformationpane') as HTMLElement | null
        if (pane && pane.style.transform) {
            svgTransform.value = pane.style.transform
        }

        isSettling.value = true
        if (settleTimer) clearTimeout(settleTimer)
        settleTimer = setTimeout(() => {
            isSettling.value = false
        }, 150)

        const now = performance.now()
        if (now - lastMoveTs > 100) {
            lastMoveTs = now
            zoomLevel.value = vp.zoom
        }

        if (pendingSave) clearTimeout(pendingSave)
        pendingSave = setTimeout(() => {
            try {
                localStorage.setItem('kg-viewport', JSON.stringify({x: vp.x, y: vp.y, zoom: vp.zoom}))
            } catch {
                /* localStorage unavailable — skip persist */
            }
        }, 300)
    }

    function fitView(): void {
        // T-10-11: guard against null flowRef (composable mounted before VueFlow)
        if (!flowRef.value) return
        flowRef.value?.fitView?.({duration: 300})
    }

    function focusNode(topicId: string): void {
        if (!flowRef.value) return
        const nodeId = `topic-${topicId}`
        const node = displayNodes.value.find((n) => n.id === nodeId)
        if (node) {
            flowRef.value?.setCenter?.(node.position.x + NODE_HALF_W, node.position.y + NODE_HALF_H, {
                zoom: 1.2,
                duration: 400
            })
        }
    }

    function flyToNode(topicId: string): void {
        if (!flowRef.value) return
        const nodeId = `topic-${topicId}`
        const node = displayNodes.value.find((n) => n.id === nodeId)
        if (!node) return

        flowRef.value?.setCenter?.(
            // D-19: zoom 1.5 crops tighter — +75/+20 shifts node slightly up-left
            // so the label stays visible below center. focusNode (zoom 1.2) uses
            // NODE_HALF_W/H directly; flyToNode's offset is intentionally different.
            node.position.x + 75,
            node.position.y + 20,
            {zoom: 1.5, duration: 600}
        )
    }

    // ── Lifecycle (guarded so composable is unit-testable) ───────

    const instance = getCurrentInstance()
    if (instance) {
        onMounted(async () => {
            // D-31: auto-fit on first visit when no saved viewport exists.
            // Viewport restore (when saved) happens in onPaneReady after layout.
            try {
                const saved = localStorage.getItem('kg-viewport')
                if (!saved) {
                    await nextTick()
                    flowRef.value?.fitView?.({duration: 300})
                }
            } catch {
                await nextTick()
                flowRef.value?.fitView?.({duration: 300})
            }
        })

        onUnmounted(() => {
            if (settleTimer) clearTimeout(settleTimer)
            if (pendingSave) clearTimeout(pendingSave)
        })
    }

    return {
        zoomLevel,
        viewportPos,
        svgTransform,
        isSettling,
        onMove,
        fitView,
        focusNode,
        flyToNode
    }
}
