import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { makeKnowledgeTopic } from '@/__tests__/fixtures/knowledge'
import JournalTaskDetail from '@/components/knowledge/journal/JournalTaskDetail.vue'
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'

const topics: KnowledgeTopic[] = [
    makeKnowledgeTopic({ id: 'basics', label: '基础', difficulty: 1 }),
    makeKnowledgeTopic({ id: 'joins', label: '连接', difficulty: 3 })
]

function makeTask(overrides: Partial<KnowledgeTask> = {}): KnowledgeTask {
    return {
        id: 't1',
        topicId: 'basics',
        title: '练习 SELECT',
        notes: '',
        status: 'todo',
        priority: 'low',
        createdAt: '2024-01-01T00:00:00.000Z',
        category: 'core',
        substeps: [],
        isPinned: false,
        ...overrides
    }
}

function mountDetail(
    props: {
        task?: KnowledgeTask | null
        topic?: KnowledgeTopic | null
        totalTaskCount?: number
    } = {}
) {
    return mount(JournalTaskDetail, {
        props: {
            task: props.task ?? null,
            topic: props.topic ?? null,
            topics,
            totalTaskCount: props.totalTaskCount ?? 1
        },
        global: { stubs: { StepProgress: true, TaskCreateForm: true } }
    })
}

describe('JournalTaskDetail', () => {
    it('allows explicit completion without substeps and previews the actual topic reward', () => {
        const wrapper = mountDetail({ task: makeTask(), topic: topics[1] })
        expect(wrapper.find('.journal__btn--complete').exists()).toBe(true)
        expect(wrapper.find('.journal__detail-reward').text()).toContain('奖励：+90 XP')
    })
    it('renders the task detail header with category label and topic info', () => {
        const wrapper = mountDetail({ task: makeTask(), topic: topics[0] })
        expect(wrapper.find('.journal__detail-title').text()).toBe('练习 SELECT')
        expect(wrapper.find('.journal__detail-badge').text()).not.toBe('')
        expect(wrapper.find('.journal__detail-topic').text()).toContain('基础')
    })

    it('hides the topic line when no topic matches', () => {
        const wrapper = mountDetail({ task: makeTask(), topic: null })
        expect(wrapper.find('.journal__detail-topic').exists()).toBe(false)
    })

    it('shows the XP reward for the task', () => {
        const wrapper = mountDetail({ task: makeTask() })
        expect(wrapper.find('.journal__detail-reward').text()).toMatch(/奖励：\+\d+ XP/u)
    })

    it('shows StepProgress only when the task has substeps', () => {
        const without = mountDetail({ task: makeTask() })
        expect(without.findComponent({ name: 'StepProgress' }).exists()).toBe(false)

        const withSteps = mountDetail({
            task: makeTask({ substeps: [{ id: 's1', title: 'step', status: 'active' }] as any })
        })
        expect(withSteps.findComponent({ name: 'StepProgress' }).exists()).toBe(true)
        expect(withSteps.findComponent({ name: 'StepProgress' }).props('editable')).toBe(true)
    })

    it('relays toggle-step from StepProgress', async () => {
        const wrapper = mountDetail({
            task: makeTask({ substeps: [{ id: 's1', title: 'step', status: 'active' }] as any })
        })
        await wrapper.findComponent({ name: 'StepProgress' }).vm.$emit('toggle-step', 's1')
        expect(wrapper.emitted('toggle-step')).toEqual([['s1']])
    })

    it('emits navigate and pin from the action buttons', async () => {
        const wrapper = mountDetail({ task: makeTask() })
        await wrapper.find('button.journal__btn--primary').trigger('click')
        expect(wrapper.emitted('navigate')).toHaveLength(1)

        await wrapper.find('button.journal__btn--secondary').trigger('click')
        expect(wrapper.emitted('pin')).toEqual([['t1']])
    })

    it('pin button label reflects pinned state', () => {
        const unpinned = mountDetail({ task: makeTask() })
        expect(unpinned.find('button.journal__btn--secondary').text()).toBe('置顶追踪')

        const pinned = mountDetail({ task: makeTask({ isPinned: true }) })
        expect(pinned.find('button.journal__btn--secondary').text()).toBe('已置顶')
    })

    it('shows the complete button only when all substeps are done and task is not done', () => {
        const notDone = makeTask({
            substeps: [{ id: 's1', title: 'a', status: 'done' }] as any
        })
        const wrapper = mountDetail({ task: notDone })
        const complete = wrapper.find('button.journal__btn--complete')
        expect(complete.exists()).toBe(true)

        const alreadyDone = mountDetail({
            task: makeTask({
                status: 'done',
                substeps: [{ id: 's1', title: 'a', status: 'done' }] as any
            })
        })
        expect(alreadyDone.find('button.journal__btn--complete').exists()).toBe(false)

        const unfinished = mountDetail({
            task: makeTask({ substeps: [{ id: 's1', title: 'a', status: 'active' }] as any })
        })
        expect(unfinished.find('button.journal__btn--complete').exists()).toBe(false)
    })

    it('emits complete from the complete button', async () => {
        const wrapper = mountDetail({
            task: makeTask({ substeps: [{ id: 's1', title: 'a', status: 'done' }] as any })
        })
        await wrapper.find('button.journal__btn--complete').trigger('click')
        expect(wrapper.emitted('complete')).toEqual([['t1']])
    })

    it('empty state with zero tasks shows the guided create entry', async () => {
        const wrapper = mountDetail({ task: null, totalTaskCount: 0 })
        expect(wrapper.find('.journal__detail-empty-heading').text()).toBe('还没有学习任务')

        await wrapper.find('.journal__detail-empty-btn').trigger('click')
        expect(wrapper.findComponent({ name: 'TaskCreateForm' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'TaskCreateForm' }).props('mode')).toBe('global')
    })

    it('empty state with tasks shows the pick-a-task hint instead of create form', () => {
        const wrapper = mountDetail({ task: null, totalTaskCount: 3 })
        expect(wrapper.text()).toContain('选择一个任务查看详情')
        expect(wrapper.find('.journal__detail-empty-btn').exists()).toBe(false)
    })

    it('create submit relays the payload and closes the form; cancel hides it', async () => {
        const wrapper = mountDetail({ task: null, totalTaskCount: 0 })
        await wrapper.find('.journal__detail-empty-btn').trigger('click')
        const form = wrapper.findComponent({ name: 'TaskCreateForm' })

        await form.vm.$emit('cancel')
        expect(wrapper.findComponent({ name: 'TaskCreateForm' }).exists()).toBe(false)

        await wrapper.find('.journal__detail-empty-btn').trigger('click')
        const payload = { title: 'x', topicId: 'basics', category: 'core' } as any
        await wrapper.findComponent({ name: 'TaskCreateForm' }).vm.$emit('create', payload)
        expect(wrapper.emitted('create')).toEqual([[payload]])
        expect(wrapper.findComponent({ name: 'TaskCreateForm' }).exists()).toBe(false)
    })
})
