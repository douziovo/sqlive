import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Button from '@/components/ui/button/Button.vue'

describe('Button', () => {
  it('renders with default slot text content', () => {
    const wrapper = mount(Button, {
      slots: { default: 'Save' },
    })
    expect(wrapper.text()).toBe('Save')
    expect(wrapper.attributes('data-slot')).toBe('button')
  })

  it('passes variant and size props to data attributes', () => {
    const wrapper = mount(Button, {
      props: { variant: 'destructive', size: 'lg' },
    })
    expect(wrapper.attributes('data-variant')).toBe('destructive')
    expect(wrapper.attributes('data-size')).toBe('lg')
  })

  it('renders with as-child pattern (asChild=true + child slot)', () => {
    const wrapper = mount(Button, {
      props: { asChild: true, as: 'a' },
      slots: { default: '<a href="#">Link</a>' },
    })
    // When asChild is true, Primitive passes through to the child element
    // The rendered element should be an anchor, not a button
    expect(wrapper.element.tagName).not.toBe('BUTTON')
  })
})
