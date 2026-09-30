import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

describe('InputGroupAddon', () => {
    it('focuses the adjacent input when its label is clicked', async () => {
        const wrapper = mount(
            defineComponent({
                components: { InputGroup, InputGroupAddon, InputGroupInput },
                template:
                    '<InputGroup><InputGroupInput /><InputGroupAddon>Search</InputGroupAddon></InputGroup>'
            }),
            { attachTo: document.body }
        )
        try {
            const input = wrapper.find('input').element
            await wrapper.find('[data-slot="input-group-addon"]').trigger('click')
            expect(document.activeElement).toBe(input)
        } finally {
            wrapper.unmount()
        }
    })

    it('leaves focus on a button inside the addon', async () => {
        const wrapper = mount(
            defineComponent({
                components: { InputGroup, InputGroupAddon, InputGroupInput },
                template:
                    '<InputGroup><InputGroupInput /><InputGroupAddon><button>Clear</button></InputGroupAddon></InputGroup>'
            }),
            { attachTo: document.body }
        )
        try {
            const button = wrapper.find('button')
            button.element.focus()
            await button.trigger('click')
            expect(document.activeElement).toBe(button.element)
        } finally {
            wrapper.unmount()
        }
    })
})
