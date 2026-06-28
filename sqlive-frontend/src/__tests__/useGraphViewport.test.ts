import {describe, expect, it, vi} from 'vitest'
import {ref} from 'vue'
import type {Node} from '@vue-flow/core'
import type {KnowledgeNodeData} from '@/composables/useKnowledgeGraph'
import {useGraphViewport} from '@/composables/useGraphViewport'

// ── Test fixtures ──────────────────────────────────────────────

function makeNode(topicId: string, position: { x: number; y: number } = {x: 0, y: 0}): Node<KnowledgeNodeData> {
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
        const flowRef = ref<any>({fitView: fitViewMock})
        const displayNodes = ref<Node<KnowledgeNodeData[]>>([])
        const {fitView} = useGraphViewport(flowRef, displayNodes as any)

        fitView()
        expect(fitViewMock).toHaveBeenCalled()
    })

    it('fitView no-op when flowRef null', () => {
        const flowRef = ref<any>(null)
        const displayNodes = ref<Node<KnowledgeNodeData[]>>([])
        const {fitView} = useGraphViewport(flowRef, displayNodes as any)

        // Must not throw
        expect(() => fitView()).not.toThrow()
    })

    it('flyToNode calls flowRef.setCenter', () => {
        const setCenterMock = vi.fn()
        const flowRef = ref<any>({setCenter: setCenterMock})
        const displayNodes = ref<Node<KnowledgeNodeData[]>>([makeNode('X', {x: 100, y: 50})])
        const {flyToNode} = useGraphViewport(flowRef, displayNodes as any)

        flyToNode('X')
        expect(setCenterMock).toHaveBeenCalled()
        // First arg should be node.position.x + 75 (per existing KnowledgeGraph.vue flyToNode offset)
        expect(setCenterMock.mock.calls[0][0]).toBe(175)
        // Second arg should be node.position.y + 20
        expect(setCenterMock.mock.calls[0][1]).toBe(70)
    })

    it('flyToNode no-op when topic not found', () => {
        const setCenterMock = vi.fn()
        const flowRef = ref<any>({setCenter: setCenterMock})
        const displayNodes = ref<Node<KnowledgeNodeData[]>>([makeNode('X')])
        const {flyToNode} = useGraphViewport(flowRef, displayNodes as any)

        flyToNode('nonexistent')
        expect(setCenterMock).not.toHaveBeenCalled()
    })

    it('onMove updates zoomLevel and viewportPos', () => {
        const flowRef = ref<any>(null)
        const displayNodes = ref<Node<KnowledgeNodeData[]>>([])
        const {onMove, zoomLevel, viewportPos} = useGraphViewport(flowRef, displayNodes as any)

        onMove({event: {}, flowTransform: {x: 10, y: 20, zoom: 0.8}})

        expect(zoomLevel.value).toBe(0.8)
        expect(viewportPos.x).toBe(10)
        expect(viewportPos.y).toBe(20)
    })

    // ── IN-08 (D-19): NODE_HALF_W/H constants extracted ──

    it('IN-08 focusNode uses NODE_HALF_W/H constants (60/30) for centering', () => {
        // Structural regression guard: verifies constants are named and used in focusNode.
        // If NODE_HALF_W is renamed or focusNode reverts to magic number, this fails.
        const fs = require('fs')
        const source = fs.readFileSync('src/composables/useGraphViewport.ts', 'utf-8')
        expect(source).toContain('NODE_HALF_W = 60')
        expect(source).toContain('NODE_HALF_H = 30')
        expect(source).toContain('node.position.x + NODE_HALF_W')
        expect(source).toContain('node.position.y + NODE_HALF_H')
    })

    it('IN-08 focusNode centers on node.position + 60/30 via constants', () => {
        const setCenterMock = vi.fn()
        const flowRef = ref<any>({setCenter: setCenterMock})
        const displayNodes = ref<Node<KnowledgeNodeData[]>>([makeNode('X', {x: 100, y: 50})])
        const {focusNode} = useGraphViewport(flowRef, displayNodes as any)

        focusNode('X')
        expect(setCenterMock).toHaveBeenCalled()
        // node.position.x + NODE_HALF_W (60) = 160
        expect(setCenterMock.mock.calls[0][0]).toBe(160)
        // node.position.y + NODE_HALF_H (30) = 80
        expect(setCenterMock.mock.calls[0][1]).toBe(80)
    })
})
