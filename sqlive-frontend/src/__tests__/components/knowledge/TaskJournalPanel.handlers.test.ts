import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { makeKnowledgeTopic } from '@/__tests__/fixtures/knowledge'
import TaskJournalPanel from '@/components/knowledge/TaskJournalPanel.vue'
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'

// ── Mocks with exposed spies for handler assertions ──────────────
const { state } = vi.hoisted(() => ({
    state: {} as Record<string, any>
}))

vi.mock('@/composables/useKnowledgeTasks', async () => {
    const { ref } = await import('vue')
    state.tasks = ref<KnowledgeTask[]>([])
    state.addTask = vi.fn()
    state.completeTask = vi.fn()
    state.updateSubstep = vi.fn()
    state.pinTask = vi.fn()
    return {
        useKnowledgeTasks: () => ({
            tasks: state.tasks,
            addTask: state.addTask,
            updateTask: vi.fn(),
            deleteTask: vi.fn(),
            completeTask: state.completeTask,
            updateSubstep: state.updateSubstep,
            pinTask: state.pinTask,
            unpinTask: vi.fn(),
            getPinnedTask: { value: null },
            getChapterProgress: () => ({ completed: 0, total: 0 }),
            tasksByTopic: () => [],
            pendingCount: { value: 0 },
            isOverdue: () => false,
            seedPresetTasksIfFirstRun: () => false
        })
    }
})

vi.mock('@/composables/useRedDot', () => ({
    useRedDot: () => ({
        isVisible: (key: string) => state.redDotKeys?.includes(key) ?? false,
        clear: (key: string) => state.clearedRedDots?.push(key),
        show: vi.fn(),
        hasDotInPrefix: () => false,
        clearAll: vi.fn(),
        keyParents: { value: {} }
    })
}))

