import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AiChatHeader from '@/components/ai/AiChatHeader.vue'

function mountHeader(isMinimized = false) {
    return mount(AiChatHeader, { props: { isMinimized } })
}

describe('AiChatHeader', () => {
    it('renders the assistant title', () => {
        const wrapper = mountHeader()
        expect(wrapper.text()).toContain('SQL 助手')
    })

    it('uses cursor-pointer when minimized and cursor-move otherwise', () => {
        expect(mountHeader(true).find('div').classes()).toContain('cursor-pointer')
        expect(mountHeader(false).find('div').classes()).toContain('cursor-move')
    })

    it('emits clear when the clear button is clicked', async () => {
        const wrapper = mountHeader()
        await wrapper.find('button[title="清空对话"]').trigger('click')
        expect(wrapper.emitted('clear')).toHaveLength(1)
    })

    it('emits close when the close button is clicked', async () => {
        const wrapper = mountHeader()
        await wrapper.find('button[title="关闭"]').trigger('click')
        expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('emits dragStart on mousedown', async () => {
        const wrapper = mountHeader()
        await wrapper.find('div').trigger('mousedown')
        const events = wrapper.emitted('dragStart')
        expect(events).toHaveLength(1)
        expect(events![0][0]).toBeInstanceOf(MouseEvent)
    })

    it('emits toggle on dblclick', async () => {
        const wrapper = mountHeader()
        await wrapper.find('div').trigger('dblclick')
        expect(wrapper.emitted('toggle')).toHaveLength(1)
    })
})
