import {mount} from '@vue/test-utils'
import {beforeEach, describe, expect, it} from 'vitest'
import ActiveTaskTracker from '@/components/knowledge/ActiveTaskTracker.vue'
import type {KnowledgeTask} from '@/composables/useKnowledgeTasks'

const mockPinnedTask: KnowledgeTask = {
    id: 'task-1',
    topicId: 'joins',
    title: '练习 JOIN 查询',
    notes: '',
    status: 'in-progress',
    priority: 'medium',
    createdAt: '2026-06-24T00:00:00.000Z',
    category: 'core',
    isPinned: true,
    substeps: [
        {id: 's1', label: '了解 INNER JOIN', status: 'done'},
        {id: 's2', label: '了解 LEFT JOIN', status: 'done'},
        {id: 's3', label: '练习多表查询', status: 'active'},
        {id: 's4', label: '掌握自连接', status: 'locked'},
    ],
}

describe('ActiveTaskTracker', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('renders pinned task title and step count', () => {
        const w = mount(ActiveTaskTracker, {
            props: {
                pinnedTask: mockPinnedTask,
                topicLabel: 'JOIN 查询',
                currentStepLabel: '练习多表查询',
            },
        })
        expect(w.text()).toContain('练习 JOIN 查询')
        expect(w.text()).toContain('2/4')
    })

    it('shows current step label', () => {
        const w = mount(ActiveTaskTracker, {
            props: {
                pinnedTask: mockPinnedTask,
                topicLabel: 'JOIN 查询',
                currentStepLabel: '练习多表查询',
            },
        })
        expect(w.text()).toContain('练习多表查询')
    })

    it('does not render when pinnedTask is null', () => {
        const w = mount(ActiveTaskTracker, {
            props: {
                pinnedTask: null,
                topicLabel: '',
                currentStepLabel: '',
            },
        })
        expect(w.find('.active-tracker').exists()).toBe(false)
    })

    it('emits unpin when cancel button clicked', async () => {
        const w = mount(ActiveTaskTracker, {
            props: {
                pinnedTask: mockPinnedTask,
                topicLabel: 'JOIN 查询',
                currentStepLabel: '练习多表查询',
            },
        })
        const cancelBtn = w.find('.active-tracker__btn--ghost')
        expect(cancelBtn.text()).toBe('取消追踪')
        await cancelBtn.trigger('click')
        expect(w.emitted('unpin')).toBeTruthy()
    })

    it('emits navigate with topicId when continue button clicked', async () => {
        const w = mount(ActiveTaskTracker, {
            props: {
                pinnedTask: mockPinnedTask,
                topicLabel: 'JOIN 查询',
                currentStepLabel: '练习多表查询',
            },
        })
        const continueBtn = w.find('.active-tracker__btn--primary')
        expect(continueBtn.text()).toBe('继续学习')
        await continueBtn.trigger('click')
        expect(w.emitted('navigate')).toBeTruthy()
        expect(w.emitted('navigate')?.[0]).toEqual(['joins'])
    })

    it('shows correct doneCount / total steps', () => {
        const w = mount(ActiveTaskTracker, {
            props: {
                pinnedTask: mockPinnedTask,
                topicLabel: 'JOIN 查询',
                currentStepLabel: '练习多表查询',
            },
        })
        expect(w.text()).toContain('2/4 步骤')
    })
})
