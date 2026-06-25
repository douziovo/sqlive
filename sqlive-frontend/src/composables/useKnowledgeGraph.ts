import type { Edge, Node } from '@vue-flow/core'
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
  category?: string
  status: 'mastered' | 'in-progress' | 'unlearned'
  /** @internal hover/focus state */
  isFocused?: boolean
  /** @internal hover state */
  isHighlighted?: boolean
  /** @internal hover state */
  isDimmed?: boolean
  /** @internal search state */
  isSearchMatch?: boolean
  /** @internal search active state */
  isActiveMatch?: boolean
  /** @internal path highlight state */
  isPathHighlighted?: boolean
  /** @internal gamification: trigger spark burst animation */
  triggerSparkBurst?: boolean
  /** @internal gamification: trigger unlock glow animation */
  triggerUnlockGlow?: boolean
}

export function useKnowledgeGraph(opts?: { sqlSource?: () => string }) {
  const graphData = ref<KnowledgeGraphData | null>(null)
  const selectedNode = ref<string | null>(null)
  const masteredTopics = useLocalStorage<string[]>('ai-mastered-topics', [])

  // ── XP/Level/Combo system (Phase 05-03) ──────────────────────

  const XP_PER_DIFFICULTY: Record<number, number> = { 1: 30, 2: 50, 3: 80 }
  const XP_PER_LEVEL = 750
  const LEVEL_NAMES = ['初级学者', '进阶学者', 'SQL 大师', '数据库传奇']

  const xpData = useLocalStorage('ai-knowledge-xp', {
    totalXp: 0,
    level: 0,
    streak: 0,
    masteredLog: [] as string[]
  })

  const sessionStreak = ref(0)
  const levelUpTriggered = ref(false)

  function xpForDifficulty(difficulty: number): number {
    return XP_PER_DIFFICULTY[difficulty] ?? 30
  }

  // ── Selected node ────────────────────────────────────────────

  const selectedNodeData = computed(() => {
    if (!selectedNode.value || !graphData.value) return null
    return graphData.value.topics.find((t) => t.id === selectedNode.value) || null
  })

  const progress = computed(() => {
    if (!graphData.value) return {
      count: 0, total: 0, percentage: 0,
      level: xpData.value.level, levelName: LEVEL_NAMES[xpData.value.level] || '初级学者',
      xp: xpData.value.totalXp, xpForNext: XP_PER_LEVEL,
      nextLevelXp: (xpData.value.level + 1) * XP_PER_LEVEL,
      streak: sessionStreak.value, allTimeStreak: xpData.value.streak
    }
    const total = graphData.value.topics.length
    const mastered = new Set(masteredTopics.value)
    const count = graphData.value.topics.filter((t) => mastered.has(t.id)).length
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0
    return {
      count, total, percentage,
      level: xpData.value.level,
      levelName: LEVEL_NAMES[xpData.value.level] || '初级学者',
      xp: xpData.value.totalXp,
      xpForNext: XP_PER_LEVEL,
      nextLevelXp: (xpData.value.level + 1) * XP_PER_LEVEL,
      streak: sessionStreak.value,
      allTimeStreak: xpData.value.streak
    }
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
        category: topic.category,
        status: getNodeStatus(topic.id)
      }
    }
  }

  function topicsToEdges(topics: KnowledgeTopic[]): Edge[] {
    const edges: Edge[] = []
    const topicIds = new Set(topics.map((t) => t.id))
    const seen = new Set<string>()

    for (const topic of topics) {
      // nextTopics：学习路径方向
      for (const nextId of topic.nextTopics) {
        const key = `${topic.id}→${nextId}`
        if (topicIds.has(nextId) && !seen.has(key)) {
          seen.add(key)
          edges.push({
            id: `edge-${topic.id}-${nextId}`,
            type: 'smoothstep',
            source: `topic-${topic.id}`,
            target: `topic-${nextId}`,
            style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 6' }
          })
        }
      }
      // prerequisites：前置依赖方向，生成反向边（前驱 → 当前节点）
      for (const prereqId of topic.prerequisites) {
        const key = `${prereqId}→${topic.id}`
        if (topicIds.has(prereqId) && !seen.has(key)) {
          seen.add(key)
          edges.push({
            id: `edge-${prereqId}-${topic.id}`,
            type: 'smoothstep',
            source: `topic-${prereqId}`,
            target: `topic-${topic.id}`,
            data: { isPrereq: true },
            style: { stroke: '#e2e8f0', strokeWidth: 1, strokeDasharray: '1 8', opacity: 0.06 }
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

  function toggleMastered(topicId: string): { action: 'master' | 'unmaster', xpGained: number, leveledUp: boolean, streak: number } {
    const current = new Set(masteredTopics.value)
    const isMastering = !current.has(topicId)

    if (isMastering) {
      current.add(topicId)
      masteredTopics.value = [...current]

      // Calculate XP
      const topic = graphData.value?.topics.find(t => t.id === topicId)
      const difficulty = topic?.difficulty ?? 1
      const xpGained = XP_PER_DIFFICULTY[difficulty] ?? 30

      // Only award XP if not already logged (prevent double-counting on page reload)
      let awardedXp = 0
      if (!xpData.value.masteredLog.includes(topicId)) {
        xpData.value.totalXp += xpGained
        xpData.value.masteredLog.push(topicId)
        awardedXp = xpGained
      }

      // Increment session streak
      sessionStreak.value++
      xpData.value.streak = Math.max(xpData.value.streak, sessionStreak.value)

      // Check level up
      const newLevel = Math.floor(xpData.value.totalXp / XP_PER_LEVEL)
      // D-03: max-level guard — mirrors addTaskXp (Phase 10 D-14) pattern.
      // At max level the stored level cannot advance, so leveledUp must be false
      // even when totalXp crosses the next threshold (prevents false confetti).
      const atMaxLevel = xpData.value.level >= LEVEL_NAMES.length - 1
      const leveledUp = !atMaxLevel && newLevel > xpData.value.level
      if (leveledUp) {
        xpData.value.level = Math.min(newLevel, LEVEL_NAMES.length - 1)
        levelUpTriggered.value = true
        setTimeout(() => { levelUpTriggered.value = false }, 1000)
      }

      return { action: 'master', xpGained: awardedXp, leveledUp, streak: sessionStreak.value }
    } else {
      current.delete(topicId)
      masteredTopics.value = [...current]
      sessionStreak.value = 0

      return { action: 'unmaster', xpGained: 0, leveledUp: false, streak: 0 }
    }
  }

  function resetSessionStreak(): void {
    sessionStreak.value = 0
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
    focusNode,
    // XP/Level/Combo
    xpData,
    sessionStreak,
    levelUpTriggered,
    xpForDifficulty,
    resetSessionStreak
  }
}
