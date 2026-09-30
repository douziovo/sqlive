import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator
} from '@/components/ui/command'

const palette = defineComponent({
    components: {
        Command,
        CommandEmpty,
        CommandGroup,
        CommandInput,
        CommandItem,
        CommandList,
        CommandSeparator
    },
    template: `<Command>
        <CommandInput placeholder="Search" />
        <CommandList>
            <CommandGroup heading="Fruit">
                <CommandItem value="apple">Apple</CommandItem>
                <CommandItem value="banana">Banana</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandEmpty>No matches</CommandEmpty>
        </CommandList>
    </Command>`
})

describe('command palette', () => {
    it('filters items, hides empty groups, and shows the empty state', async () => {
        const wrapper = mount(palette, { attachTo: document.body })
        try {
            expect(wrapper.findAll('[data-slot="command-item"]')).toHaveLength(2)
            expect(wrapper.find('[data-slot="command-empty"]').exists()).toBe(false)

            await wrapper.find('input').setValue('Apple')
            await nextTick()
            expect(wrapper.findAll('[data-slot="command-item"]')).toHaveLength(1)
            expect(wrapper.find('[data-slot="command-item"]').text()).toBe('Apple')

            await wrapper.find('input').setValue('missing')
            await nextTick()
            expect(wrapper.findAll('[data-slot="command-item"]')).toHaveLength(0)
            expect(wrapper.find('[data-slot="command-group"]').attributes('hidden')).toBeDefined()
            expect(wrapper.find('[data-slot="command-empty"]').text()).toBe('No matches')

            await wrapper.find('input').setValue('')
            await nextTick()
            expect(wrapper.findAll('[data-slot="command-item"]')).toHaveLength(2)
            expect(wrapper.find('[data-slot="command-empty"]').exists()).toBe(false)
        } finally {
            wrapper.unmount()
        }
    })

    it('provides a default accessible title and description in its dialog', async () => {
        const wrapper = mount(CommandDialog, {
            props: { open: true },
            attachTo: document.body
        })
        try {
            await flushPromises()
            expect(document.body.textContent).toContain('Command Palette')
            expect(document.body.textContent).toContain('Search for a command to run...')
        } finally {
            wrapper.unmount()
        }
    })
})
