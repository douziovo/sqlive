import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Node } from '@vue-flow/core'
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph'
import { useGraphViewport } from '@/composables/useGraphViewport'

// ── Test fixtures ──────────────────────────────────────────────

function makeNode(topicId: string, position: { x: number; y: number } = { x: 0, y: 0 }): Node<KnowledgeNodeData> {
  return {
    id: `topic-${topicId}`,
    type: 'knowledge-node',
    position,
    data: {
      topicId,
      label: topicId.toUpperCase(),
      difficulty: 1,
      description: '',
      prerequisites: [],
      nextTopics: [],
      category: 'query',
      status: 'unlearned'
    }
  }
}

// ── Tests ──────────────────────────────────────────────────────

describe('useGraphViewport', () => {
  it('fitView calls flowRef.fitView when available', () => {
    const fitViewMock = vi.fn()
    const flowRef = ref<any>({ fitView: fitViewMock })
    const displayNodes = ref<Node<KnowledgeNodeData[]>>([])
    const { fitView } = useGraphViewport(flowRef, displayNodes as any)

    fitView()
    expect(fitViewMock).toHaveBeenCalled()
  })

  it('fitView no-op when flowRef null', () => {
    const flowRef = ref<any>(null)
    const displayNodes = ref<Node<KnowledgeNodeData[]>>([])
    const { fitView } = useGraphViewport(flowRef, displayNodes as any)

    // Must not throw
    expect(() => fitView()).not.toThrow()
  })

  it('flyToNode calls flowRef.setCenter', () => {
    const setCenterMock = vi.fn()
    const flowRef = ref<any>({ setCenter: setCenterMock })
    const displayNodes = ref<Node<KnowledgeNodeData[]>>([makeNode('X', { x: 100, y: 50 })])
    const { flyToNode } = useGraphViewport(flowRef, displayNodes as any)

    flyToNode('X')
    expect(setCenterMock).toHaveBeenCalled()
    // First arg should be node.position.x + 75 (per existing KnowledgeGraph.vue flyToNode offset)
    expect(setCenterMock.mock.calls[0][0]).toBe(175)
    // Second arg should be node.position.y + 20
    expect(setCenterMock.mock.calls[0][1]).toBe(70)
  })

  it('flyToNode no-op when topic not found', () => {
    const setCenterMock = vi.fn()
    const flowRef = ref<any>({ setCenter: setCenterMock })
    const displayNodes = ref<Node<KnowledgeNodeData[]>>([makeNode('X')])
    const { flyToNode } = useGraphViewport(flowRef, displayNodes as any)

    flyToNode('nonexistent')
    expect(setCenterMock).not.toHaveBeenCalled()
  })

  it('onMove updates zoomLevel and viewportPos', () => {
    const flowRef = ref<any>(null)
    const displayNodes = ref<Node<KnowledgeNodeData[]>>([])
    const { onMove, zoomLevel, viewportPos } = useGraphViewport(flowRef, displayNodes as any)

    onMove({ event: {}, flowTransform: { x: 10, y: 20, zoom: 0.8 } })

    expect(zoomLevel.value).toBe(0.8)
    expect(viewportPos.x).toBe(10)
    expect(viewportPos.y).toBe(20)
  })
})
