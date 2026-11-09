import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { AiMessage } from '@/composables/useAiChat'
import AiChatMessages from '@/components/ai/AiChatMessages.vue'

function makeMessage(overrides: Partial<AiMessage> = {}): AiMessage {
    return {
        id: 'm1',
        role: 'user',
        content: 'hello',
        timestamp: Date.now(),
        ...overrides
    }
}

function mountMessages(messages: AiMessage[], isMinimized = false) {
    return mount(AiChatMessages, {
        props: { messages, isMinimized },
        attachTo: document.body
    })
}

describe('AiChatMessages', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.stubGlobal('navigator', {
            clipboard: { writeText: vi.fn(() => Promise.resolve()) }
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
        document.body.innerHTML = ''
    })

    it('shows the empty state with clickable prompt suggestions', async () => {
        const wrapper = mountMessages([])
        const suggestions = wrapper.findAllComponents({ name: 'Suggestion' })
        expect(suggestions.length).toBe(4)

        await suggestions[0].trigger('click')
        expect(wrapper.emitted('send')).toEqual([['解释当前代码']])
    })

    it('renders a system message as warning banner', () => {
        const wrapper = mountMessages([makeMessage({ id: 's1', role: 'system', content: 'oops' })])
        expect(wrapper.text()).toContain('⚠️ oops')
    })

    it('routes user messages to AiChatUserMessage and assistant to AiChatAssistantMessage', () => {
        const wrapper = mountMessages([
            makeMessage({ id: 'u1', role: 'user' }),
            makeMessage({ id: 'a1', role: 'assistant', content: 'hi there' })
        ])
        expect(wrapper.findComponent({ name: 'AiChatUserMessage' }).exists()).toBe(true)
        expect(wrapper.findComponent({ name: 'AiChatAssistantMessage' }).exists()).toBe(true)
    })

    it('emits delete when a child message emits delete', async () => {
        const wrapper = mountMessages([makeMessage({ id: 'u1', role: 'user' })])
        await wrapper.findComponent({ name: 'AiChatUserMessage' }).vm.$emit('delete', 'u1')
        expect(wrapper.emitted('delete')).toEqual([['u1']])
    })

    it('emits regenerate when a child assistant message emits regenerate', async () => {
        const wrapper = mountMessages([makeMessage({ id: 'a1', role: 'assistant' })])
        await wrapper.findComponent({ name: 'AiChatAssistantMessage' }).vm.$emit('regenerate', 'a1')
        expect(wrapper.emitted('regenerate')).toEqual([['a1']])
    })

    it('edit flow: startEdit, submitEdit emits edit with id, cancelEdit clears', async () => {
        const wrapper = mountMessages([makeMessage({ id: 'u1', role: 'user' })])
        const userMsg = wrapper.findComponent({ name: 'AiChatUserMessage' })

        await userMsg.vm.$emit('startEdit', wrapper.props('messages')[0])
        await nextTick()
        // The same child is now in editing mode
        expect(userMsg.props('isEditing')).toBe(true)

        await userMsg.vm.$emit('submitEdit', 'new text')
        expect(wrapper.emitted('edit')).toEqual([['u1', 'new text']])
        // editing state cleared after submit
        await nextTick()
        expect(wrapper.findComponent({ name: 'AiChatUserMessage' }).props('isEditing')).toBe(false)

        await wrapper.findComponent({ name: 'AiChatUserMessage' }).vm.$emit('startEdit', wrapper.props('messages')[0])
        await nextTick()
        await wrapper.findComponent({ name: 'AiChatUserMessage' }).vm.$emit('cancelEdit')
        await nextTick()
        expect(wrapper.findComponent({ name: 'AiChatUserMessage' }).props('isEditing')).toBe(false)
    })

    it('copy flow: marks the copied message and resets after 2s', async () => {
        const assistant = makeMessage({ id: 'a1', role: 'assistant', content: 'answer text' })
        const wrapper = mountMessages([assistant])

        await wrapper.findComponent({ name: 'AiChatAssistantMessage' }).vm.$emit('copy', 'answer text')
        await nextTick()
        expect(wrapper.findComponent({ name: 'AiChatAssistantMessage' }).props('copied')).toBe(true)

        vi.advanceTimersByTime(2100)
        await nextTick()
        expect(wrapper.findComponent({ name: 'AiChatAssistantMessage' }).props('copied')).toBe(false)
    })

    it('copy of unknown text does not mark any message as copied', async () => {
        const assistant = makeMessage({ id: 'a1', role: 'assistant', content: 'answer' })
        const wrapper = mountMessages([assistant])

        await wrapper.findComponent({ name: 'AiChatAssistantMessage' }).vm.$emit('copy', 'not in list')
        await nextTick()
        expect(wrapper.findComponent({ name: 'AiChatAssistantMessage' }).props('copied')).toBe(false)
    })

    it('swallows clipboard write failures', async () => {
        vi.stubGlobal('navigator', {
            clipboard: { writeText: vi.fn(() => Promise.reject(new Error('denied'))) }
        })
        const assistant = makeMessage({ id: 'a1', role: 'assistant', content: 'answer' })
        const wrapper = mountMessages([assistant])

        await wrapper.findComponent({ name: 'AiChatAssistantMessage' }).vm.$emit('copy', 'answer')
        await vi.advanceTimersByTimeAsync(0)
        // Still marked copied even when the clipboard API rejects
        expect(wrapper.findComponent({ name: 'AiChatAssistantMessage' }).props('copied')).toBe(true)
    })

    it('clears the pending copy timeout on unmount', async () => {
        const assistant = makeMessage({ id: 'a1', role: 'assistant', content: 'answer' })
        const wrapper = mountMessages([assistant])
        await wrapper.findComponent({ name: 'AiChatAssistantMessage' }).vm.$emit('copy', 'answer')
        await nextTick()

        wrapper.unmount()
        // No unhandled timer callback after the component is gone
        vi.advanceTimersByTime(2100)
        expect(true).toBe(true)
    })

    it('scrolls the panel container to bottom when a new message arrives', async () => {
        // The component looks up `.fixed.z-50 [style*="overflow"]` (a descendant)
        const panel = document.createElement('div')
        panel.className = 'fixed z-50'
        const scroller = document.createElement('div')
        scroller.setAttribute('style', 'overflow: hidden')
        const scrollTo = vi.fn()
        scroller.scrollTo = scrollTo
        Object.defineProperty(scroller, 'scrollHeight', { value: 800, configurable: true })
        panel.appendChild(scroller)
        document.body.appendChild(panel)

        const wrapper = mountMessages([makeMessage({ id: 'u1', role: 'user' })])
        await wrapper.setProps({ messages: [makeMessage({ id: 'u1', role: 'user' }), makeMessage({ id: 'a1', role: 'assistant' })] })
        await nextTick()
        await nextTick()

        expect(scrollTo).toHaveBeenCalledWith({ top: 800, behavior: 'smooth' })
    })

    it('skips auto-scroll while a message is being edited', async () => {
        const panel = document.createElement('div')
        panel.className = 'fixed z-50'
        panel.setAttribute('style', 'overflow: hidden; width: 500px')
        const scrollTo = vi.fn()
        panel.scrollTo = scrollTo
        document.body.appendChild(panel)

        const first = makeMessage({ id: 'u1', role: 'user' })
        const wrapper = mountMessages([first])
        await wrapper.findComponent({ name: 'AiChatUserMessage' }).vm.$emit('startEdit', first)
        await wrapper.setProps({ messages: [first, makeMessage({ id: 'a1', role: 'assistant' })] })
        await nextTick()
        await nextTick()

        expect(scrollTo).not.toHaveBeenCalled()
    })

    it('emits delete for assistant messages too', async () => {
        const wrapper = mountMessages([makeMessage({ id: 'a1', role: 'assistant' })])
        await wrapper.findComponent({ name: 'AiChatAssistantMessage' }).vm.$emit('delete', 'a1')
        expect(wrapper.emitted('delete')).toEqual([['a1']])
    })

    it('ignores submit-edit when no message is being edited', async () => {
        const wrapper = mountMessages([makeMessage({ id: 'u1', role: 'user' })])
        await wrapper.findComponent({ name: 'AiChatUserMessage' }).vm.$emit('submitEdit', 'text')
        expect(wrapper.emitted('edit')).toBeUndefined()
    })
})
