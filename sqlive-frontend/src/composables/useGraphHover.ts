import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { Edge, Node } from '@vue-flow/core'
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph'

/**
 * useGraphHover — hover-driven adjacency highlight for the knowledge graph.
 *
 * Owns:
 *   - hoveredNodeId state
 *   - adjacencyMap (bidirectional topic-id → Set<connected topicId>) from edges
 *   - nodeDataMap / hubCount computeds used by edge weighting
 *   - edgeWeight / topKneighbors / immediatePredecessors / immediateSuccessors
 *   - setHoveredNode / clearHoveredNode / resetHoverState mutators
 *
 * Edges are read via `edgesGetter` so callers can pass `() => props.edges`
 * (reactive through Vue's props proxy) without leaking the props object in.
 */
export function useGraphHover(
  edgesGetter: () => Edge[],
  displayNodes: Ref<Node<KnowledgeNodeData>[]>
): {
  hoveredNodeId: Ref<string | null>
  adjacencyMap: ComputedRef<Map<string, Set<string>>>
  nodeDataMap: ComputedRef<Map<string, KnowledgeNodeData>>
  hubCount: ComputedRef<Map<string, number>>
  edgeWeight: (fromId: string, toId: string) => number
  topKneighbors: (topicId: string, neighborIds: string[], k: number, fromSource: boolean) => Set<string>
  immediatePredecessors: (topicId: string) => Set<string>
  immediateSuccessors: (topicId: string) => Set<string>
  setHoveredNode: (topicId: string) => void
  clearHoveredNode: () => void
  resetHoverState: () => void
} {
  const hoveredNodeId = ref<string | null>(null)

  /**
   * Build adjacency map from edges: topicId → Set<connected topicId>.
   * `topic-` prefix on edge.source/target is stripped to recover raw topicId.
   */
  const adjacencyMap = computed(() => {
    const map = new Map<string, Set<string>>()
    for (const edge of edgesGetter()) {
      const sourceId = edge.source.replace(/^topic-/, '')
      const targetId = edge.target.replace(/^topic-/, '')
      if (!map.has(sourceId)) map.set(sourceId, new Set())
      if (!map.has(targetId)) map.set(targetId, new Set())
      map.get(sourceId)!.add(targetId)
      map.get(targetId)!.add(sourceId)
    }
    return map
  })

  // ── Node data lookup (path traversal + category check) ───────

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
  function topKneighbors(
    topicId: string,
    neighborIds: string[],
    k: number,
    fromSource: boolean
  ): Set<string> {
    const scored = neighborIds.map((id) => ({
      id,
      weight: fromSource ? edgeWeight(id, topicId) : edgeWeight(topicId, id)
    }))
    scored.sort((a, b) => b.weight - a.weight)
    return new Set(scored.slice(0, k).map((s) => s.id))
  }

  function immediatePredecessors(topicId: string): Set<string> {
    const data = nodeDataMap.value.get(topicId)
    return topKneighbors(topicId, data?.prerequisites ?? [], 2, true)
  }

  function immediateSuccessors(topicId: string): Set<string> {
    const data = nodeDataMap.value.get(topicId)
    return topKneighbors(topicId, data?.nextTopics ?? [], 2, false)
  }

  function setHoveredNode(topicId: string): void {
    hoveredNodeId.value = topicId
  }

  function clearHoveredNode(): void {
    hoveredNodeId.value = null
  }

  function resetHoverState(): void {
    hoveredNodeId.value = null
  }

  return {
    hoveredNodeId,
    adjacencyMap,
    nodeDataMap,
    hubCount,
    edgeWeight,
    topKneighbors,
    immediatePredecessors,
    immediateSuccessors,
    setHoveredNode,
    clearHoveredNode,
    resetHoverState
  }
}
