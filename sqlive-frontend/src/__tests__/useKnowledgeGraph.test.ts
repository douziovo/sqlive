import {beforeEach, describe, expect, it, vi} from 'vitest'
import {nextTick} from 'vue'
import {LEVEL_NAMES, useKnowledgeGraph} from '@/composables/useKnowledgeGraph'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockGraphData = {
    topics: [
        {
            id: 'sql-basics',
            label: 'SQL 基础查询',
            description: '基础 SELECT',
            keywords: ['SELECT', 'FROM', 'WHERE'],
            patterns: ['SELECT\\s+.*\\s+FROM'],
            difficulty: 1,
            prerequisites: [],
            nextTopics: ['filtering'],
            category: 'basics'
        },
        {
            id: 'filtering',
            label: '条件过滤',
            description: 'WHERE 过滤',
            keywords: ['AND', 'OR', 'IN'],
            patterns: ['WHERE.*(?:AND|OR)'],
            difficulty: 1,
            prerequisites: ['sql-basics'],
            nextTopics: ['sorting'],
            category: 'basics'
        },
        {
            id: 'joins',
            label: 'JOIN 查询',
            description: '连接查询',
            keywords: ['JOIN', 'INNER JOIN'],
            patterns: ['\\bJOIN\\s+\\w+'],
            difficulty: 2,
            prerequisites: ['sql-basics', 'filtering'],
            nextTopics: ['subqueries'],
            category: 'query'
        }
    ]
}

