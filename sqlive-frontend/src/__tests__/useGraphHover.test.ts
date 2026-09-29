import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import type { Edge } from '@vue-flow/core'
import type { KnowledgeNode, KnowledgeNodeData } from '@/composables/useKnowledgeGraph'
import { useGraphHover } from '@/composables/useGraphHover'

// ── Test fixtures ──────────────────────────────────────────────

function makeNode(topicId: string, overrides: Partial<KnowledgeNodeData> = {}): KnowledgeNode {
    return {
        id: `topic-${topicId}`,
        type: 'knowledge-node',
        position: { x: 0, y: 0 },
        data: {
            topicId,
            label: topicId.toUpperCase(),
            difficulty: 1,
            description: '',
            prerequisites: [],
            nextTopics: [],
            category: 'query',
            status: 'unlearned',
            ...overrides
        }
    }
}

// ── Tests ──────────────────────────────────────────────────────

describe('useGraphHover', () => {
    it('adjacencyMap builds bidirectional links from edges', () => {
        const nodes = shallowRef<KnowledgeNode[]>([makeNode('a'), makeNode('b')])
        const edges: Edge[] = [{ id: 'e1', source: 'topic-a', target: 'topic-b' }]
        const { adjacencyMap } = useGraphHover(() => edges, nodes)

        expect(adjacencyMap.value.get('a')).toEqual(new Set(['b']))
        expect(adjacencyMap.value.get('b')).toEqual(new Set(['a']))
    })

    it('immediatePredecessors returns top-2 by weight', () => {
        // Target has 3 prerequisites; topKneighbors k=2 must trim to 2 results
        const nodes = shallowRef<KnowledgeNode[]>([
            makeNode('target', { prerequisites: ['p1', 'p2', 'p3'], nextTopics: [] }),
            makeNode('p1', { prerequisites: [], nextTopics: ['target'] }),
            makeNode('p2', { prerequisites: [], nextTopics: ['target'] }),
            makeNode('p3', { prerequisites: [], nextTopics: ['target'] })
        ])
        const edges: Edge[] = [
            { id: 'e1', source: 'topic-p1', target: 'topic-target' },
            { id: 'e2', source: 'topic-p2', target: 'topic-target' },
            { id: 'e3', source: 'topic-p3', target: 'topic-target' }
        ]
        const { immediatePredecessors } = useGraphHover(() => edges, nodes)

        const result = immediatePredecessors('target')
        expect(result.size).toBe(2)
    })

    it('setHoveredNode/clearHoveredNode changes hoveredNodeId', () => {
        const nodes = shallowRef<KnowledgeNode[]>([makeNode('joins')])
        const { hoveredNodeId, setHoveredNode, clearHoveredNode } = useGraphHover(() => [], nodes)

        expect(hoveredNodeId.value).toBeNull()
        setHoveredNode('joins')
        expect(hoveredNodeId.value).toBe('joins')
        clearHoveredNode()
        expect(hoveredNodeId.value).toBeNull()
    })

    it('resetHoverState clears hoveredNodeId', () => {
        const nodes = shallowRef<KnowledgeNode[]>([makeNode('joins')])
        const { hoveredNodeId, setHoveredNode, resetHoverState } = useGraphHover(() => [], nodes)

        setHoveredNode('joins')
        expect(hoveredNodeId.value).toBe('joins')
        resetHoverState()
        expect(hoveredNodeId.value).toBeNull()
    })

    it('immediateSuccessors returns top-2 by weight from nextTopics', () => {
        const nodes = shallowRef<KnowledgeNode[]>([
            makeNode('root', { prerequisites: [], nextTopics: ['s1', 's2', 's3'] }),
            makeNode('s1', { prerequisites: ['root'], nextTopics: [] }),
            makeNode('s2', { prerequisites: ['root'], nextTopics: [] }),
            makeNode('s3', { prerequisites: ['root'], nextTopics: [] })
        ])
        const edges: Edge[] = [
            { id: 'e1', source: 'topic-root', target: 'topic-s1' },
            { id: 'e2', source: 'topic-root', target: 'topic-s2' },
            { id: 'e3', source: 'topic-root', target: 'topic-s3' }
        ]
        const { immediateSuccessors } = useGraphHover(() => edges, nodes)

        const result = immediateSuccessors('root')
        expect(result.size).toBe(2)
    })
})
