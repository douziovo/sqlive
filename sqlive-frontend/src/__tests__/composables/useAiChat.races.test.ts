import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { setupAiChat, tick, type AiChatSetup } from '../test-utils'

const response = (text = 'answer') =>
    new Response(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`, {
        headers: { 'Content-Type': 'text/event-stream' }
    })

describe('AI request ownership and history', () => {
    let setup: AiChatSetup
    beforeEach(async () => {
        setup = await setupAiChat()
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    const context = () => ({
        executionError: ref(null),
        code: ref('SELECT 1;'),
        tablesSource: () => []
    })

    it('keeps the next request loading when a cancelled request finishes late', async () => {
        let resolveFirst!: (response: Response) => void
        setup.fetchSpy
            .mockImplementationOnce(
                () =>
                    new Promise<Response>((resolve) => {
                        resolveFirst = resolve
                    })
            )
            .mockResolvedValueOnce(new Response(new ReadableStream()))
        const chat = setup.useAiChat(context())
        const first = chat.sendMessage('first')
        await tick(0)
        chat.cancelStream()
        const second = chat.sendMessage('second')
        await tick(0)
        resolveFirst(response('stale answer'))
        await first

        expect(chat.isLoading.value).toBe(true)
        expect(chat.messages.value[1].content).toBe('')
        await chat.sendMessage('third')
        expect(setup.fetchSpy).toHaveBeenCalledTimes(2)
        chat.cancelStream()
        await second
        expect(chat.isLoading.value).toBe(false)
        expect(setup.fetchSpy.mock.calls[1][1].signal.aborted).toBe(true)
    })

    it('clears and cancels the conversation without accepting late chunks', async () => {
        let resolve!: (response: Response) => void
        setup.fetchSpy.mockImplementationOnce(
            () =>
                new Promise<Response>((done) => {
                    resolve = done
                })
        )
        const chat = setup.useAiChat(context())
        const pending = chat.sendMessage('question')
        await tick(0)
        chat.clearMessages()
        resolve(response('late answer'))
        await pending

        expect(chat.messages.value).toEqual([])
        expect(chat.isLoading.value).toBe(false)
        expect(setup.fetchSpy.mock.calls[0][1].signal.aborted).toBe(true)
    })

    it('sends the current user turn once and reuses that turn on regeneration', async () => {
        setup.fetchSpy.mockImplementation(() => Promise.resolve(response()))
        const chat = setup.useAiChat(context())
        await chat.sendMessage('first')
        await chat.sendMessage('second')

        const bodies = setup.fetchSpy.mock.calls.map(([, options]) => JSON.parse(options.body))
        expect(bodies[0].history).toEqual([])
        expect(bodies[1].history).toEqual([
            { role: 'user', content: 'first' },
            { role: 'assistant', content: 'answer' }
        ])
        chat.regenerateMessage(chat.messages.value[1].id)
        await tick(0)
        expect(chat.messages.value.map((message) => message.role)).toEqual(['user', 'assistant'])
        expect(chat.messages.value[0].content).toBe('first')
        expect(JSON.parse(setup.fetchSpy.mock.calls[2][1].body).history).toEqual([])
    })
})
