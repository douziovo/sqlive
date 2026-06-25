import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CommandShortcut from '@/components/ui/command/CommandShortcut.vue'

describe('CommandShortcut', () => {
  it('renders span with default slot text', () => {
    const wrapper = mount(CommandShortcut, {
      slots: { default: 'Ctrl+K' },
    })
    expect(wrapper.text()).toBe('Ctrl+K')
    expect(wrapper.element.tagName).toBe('SPAN')
  })

  it('accepts and applies custom class prop', () => {
    const wrapper = mount(CommandShortcut, {
      props: { class: 'my-custom' },
    })
    expect(wrapper.classes()).toContain('my-custom')
  })
})
