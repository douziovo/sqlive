import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import JournalTaskList from '@/components/knowledge/journal/JournalTaskList.vue'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'

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

function mountList(props: Record<string, unknown> = {}) {
    return mount(JournalTaskList, {
        props: {
            tasks: [makeTask()],
            selectedTaskId: null,
            activeCategory: 'core',
            isOverdue: () => false,
            hasDot: () => false,
            ...props
        }
    })
}

describe('JournalTaskList', () => {
    it('shows the empty hint when the category has no tasks', () => {
        const wrapper = mountList({ tasks: [] })
        expect(wrapper.text()).toContain('暂无核心路径任务')
    })

    it('renders task titles and emits select on click', async () => {
        const wrapper = mountList()
        expect(wrapper.text()).toContain('练习 SELECT')
        await wrapper.find('button.journal__list-item').trigger('click')
        expect(wrapper.emitted('select')).toEqual([['t1']])
    })

    it('marks the selected task', () => {
        const wrapper = mountList({ selectedTaskId: 't1' })
        expect(wrapper.find('.journal__list-item--selected').exists()).toBe(true)
    })

    it('shows the done-substeps counter', () => {
        const wrapper = mountList({
            tasks: [
                makeTask({
                    substeps: [
                        { id: 'a', label: 'a', status: 'done' },
                        { id: 'b', label: 'b', status: 'active' },
                        { id: 'c', label: 'c', status: 'locked' }
                    ]
                })
            ]
        })
        expect(wrapper.find('.journal__list-item-steps').text()).toBe('1/3')
    })

    it('omits the counter when the task has no substeps', () => {
        const wrapper = mountList()
        expect(wrapper.find('.journal__list-item-steps').exists()).toBe(false)
    })

    it('marks overdue titles in red via isOverdue', () => {
        const wrapper = mountList({ isOverdue: () => true })
        expect(wrapper.find('.journal__list-item-title').classes()).toContain('text-red-500')
    })

    it('shows the red dot badge when hasDot is true for a task', () => {
        const wrapper = mountList({ hasDot: (id: string) => id === 't1' })
        expect(wrapper.find('.journal__list-item .red-dot-badge').exists()).toBe(true)
    })
})
