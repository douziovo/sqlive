import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SessionRecoveryToast from '@/components/SessionRecoveryToast.vue'

afterEach(() => vi.useRealTimers())

describe('SessionRecoveryToast', () => {
    it('closes three seconds after becoming visible', async () => {
        vi.useFakeTimers()
        const wrapper = mount(SessionRecoveryToast, { props: { visible: false } })
        await wrapper.setProps({ visible: true })
        expect(document.body.textContent).toContain('会话已恢复')
        vi.advanceTimersByTime(2999)
        expect(wrapper.emitted('close')).toBeUndefined()
        vi.advanceTimersByTime(1)
        expect(wrapper.emitted('close')).toHaveLength(1)
        wrapper.unmount()
    })

    it('cancels the old timer when hidden and on unmount', async () => {
        vi.useFakeTimers()
        const wrapper = mount(SessionRecoveryToast, { props: { visible: false } })
        await wrapper.setProps({ visible: true })
        vi.advanceTimersByTime(1000)
        await wrapper.setProps({ visible: false })
        vi.advanceTimersByTime(3000)
        expect(wrapper.emitted('close')).toBeUndefined()
        await wrapper.setProps({ visible: true })
        wrapper.unmount()
        vi.advanceTimersByTime(3000)
        expect(wrapper.emitted('close')).toBeUndefined()
    })
})
