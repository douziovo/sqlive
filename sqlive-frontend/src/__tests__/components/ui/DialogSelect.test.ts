import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DialogContent } from 'reka-ui'
import { Dialog, DialogScrollContent } from '@/components/ui/dialog'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import CommandItem from '@/components/ui/command/CommandItem.vue'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandList
} from '@/components/ui/command'
// NOTE: SelectScrollUpButton/SelectScrollDownButton fallback icons are NOT covered
// here: reka-ui mounts them through <Presence :present="canScrollUp">, and jsdom
// reports zero scroll metrics, so the buttons never become present. Verified by
// probe: with the select open, `[data-slot="select-content"]` and `[role="option"]`
// render, but `[data-slot="select-scroll-up-button"]` does not.

describe('DialogFooter', () => {
    it('renders slot content', () => {
        const wrapper = mount(DialogFooter, { slots: { default: 'Actions' } })
        expect(wrapper.attributes('data-slot')).toBe('dialog-footer')
        expect(wrapper.text()).toContain('Actions')
    })

    it('shows the Close button only when showCloseButton is set', () => {
        const host = (showCloseButton?: boolean) =>
            mount(
                defineComponent({
                    components: { Dialog, DialogFooter },
                    props: { showCloseButton: Boolean },
                    template: `<Dialog :open="true">
                        <DialogFooter :show-close-button="showCloseButton">x</DialogFooter>
                    </Dialog>`
                }),
                { props: { showCloseButton: showCloseButton ?? false } }
            )

        expect(host().text()).not.toContain('Close')
        expect(host(true).text()).toContain('Close')
    })
})
describe('DialogScrollContent', () => {
    afterEach(() => {
        document.body.innerHTML = ''
    })

    function mountDialog() {
        return mount(
            defineComponent({
                components: { Dialog, DialogScrollContent },
                template: `<Dialog :open="true">
                    <DialogScrollContent class="scroll-content-test">
                        <p>Body</p>
                    </DialogScrollContent>
                </Dialog>`
            }),
            { attachTo: document.body }
        )
    }

    it('renders its content through the portal', async () => {
        const wrapper = mountDialog()
        await flushPromises()
        expect(document.body.textContent).toContain('Body')
        wrapper.unmount()
    })

    it('prevents close when the pointer-down lands on the scrollbar area', async () => {
        const wrapper = mountDialog()
        await flushPromises()
        const content = wrapper.findComponent(DialogContent)
        expect(content.exists()).toBe(true)

        const preventDefault = vi.fn()
        const makeEvent = (offsetX: number, offsetY: number) => ({
            preventDefault,
            detail: {
                originalEvent: {
                    offsetX,
                    offsetY,
                    target: { clientWidth: 100, clientHeight: 100 }
                }
            }
        })
        // Click beyond the right edge (scrollbar drag) → preventDefault
        content.vm.$emit('pointerDownOutside', makeEvent(150, 50))
        expect(preventDefault).toHaveBeenCalledTimes(1)
        // Click beyond the bottom edge → preventDefault
        content.vm.$emit('pointerDownOutside', makeEvent(50, 150))
        expect(preventDefault).toHaveBeenCalledTimes(2)
        // Click inside the overlay → dialog closes normally
        content.vm.$emit('pointerDownOutside', makeEvent(50, 50))
        expect(preventDefault).toHaveBeenCalledTimes(2)
        wrapper.unmount()
    })
})

describe('CommandItem', () => {
    it('clears the search when an item is selected', async () => {
        const wrapper = mount(
            defineComponent({
                components: {
                    Command,
                    CommandEmpty,
                    CommandGroup,
                    CommandInput,
                    CommandItem,
                    CommandList
                },
                template: `<Command>
                    <CommandInput placeholder="Search" />
                    <CommandList>
                        <CommandGroup heading="Fruit">
                            <CommandItem value="apple">Apple</CommandItem>
                            <CommandItem value="banana">Banana</CommandItem>
                        </CommandGroup>
                        <CommandEmpty>No matches</CommandEmpty>
                    </CommandList>
                </Command>`
            }),
            { attachTo: document.body }
        )
        try {
            await wrapper.find('input').setValue('Apple')
            await nextTick()
            const item = wrapper.findAll('[data-slot="command-item"]')[0]
            expect(item).toBeTruthy()
            await item.trigger('click')
            await flushPromises()
            // Selecting an item resets the command palette search
            expect((wrapper.find('input').element as HTMLInputElement).value).toBe('')
        } finally {
            wrapper.unmount()
        }
    })
})
