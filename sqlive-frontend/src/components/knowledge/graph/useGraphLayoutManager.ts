import type { VueFlowStore } from '@vue-flow/core'
import type { Edge } from '@vue-flow/core'
import { nextTick, watch } from 'vue'
import type { Ref } from 'vue'

import { layoutNodes } from '@/composables/useDagreLayout'
import type { KnowledgeNode as KnowledgeFlowNode } from '@/composables/useKnowledgeGraph'
import { STORAGE_KEYS } from '@/constants/storageKeys'

/**
 * useGraphLayoutManager — dagre TB layout + saved-viewport restore
 * (extracted from KnowledgeGraph.vue).
 *
 * Owns:
 *   - watch(nodesGetter): re-sync displayNodes and re-run layout on node changes
 *   - onPaneReady: layout on pane ready + restore saved viewport
 */
export function useGraphLayoutManager(opts: {
    flowRef: Ref<(VueFlowStore & { $el?: HTMLElement }) | null>
    displayNodes: Ref<KnowledgeFlowNode[]>
    nodesGetter: () => KnowledgeFlowNode[]
    edgesGetter: () => Edge[]
}): {
    onPaneReady: () => Promise<void>
} {
    // Sync displayNodes when props.nodes change, re-run dagre TB layout
    watch(
        opts.nodesGetter,
        async (newNodes) => {
            opts.displayNodes.value = [...newNodes]
            if (newNodes.length === 0) return
            await nextTick()
            const el = opts.flowRef.value?.$el as HTMLElement | undefined
            opts.displayNodes.value = layoutNodes(opts.displayNodes.value, opts.edgesGetter(), el, {
                rankdir: 'TB',
                ranksep: 120,
                nodesep: 80,
                marginx: 60,
                marginy: 60
            })
        },
        { deep: true }
    )

    // ── Layout + viewport restore on pane ready ───────────────────

    async function onPaneReady(): Promise<void> {
        await nextTick()
        const el = opts.flowRef.value?.$el as HTMLElement | undefined
        opts.displayNodes.value = layoutNodes(opts.displayNodes.value, opts.edgesGetter(), el, {
            rankdir: 'TB',
            ranksep: 120,
            nodesep: 80
        })
        // restore saved viewport after layout
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.graphViewport)
            if (saved) {
                const vp = JSON.parse(saved) as { x: number; y: number; zoom: number }
                await nextTick()
                opts.flowRef.value?.setViewport?.(vp, { duration: 0 })
            }
        } catch {
            /* localStorage unavailable */
        }
    }

    return { onPaneReady }
}
