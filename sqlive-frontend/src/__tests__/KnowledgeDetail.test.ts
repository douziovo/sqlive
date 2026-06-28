import {mount} from '@vue/test-utils'
import {beforeEach, describe, expect, it} from 'vitest'
import KnowledgeDetail from '@/components/knowledge/KnowledgeDetail.vue'
import type {KnowledgeTopic} from '@/composables/useKnowledgeGraph'
import type {KnowledgeTask} from '@/composables/useKnowledgeTasks'

const mockTopic: KnowledgeTopic = {
    id: 'joins',
    label: 'JOIN 查询',
    description: '连接多张表进行联合查询',
    keywords: [],
    patterns: [],
    difficulty: 2,
    prerequisites: ['sql-basics', 'filtering'],
    nextTopics: ['subqueries', 'aggregation'],
    category: 'query'
}

describe('KnowledgeDetail', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('renders nothing when topic is null', () => {
        const w = mount(KnowledgeDetail, {
            props: {topic: null, isMastered: false}
        })
        expect(w.find('.knowledge-detail').exists()).toBe(false)
    })

    it('renders topic details', () => {
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        expect(w.text()).toContain('JOIN 查询')
        expect(w.text()).toContain('连接多张表进行联合查询')
        expect(w.text()).toContain('sql-basics, filtering')
        expect(w.text()).toContain('subqueries, aggregation')
    })

    it('shows mark-mastered button when not mastered', () => {
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        expect(w.text()).toContain('标记已掌握')
    })

    it('shows cancel-master button when already mastered', () => {
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: true}
        })
        expect(w.text()).toContain('取消掌握')
    })

    it('emits toggle-mastered on button click', async () => {
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        await w.find('.knowledge-detail__btn--master').trigger('click')
        expect(w.emitted('toggle-mastered')).toBeTruthy()
        expect(w.emitted('toggle-mastered')?.[0]).toEqual(['joins'])
    })

    it('emits ask-ai on AI button click', async () => {
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        await w.find('.knowledge-detail__btn--ai').trigger('click')
        expect(w.emitted('ask-ai')?.[0]).toEqual(['JOIN 查询'])
    })

    it('emits close on close button click', async () => {
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        await w.find('.knowledge-detail__close').trigger('click')
        expect(w.emitted('close')).toBeTruthy()
    })

    // ── task tracking (Phase 09) ──────────────────────────────────

    const mockTask: KnowledgeTask = {
        id: 'task-1',
        topicId: 'joins',
        title: '练习 JOIN 查询',
        dueDate: '2026-06-30',
        notes: '',
        status: 'todo',
        priority: 'medium',
        createdAt: '2026-06-24T00:00:00.000Z',
        completedAt: undefined,
        category: 'core',
        substeps: [],
        isPinned: false
    }

    it('shows add task button when topic is provided', () => {
        localStorage.setItem('ai-knowledge-tasks', JSON.stringify([]))
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        expect(w.text()).toContain('+ 添加任务')
    })

    it('shows task create form when add task is clicked', async () => {
        localStorage.setItem('ai-knowledge-tasks', JSON.stringify([]))
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        await w.find('.knowledge-detail__add-task-btn').trigger('click')
        expect(w.find('.task-create-form').exists()).toBe(true)
    })

    it('hides task create form when cancel is emitted', async () => {
        localStorage.setItem('ai-knowledge-tasks', JSON.stringify([]))
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        await w.find('.knowledge-detail__add-task-btn').trigger('click')
        await w.find('.task-create-form__btn--cancel').trigger('click')
        expect(w.find('.task-create-form').exists()).toBe(false)
    })

    it('shows task list for current topic', () => {
        localStorage.setItem('ai-knowledge-tasks', JSON.stringify([mockTask]))
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        expect(w.text()).toContain('练习 JOIN 查询')
    })

    it('shows view all link when more than 3 tasks', () => {
        const tasks: KnowledgeTask[] = [
            {...mockTask, id: 't1'},
            {...mockTask, id: 't2'},
            {...mockTask, id: 't3'},
            {...mockTask, id: 't4'}
        ]
        localStorage.setItem('ai-knowledge-tasks', JSON.stringify(tasks))
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        expect(w.text()).toContain('查看全部')
    })

    it('emits view-all-tasks when view all link clicked', async () => {
        const tasks: KnowledgeTask[] = [
            {...mockTask, id: 't1'}, {...mockTask, id: 't2'},
            {...mockTask, id: 't3'}, {...mockTask, id: 't4'}
        ]
        localStorage.setItem('ai-knowledge-tasks', JSON.stringify(tasks))
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        await w.find('.knowledge-detail__view-all').trigger('click')
        expect(w.emitted('view-all-tasks')).toBeTruthy()
    })

    it('emits complete-task when task status toggled to done', async () => {
        const inProgressTask = {...mockTask, id: 't1', status: 'in-progress' as const}
        localStorage.setItem('ai-knowledge-tasks', JSON.stringify([inProgressTask]))
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        // Click the status badge to cycle in-progress → done, which triggers complete:task + complete-task
        await w.find('.task-item__status').trigger('click')
        expect(w.emitted('complete-task')).toBeTruthy()
        expect(w.emitted('complete-task')?.[0]).toEqual(['joins'])
    })

    it('shows completed tasks in history section', () => {
        const doneTask = {...mockTask, id: 't-done', status: 'done' as const, completedAt: '2026-06-23T12:00:00.000Z'}
        localStorage.setItem('ai-knowledge-tasks', JSON.stringify([doneTask]))
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        expect(w.text()).toContain('已完成')
    })

    it('toggles history visibility on click', async () => {
        const doneTask = {...mockTask, id: 't-done', status: 'done' as const, completedAt: '2026-06-23T12:00:00.000Z'}
        localStorage.setItem('ai-knowledge-tasks', JSON.stringify([doneTask]))
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        // History is initially collapsed
        await w.find('.knowledge-detail__history-toggle').trigger('click')
        // After toggle, the history list should be visible with the completed task title
        expect(w.text()).toContain('练习 JOIN 查询')
        // Click again to collapse
        await w.find('.knowledge-detail__history-toggle').trigger('click')
    })

    // ── Locate topic button (Phase 09-06) ──────────────────────────

    it('shows locate button when topic is provided', () => {
        localStorage.setItem('ai-knowledge-tasks', JSON.stringify([]))
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        expect(w.text()).toContain('定位知识点')
    })

    it('emits navigate-to-topic when locate button clicked', async () => {
        localStorage.setItem('ai-knowledge-tasks', JSON.stringify([]))
        const w = mount(KnowledgeDetail, {
            props: {topic: mockTopic, isMastered: false}
        })
        await w.find('.knowledge-detail__locate-btn').trigger('click')
        expect(w.emitted('navigate-to-topic')).toBeTruthy()
        expect(w.emitted('navigate-to-topic')?.[0]).toEqual(['joins'])
    })

    it('locate button hidden when no topic', () => {
        const w = mount(KnowledgeDetail, {
            props: {topic: null, isMastered: false}
        })
        expect(w.find('.knowledge-detail__locate-btn').exists()).toBe(false)
    })
})
