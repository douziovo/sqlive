import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, shallowRef } from 'vue'

import type { KnowledgeNode } from '@/composables/useKnowledgeGraph'

const { layoutMock } = vi.hoisted(() => ({ layoutMock: vi.fn() }))
vi.mock('@/composables/useDagreLayout', () => ({
    //noinspection JSUnusedGlobalSymbols -- 供被 mock 的 useGraphLayoutManager 内部 import { layoutNodes } 使用，本文件内无需直接引用
    layoutNodes: (...args: unknown[]) => layoutMock(...args)
}))

import { useGraphLayoutManager } from '@/components/knowledge/graph/useGraphLayoutManager'

function makeNode(id: string): KnowledgeNode {
    return {
        id,
        position: { x: 0, y: 0 },
        data: {
            topicId: id,
            //noinspection JSDeprecatedSymbols -- KnowledgeNodeData.label 是必填业务字段，非 @vue-flow/core 顶层 Node.label 的 deprecated 别名
            label: id,
            difficulty: 1,
            description: '',
            prerequisites: [],
            nextTopics: [],
            status: 'unlearned'
        }
    }
}

describe('useGraphLayoutManager', () => {
    let scope: ReturnType<typeof effectScope>

    beforeEach(() => {
        layoutMock.mockReset()
        layoutMock.mockImplementation((nodes: unknown[]) => nodes)
    })

    afterEach(() => {
        scope.stop()
        localStorage.clear()
    })

    function setup(nodes: KnowledgeNode[] = []) {
        const nodesRef = shallowRef(nodes)
        const displayNodes = shallowRef<KnowledgeNode[]>([])
        const setViewport = vi.fn()
        const flowRef = ref<any>({
            $el: document.createElement('div'),
            setViewport
        })
        const edges = ref<any[]>([])
        scope = effectScope()
        let manager: ReturnType<typeof useGraphLayoutManager> | undefined
        scope.run(() => {
            manager = useGraphLayoutManager({
                flowRef: flowRef as any,
                displayNodes: displayNodes as any,
                nodesGetter: () => nodesRef.value,
                edgesGetter: () => edges.value
            })
        })
        return { nodesRef, displayNodes, flowRef, edges, setViewport, manager: manager! }
    }

    it('syncs displayNodes from the nodes getter and runs the TB layout', async () => {
        const { nodesRef, displayNodes } = setup()
        nodesRef.value = [makeNode('a'), makeNode('b')]
        await nextTick()
        await nextTick()

        expect(displayNodes.value.map((n) => n.id)).toEqual(['a', 'b'])
        expect(layoutMock).toHaveBeenCalledTimes(1)
        expect(layoutMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.any(HTMLElement),
            expect.objectContaining({
                rankdir: 'TB',
                ranksep: 120,
                nodesep: 80,
                marginx: 60,
                marginy: 60
            })
        )
    })

    it('skips layout when nodes become empty but still syncs displayNodes', async () => {
        const { nodesRef, displayNodes } = setup()
        nodesRef.value = [makeNode('a')]
        await nextTick()
        await nextTick()
        expect(layoutMock).toHaveBeenCalledTimes(1)

        nodesRef.value = []
        await nextTick()
        await nextTick()
        expect(displayNodes.value).toEqual([])
        expect(layoutMock).toHaveBeenCalledTimes(1)
    })

    it('handles a missing flow element during node watch', async () => {
        const { nodesRef, flowRef } = setup()
        flowRef.value = null
        nodesRef.value = [makeNode('a'), makeNode('b')]
        await nextTick()
        await nextTick()
        // layoutNodes is still called, with el undefined
        expect(layoutMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            undefined,
            expect.anything()
        )
    })

    it('onPaneReady lays out and restores the saved viewport', async () => {
        const saved = { x: 11, y: 22, zoom: 1.5 }
        localStorage.setItem('kg-viewport', JSON.stringify(saved))
        const { displayNodes, setViewport, manager } = setup([makeNode('a')])
        await nextTick()
        displayNodes.value = [makeNode('a'), makeNode('b')]

        await manager.onPaneReady()
        expect(layoutMock).toHaveBeenCalledWith(
            [makeNode('a'), makeNode('b')],
            [],
            expect.any(HTMLElement),
            expect.objectContaining({ rankdir: 'TB' })
        )
        expect(setViewport).toHaveBeenCalledWith(saved, { duration: 0 })
    })

    it('onPaneReady does not restore viewport when nothing is saved', async () => {
        const { setViewport, manager } = setup([makeNode('a')])
        await manager.onPaneReady()
        expect(setViewport).not.toHaveBeenCalled()
    })

    it('onPaneReady swallows corrupted saved viewport JSON', async () => {
        localStorage.setItem('kg-viewport', '{not json')
        const { setViewport, manager } = setup([makeNode('a')])
        await expect(manager.onPaneReady()).resolves.toBeUndefined()
        expect(setViewport).not.toHaveBeenCalled()
    })

    it('onPaneReady tolerates a flow ref without setViewport', async () => {
        localStorage.setItem('kg-viewport', JSON.stringify({ x: 0, y: 0, zoom: 1 }))
        const { flowRef, manager } = setup([makeNode('a')])
        delete (flowRef.value as any).setViewport
        await expect(manager.onPaneReady()).resolves.toBeUndefined()
    })
})
