import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import KnowledgeGraph from '@/components/knowledge/KnowledgeGraph.vue'

const mockNodes = [
  {
    id: 'topic-sql-basics',
    type: 'knowledge-node',
    position: { x: 0, y: 100 },
    data: {
      topicId: 'sql-basics',
      label: 'SQL 基础查询',
      difficulty: 1,
      description: '基础 SELECT',
      prerequisites: [],
      nextTopics: ['filtering'],
      status: 'mastered'
    }
  },
  {
    id: 'topic-filtering',
    type: 'knowledge-node',
    position: { x: 200, y: 100 },
    data: {
      topicId: 'filtering',
      label: '条件过滤',
      difficulty: 1,
      description: 'WHERE 过滤',
      prerequisites: ['sql-basics'],
      nextTopics: ['sorting'],
      status: 'in-progress'
    }
  },
  {
    id: 'topic-joins',
    type: 'knowledge-node',
    position: { x: 400, y: 100 },
    data: {
      topicId: 'joins',
      label: 'JOIN 查询',
      difficulty: 2,
      description: '连接查询',
      prerequisites: ['sql-basics'],
      nextTopics: ['subqueries'],
      status: 'unlearned'
    }
  }
]

const mockEdges = [
  {
    id: 'edge-sql-basics-filtering',
    source: 'topic-sql-basics',
    target: 'topic-filtering',
    type: 'smoothstep',
    style: { stroke: '#94a3b8', strokeWidth: 1.5 }
  },
  {
    id: 'edge-sql-basics-joins',
    source: 'topic-sql-basics',
    target: 'topic-joins',
    type: 'smoothstep',
    style: { stroke: '#94a3b8', strokeWidth: 1.5 }
  }
]

const stubs = {
  VueFlow: { template: '<div class="vue-flow-stub"><slot /></div>' },
  Background: true,
  MiniMap: true,
  KnowledgeNode: true,
  KnowledgeDetail: true,
  ErSearchBar: true
}