function makeTask(overrides: Partial<KnowledgeTask> = {}): KnowledgeTask {
    return {
        id: 't1',
        topicId: 'basics',
        title: 'Task 1',
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

const topics: KnowledgeTopic[] = [
    makeKnowledgeTopic({ id: 'basics', label: '基础', difficulty: 1 })
]

function mountPanel() {
    return mount(TaskJournalPanel, {
        props: { topics },
        global: {
            stubs: { StepProgress: true, RedDotBadge: true, TaskCreateForm: true }
        }
    })
}

beforeEach(() => {
    state.tasks.value = []
    state.addTask.mockClear()
    state.completeTask.mockClear()
    state.updateSubstep.mockClear()
    state.pinTask.mockClear()
    state.redDotKeys = []
    state.clearedRedDots = []
})

describe('TaskJournalPanel handlers', () => {
    it('selecting a task updates selection and clears its red dot', async () => {
        state.tasks.value = [makeTask({ id: 't1' }), makeTask({ id: 't2' })]
        const wrapper = mountPanel()
        await nextTick()

        await wrapper.findComponent({ name: 'JournalTaskList' }).vm.$emit('select', 't2')
        expect(state.clearedRedDots).toContain('task:t2')
        // selectedTask resolves to t2 and detail receives it
        expect(wrapper.findComponent({ name: 'JournalTaskDetail' }).props('task')?.id).toBe('t2')
    })

    it('changing category resets selection and clears the category dot', async () => {
        state.tasks.value = [makeTask({ id: 't1', category: 'core' })]
        const wrapper = mountPanel()
        await nextTick()
        expect(wrapper.findComponent({ name: 'JournalTaskDetail' }).props('task')).not.toBeNull()

        await wrapper.findComponent({ name: 'JournalCategoryTabs' }).vm.$emit('select', 'deep-dive')
        expect(state.clearedRedDots).toContain('category:deep-dive')
        expect(wrapper.findComponent({ name: 'JournalTaskDetail' }).props('task')).toBeNull()
    })

    it('toggles an active substep to done', async () => {
        state.tasks.value = [
            makeTask({ id: 't1', substeps: [{ id: 's1', title: 's', status: 'active' }] as any })
        ]
        const wrapper = mountPanel()
        await nextTick()

        await wrapper.findComponent({ name: 'JournalTaskDetail' }).vm.$emit('toggle-step', 's1')
        expect(state.updateSubstep).toHaveBeenCalledWith('t1', 's1', 'done')
    })

    it('toggles a done substep back to active and pending to active', async () => {
        state.tasks.value = [
            makeTask({
                id: 't1',
                substeps: [
                    { id: 's1', title: 'a', status: 'done' },
                    { id: 's2', title: 'b', status: 'pending' }
                ] as any
            })
        ]
        const wrapper = mountPanel()
        await nextTick()
        const detail = wrapper.findComponent({ name: 'JournalTaskDetail' })

        await detail.vm.$emit('toggle-step', 's1')
        expect(state.updateSubstep).toHaveBeenLastCalledWith('t1', 's1', 'active')

        await detail.vm.$emit('toggle-step', 's2')
        expect(state.updateSubstep).toHaveBeenLastCalledWith('t1', 's2', 'active')
    })

    it('ignores substep toggles for unknown substeps or without selection', async () => {
        state.tasks.value = [
            makeTask({ id: 't1', substeps: [{ id: 's1', title: 's', status: 'active' }] as any })
        ]
        const wrapper = mountPanel()
        await nextTick()

        await wrapper.findComponent({ name: 'JournalTaskDetail' }).vm.$emit('toggle-step', 'nope')
        expect(state.updateSubstep).not.toHaveBeenCalled()
    })

    it('completing a task emits completeTask with the topic id', async () => {
        const done = makeTask({ id: 't1', topicId: 'basics', status: 'done' })
        state.completeTask.mockReturnValue({ task: done })
        state.tasks.value = [makeTask({ id: 't1' })]
        const wrapper = mountPanel()
        await nextTick()

        await wrapper.findComponent({ name: 'JournalTaskDetail' }).vm.$emit('complete', 't1')
        expect(state.completeTask).toHaveBeenCalledWith('t1')
        expect(wrapper.emitted('completeTask')).toEqual([['basics']])
    })

    it('does not emit completeTask when completeTask returns null', async () => {
        state.completeTask.mockReturnValue(null)
        state.tasks.value = [makeTask({ id: 't1' })]
        const wrapper = mountPanel()
        await nextTick()

        await wrapper.findComponent({ name: 'JournalTaskDetail' }).vm.$emit('complete', 't1')
        expect(wrapper.emitted('completeTask')).toBeUndefined()
    })

    it('pinning a task calls pinTask and emits pinTask', async () => {
        state.tasks.value = [makeTask({ id: 't1' })]
        const wrapper = mountPanel()
        await nextTick()

        await wrapper.findComponent({ name: 'JournalTaskDetail' }).vm.$emit('pin', 't1')
        expect(state.pinTask).toHaveBeenCalledWith('t1')
        expect(wrapper.emitted('pinTask')).toEqual([['t1']])
    })

    it('navigating emits navigateToTopic for the selected task topic', async () => {
        state.tasks.value = [makeTask({ id: 't1', topicId: 'basics' })]
        const wrapper = mountPanel()
        await nextTick()

        await wrapper.findComponent({ name: 'JournalTaskDetail' }).vm.$emit('navigate')
        expect(wrapper.emitted('navigateToTopic')).toEqual([['basics']])
    })

    it('creating from the empty-state form calls addTask', async () => {
        const payload = { title: 'New task', topicId: 'basics', category: 'core' } as any
        const wrapper = mountPanel() // no tasks
        await nextTick()

        await wrapper.findComponent({ name: 'JournalTaskDetail' }).vm.$emit('create', payload)
        expect(state.addTask).toHaveBeenCalledWith(payload)
    })

    it('sorts pinned tasks first, then newest', async () => {
        state.tasks.value = [
            makeTask({ id: 'old-pinned', isPinned: true, createdAt: '2023-01-01T00:00:00.000Z' }),
            makeTask({ id: 'new-unpinned', createdAt: '2026-01-01T00:00:00.000Z' }),
            makeTask({ id: 'mid-unpinned', createdAt: '2025-01-01T00:00:00.000Z' })
        ]
        const wrapper = mountPanel()
        await nextTick()

        const list = wrapper
            .findComponent({ name: 'JournalTaskList' })
            .props('tasks') as KnowledgeTask[]
        expect(list.map((t) => t.id)).toEqual(['old-pinned', 'new-unpinned', 'mid-unpinned'])
    })

    it('exposes red dots for tasks and categories to the children', async () => {
        state.redDotKeys = ['task:t1', 'category:core']
        state.tasks.value = [makeTask({ id: 't1' })]
        const wrapper = mountPanel()
        await nextTick()

        const list = wrapper.findComponent({ name: 'JournalTaskList' })
        expect(list.props('hasDot')('t1')).toBe(true)
        expect(list.props('hasDot')('t2')).toBe(false)

        const tabs = wrapper.findComponent({ name: 'JournalCategoryTabs' })
        expect(tabs.props('hasDot')('core')).toBe(true)
        expect(tabs.props('hasDot')('daily')).toBe(false)
    })

    it('topicForSelectedTask resolves the topic for the selected task', async () => {
        state.tasks.value = [makeTask({ id: 't1', topicId: 'basics' })]
        const wrapper = mountPanel()
        await nextTick()

        const detail = wrapper.findComponent({ name: 'JournalTaskDetail' })
        expect((detail.props('topic') as KnowledgeTopic)?.id).toBe('basics')
        expect(detail.props('totalTaskCount')).toBe(1)
    })
})