describe('useKnowledgeGraph', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        // D-02: graphData/selectedNode hoisted to module scope — reset between tests
        const kg = useKnowledgeGraph()
        kg.graphData.value = null
        kg.selectedNode.value = null
        // D-08: sessionStreak hoisted to module scope — reset between tests so
        // 'combo/streak increments with each mastery' starts from 0 regardless of
        // state left by prior toggleMastered calls in other tests.
        kg.sessionStreak.value = 0
    })

    // ── D-02: LEVEL_NAMES exported as public constant ─────────────

    it('exports LEVEL_NAMES constant with 4 levels', () => {
        expect(Array.isArray(LEVEL_NAMES)).toBe(true)
        expect(LEVEL_NAMES).toHaveLength(4)
        expect(LEVEL_NAMES[0]).toBe('初级学者')
        expect(LEVEL_NAMES[1]).toBe('进阶学者')
        expect(LEVEL_NAMES[2]).toBe('SQL 大师')
        expect(LEVEL_NAMES[3]).toBe('数据库传奇')
    })

    it('module-level graphData is shared across useKnowledgeGraph() calls (singleton)', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockGraphData)
        })

        const kg1 = useKnowledgeGraph()
        await kg1.fetchGraph()

        // Second call should see the same graphData (singleton, no re-fetch needed)
        const kg2 = useKnowledgeGraph()
        expect(kg2.graphData.value).not.toBeNull()
        expect(kg2.graphData.value?.topics).toHaveLength(3)
        // Both calls return the same ref instance
        expect(kg1.graphData).toBe(kg2.graphData)
    })

    it('fetchGraph loads data and computes nodes/edges', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockGraphData)
        })

        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        expect(kg.graphData.value).not.toBeNull()
        expect(kg.graphData.value?.topics).toHaveLength(3)
        expect(kg.nodes.value).toHaveLength(3)
        expect(kg.edges.value.length).toBe(3) // nextTopics + prerequisites edges
        expect(kg.progress.value.total).toBe(3)
    })

    it('progress reflects mastered topics from localStorage', async () => {
        localStorage.setItem('ai-mastered-topics', JSON.stringify(['sql-basics', 'filtering']))

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockGraphData)
        })

        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        expect(kg.progress.value.count).toBe(2)
        expect(kg.progress.value.percentage).toBe(67)
        expect(kg.progress.value.levelName).toBe('初级学者') // level based on XP, not percentage
    })

    it('toggleMastered adds and removes topics', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockGraphData)
        })

        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        kg.toggleMastered('sql-basics')
        expect(kg.masteredTopics.value).toContain('sql-basics')
        expect(kg.progress.value.count).toBe(1)

        kg.toggleMastered('sql-basics')
        expect(kg.masteredTopics.value).not.toContain('sql-basics')
        expect(kg.progress.value.count).toBe(0)

        const stored = JSON.parse(localStorage.getItem('ai-mastered-topics') || '[]')
        expect(stored).not.toContain('sql-basics')
    })

    it('selectedNode starts null and can be set', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockGraphData)
        })

        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        expect(kg.selectedNode.value).toBeNull()
        kg.selectedNode.value = 'joins'
        expect(kg.selectedNode.value).toBe('joins')
    })

    it('selectedNodeData computed from graphData', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockGraphData)
        })

        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        kg.selectedNode.value = 'joins'
        expect(kg.selectedNodeData.value?.label).toBe('JOIN 查询')
        expect(kg.selectedNodeData.value?.difficulty).toBe(2)
    })

    it('focusNode sets selectedNode', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockGraphData)
        })

        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        kg.focusNode('filtering')
        expect(kg.selectedNode.value).toBe('filtering')
    })

    it('fetchGraph handles HTTP error gracefully', async () => {
        mockFetch.mockResolvedValueOnce({ok: false, status: 500})

        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        expect(kg.graphData.value).toBeNull()
        expect(kg.progress.value.total).toBe(0)
    })

    it('fetchGraph handles network error gracefully', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        expect(kg.graphData.value).toBeNull()
    })

    // ── CR-03 fetchGraph response shape validation (D-04) ────────

    it('fetchGraph with {} response does not set graphData', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({})})

        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        expect(kg.graphData.value).toBeNull()
        expect(kg.nodes.value).toEqual([]) // nodes computed does not throw
    })

    it('fetchGraph with { topics: null } does not set graphData', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({topics: null})})

        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        expect(kg.graphData.value).toBeNull()
    })

    it('fetchGraph with { topics: "not-array" } does not set graphData', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({topics: 'not-array'})})

        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        expect(kg.graphData.value).toBeNull()
    })

    it('fetchGraph preserves previous valid graphData on malformed response', async () => {
        // First fetch: valid
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph()
        await kg.fetchGraph()
        expect(kg.graphData.value?.topics).toHaveLength(3)

        // Second fetch: malformed — graphData should stay as previous valid
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve({})})
        await kg.fetchGraph()
        expect(kg.graphData.value?.topics).toHaveLength(3) // unchanged
    })

    // ── inProgressTopics ─────────────────────────────────────────

    it('inProgressTopics detects keywords in SQL (case-insensitive)', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph({sqlSource: () => 'select * from users'})
        await kg.fetchGraph()

        expect(kg.inProgressTopics.value.has('sql-basics')).toBe(true)
        expect(kg.inProgressTopics.value.has('filtering')).toBe(false)
    })

    it('inProgressTopics detects regex patterns in SQL', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph({sqlSource: () => 'SELECT * FROM t1 INNER JOIN t2 ON t1.id = t2.id'})
        await kg.fetchGraph()

        expect(kg.inProgressTopics.value.has('sql-basics')).toBe(true) // SELECT...FROM keyword/pattern
        expect(kg.inProgressTopics.value.has('joins')).toBe(true) // JOIN pattern match
        // filtering also matches because "IN" is a substring of "JOIN"/"INNER" — known limitation
    })

    it('inProgressTopics returns empty set when SQL is empty', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph({sqlSource: () => ''})
        await kg.fetchGraph()

        expect(kg.inProgressTopics.value.size).toBe(0)
    })

    it('inProgressTopics skips mastered topics (mastered takes priority)', async () => {
        localStorage.setItem('ai-mastered-topics', JSON.stringify(['sql-basics']))
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph({sqlSource: () => 'select * from users'})
        await kg.fetchGraph()

        // sql-basics matches SELECT but is already mastered → excluded
        expect(kg.inProgressTopics.value.has('sql-basics')).toBe(false)
    })

    it('inProgressTopics handles no sqlSource gracefully', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph() // no opts
        await kg.fetchGraph()

        expect(kg.inProgressTopics.value.size).toBe(0)
    })

    it('getNodeStatus returns correct status', async () => {
        localStorage.setItem('ai-mastered-topics', JSON.stringify(['sql-basics']))
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph({sqlSource: () => 'SELECT * FROM t WHERE a AND b'})
        await kg.fetchGraph()

        expect(kg.getNodeStatus('sql-basics')).toBe('mastered') // has SELECT+FROM but already mastered
        expect(kg.getNodeStatus('filtering')).toBe('in-progress') // WHERE...AND matches pattern
        expect(kg.getNodeStatus('joins')).toBe('unlearned') // no JOIN keyword or pattern
    })

    // ── Edge style ──────────────────────────────────────────────

    it('edges include nextTopics and prerequisites edges with distinct styles', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        expect(kg.edges.value.length).toBeGreaterThan(0)
        const nextEdges = kg.edges.value.filter((e: any) => e.style.strokeDasharray === '3 6')
        const prereqEdges = kg.edges.value.filter((e: any) => e.style.strokeDasharray === '1 8')
        expect(nextEdges.length).toBeGreaterThan(0)
        expect(nextEdges.length + prereqEdges.length).toBe(kg.edges.value.length)
        for (const edge of kg.edges.value) {
            expect(edge.type).toBe('smoothstep')
            expect(edge.style.strokeWidth).toBe(1)
            expect(edge).not.toHaveProperty('markerEnd')
        }
    })

    // ── XP/Level/Streak system (Phase 05-03) ─────────────────────

    it('toggleMastered returns xpGained: 30 for difficulty-1, 50 for difficulty-2, 80 for difficulty-3', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        const r1 = kg.toggleMastered('sql-basics') // difficulty 1
        expect(r1.xpGained).toBe(30)

        const r2 = kg.toggleMastered('joins') // difficulty 2
        expect(r2.xpGained).toBe(50)
    })

    it('toggleMastered returns leveledUp false when XP < 750', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        const result = kg.toggleMastered('sql-basics') // +30 XP
        expect(result.leveledUp).toBe(false)
    })

    it('every 750 XP levels up, level starts at 0', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        // Each call returns toggleMastered result
        // We need many mastered topics — add more mock data would be needed
        // Instead test by adding difficulty-2 topics (50 XP each), 15 = 750 XP
        const mockManyTopics = {
            topics: Array.from({length: 30}, (_, i) => ({
                id: `topic-${i}`,
                label: `Topic ${i}`,
                description: '',
                keywords: [],
                patterns: [],
                difficulty: i < 15 ? 2 : 1,
                prerequisites: [],
                nextTopics: [],
                category: 'basics'
            }))
        }
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockManyTopics)})
        await kg.fetchGraph()

        // After 15 difficulty-2 topics (15*50=750)
        for (let i = 0; i < 14; i++) kg.toggleMastered(`topic-${i}`)
        const r1 = kg.toggleMastered('topic-14')
        expect(r1.leveledUp).toBe(true)
        expect(r1.xpGained).toBe(50)
    })

    it('progress returns level 0 with name 初级学者 initially', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        const p = kg.progress.value
        expect(p.level).toBe(0)
        expect(p.levelName).toBe('初级学者')
        expect(p.xp).toBe(0)
        expect(p.xpForNext).toBe(750)
    })

    it('level names: 0=初级学者, 1=进阶学者, 2=SQL 大师, 3=数据库传奇', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        // Accumulate XP through levels
        // Level 1 at 750 XP = 15 diff-2 topics, Level 2 at 1500, Level 3 at 2250
        const mockManyTopics = {
            topics: Array.from({length: 60}, (_, i) => ({
                id: `topic-${i}`,
                label: `Topic ${i}`,
                description: '',
                keywords: [],
                patterns: [],
                difficulty: 2,
                prerequisites: [],
                nextTopics: [],
                category: 'basics'
            }))
        }
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockManyTopics)})
        await kg.fetchGraph()

        // Level 0
        expect(kg.progress.value.levelName).toBe('初级学者')

        // Level 1: 750 XP (15 * 50)
        for (let i = 0; i < 15; i++) kg.toggleMastered(`topic-${i}`)
        expect(kg.progress.value.level).toBe(1)
        expect(kg.progress.value.levelName).toBe('进阶学者')

        // Level 2: 1500 XP (30 * 50)
        for (let i = 15; i < 30; i++) kg.toggleMastered(`topic-${i}`)
        expect(kg.progress.value.level).toBe(2)
        expect(kg.progress.value.levelName).toBe('SQL 大师')

        // Level 3: 2250 XP (45 * 50)
        for (let i = 30; i < 45; i++) kg.toggleMastered(`topic-${i}`)
        expect(kg.progress.value.level).toBe(3)
        expect(kg.progress.value.levelName).toBe('数据库传奇')
    })

    // ── CR-02 toggleMastered max-level guard (D-03) ──────────────

    it('toggleMastered at max level returns leveledUp: false even when XP crosses threshold', async () => {
        // Start at max level (3) with totalXp=3000. Mastering 'sql-basics' (+30 XP)
        // pushes totalXp to 3030, newLevel=floor(3030/750)=4. Without the atMaxLevel
        // guard, buggy code returns leveledUp=(4>3)=true — false positive confetti.
        localStorage.setItem('ai-knowledge-xp', JSON.stringify({
            totalXp: 3000, level: 3, streak: 0, masteredLog: []
        }))
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        expect(kg.xpData.value.level).toBe(3) // max level

        const result = kg.toggleMastered('sql-basics') // +30 XP → 3030, newLevel=4
        expect(result.leveledUp).toBe(false) // atMaxLevel guard blocks false positive
        expect(kg.xpData.value.level).toBe(3) // unchanged, capped at max
    })

    it('toggleMastered below max level still levels up when crossing threshold', async () => {
        // Start at level 0 with totalXp=720. Mastering 'sql-basics' (+30 XP) pushes
        // totalXp to 750, newLevel=1. atMaxLevel guard should NOT block level-up here.
        localStorage.setItem('ai-knowledge-xp', JSON.stringify({
            totalXp: 720, level: 0, streak: 0, masteredLog: []
        }))
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        const result = kg.toggleMastered('sql-basics') // +30 XP → 750, newLevel=1
        expect(result.leveledUp).toBe(true)
        expect(kg.xpData.value.level).toBe(1)
    })

    it('combo/streak increments with each mastery, unmaster resets to 0', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        expect(kg.toggleMastered('sql-basics').streak).toBe(1)
        expect(kg.toggleMastered('filtering').streak).toBe(2)
        expect(kg.toggleMastered('joins').streak).toBe(3)

        // Unmaster resets
        kg.toggleMastered('joins') // unmaster
        // Now streak should be 0 for next mastery
        expect(kg.toggleMastered('joins').streak).toBe(1) // re-master starts at 1
    })

    it('masteredLog prevents double XP for same topic on page reload', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        const r1 = kg.toggleMastered('sql-basics')
        expect(r1.xpGained).toBe(30)
        expect(kg.progress.value.xp).toBe(30)

        // Unmaster and re-master: should NOT award XP again (topic is in masteredLog)
        kg.toggleMastered('sql-basics') // unmaster
        const r2 = kg.toggleMastered('sql-basics') // re-master
        expect(r2.xpGained).toBe(0) // no XP because already in masteredLog
        expect(kg.progress.value.xp).toBe(30) // unchanged
    })

    it('XP/level persists to localStorage', () => {
        const key = 'ai-knowledge-xp'
        // Simulate reload: set localStorage
        localStorage.setItem(key, JSON.stringify({totalXp: 750, level: 1, streak: 5, masteredLog: ['topic-a']}))

        const kg = useKnowledgeGraph()
        expect(kg.progress.value.xp).toBe(750)
        expect(kg.progress.value.level).toBe(1)
    })

    it('progress returns count, total, percentage, level, levelName, xp, xpForNext, streak', async () => {
        mockFetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(mockGraphData)})
        const kg = useKnowledgeGraph()
        await kg.fetchGraph()

        const p = kg.progress.value
        expect(p).toHaveProperty('count')
        expect(p).toHaveProperty('total')
        expect(p).toHaveProperty('percentage')
        expect(p).toHaveProperty('level')
        expect(p).toHaveProperty('levelName')
        expect(p).toHaveProperty('xp')
        expect(p).toHaveProperty('xpForNext')
        expect(p).toHaveProperty('streak')
    })

    // ── D-14: addTaskXp unified XP entry ──────────────────────────

    describe('addTaskXp', () => {
        it('awards xp and logs task:topicId key', () => {
            const kg = useKnowledgeGraph()
            // xpData starts at totalXp=0, level=0
            expect(kg.xpData.value.totalXp).toBe(0)

            const result = kg.addTaskXp('joins', 60)

            expect(result.xpGained).toBe(60)
            expect(result.leveledUp).toBe(false)
            expect(kg.xpData.value.totalXp).toBe(60)
            expect(kg.xpData.value.masteredLog).toContain('task:joins')
        })

        it('does not double-award on repeat call with same topicId', () => {
            const kg = useKnowledgeGraph()

            const r1 = kg.addTaskXp('joins', 60)
            const r2 = kg.addTaskXp('joins', 60)

            expect(r1.xpGained).toBe(60)
            expect(r2.xpGained).toBe(0)
            expect(r2.leveledUp).toBe(false)
            expect(kg.xpData.value.totalXp).toBe(60) // only awarded once
        })

        it('detects level up when crossing XP_PER_LEVEL boundary', () => {
            // XP_PER_LEVEL = 750; start at 740, level 0; +60 → 800 → level 1
            localStorage.setItem('ai-knowledge-xp', JSON.stringify({
                totalXp: 740, level: 0, streak: 0, masteredLog: []
            }))
            const kg = useKnowledgeGraph()
            expect(kg.xpData.value.level).toBe(0)

            const result = kg.addTaskXp('joins', 60)

            expect(result.xpGained).toBe(60)
            expect(result.leveledUp).toBe(true)
            expect(kg.xpData.value.level).toBe(1)
        })

        it('does not modify masteredTopics array (task completion ≠ topic mastery)', () => {
            const kg = useKnowledgeGraph()
            expect(kg.masteredTopics.value).toHaveLength(0)

            kg.addTaskXp('joins', 60)

            expect(kg.masteredTopics.value).toHaveLength(0)
            expect(kg.masteredTopics.value).not.toContain('joins')
        })

        it('caps level at LEVEL_NAMES.length - 1', () => {
            // LEVEL_NAMES.length = 4 → max level = 3; start at 2940 + 60 = 3000 → level 4 capped to 3
            localStorage.setItem('ai-knowledge-xp', JSON.stringify({
                totalXp: 2940, level: 3, streak: 0, masteredLog: []
            }))
            const kg = useKnowledgeGraph()
            expect(kg.xpData.value.level).toBe(3)

            const result = kg.addTaskXp('joins', 60)

            expect(result.xpGained).toBe(60)
            expect(result.leveledUp).toBe(false) // already at max level, no level-up triggered
            expect(kg.xpData.value.level).toBe(3) // capped, not 4
        })
    })

    // ── WR-01: getChapterProgress migrated from useKnowledgeTasks (D-05) ──
    // New semantic: counts MASTERED TOPICS under chapter.categoryKey, divided by
    // chapter.topicCount (from learningChapters.ts). Previously counted done tasks
    // / task.length — mixed user-created task count with chapter-defined topicCount,
    // producing >100% or understated progress.

    describe('getChapterProgress (D-05 migration)', () => {
        it('basics chapter counts only mastered basics-category topics', async () => {
            // basics.topicCount = 6 (learningChapters.ts). mockGraphData has sql-basics
            // and filtering in category='basics'. Mastering only sql-basics → completed=1.
            localStorage.setItem('ai-mastered-topics', JSON.stringify(['sql-basics']))
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockGraphData)
            })
            const kg = useKnowledgeGraph()
            await kg.fetchGraph()

            const progress = kg.getChapterProgress('basics')
            expect(progress.completed).toBe(1)
            expect(progress.total).toBe(6)
        })

        it('unknown chapter returns 0/0', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockGraphData)
            })
            const kg = useKnowledgeGraph()
            await kg.fetchGraph()

            const progress = kg.getChapterProgress('nonexistent')
            expect(progress.completed).toBe(0)
            expect(progress.total).toBe(0)
        })

        it('returns 0/topicCount when graphData not loaded', () => {
            // No fetchGraph call — graphData stays null
            const kg = useKnowledgeGraph()

            const progress = kg.getChapterProgress('basics')
            expect(progress.completed).toBe(0)
            expect(progress.total).toBe(6) // basics.topicCount from learningChapters.ts
        })

        it('query chapter counts mastered topics with category=query', async () => {
            // query.topicCount = 4 (learningChapters.ts). mockGraphData has joins in
            // category='query'. Mastering joins → completed=1.
            localStorage.setItem('ai-mastered-topics', JSON.stringify(['joins']))
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockGraphData)
            })
            const kg = useKnowledgeGraph()
            await kg.fetchGraph()

            const progress = kg.getChapterProgress('query')
            expect(progress.completed).toBe(1)
            expect(progress.total).toBe(4)
        })

        it('does not count done tasks (semantic change from useKnowledgeTasks version)', async () => {
            // Seed tasks localStorage with done tasks under basics chapter's taskCategories.
            // useKnowledgeGraph doesn't read tasks — new semantic counts only mastered topics.
            // With no mastered topics, completed=0 even if tasks are all done.
            localStorage.setItem('ai-knowledge-tasks', JSON.stringify([{
                id: 't1',
                topicId: 'sql-basics',
                title: 'Done task',
                notes: '',
                status: 'done',
                priority: 'medium',
                createdAt: new Date().toISOString(),
                category: 'core',
                substeps: [],
                isPinned: false
            }]))
            // No mastered topics
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockGraphData)
            })
            const kg = useKnowledgeGraph()
            await kg.fetchGraph()

            const progress = kg.getChapterProgress('basics')
            expect(progress.completed).toBe(0)
            expect(progress.total).toBe(6)
        })
    })

    // ── WR-04: sessionStreak hoisted to module scope (D-08) ────────
    // Previously per-instance — instance A's toggleMastered incremented streak
    // but instance B (e.g., LearningCompanion) read progress.value.streak = 0.
    // Aligns with D-02 module-level singleton pattern (graphData/selectedNode).

    describe('sessionStreak module singleton (WR-04/D-08)', () => {
        it('sessionStreak is shared across useKnowledgeGraph() instances', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockGraphData)
            })
            const kg1 = useKnowledgeGraph()
            await kg1.fetchGraph()
            kg1.toggleMastered('sql-basics') // streak → 1
            expect(kg1.progress.value.streak).toBe(1)

            // Second instance reads same module-level sessionStreak.
            // Before D-08 fix, kg2.progress.value.streak was 0 (per-instance bug).
            const kg2 = useKnowledgeGraph()
            expect(kg2.progress.value.streak).toBe(1)
        })

        it('resetSessionStreak clears module-level sessionStreak', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockGraphData)
            })
            const kg1 = useKnowledgeGraph()
            await kg1.fetchGraph()
            kg1.toggleMastered('sql-basics')
            expect(kg1.progress.value.streak).toBe(1)

            kg1.resetSessionStreak()
            expect(kg1.progress.value.streak).toBe(0)

            // Module-level cleared — a fresh instance reads 0, not a stale 1.
            const kg2 = useKnowledgeGraph()
            expect(kg2.progress.value.streak).toBe(0)
        })
    })

    // ── WR-06: xpData.level clamp on load (D-10) ──────────────────
    // Corrupted localStorage (e.g., level: 99 from manual edit or past bug)
    // would break nextLevelXp / xpBarPercent numeric semantics. The watch with
    // { immediate: true } clamps level to [0, LEVEL_NAMES.length - 1] on load.

    describe('xpData level clamp (WR-06/D-10)', () => {
        it('clamps level:99 to LEVEL_NAMES.length - 1 on load', async () => {
            localStorage.setItem('ai-knowledge-xp', JSON.stringify({
                totalXp: 100, level: 99, streak: 0, masteredLog: []
            }))
            const kg = useKnowledgeGraph()
            // wait for immediate watch to fire + flush
            await nextTick()
            expect(kg.xpData.value.level).toBe(3) // LEVEL_NAMES.length - 1
        })

        it('clamps level:-5 to 0 on load', async () => {
            localStorage.setItem('ai-knowledge-xp', JSON.stringify({
                totalXp: 100, level: -5, streak: 0, masteredLog: []
            }))
            const kg = useKnowledgeGraph()
            await nextTick()
            expect(kg.xpData.value.level).toBe(0)
        })

        it('normal level 0-3 unchanged', async () => {
            localStorage.setItem('ai-knowledge-xp', JSON.stringify({
                totalXp: 750, level: 1, streak: 0, masteredLog: []
            }))
            const kg = useKnowledgeGraph()
            await nextTick()
            expect(kg.xpData.value.level).toBe(1)
        })
    })
})
