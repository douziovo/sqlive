import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StepProgress from '@/components/knowledge/StepProgress.vue'
import type { TaskSubstep } from '@/composables/useKnowledgeTasks'

const substeps: TaskSubstep[] = [
    { id: 'done', label: 'Read', status: 'done' },
    { id: 'active', label: 'Practice', status: 'active' },
    { id: 'locked', label: 'Review', status: 'locked' }
]

describe('StepProgress', () => {
    it('shows progress but does not toggle in read-only mode', async () => {
        const wrapper = mount(StepProgress, { props: { substeps } })
        expect(wrapper.findAll('.step-progress__connector')).toHaveLength(2)
        expect(wrapper.find('.step-progress__node--done svg').exists()).toBe(true)
        await wrapper.find('.step-progress__node--active').trigger('click')
        expect(wrapper.emitted('toggleStep')).toBeUndefined()
    })

    it('toggles completed or active steps while keeping locked steps inert', async () => {
        const wrapper = mount(StepProgress, { props: { substeps, editable: true } })
        await wrapper.find('.step-progress__node--done').trigger('click')
        await wrapper.find('.step-progress__node--active').trigger('click')
        await wrapper.find('.step-progress__node--locked').trigger('click')
        expect(wrapper.emitted('toggleStep')).toEqual([['done'], ['active']])
    })
})
