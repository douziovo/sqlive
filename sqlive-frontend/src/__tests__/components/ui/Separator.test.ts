import {mount} from '@vue/test-utils'
import {describe, expect, it} from 'vitest'
import Separator from '@/components/ui/separator/Separator.vue'

describe('Separator', () => {
    it('renders with default horizontal orientation and decorative role', () => {
        const wrapper = mount(Separator)
        expect(wrapper.attributes('data-slot')).toBe('separator')
        expect(wrapper.attributes('data-orientation')).toBe('horizontal')
        expect(wrapper.attributes('role')).toBe('none')
    })

    it('renders with vertical orientation prop', () => {
        const wrapper = mount(Separator, {
            props: {orientation: 'vertical'},
        })
        expect(wrapper.attributes('data-orientation')).toBe('vertical')
    })
})
