import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref, shallowRef } from 'vue'
import type { KnowledgeNode } from '@/composables/useKnowledgeGraph'
import { useGraphViewport } from '@/composables/useGraphViewport'

// ── Test fixtures ──────────────────────────────────────────────

function makeNode(
    topicId: string,
    position: { x: number; y: number } = { x: 0, y: 0 }
): KnowledgeNode {
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
    it('debounces persistence and cancels pending timers when its scope stops', () => {
        vi.useFakeTimers()
        const scope = effectScope()
        const storage = vi.spyOn(Storage.prototype, 'setItem')
        try {
            const viewport = scope.run(() => useGraphViewport(ref(null), ref([])))!
            viewport.onMove({ event: null, flowTransform: { x: 1, y: 2, zoom: 1 } })
            vi.advanceTimersByTime(100)
            viewport.onMove({ event: null, flowTransform: { x: 3, y: 4, zoom: 2 } })
            vi.advanceTimersByTime(150)
            expect(viewport.isSettling.value).toBe(false)
            expect(storage).not.toHaveBeenCalled()
            vi.advanceTimersByTime(150)
            expect(storage).toHaveBeenCalledExactlyOnceWith(
                'kg-viewport',
                JSON.stringify({ x: 3, y: 4, zoom: 2 })
            )
            viewport.onMove({ event: null, flowTransform: { x: 5, y: 6, zoom: 3 } })
            scope.stop()
            vi.advanceTimersByTime(500)
            expect(storage).toHaveBeenCalledTimes(1)
        } finally {
            scope.stop()
            storage.mockRestore()
            vi.useRealTimers()
        }
    })

    it('fitView calls flowRef.fitView when available', () => {
        const fitViewMock = vi.fn()
        const flowRef = ref<any>({ fitView: fitViewMock })
        const displayNodes = shallowRef<KnowledgeNode[]>([])
        const { fitView } = useGraphViewport(flowRef, displayNodes)

        fitView()
        expect(fitViewMock).toHaveBeenCalled()
    })

    it('fitView no-op when flowRef null', () => {
        const flowRef = ref<any>(null)
        const displayNodes = shallowRef<KnowledgeNode[]>([])
        const { fitView } = useGraphViewport(flowRef, displayNodes)

        // Must not throw
        expect(() => fitView()).not.toThrow()
    })

    it('flyToNode calls flowRef.setCenter', () => {
        const setCenterMock = vi.fn()
        const flowRef = ref<any>({ setCenter: setCenterMock })
        const displayNodes = shallowRef<KnowledgeNode[]>([makeNode('X', { x: 100, y: 50 })])
        const { flyToNode } = useGraphViewport(flowRef, displayNodes)

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
        const displayNodes = shallowRef<KnowledgeNode[]>([makeNode('X')])
        const { flyToNode } = useGraphViewport(flowRef, displayNodes)

        flyToNode('nonexistent')
        expect(setCenterMock).not.toHaveBeenCalled()
    })

    it('onMove updates zoomLevel and viewportPos', () => {
        const flowRef = ref<any>(null)
        const displayNodes = shallowRef<KnowledgeNode[]>([])
        const { onMove, zoomLevel, viewportPos } = useGraphViewport(flowRef, displayNodes)

        onMove({ event: {}, flowTransform: { x: 10, y: 20, zoom: 0.8 } })

        expect(zoomLevel.value).toBe(0.8)
        expect(viewportPos.x).toBe(10)
        expect(viewportPos.y).toBe(20)
    })

    // ── IN-08 (D-19): NODE_HALF_W/H constants extracted ──

    it('IN-08 focusNode centers on node.position + 60/30 via constants', () => {
        const setCenterMock = vi.fn()
        const flowRef = ref<any>({ setCenter: setCenterMock })
        const displayNodes = shallowRef<KnowledgeNode[]>([makeNode('X', { x: 100, y: 50 })])
        const { focusNode } = useGraphViewport(flowRef, displayNodes)

        focusNode('X')
        expect(setCenterMock).toHaveBeenCalled()
        // node.position.x + NODE_HALF_W (60) = 160
        expect(setCenterMock.mock.calls[0][0]).toBe(160)
        // node.position.y + NODE_HALF_H (30) = 80
        expect(setCenterMock.mock.calls[0][1]).toBe(80)
    })
})
