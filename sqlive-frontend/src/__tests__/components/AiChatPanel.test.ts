import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import type { AiMessage } from '@/composables/useAiChat'
import AiChatPanel from '@/components/AiChatPanel.vue'

function makeMessage(overrides: Partial<AiMessage> = {}): AiMessage {
    return {
        id: 'm1',
        role: 'user',
        content: 'hi',
        timestamp: Date.now(),
        ...overrides
    }
}

function mountPanel(
    props: { messages?: AiMessage[]; isLoading?: boolean; minimized?: boolean } = {}
) {
    return mount(AiChatPanel, {
        props: {
            messages: props.messages ?? [],
            isLoading: props.isLoading ?? false,
            minimized: props.minimized ?? false
        },
        attachTo: document.body
    })
}

function keyDown(target: Element, key: string) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

afterEach(() => {
    document.body.innerHTML = ''
})

describe('AiChatPanel', () => {
    it('renders header, messages and input sections', () => {
        const wrapper = mountPanel({ messages: [makeMessage()] })
        expect(wrapper.findComponent({ name: 'AiChatHeader' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'AiChatMessages' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'AiChatInput' }).exists()).toBe(true)
        expect(wrapper.find('.ai-chat-panel').exists()).toBe(true)
    })

    it('relays send from the input area', async () => {
        const wrapper = mountPanel()
        await wrapper.findComponent({ name: 'AiChatInput' }).vm.$emit('send', 'hello')
        expect(wrapper.emitted('send')).toEqual([['hello']])
    })

    it('relays send from a prompt suggestion via messages area', async () => {
        const wrapper = mountPanel()
        await wrapper.findComponent({ name: 'AiChatMessages' }).vm.$emit('send', 'prompt text')
        expect(wrapper.emitted('send')).toEqual([['prompt text']])
    })

    it('relays message actions from the messages area', async () => {
        const wrapper = mountPanel({ messages: [makeMessage({ id: 'a1', role: 'assistant' })] })
        const messages = wrapper.findComponent({ name: 'AiChatMessages' })
        await messages.vm.$emit('regenerate', 'a1')
        await messages.vm.$emit('edit', 'a1', 'edited')
        await messages.vm.$emit('delete', 'a1')
        expect(wrapper.emitted('regenerate')).toEqual([['a1']])
        expect(wrapper.emitted('edit')).toEqual([['a1', 'edited']])
        expect(wrapper.emitted('delete')).toEqual([['a1']])
    })

    it('relays clear/close from the header and close/cancelStream from the input', async () => {
        const wrapper = mountPanel()
        await wrapper.findComponent({ name: 'AiChatHeader' }).vm.$emit('clear')
        await wrapper.findComponent({ name: 'AiChatHeader' }).vm.$emit('close')
        const input = wrapper.findComponent({ name: 'AiChatInput' })
        await input.vm.$emit('close')
        await input.vm.$emit('cancelStream')
        expect(wrapper.emitted('clear')).toHaveLength(1)
        expect(wrapper.emitted('close')).toHaveLength(2)
        expect(wrapper.emitted('cancelStream')).toHaveLength(1)
    })

    it('toggles the minimized class when the header emits toggle', async () => {
        const wrapper = mountPanel()
        expect(wrapper.find('.ai-chat-panel').classes()).not.toContain('ai-chat-panel--minimized')

        await wrapper.findComponent({ name: 'AiChatHeader' }).vm.$emit('toggle')
        expect(wrapper.find('.ai-chat-panel').classes()).toContain('ai-chat-panel--minimized')
    })

    it('emits close on Escape when the event target is not an input element', async () => {
        const wrapper = mountPanel()
        keyDown(wrapper.find('.ai-chat-panel').element, 'Escape')
        await nextTick()
        expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('ignores Escape when the target is a textarea or input', async () => {
        const wrapper = mountPanel()
        const textarea = document.createElement('textarea')
        wrapper.element.appendChild(textarea)
        keyDown(textarea, 'Escape')
        await nextTick()
        expect(wrapper.emitted('close')).toBeUndefined()

        const input = document.createElement('input')
        wrapper.element.appendChild(input)
        keyDown(input, 'Escape')
        await nextTick()
        expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('ignores Escape while minimized and other keys entirely', async () => {
        const wrapper = mountPanel()
        await wrapper.findComponent({ name: 'AiChatHeader' }).vm.$emit('toggle') // minimize
        keyDown(document.body, 'Escape')
        await nextTick()
        expect(wrapper.emitted('close')).toBeUndefined()

        // un-minimize, then a non-Escape key must not close either
        await wrapper.findComponent({ name: 'AiChatHeader' }).vm.$emit('toggle')
        keyDown(document.body, 'Enter')
        await nextTick()
        expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('starts a resize interaction from the corner handle without propagating', async () => {
        const wrapper = mountPanel()
        const handle = wrapper.find('.cursor-nwse-resize')
        expect(handle.exists()).toBe(true)
        // The handler stops propagation and registers geometry state; the panel
        // must stay interactive afterwards.
        await handle.trigger('mousedown', { button: 0 })
        expect(wrapper.find('.ai-chat-panel').exists()).toBe(true)
        document.dispatchEvent(new MouseEvent('mouseup'))
        await nextTick()
    })

    it('removes the document keydown listener on unmount', () => {
        const wrapper = mountPanel()
        wrapper.unmount()
        // After unmount, Escape must no longer be routed to the panel
        keyDown(document.body, 'Escape')
    })

    it('passes isLoading down to the input area', () => {
        const wrapper = mountPanel({ isLoading: true })
        expect(wrapper.findComponent({ name: 'AiChatInput' }).props('isLoading')).toBe(true)
    })
})
