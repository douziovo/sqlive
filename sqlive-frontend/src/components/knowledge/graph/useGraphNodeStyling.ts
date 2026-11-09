import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { KnowledgeNode as KnowledgeFlowNode } from '@/composables/useKnowledgeGraph'

/**
 * useGraphNodeStyling — search dimming + hover focus/highlight/dim markers
 * applied to node data/style (extracted from KnowledgeGraph.vue).
 *
 * Step 1: local search filter (opacity 0.2 for non-matches, isSearchMatch /
 * isActiveMatch markers). Step 2: hover state overrides search opacity for
 * connected nodes (isFocused / isHighlighted / isDimmed markers).
 */
export function useGraphNodeStyling(opts: {
    displayNodes: Ref<KnowledgeFlowNode[]>
    searchQuery: Ref<string>
    matchNodes: ComputedRef<KnowledgeFlowNode[]>
    currentIndex: ComputedRef<number>
    hoveredNodeId: Ref<string | null>
    adjacencyMap: ComputedRef<Map<string, Set<string>>>
}): {
    styledNodes: ComputedRef<KnowledgeFlowNode[]>
} {
    const styledNodes = computed<KnowledgeFlowNode[]>(() => {
        const matches = opts.matchNodes.value
        const matchIdSet = new Set(matches.map((m) => m.id))
        const activeId = opts.currentIndex.value >= 0 ? matches[opts.currentIndex.value]?.id : null

        return opts.displayNodes.value.map((node) => {
            let data = { ...node.data }
            let style = { ...node.style }
            let searchDimmed = false

            // Step 1: Local search filter
            if (opts.searchQuery.value) {
                const isMatch = matchIdSet.has(node.id)
                const isActive = activeId === node.id
                style = { ...style, opacity: isMatch ? 1 : 0.2 }
                searchDimmed = !isMatch
                data = { ...data, isSearchMatch: isMatch, isActiveMatch: isActive }
            } else {
                data = { ...data, isSearchMatch: undefined, isActiveMatch: undefined }
            } // Step 2: Hover state (overrides search opacity for connected nodes)
            if (opts.hoveredNodeId.value) {
                const tid = data.topicId
                const adj = opts.adjacencyMap.value.get(opts.hoveredNodeId.value) || new Set()
                if (tid === opts.hoveredNodeId.value) {
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
                if (!searchDimmed && !('opacity' in style)) style = { ...style, opacity: 1 }
            }

            data = { ...data, isPathHighlighted: false }
            return { ...node, data, style }
        })
    })

    return { styledNodes }
}
