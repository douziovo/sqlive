import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TaskTopicSelector from '@/components/knowledge/TaskTopicSelector.vue'
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'

const topics = [
    { id: 'select', label: 'SELECT' },
    { id: 'joins', label: 'JOIN' }
] as KnowledgeTopic[]

describe('TaskTopicSelector', () => {
    it('renders topics, emits a selection, and follows external model changes', async () => {
        const wrapper = mount(TaskTopicSelector, {
            props: { topics, modelValue: 'select' }
        })
        expect(wrapper.findAll('option').map((option) => option.text())).toEqual([
            '选择知识点...',
            'SELECT',
            'JOIN'
        ])
        await wrapper.find('select').setValue('joins')
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['joins'])
        await wrapper.setProps({ modelValue: 'joins' })
        await wrapper.setProps({ modelValue: 'select' })
        expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('select')
    })
})
