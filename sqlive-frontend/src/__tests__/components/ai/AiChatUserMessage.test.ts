import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import AiChatUserMessage from '@/components/ai/AiChatUserMessage.vue'
import type { AiMessage } from '@/composables/useAiChat'

function makeMessage(overrides: Partial<AiMessage> = {}): AiMessage {
    return {
        id: 'm1',
        role: 'user',
        content: 'SELECT 1',
        timestamp: Date.now(),
        ...overrides
    }
}

let wrapper: VueWrapper
let host: HTMLElement

function mountMessage(props: { msg?: AiMessage; isEditing?: boolean; isLast?: boolean } = {}) {
    // Parent with inline overflow style so the edit-mode scroll logic finds its container
    host = document.createElement('div')
    host.style.overflow = 'auto'
    document.body.appendChild(host)
    wrapper = mount(AiChatUserMessage, {
        props: {
            msg: props.msg ?? makeMessage(),
            isEditing: props.isEditing ?? false,
            isLast: props.isLast ?? true
        },
        attachTo: host
    })
    return wrapper
}

afterEach(() => {
    wrapper?.unmount()
    host?.remove()
})

describe('AiChatUserMessage', () => {
    it('renders message content in display mode', () => {
        mountMessage()
        expect(wrapper.text()).toContain('SELECT 1')
    })

    it('hides action buttons while streaming', () => {
        mountMessage({ msg: makeMessage({ isStreaming: true }) })
        expect(wrapper.find('button[title="编辑"]').exists()).toBe(false)
    })

    it('emits startEdit and delete from action buttons', async () => {
        mountMessage()
        await wrapper.find('button[title="编辑"]').trigger('click')
        expect(wrapper.emitted('startEdit')).toHaveLength(1)

        await wrapper.find('button[title="删除"]').trigger('click')
        expect(wrapper.emitted('delete')).toEqual([['m1']])
    })

    it('applies hover-opacity class to non-last messages', () => {
        mountMessage({ isLast: true })
        const actionRow = wrapper.find('button[title="编辑"]').element.parentElement
        expect(actionRow?.className).toContain('opacity-100')

        mountMessage({ isLast: false })
        const hiddenRow = wrapper.find('button[title="编辑"]').element.parentElement
        expect(hiddenRow?.className).toContain('opacity-0')
    })

    it('renders the edit textarea when editing', async () => {
        mountMessage({ isEditing: true })
        const textarea = wrapper.find('textarea')
        expect(textarea.exists()).toBe(true)
        await textarea.setValue(' edited text ')
        const updateBtn = wrapper.findAll('button').find((b) => b.text() === '更新')
        expect(updateBtn).toBeDefined()
        await updateBtn!.trigger('click')
        expect(wrapper.emitted('submitEdit')).toEqual([['edited text']])
    })

    it('cancel button emits cancelEdit', async () => {
        mountMessage({ isEditing: true })
        const cancelBtn = wrapper.findAll('button').find((b) => b.text() === '取消')
        await cancelBtn!.trigger('click')
        expect(wrapper.emitted('cancelEdit')).toHaveLength(1)
    })

    it('does not submit empty or whitespace edits', async () => {
        mountMessage({ isEditing: true })
        await wrapper.find('textarea').setValue('   ')
        const updateBtn = wrapper.findAll('button').find((b) => b.text() === '更新')
        await updateBtn!.trigger('click')
        expect(wrapper.emitted('submitEdit')).toBeUndefined()
    })

    it('submits on Enter and cancels on Escape inside the edit textarea', async () => {
        mountMessage({ isEditing: true })
        const textarea = wrapper.find('textarea')
        await textarea.setValue('via enter')
        await textarea.trigger('keydown.enter')
        expect(wrapper.emitted('submitEdit')).toEqual([['via enter']])

        await textarea.trigger('keydown.esc')
        expect(wrapper.emitted('cancelEdit')).toHaveLength(1)
    })

    it('preloads edit content, focuses and caps height when entering edit mode', async () => {
        mountMessage({ isEditing: false })
        await wrapper.setProps({ isEditing: true })
        await nextTick()
        await nextTick()

        const textarea = wrapper.find('textarea')
        const el = textarea.element as HTMLTextAreaElement
        expect(el.value).toBe('SELECT 1')

        // autoResizeEdit ran: jsdom reports scrollHeight 0 initially
        expect(el.style.height).toBe('0px')

        // typing re-runs autoResizeEdit with the new scrollHeight (clamped at 300px)
        Object.defineProperty(el, 'scrollHeight', { value: 500, configurable: true })
        await textarea.trigger('input')
        expect(el.style.height).toBe('300px')
    })
})
