import {mount} from '@vue/test-utils'
import {describe, expect, it} from 'vitest'
import Textarea from '@/components/ui/textarea/Textarea.vue'

describe('Textarea', () => {
    it('renders a textarea element with data-slot="textarea"', () => {
        const wrapper = mount(Textarea)
        const textareaEl = wrapper.find('textarea')
        expect(textareaEl.exists()).toBe(true)
        expect(textareaEl.attributes('data-slot')).toBe('textarea')
    })

    it('v-model updates modelValue on input event', async () => {
        const wrapper = mount(Textarea, {
            props: {modelValue: 'content'},
        })
        const textareaEl = wrapper.find('textarea')
        expect((textareaEl.element as HTMLTextAreaElement).value).toBe('content')

        await textareaEl.setValue('new content')
        expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe('new content')
    })
})