describe('KnowledgeGraph', () => {
  it('shows empty state when no nodes', () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: [], edges: [], searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })
    expect(wrapper.text()).toContain('暂无知识图谱数据')
  })

  it('renders VueFlow area when nodes exist', () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })
    expect(wrapper.text()).not.toContain('暂无知识图谱数据')
  })

  it('renders ErSearchBar component', () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })
    expect(wrapper.findComponent({ name: 'ErSearchBar' }).exists()).toBe(true)
  })

  // ── Edge opacity (Task 1) ──────────────────────────────────

  it('默认所有边 opacity 为 0.12 (at zoom 0.8, compact tier)', () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    const edges = wrapper.vm.getStyledEdges() as any[]
    for (const edge of edges) {
      expect(Number(edge.style.opacity)).toBe(0.12)
      expect(edge.style.stroke).toBe('#cbd5e1')
      expect(edge.style.strokeWidth).toBe(1)
      expect(edge.style.strokeDasharray).toBe('3 6')
    }
  })

  it('hover 节点时关联边高亮 (opacity 1, solid, no dash)', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    await wrapper.vm.setHoveredNode('sql-basics')
    await wrapper.vm.$nextTick()

    const edges = wrapper.vm.getStyledEdges() as any[]
    const connectedEdges = edges.filter((e: any) => Number(e.style.opacity) === 1)
    expect(connectedEdges.length).toBe(1) // 仅 successor 边高亮，直连边已移除
    for (const edge of connectedEdges) {
      expect(edge.style.strokeDasharray).toBe('none')
    }
  })

  it('hover 节点时非关联边保持 zoom-tiered opacity (not hidden)', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    // When hovering 'filtering', edge-sql-basics-filtering is connected (target=filtering),
    // but edge-sql-basics-joins is not — it should stay at zoom-tiered opacity, not 0
    await wrapper.vm.setHoveredNode('filtering')
    await wrapper.vm.$nextTick()

    const edges = wrapper.vm.getStyledEdges() as any[]
    const connected = edges.filter((e: any) => Number(e.style.opacity) === 1)
    const dimmed = edges.filter((e: any) => Number(e.style.opacity) < 1)

    expect(connected.length).toBe(1) // edge-sql-basics-filtering is connected
    expect(dimmed.length).toBe(1) // edge-sql-basics-joins is not connected
    expect(Number(dimmed[0].style.opacity)).toBe(0.12) // stays at zoom-tiered, not 0
  })

  it('hover 节点时关联节点 highlighted，无关节点 dimmed (opacity 0.12)', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    await wrapper.vm.setHoveredNode('sql-basics')
    await wrapper.vm.$nextTick()

    const nodes = wrapper.vm.getStyledNodes() as any[]

    // focused node (sql-basics)
    const basicsNode = nodes.find((n: any) => n.id === 'topic-sql-basics')
    expect(basicsNode).toBeDefined()
    expect(basicsNode.data.isFocused).toBe(true)

    // highlighted nodes (filtering, joins — connected to sql-basics)
    const filteringNode = nodes.find((n: any) => n.id === 'topic-filtering')
    expect(filteringNode.data.isHighlighted).toBe(true)

    const joinsNode = nodes.find((n: any) => n.id === 'topic-joins')
    expect(joinsNode.data.isHighlighted).toBe(true)

    // No dimmed nodes — all nodes connected to sql-basics
    const dimmedNodes = nodes.filter((n: any) => n.data.isDimmed)
    expect(dimmedNodes.length).toBe(0)
  })

  it('移开鼠标后所有节点恢复默认样式', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    await wrapper.vm.setHoveredNode('sql-basics')
    await wrapper.vm.$nextTick()
    await wrapper.vm.clearHoveredNode()
    await wrapper.vm.$nextTick()

    const nodes = wrapper.vm.getStyledNodes() as any[]
    for (const node of nodes) {
      expect(Number(node.style.opacity)).toBe(1)
      expect(node.data.isFocused).toBeFalsy()
      expect(node.data.isDimmed).toBeFalsy()
      expect(node.data.isHighlighted).toBeFalsy()
    }
  })

  it('双击画布重置 hover 状态', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    await wrapper.vm.setHoveredNode('sql-basics')
    await wrapper.vm.$nextTick()
    await wrapper.vm.resetHoverState()
    await wrapper.vm.$nextTick()

    const nodes = wrapper.vm.getStyledNodes() as any[]
    for (const node of nodes) {
      expect(Number(node.style.opacity)).toBe(1)
    }
  })

  // ── Search behavior (Task 2) ───────────────────────────────

  it('默认 showSearch 为 false', () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })
    expect(wrapper.vm.showSearch).toBe(false)
  })

  it('Ctrl+F 触发后 showSearch 变为 true', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.showSearch).toBe(true)
  })

  it('Ctrl+0 重置视图（关闭已打开的搜索框，与双击行为一致）', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    // Open search first via Ctrl+F (proves baseline state)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.showSearch).toBe(true)

    // Ctrl+0 should invoke onPaneDblClick which closes search
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.showSearch).toBe(false)
  })

  it('Ctrl+0 在 input focus 时不拦截（与 Ctrl+F 相同守卫）', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    // Open search first from non-input context
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.showSearch).toBe(true)

    // Dispatch Ctrl+0 from within an input — guard should ignore it
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.showSearch).toBe(true) // Still open — Ctrl+0 was ignored
    document.body.removeChild(input)
  })

  it('Escape 关闭搜索框并清空搜索词', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    wrapper.vm.showSearch = true
    wrapper.vm.searchQuery = 'SQL'
    await wrapper.vm.$nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.showSearch).toBe(false)
    expect(wrapper.vm.searchQuery).toBe('')
  })

  it('搜索匹配的节点有 isSearchMatch 标记', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    wrapper.vm.searchQuery = 'SQL 基础'
    await wrapper.vm.$nextTick()

    const nodes = wrapper.vm.getStyledNodes() as any[]
    const matchingNode = nodes.find((n: any) => n.data.isSearchMatch)
    expect(matchingNode).toBeDefined()
    expect(matchingNode!.data.label).toContain('SQL 基础查询')
  })

  it('搜索匹配 active 节点有 isActiveMatch 标记', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    wrapper.vm.searchQuery = '条件'
    await wrapper.vm.$nextTick()

    const nodes = wrapper.vm.getStyledNodes() as any[]
    const activeNode = nodes.find((n: any) => n.data.isActiveMatch)
    expect(activeNode).toBeDefined()
    expect(activeNode!.data.isSearchMatch).toBe(true)
  })

  it('matchCount 反映搜索匹配节点数量', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    wrapper.vm.searchQuery = 'SQL'
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.matchCount).toBe(1) // only "SQL 基础查询" label

    wrapper.vm.searchQuery = '查询'
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.matchCount).toBe(2) // "SQL 基础查询" + "JOIN 查询" label
  })

  it('搜索词清空后 matchCount 为 0', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    wrapper.vm.searchQuery = 'SQL'
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.matchCount).toBeGreaterThan(0)

    wrapper.vm.searchQuery = ''
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.matchCount).toBe(0)
  })

  it('navigateMatch 循环切换匹配节点', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    wrapper.vm.searchQuery = '查'
    await wrapper.vm.$nextTick()
    const initialCount = wrapper.vm.matchCount
    expect(initialCount).toBeGreaterThanOrEqual(2)

    expect(wrapper.vm.currentIndex).toBe(0)
    wrapper.vm.navigateMatch(1)
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.currentIndex).toBe(1)

    // Wrap around
    wrapper.vm.navigateMatch(1)
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.currentIndex).toBe(2 % initialCount)
  })

  // ── MiniMap ─────────────────────────────────────────────────

  it('MiniMap 组件已渲染', () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })
    expect(wrapper.findComponent({ name: 'MiniMap' }).exists()).toBe(true)
  })

  it('miniMapNodeColor 返回默认颜色 #94a3b8', () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })
    expect((wrapper.vm as any).miniMapNodeColor?.({ id: 'topic-sql-basics' })).toBe('#94a3b8')
  })

  // ── SparkBurst / UnlockGlow (Phase 05-03) ────────────────────

  it('triggerSparkBurst sets node.data.triggerSparkBurst', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    // Reset displayNodes data to simulate real state
    wrapper.vm.triggerSparkBurst('sql-basics')
    await wrapper.vm.$nextTick()

    const nodes = wrapper.vm.getStyledNodes() as any[]
    const basicsNode = nodes.find((n: any) => n.data.topicId === 'sql-basics')
    expect(basicsNode.data.triggerSparkBurst).toBe(true)
  })

  it('triggerSparkBurst auto-resets after 700ms', async () => {
    vi.useFakeTimers()
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    wrapper.vm.triggerSparkBurst('sql-basics')
    await wrapper.vm.$nextTick()

    let nodes = wrapper.vm.getStyledNodes() as any[]
    expect(nodes.find((n: any) => n.data.topicId === 'sql-basics').data.triggerSparkBurst).toBe(true)

    vi.advanceTimersByTime(700)
    await wrapper.vm.$nextTick()

    nodes = wrapper.vm.getStyledNodes() as any[]
    expect(nodes.find((n: any) => n.data.topicId === 'sql-basics').data.triggerSparkBurst).toBe(false)
    vi.useRealTimers()
  })

  it('triggerUnlockGlow sets triggerUnlockGlow on nextTopics nodes', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    wrapper.vm.triggerUnlockGlow('sql-basics')
    await wrapper.vm.$nextTick()

    const nodes = wrapper.vm.getStyledNodes() as any[]
    const filteringNode = nodes.find((n: any) => n.data.topicId === 'filtering')
    // filtering is a nextTopic of sql-basics
    expect(filteringNode.data.triggerUnlockGlow).toBe(true)
  })

  it('triggerUnlockGlow auto-resets after 800ms', async () => {
    vi.useFakeTimers()
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    wrapper.vm.triggerUnlockGlow('sql-basics')
    await wrapper.vm.$nextTick()

    let nodes = wrapper.vm.getStyledNodes() as any[]
    expect(nodes.find((n: any) => n.data.topicId === 'filtering').data.triggerUnlockGlow).toBe(true)

    vi.advanceTimersByTime(800)
    await wrapper.vm.$nextTick()

    nodes = wrapper.vm.getStyledNodes() as any[]
    expect(nodes.find((n: any) => n.data.topicId === 'filtering').data.triggerUnlockGlow).toBe(false)
    vi.useRealTimers()
  })

  // ── CR-01 styledEdges cache invalidation (D-02) ──────────────

  it('styledEdges reflects updated props.edges after nextTick (no stale cache)', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    // Initial: 2 edges
    expect(wrapper.vm.getStyledEdges()).toHaveLength(2)

    // Filter to 1 edge — styledEdges should reflect new edge set within nextTick
    await wrapper.setProps({ edges: [mockEdges[0]] })
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.getStyledEdges()).toHaveLength(1)
  })

  it('styledEdges updates on hoveredNodeId change', async () => {
    const wrapper = mount(KnowledgeGraph, {
      props: { nodes: mockNodes, edges: mockEdges, searchQuery: '', selectedTopic: null, masteredTopics: [] },
      global: { stubs }
    })

    // No hover initially — no highlighted (opacity=1) edges
    const initialEdges = wrapper.vm.getStyledEdges() as any[]
    const initialHighlighted = initialEdges.filter((e: any) => Number(e.style.opacity) === 1)
    expect(initialHighlighted.length).toBe(0)

    // Hover sql-basics — successor edge (sql-basics → filtering) should highlight
    await wrapper.vm.setHoveredNode('sql-basics')
    await wrapper.vm.$nextTick()

    const edges = wrapper.vm.getStyledEdges() as any[]
    const highlighted = edges.filter((e: any) => Number(e.style.opacity) === 1)
    expect(highlighted.length).toBe(1)
    expect(highlighted[0].style.stroke).toBe('#3b82f6') // successor highlight color
  })
})
