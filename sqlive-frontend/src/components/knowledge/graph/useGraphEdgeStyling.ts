import type { Edge } from '@vue-flow/core'
import { computed, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph'

/**
 * useGraphEdgeStyling — zoom-tiered opacity + hover path highlight for
 * knowledge graph edges (extracted from KnowledgeGraph.vue).
 *
 * styledEdges cache (watch+ref pattern, computed stays pure).
 * Watch writes to styledEdgesCache; computed reads ref.value. Avoids cache
 * heuristic that lost reactivity to props.edges. { immediate: true }
 * ensures cache is populated on mount before first render.
 */
export function useGraphEdgeStyling(opts: {
    edgesGetter: () => Edge[]
    zoomLevel: Ref<number>
    edgeOpacityForZoom: (zoom: number) => number
    hoveredNodeId: Ref<string | null>
    nodeDataMap: ComputedRef<Map<string, KnowledgeNodeData>>
    immediatePredecessors: (topicId: string) => Set<string>
    immediateSuccessors: (topicId: string) => Set<string>
}): {
    styledEdges: ComputedRef<Edge[]>
} {
    const styledEdgesCache = ref<Edge[]>([])

    watch(
        [
            () => opts.edgesGetter(),
            () => opts.edgeOpacityForZoom(opts.zoomLevel.value),
            () => opts.hoveredNodeId.value
        ],
        () => {
            const baseOpacity = opts.edgeOpacityForZoom(opts.zoomLevel.value)

            // 计算 hover 时前驱/后继路径集合（仅一层）
            let predSet = new Set<string>()
            let succSet = new Set<string>()
            if (opts.hoveredNodeId.value) {
                predSet = opts.immediatePredecessors(opts.hoveredNodeId.value)
                succSet = opts.immediateSuccessors(opts.hoveredNodeId.value)
            }

            styledEdgesCache.value = opts.edgesGetter().map((edge) => {
                const sourceId = edge.source.replace(/^topic-/, '')
                const targetId = edge.target.replace(/^topic-/, '')

                // 大陆连线：跨 category 的连线，更宽更明显
                const srcData = opts.nodeDataMap.value.get(sourceId)
                const tgtData = opts.nodeDataMap.value.get(targetId)
                const isContinent = srcData && tgtData && srcData.category !== tgtData.category

                const isPred =
                    opts.hoveredNodeId.value &&
                    predSet.has(sourceId) &&
                    targetId === opts.hoveredNodeId.value
                const isSucc =
                    opts.hoveredNodeId.value &&
                    succSet.has(targetId) &&
                    sourceId === opts.hoveredNodeId.value

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
                const prereq = edge.data?.isPrereq
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

    const styledEdges = computed(() => styledEdgesCache.value)

    return { styledEdges }
}
