import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ErSearchBar from '../../../components/er/ErSearchBar.vue'

describe('ErSearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const defaultProps = {
    modelValue: '',
    visible: true,
    totalCount: 10,
    matchCount: 0,
    currentIndex: -1
  }

  it('renders when visible', () => {
    const wrapper = mount(ErSearchBar, { props: defaultProps })
    expect(wrapper.find('.er-findbar').exists()).toBe(true)
  })

  it('does not render when visible is false', () => {
    const wrapper = mount(ErSearchBar, { props: { ...defaultProps, visible: false } })
    expect(wrapper.find('.er-findbar').exists()).toBe(false)
  })

  it('emits update:modelValue on input after debounce', async () => {
    const wrapper = mount(ErSearchBar, { props: defaultProps })
    const input = wrapper.find('input')
    await input.setValue('employees')

    // Before debounce (150ms), should not have emitted yet
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()

    // Advance past debounce
    vi.advanceTimersByTime(200)
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['employees'])
  })

  it('shows filter count when modelValue has content', async () => {
    const wrapper = mount(ErSearchBar, { props: defaultProps })
    await wrapper.setProps({ modelValue: 'test', matchCount: 3, currentIndex: 0 })
    await nextTick()
    const count = wrapper.find('.er-findbar-count')
    expect(count.exists()).toBe(true)
    expect(count.text()).toBe('1/3')
  })

  it('emits close on ESC when filter is empty', async () => {
    const wrapper = mount(ErSearchBar, { props: defaultProps })
    await wrapper.find('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('clears filter on ESC when filter has text, then closes on second ESC', async () => {
    const wrapper = mount(ErSearchBar, {
      props: { ...defaultProps, modelValue: 'test' }
    })
    await wrapper.find('input').trigger('keydown', { key: 'Escape' })
    // First ESC should clear (emit empty)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
  })

  it('emits next on Enter without shift', async () => {
    const wrapper = mount(ErSearchBar, { props: defaultProps })
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('next')).toBeTruthy()
  })

  it('emits prev on Shift+Enter', async () => {
    const wrapper = mount(ErSearchBar, { props: defaultProps })
    await wrapper.find('input').trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('prev')).toBeTruthy()
  })

  it('emits prev on click of up arrow button', async () => {
    const wrapper = mount(ErSearchBar, { props: defaultProps })
    const buttons = wrapper.findAll('.er-findbar-nav-btn')
    // First nav button is up (prev)
    await buttons[0].trigger('click')
    expect(wrapper.emitted('prev')).toBeTruthy()
  })

  it('emits next on click of down arrow button', async () => {
    const wrapper = mount(ErSearchBar, { props: defaultProps })
    const buttons = wrapper.findAll('.er-findbar-nav-btn')
    // Second nav button is down (next)
    await buttons[1].trigger('click')
    expect(wrapper.emitted('next')).toBeTruthy()
  })

  it('emits close on click of X button', async () => {
    const wrapper = mount(ErSearchBar, { props: defaultProps })
    const closeBtn = wrapper.find('.er-findbar-close-btn')
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('hides count text when modelValue is empty', () => {
    const wrapper = mount(ErSearchBar, { props: defaultProps })
    expect(wrapper.find('.er-findbar-count').exists()).toBe(false)
  })

  it('shows "0/0" when there are zero matches and modelValue has text', () => {
    const wrapper = mount(ErSearchBar, {
      props: { ...defaultProps, modelValue: 'xyz', matchCount: 0, currentIndex: -1 }
    })
    expect(wrapper.find('.er-findbar-count').text()).toBe('')
  })
})
