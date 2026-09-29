import dagre from 'dagre'

export interface DagreLayoutOptions {
    rankdir?: 'LR' | 'TB' | 'RL' | 'BT'
    ranksep?: number
    nodesep?: number
    marginx?: number
    marginy?: number
}

export function layoutNodes<TNode extends { id: string; position: { x: number; y: number } }>(
    nodes: TNode[],
    edges: { source: string; target: string }[],
    containerEl?: HTMLElement | null,
    options?: DagreLayoutOptions
): TNode[] {
    const g = new dagre.graphlib.Graph()
    g.setGraph({
        rankdir: options?.rankdir ?? 'TB',
        ranksep: options?.ranksep ?? 120,
        nodesep: options?.nodesep ?? 80,
        marginx: options?.marginx ?? 60,
        marginy: options?.marginy ?? 60
    })
    g.setDefaultEdgeLabel(() => ({}))

    const elMap = new Map<string, HTMLElement>()
    const root = containerEl || document
    root.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => {
        if (el.dataset.id) elMap.set(el.dataset.id, el)
    })

    for (const node of nodes) {
        const el = elMap.get(node.id)
        const w = el?.offsetWidth || 200
        const h = el?.offsetHeight || 120
        g.setNode(node.id, { width: w, height: h })
    }

    for (const edge of edges) {
        g.setEdge(edge.source, edge.target)
    }

    dagre.layout(g)

    return nodes.map((node) => {
        const pos = g.node(node.id)
        if (!pos) return node
        return {
            ...node,
            position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 }
        } as TNode
    })
}
