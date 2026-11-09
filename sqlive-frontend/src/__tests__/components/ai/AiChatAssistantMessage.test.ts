import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { AiMessage } from '@/composables/useAiChat'
import AiChatAssistantMessage from '@/components/ai/AiChatAssistantMessage.vue'

// Wrap marked.parse in a controllable passthrough (ESM namespace cannot be spied on)
const { mockParse } = vi.hoisted(() => ({ mockParse: vi.fn() }))
vi.mock('marked', async (importOriginal) => {
    const actual = await importOriginal<typeof import('marked')>()
    mockParse.mockImplementation((text: string, opts: unknown) =>
        (actual.marked.parse as (t: string, o: unknown) => string)(text, opts)
    )
    return { marked: { parse: (text: string, opts: unknown) => mockParse(text, opts) } }
})

function makeMessage(overrides: Partial<AiMessage> = {}): AiMessage {
    return {
        id: 'a1',
        role: 'assistant',
        content: '**bold** statement',
        timestamp: Date.now(),
        ...overrides
    }
}

function mountMessage(props: { msg?: AiMessage; isLast?: boolean; copied?: boolean } = {}) {
    return mount(AiChatAssistantMessage, {
        props: {
            msg: props.msg ?? makeMessage(),
            isLast: props.isLast ?? true,
            copied: props.copied ?? false
        }
    })
}

describe('AiChatAssistantMessage', () => {
    it('renders markdown content as sanitized html', () => {
        const wrapper = mountMessage()
        const md = wrapper.find('.md-body')
        expect(md.exists()).toBe(true)
        expect(md.html()).toContain('<strong>bold</strong>')
    })

    it('escapes html in markdown output', () => {
        const wrapper = mountMessage({ msg: makeMessage({ content: '<script>x()</script>' }) })
        expect(wrapper.find('.md-body').html()).not.toContain('<script>')
    })

    it('renders the thinking indicator when streaming without content or reasoning', () => {
        const wrapper = mountMessage({
            msg: makeMessage({ content: '', isStreaming: true, isReasoning: false })
        })
        expect(wrapper.text()).toContain('Thinking...')
    })

    it('hides the thinking indicator once content arrives while streaming', () => {
        const wrapper = mountMessage({
            msg: makeMessage({ content: 'partial', isStreaming: true })
        })
        expect(wrapper.text()).not.toContain('Thinking...')
        expect(wrapper.text()).toContain('partial')
    })

    it('renders a reasoning block when the message has reasoning', () => {
        const wrapper = mountMessage({
            msg: makeMessage({ reasoning: 'thinking...', isReasoning: true })
        })
        expect(wrapper.text()).toContain('thinking...')
    })

    it('hides action buttons while streaming', () => {
        const wrapper = mountMessage({ msg: makeMessage({ isStreaming: true }) })
        expect(wrapper.find('button[title="重新回答"]').exists()).toBe(false)
    })

    it('emits regenerate, copy and delete from action buttons', async () => {
        const wrapper = mountMessage()
        await wrapper.find('button[title="重新回答"]').trigger('click')
        expect(wrapper.emitted('regenerate')).toEqual([['a1']])

        await wrapper.find('button[title="复制"]').trigger('click')
        expect(wrapper.emitted('copy')).toEqual([['**bold** statement']])

        await wrapper.find('button[title="删除"]').trigger('click')
        expect(wrapper.emitted('delete')).toEqual([['a1']])
    })

    it('shows the copied checkmark when copied prop is true', () => {
        const wrapper = mountMessage({ copied: true })
        expect(wrapper.find('button[title="已复制"]').find('svg.text-green-500').exists()).toBe(
            true
        )
    })

    it('renders the footer with metadata only for last, non-streaming messages with content', () => {
        const withFooter = mountMessage({ isLast: true })
        expect(withFooter.findComponent({ name: 'AiMessageFooter' }).exists()).toBe(true)

        const notLast = mountMessage({ isLast: false })
        expect(notLast.findComponent({ name: 'AiMessageFooter' }).exists()).toBe(false)

        const streaming = mountMessage({ msg: makeMessage({ isStreaming: true }) })
        expect(streaming.findComponent({ name: 'AiMessageFooter' }).exists()).toBe(false)
    })

    it('falls back to escaped <pre> when marked.parse throws', () => {
        const passthrough = mockParse.getMockImplementation()!
        mockParse.mockImplementation(() => {
            throw new Error('parse failure')
        })
        try {
            const wrapper = mountMessage({ msg: makeMessage({ content: 'a<b>&c' }) })
            const md = wrapper.find('.md-body')
            expect(md.html()).toContain('a&lt;b&gt;&amp;c')
            expect(md.html()).toContain('<pre>')
        } finally {
            mockParse.mockImplementation(passthrough)
        }
    })
})
