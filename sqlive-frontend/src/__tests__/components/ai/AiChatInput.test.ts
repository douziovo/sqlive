import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AiChatInput from '@/components/ai/AiChatInput.vue'

type TestEmits = {
    send: string[]
    close: number
    cancelStream: number
}

function mountInput(props: { isLoading?: boolean; isMinimized?: boolean } = {}) {
    return mount(AiChatInput, {
        props: {
            isLoading: props.isLoading ?? false,
            isMinimized: props.isMinimized ?? false
        },
        attachTo: document.body
    })
}

function emittedNames(wrapper: ReturnType<typeof mountInput>): TestEmits {
    return {
        send: (wrapper.emitted('send') ?? []).map((args) => args[0] as string),
        close: wrapper.emitted('close')?.length ?? 0,
        cancelStream: wrapper.emitted('cancelStream')?.length ?? 0
    }
}

describe('AiChatInput', () => {
    it('shows the stop button while loading and emits cancelStream on click', async () => {
        const wrapper = mountInput({ isLoading: true })
        const stop = wrapper.find('button[title="停止生成"]')
        expect(stop.exists()).toBe(true)
        // No send button rendered while loading
        expect(wrapper.findAll('button')).toHaveLength(1)

        await stop.trigger('click')
        expect(emittedNames(wrapper).cancelStream).toBe(1)
        wrapper.unmount()
    })

    it('disables the textarea while loading', () => {
        const wrapper = mountInput({ isLoading: true })
        expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
        wrapper.unmount()
    })

    it('sends trimmed text on send button click and clears input', async () => {
        const wrapper = mountInput()
        const textarea = wrapper.find('textarea')
        await textarea.setValue('  hello world  ')
        await wrapper.find('button').trigger('click')

        expect(emittedNames(wrapper).send).toEqual(['hello world'])
        expect((textarea.element as HTMLTextAreaElement).value).toBe('')
        wrapper.unmount()
    })

    it('send button is disabled when input is empty or whitespace', async () => {
        const wrapper = mountInput()
        const button = wrapper.find('button')
        expect(button.attributes('disabled')).toBeDefined()

        await wrapper.find('textarea').setValue('   ')
        expect(button.attributes('disabled')).toBeDefined()
        wrapper.unmount()
    })

    it('does not send when the Enter keydown happens during IME composition', async () => {
        const wrapper = mountInput()
        const textarea = wrapper.find('textarea')
        await textarea.setValue('composing')
        await textarea.trigger('keydown', { key: 'Enter', isComposing: true })
        expect(emittedNames(wrapper).send).toEqual([])
        wrapper.unmount()
    })

    it('sends on Enter keydown (exact) and does not send on Shift+Enter', async () => {
        const wrapper = mountInput()
        const textarea = wrapper.find('textarea')
        await textarea.setValue('enter sends')
        await textarea.trigger('keydown.enter')
        expect(emittedNames(wrapper).send).toEqual(['enter sends'])

        await textarea.setValue('shift does not')
        await textarea.trigger('keydown.enter', { shiftKey: true })
        expect(emittedNames(wrapper).send).toEqual(['enter sends'])
        wrapper.unmount()
    })

    it('emits close on Escape in the textarea', async () => {
        const wrapper = mountInput()
        await wrapper.find('textarea').trigger('keydown.esc')
        expect(emittedNames(wrapper).close).toBe(1)
        wrapper.unmount()
    })

    it('autoResize caps textarea height at 120px', async () => {
        const wrapper = mountInput()
        const el = wrapper.find('textarea').element as HTMLTextAreaElement
        Object.defineProperty(el, 'scrollHeight', { value: 500, configurable: true })
        await wrapper.find('textarea').trigger('input')
        expect(el.style.height).toBe('120px')

        // Small content shrinks back to scrollHeight below the cap
        Object.defineProperty(el, 'scrollHeight', { value: 40, configurable: true })
        await wrapper.find('textarea').trigger('input')
        expect(el.style.height).toBe('40px')
        wrapper.unmount()
    })

    it('hides the input bar when minimized (v-show)', () => {
        const wrapper = mountInput({ isMinimized: true })
        const root = wrapper.find('div')
        expect((root.element as HTMLElement).style.display).toBe('none')
        wrapper.unmount()
    })
})
