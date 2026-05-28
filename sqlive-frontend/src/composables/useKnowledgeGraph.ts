import type { Edge, Node } from '@vue-flow/core'
import { MarkerType } from '@vue-flow/core'
import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'
import { KNOWLEDGE_API_BASE } from '@/config'
import { layoutNodes } from './useDagreLayout'

export interface KnowledgeTopic {
  id: string
  label: string
  description: string
  keywords: string[]
  patterns: string[]
  difficulty: number
  prerequisites: string[]
  nextTopics: string[]
  category: string
}

export interface KnowledgeGraphData {
  topics: KnowledgeTopic[]
}

export interface KnowledgeNodeData {
  topicId: string
  label: string
  difficulty: number
  description: string
  prerequisites: string[]
  nextTopics: string[]
  status: 'mastered' | 'in-progress' | 'unlearned'
}

function getLevel(percentage: number): string {
  if (percentage < 30) return '初级学者'
  if (percentage < 70) return '进阶学者'
  return 'SQL 大师'
}

export function useKnowledgeGraph(opts?: { sqlSource?: () => string }) {
  const graphData = ref<KnowledgeGraphData | null>(null)
  const selectedNode = ref<string | null>(null)
  const masteredTopics = useLocalStorage<string[]>('ai-mastered-topics', [])

  const selectedNodeData = computed(() => {
    if (!selectedNode.value || !graphData.value) return null
    return graphData.value.topics.find((t) => t.id === selectedNode.value) || null
  })

  const progress = computed(() => {
    if (!graphData.value) return { count: 0, total: 0, percentage: 0, level: '初级学者' }
    const total = graphData.value.topics.length
    const mastered = new Set(masteredTopics.value)
    const count = graphData.value.topics.filter((t) => mastered.has(t.id)).length
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0
    return { count, total, percentage, level: getLevel(percentage) }
  })

  const inProgressTopics = computed(() => {
    const sql = opts?.sqlSource?.() ?? ''
    if (!sql || !graphData.value) return new Set<string>()
    const mastered = new Set(masteredTopics.value)
    const result = new Set<string>()

    for (const topic of graphData.value.topics) {
      if (mastered.has(topic.id)) continue

      const upperSql = sql.toUpperCase()
      const keywordMatch = (topic.keywords || []).some((kw) => upperSql.includes(kw.toUpperCase()))
      if (keywordMatch) {
        result.add(topic.id)
        continue
      }

      const patternMatch = (topic.patterns || []).some((pat) => {
        try {
          return new RegExp(pat, 'i').test(sql)
        } catch {
          return false
        }
      })
      if (patternMatch) {
        result.add(topic.id)
      }
    }

    return result
  })

  function getNodeStatus(topicId: string): 'mastered' | 'in-progress' | 'unlearned' {
    if (masteredTopics.value.includes(topicId)) return 'mastered'
    if (inProgressTopics.value.has(topicId)) return 'in-progress'
    return 'unlearned'
  }

  function topicToNode(topic: KnowledgeTopic): Node<KnowledgeNodeData> {
    return {
      id: `topic-${topic.id}`,
      type: 'knowledge-node',
      position: { x: 0, y: 0 },
      data: {
        topicId: topic.id,
        label: topic.label,
        difficulty: topic.difficulty,
        description: topic.description,
        prerequisites: topic.prerequisites,
        nextTopics: topic.nextTopics,
        status: getNodeStatus(topic.id)
      }
    }
  }

  function topicsToEdges(topics: KnowledgeTopic[]): Edge[] {
    const edges: Edge[] = []
    const topicIds = new Set(topics.map((t) => t.id))

    for (const topic of topics) {
      for (const nextId of topic.nextTopics) {
        if (topicIds.has(nextId)) {
          edges.push({
            id: `edge-${topic.id}-${nextId}`,
            type: 'smoothstep',
            source: `topic-${topic.id}`,
            target: `topic-${nextId}`,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            style: { stroke: '#94a3b8', strokeWidth: 1.5 }
          })
        }
      }
    }
    return edges
  }

  const nodes = computed<Node<KnowledgeNodeData>[]>(() => {
    if (!graphData.value) return []
    return graphData.value.topics.map((t) => topicToNode(t))
  })

  const edges = computed<Edge[]>(() => {
    if (!graphData.value) return []
    return topicsToEdges(graphData.value.topics)
  })

  async function fetchGraph(): Promise<void> {
    try {
      const resp = await fetch(`${KNOWLEDGE_API_BASE}/graph`)
      if (!resp.ok) return
      graphData.value = await resp.json()
    } catch {
      // Silently fail - non-critical feature
    }
  }

  function toggleMastered(topicId: string): void {
    const current = new Set(masteredTopics.value)
    if (current.has(topicId)) {
      current.delete(topicId)
    } else {
      current.add(topicId)
    }
    masteredTopics.value = [...current]
  }

  function focusNode(topicId: string): void {
    selectedNode.value = topicId
  }

  return {
    graphData,
    nodes,
    edges,
    selectedNode,
    selectedNodeData,
    masteredTopics,
    progress,
    inProgressTopics,
    getNodeStatus,
    fetchGraph,
    toggleMastered,
    focusNode
  }
}
