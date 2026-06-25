import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Input from '@/components/ui/input/Input.vue'

describe('Input', () => {
  it('renders an input element with data-slot="input"', () => {
    const wrapper = mount(Input)
    const inputEl = wrapper.find('input')
    expect(inputEl.exists()).toBe(true)
    expect(inputEl.attributes('data-slot')).toBe('input')
  })

  it('v-model updates modelValue on input event', async () => {
    const wrapper = mount(Input, {
      props: { modelValue: 'hello' },
    })
    const inputEl = wrapper.find('input')
    expect((inputEl.element as HTMLInputElement).value).toBe('hello')

    await inputEl.setValue('world')
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe('world')
  })
})
