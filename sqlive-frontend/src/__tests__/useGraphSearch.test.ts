import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Node } from '@vue-flow/core'
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph'
import { useGraphSearch } from '@/composables/useGraphSearch'

// ── Test fixtures ──────────────────────────────────────────────

function makeNode(topicId: string, label: string, description = ''): Node<KnowledgeNodeData> {
  return {
    id: `topic-${topicId}`,
    type: 'knowledge-node',
    position: { x: 0, y: 0 },
    data: {
      topicId,
      label,
      description,
      difficulty: 1,
      prerequisites: [],
      nextTopics: [],
      category: 'query',
      status: 'unlearned'
    }
  }
}

function makeFakeEvent(
  overrides: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; target: HTMLElement }>
): KeyboardEvent {
  return {
    key: 'f',
    ctrlKey: false,
    metaKey: false,
    target: { tagName: 'DIV' } as HTMLElement,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides
  } as unknown as KeyboardEvent
}

// ── Tests ──────────────────────────────────────────────────────

describe('useGraphSearch', () => {
  it('matchNodes filters by label or description case-insensitive', async () => {
    const flowRef = ref<any>(null)
    const displayNodes = ref<Node<KnowledgeNodeData[]>>([
      makeNode('joins', 'Joins', '连接查询'),
      makeNode('cte', 'CTE', '公共表表达式')
    ])
    const { searchQuery, matchNodes } = useGraphSearch(flowRef, displayNodes as any)

    searchQuery.value = 'join'
    await nextTick()

    expect(matchNodes.value.length).toBe(1)
    expect(matchNodes.value[0].data.topicId).toBe('joins')
  })

  it('navigateMatch cycles index', async () => {
    const flowRef = ref<any>(null)
    const displayNodes = ref<Node<KnowledgeNodeData[]>>([
      makeNode('a', 'SQL A'),
      makeNode('b', 'SQL B'),
      makeNode('c', 'SQL C')
    ])
    const { searchQuery, currentIndex, navigateMatch } = useGraphSearch(flowRef, displayNodes as any)

    searchQuery.value = 'sql'
    await nextTick()

    expect(currentIndex.value).toBe(0)
    navigateMatch(1)
    expect(currentIndex.value).toBe(1)
    navigateMatch(1)
    expect(currentIndex.value).toBe(2)
    // Wrap around to 0
    navigateMatch(1)
    expect(currentIndex.value).toBe(0)
  })

  it('onGlobalKeydown Ctrl+F opens search', () => {
    const flowRef = ref<any>({ getViewport: () => ({ x: 0, y: 0, zoom: 1 }) })
    const displayNodes = ref<Node<KnowledgeNodeData[]>>([])
    const { showSearch, onGlobalKeydown } = useGraphSearch(flowRef, displayNodes as any)

    expect(showSearch.value).toBe(false)
    onGlobalKeydown(makeFakeEvent({ key: 'f', ctrlKey: true }))
    expect(showSearch.value).toBe(true)
  })

  it('onGlobalKeydown Ctrl+0 calls onResetView', () => {
    const onResetView = vi.fn()
    const flowRef = ref<any>(null)
    const displayNodes = ref<Node<KnowledgeNodeData[]>>([])
    const { onGlobalKeydown } = useGraphSearch(flowRef, displayNodes as any, { onResetView })

    onGlobalKeydown(makeFakeEvent({ key: '0', ctrlKey: true }))
    expect(onResetView).toHaveBeenCalled()
  })

  it('onGlobalKeydown ignores when focus in input', () => {
    const flowRef = ref<any>(null)
    const displayNodes = ref<Node<KnowledgeNodeData[]>>([])
    const { showSearch, onGlobalKeydown } = useGraphSearch(flowRef, displayNodes as any)

    expect(showSearch.value).toBe(false)
    // target is an input — guard should bail
    onGlobalKeydown(makeFakeEvent({
      key: 'f',
      ctrlKey: true,
      target: { tagName: 'INPUT' } as HTMLElement
    }))
    expect(showSearch.value).toBe(false)
  })

  it('Escape closes search and clears query', () => {
    const flowRef = ref<any>(null)
    const displayNodes = ref<Node<KnowledgeNodeData[]>>([])
    const { showSearch, searchQuery, onGlobalKeydown } = useGraphSearch(flowRef, displayNodes as any)

    showSearch.value = true
    searchQuery.value = 'SQL'
    onGlobalKeydown(makeFakeEvent({ key: 'Escape' }))
    expect(showSearch.value).toBe(false)
    expect(searchQuery.value).toBe('')
  })
})
