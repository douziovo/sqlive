import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TaskCreateForm from '@/components/knowledge/TaskCreateForm.vue'
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'

const topic: KnowledgeTopic = {
    id: 'joins',
    label: 'Joins',
    description: '',
    keywords: [],
    patterns: [],
    difficulty: 1,
    prerequisites: [],
    nextTopics: [],
    category: 'sql'
}

describe('TaskCreateForm', () => {
    it('validates and normalizes a detail task, then resets the form', async () => {
        const wrapper = mount(TaskCreateForm, { props: { topicId: 'select' } })
        await wrapper.find('.task-create-form__btn--primary').trigger('click')
        expect(wrapper.emitted('create')).toBeUndefined()

        await wrapper.find('input[type="text"]').setValue('  Learn joins  ')
        await wrapper.find('input[type="date"]').setValue('2026-10-01')
        await wrapper.findAll('select')[0]!.setValue('high')
        await wrapper.findAll('select')[1]!.setValue('deep-dive')
        await wrapper.find('textarea').setValue(' read docs \n\n try query ')
        await wrapper.find('.task-create-form__input--notes').setValue('with examples')
        await wrapper.find('input[type="text"]').trigger('keydown.enter')

        expect(wrapper.emitted('create')?.[0]?.[0]).toEqual({
            title: 'Learn joins',
            dueDate: '2026-10-01',
            notes: 'with examples',
            priority: 'high',
            topicId: 'select',
            category: 'deep-dive',
            substeps: ['read docs', 'try query']
        })
        expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('')
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
        expect((wrapper.findAll('select')[0]!.element as HTMLSelectElement).value).toBe('medium')
        await wrapper.find('input[type="text"]').trigger('keydown.esc')
        expect(wrapper.emitted('cancel')).toHaveLength(1)
    })

    it('uses the selected topic in global mode and follows topic prop updates', async () => {
        const wrapper = mount(TaskCreateForm, {
            props: { mode: 'global', topics: [topic], topicId: 'old' }
        })
        expect(wrapper.find('.task-topic-selector').exists()).toBe(true)
        await wrapper.setProps({ topicId: 'joins' })
        expect((wrapper.find('.task-topic-selector').element as HTMLSelectElement).value).toBe(
            'joins'
        )
        await wrapper.find('input[type="text"]').setValue('Practice')
        await wrapper.find('.task-create-form__btn--primary').trigger('click')
        expect(wrapper.emitted('create')?.[0]?.[0]).toMatchObject({
            title: 'Practice',
            topicId: 'joins',
            dueDate: undefined,
            substeps: undefined
        })
        await wrapper.find('.task-create-form__btn--cancel').trigger('click')
        expect(wrapper.emitted('cancel')).toHaveLength(1)
    })
})
