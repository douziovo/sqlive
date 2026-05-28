import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AiMessageFooter from '../../components/AiMessageFooter.vue'

describe('AiMessageFooter', () => {
  it('does not render when endTime is not provided', () => {
    const wrapper = mount(AiMessageFooter, {
      props: { startTime: 1000 }
    })
    expect(wrapper.text()).toBe('')
  })

  it('renders time in seconds', () => {
    const wrapper = mount(AiMessageFooter, {
      props: { startTime: 1000, endTime: 5000 }
    })
    expect(wrapper.text()).toContain('4.0s')
  })

  it('renders total tokens when usage is provided', () => {
    const wrapper = mount(AiMessageFooter, {
      props: {
        startTime: 1000,
        endTime: 5000,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      }
    })
    expect(wrapper.text()).toContain('150 tokens')
  })

  it('renders tokens per second when timing and usage are provided', () => {
    const wrapper = mount(AiMessageFooter, {
      props: {
        startTime: 1000,
        endTime: 5000,
        firstTokenTime: 1200,
        usage: { promptTokens: 100, completionTokens: 76, totalTokens: 176 }
      }
    })
    // completionTokens (76) / (endTime - firstTokenTime) (3.8s) = 20.0
    expect(wrapper.text()).toContain('token/s')
  })

  it('renders placeholder when tps is not available', () => {
    const wrapper = mount(AiMessageFooter, {
      props: {
        startTime: 1000,
        endTime: 5000,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      }
    })
    expect(wrapper.text()).toContain('— token/s')
  })

  it('renders placeholder tokens when usage is not provided', () => {
    const wrapper = mount(AiMessageFooter, {
      props: { startTime: 1000, endTime: 5000 }
    })
    expect(wrapper.text()).toContain('— tokens')
  })

  it('handles zero generation time gracefully', () => {
    const wrapper = mount(AiMessageFooter, {
      props: {
        startTime: 1000,
        endTime: 5000,
        firstTokenTime: 5000,
        usage: { promptTokens: 10, completionTokens: 100, totalTokens: 110 }
      }
    })
    // genTime = 0, so tps should be null → shows placeholder
    expect(wrapper.text()).toContain('— token/s')
  })
})
