import { shallowMount } from '@vue/test-utils'
import type { Component } from 'vue'
import { describe, expect, it } from 'vitest'

const wrappers = Object.entries(
    import.meta.glob<{ default: Component }>('../../../components/ui/**/*.vue', { eager: true })
).filter(([path]) => !path.includes('/command/'))

describe('UI wrappers', () => {
    it.each(wrappers)('%s forwards its class to the primitive', (path, module) => {
        const wrapper = shallowMount(module.default, {
            props: {
                class: 'custom-class',
                ...(path.includes('AvatarImage') ? { src: '/avatar.png' } : {}),
                ...(path.includes('RadioItem') || path.includes('SelectItem.vue')
                    ? { value: 'item' }
                    : {})
            },
            slots: { default: 'Example' },
            global: { renderStubDefaultSlot: true }
        })

        expect(wrapper.html()).toContain('custom-class')
    })
})
