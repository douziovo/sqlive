import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { AiMessage } from '../composables/useAiChat'
import { type AiChatSetup, setupAiChat } from './test-utils'

describe('useAiChat', () => {
    let useAiChat: AiChatSetup['useAiChat']
    let fetchSpy: ReturnType<typeof vi.fn>

    const mockSqlEngine = () => ({
        executionError: ref<{ line: number; message: string } | null>(null),
        code: ref('SELECT 1;'),
        tablesSource: () => []
    })

    beforeEach(async () => {
        const setup = await setupAiChat()
        useAiChat = setup.useAiChat
        fetchSpy = setup.fetchSpy
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    function mockStreamResponse(chunks: string[]) {
        const encoder = new TextEncoder()
        fetchSpy.mockResolvedValue(
            new Response(
                new ReadableStream({
                    start(controller) {
                        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
                        controller.close()
                    }
                })
            )
        )
    }

    it('initializes with default state', () => {
        const engine = useAiChat(mockSqlEngine())

        expect(engine.messages.value).toEqual([])
        expect(engine.isLoading.value).toBe(false)
        expect(engine.showPanel.value).toBe(false) // panel starts closed
        expect(engine.autoAnalysisEnabled.value).toBe(true)
    })

    it('togglePanel switches panel visibility', () => {
        const engine = useAiChat(mockSqlEngine())

        engine.togglePanel()
        expect(engine.showPanel.value).toBe(true)

        engine.togglePanel()
        expect(engine.showPanel.value).toBe(false)
    })

    it('openPanel sets panel to visible', () => {
        const engine = useAiChat(mockSqlEngine())
        engine.openPanel()
        expect(engine.showPanel.value).toBe(true)
    })

    it('clearMessages empties message list', () => {
        const engine = useAiChat(mockSqlEngine())
        engine.messages.value = [
            { id: '1', role: 'user', content: 'hi', timestamp: 0 }
        ] as AiMessage[]
        engine.clearMessages()
        expect(engine.messages.value).toEqual([])
    })

    it('sendMessage adds user and assistant messages', async () => {
        const engine = useAiChat(mockSqlEngine())

        mockStreamResponse([
            'data: {"type":"text","content":"Hello',
            ' World"}\n\ndata: {"type":"done"}\n\n'
        ])

        const promise = engine.sendMessage('Hello AI')
        await vi.advanceTimersByTimeAsync(50)

        expect(engine.messages.value.length).toBe(2)
        expect(engine.messages.value[0].role).toBe('user')
        expect(engine.messages.value[0].content).toBe('Hello AI')
        expect(engine.messages.value[1].role).toBe('assistant')
        await promise
        // After completion, streaming stops
        expect(engine.isLoading.value).toBe(false)
        expect(engine.messages.value[1].isStreaming).toBe(false)
        expect(engine.messages.value[1].content).toBe('Hello World')
    })

    it('sendMessage does nothing with empty text', async () => {
        const engine = useAiChat(mockSqlEngine())

        await engine.sendMessage('   ')
        expect(engine.messages.value.length).toBe(0)
    })

    it('cancelStream resets loading state', () => {
        const engine = useAiChat(mockSqlEngine())
        engine.isLoading.value = true

        engine.cancelStream()
        expect(engine.isLoading.value).toBe(false)
    })

    it('handles streaming error mid-response', async () => {
        const engine = useAiChat(mockSqlEngine())

        // Mock a stream that throws mid-way
        const encoder = new TextEncoder()
        let readCount = 0
        fetchSpy.mockResolvedValue(
            new Response(
                new ReadableStream({
                    pull(controller) {
                        if (readCount++ === 0)
                            controller.enqueue(encoder.encode('data: partial\n\n'))
                        else controller.error(new Error('Stream connection lost'))
                    }
                })
            )
        )

        const promise = engine.sendMessage('test')
        await vi.advanceTimersByTimeAsync(50)
        await promise

        // Should have recorded the error without crashing
        expect(engine.messages.value.length).toBeGreaterThanOrEqual(1)
        expect(engine.isLoading.value).toBe(false)
    })

    it('handles SSE parse failure gracefully', async () => {
        const engine = useAiChat(mockSqlEngine())

        mockStreamResponse(['garbage-data-without-proper-format\n\n'])

        const promise = engine.sendMessage('test')
        await vi.advanceTimersByTimeAsync(50)
        await promise

        // Should not crash on malformed data
        expect(engine.isLoading.value).toBe(false)
        expect(engine.messages.value.length).toBeGreaterThanOrEqual(1)
    })

    it('sends SQL, schema, and prior messages to chat', async () => {
        const ctx = {
            ...mockSqlEngine(),
            tablesSource: () => [
                { name: 'users', columns: ['id'], columnTypes: { id: 'INTEGER' }, data: [] }
            ]
        }
        const engine = useAiChat(ctx)
        engine.messages.value.push({
            id: 'prior',
            role: 'system',
            content: 'context',
            timestamp: 0
        })
        mockStreamResponse(['data: {"type":"text","content":"ok"}\n\n'])

        await engine.sendMessage('explain this')

        const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
        expect(body).toMatchObject({
            mode: 'chat',
            message: 'explain this',
            currentSql: 'SELECT 1;',
            schema: [{ table: 'users', columns: ['id'], columnTypes: { id: 'INTEGER' } }],
            history: [
                { role: 'system', content: 'context' },
                { role: 'user', content: 'explain this' }
            ]
        })
        expect(engine.messages.value.at(-1)?.content).toBe('ok')
    })

    it('tracks reasoning and usage, then falls back to reasoning when no answer arrives', async () => {
        const engine = useAiChat(mockSqlEngine())
        mockStreamResponse([
            'data: {"type":"reasoning","content":"thinking"}\n\n',
            'data: {"type":"usage","prompt":3,"completion":5,"total":8}\n\n',
            'data: {"type":"done"}\n\n'
        ])

        await engine.sendMessage('question')

        const answer = engine.messages.value[1]
        expect(answer.reasoning).toBe('thinking')
        expect(answer.content).toBe('thinking')
        expect(answer.metadata?.usage).toEqual({
            promptTokens: 3,
            completionTokens: 5,
            totalTokens: 8
        })
        expect(answer.firstTokenTime).toBeTypeOf('number')
        expect(answer.endTime).toBeTypeOf('number')
        expect(answer.isReasoning).toBe(false)
        expect(answer.isStreaming).toBe(false)
    })

    it('ignores malformed chunks and stores stream error content', async () => {
        const engine = useAiChat(mockSqlEngine())
        mockStreamResponse([
            'data: invalid-json\n\n',
            'data: {"type":"error","content":"model unavailable"}\n\n'
        ])

        await engine.sendMessage('question')

        expect(engine.messages.value[1].content).toBe('model unavailable')
    })

    it('does not send another message while a request is loading', async () => {
        const engine = useAiChat(mockSqlEngine())
        engine.isLoading.value = true

        await engine.sendMessage('second')

        expect(fetchSpy).not.toHaveBeenCalled()
        expect(engine.messages.value).toEqual([])
    })

    it('records a failed request and releases loading state', async () => {
        const engine = useAiChat(mockSqlEngine())
        fetchSpy.mockRejectedValue(new Error('offline'))

        await engine.sendMessage('question')

        expect(engine.messages.value[1].content).toBe('调用 AI 失败：offline')
        expect(engine.messages.value[1].isStreaming).toBe(false)
        expect(engine.isLoading.value).toBe(false)
    })

    it('adds debounced SQL errors only when automatic analysis is enabled', async () => {
        const ctx = mockSqlEngine()
        const engine = useAiChat(ctx)
        ctx.executionError.value = { line: 4, message: 'bad token' }
        await nextTick()
        await vi.advanceTimersByTimeAsync(500)

        expect(engine.messages.value[0]).toMatchObject({
            role: 'system',
            content: 'SQL 执行出错（第 4 行）：bad token',
            metadata: {
                type: 'error-analysis',
                context: { error: { line: 4, message: 'bad token' } }
            }
        })

        engine.autoAnalysisEnabled.value = false
        ctx.executionError.value = { line: 5, message: 'ignored' }
        await nextTick()
        await vi.advanceTimersByTimeAsync(500)
        expect(engine.messages.value).toHaveLength(1)
    })

    it('updates mastered topics through its computed setter', () => {
        const engine = useAiChat(mockSqlEngine())
        engine.masteredTopics.value = new Set(['select', 'joins'])

        expect(engine.masteredTopics.value).toEqual(new Set(['select', 'joins']))
    })

    it('regenerates only an assistant message with a preceding user message', async () => {
        const engine = useAiChat(mockSqlEngine())
        engine.messages.value = [
            { id: 'u', role: 'user', content: 'first', timestamp: 0 },
            { id: 'a', role: 'assistant', content: 'old', timestamp: 0 }
        ]
        mockStreamResponse(['data: {"type":"text","content":"new"}\n\n'])

        engine.regenerateMessage('missing')
        engine.regenerateMessage('u')
        expect(fetchSpy).not.toHaveBeenCalled()

        engine.regenerateMessage('a')
        await vi.advanceTimersByTimeAsync(0)
        expect(engine.messages.value.map((m) => m.content)).toEqual(['first', 'first', 'new'])
    })

    it('editing a message replaces its answer and sends the revised text', async () => {
        const engine = useAiChat(mockSqlEngine())
        engine.messages.value = [
            { id: 'u', role: 'user', content: 'old question', timestamp: 0 },
            { id: 'a', role: 'assistant', content: 'old answer', timestamp: 0 }
        ]
        mockStreamResponse(['data: {"type":"text","content":"new answer"}\n\n'])

        engine.editMessage('missing', 'ignored')
        engine.editMessage('u', 'new question')
        await vi.advanceTimersByTimeAsync(0)

        expect(engine.messages.value.map((m) => m.content)).toEqual(['new question', 'new answer'])
        expect(JSON.parse(fetchSpy.mock.calls[0][1].body).message).toBe('new question')
    })

    it('deletes user and assistant pairs from either side', () => {
        const engine = useAiChat(mockSqlEngine())
        const pair: AiMessage[] = [
            { id: 'u', role: 'user', content: 'question', timestamp: 0 },
            { id: 'a', role: 'assistant', content: 'answer', timestamp: 0 }
        ]

        engine.messages.value = [...pair]
        engine.deleteMessage('a')
        expect(engine.messages.value).toEqual([])

        engine.messages.value = [...pair]
        engine.deleteMessage('u')
        expect(engine.messages.value).toEqual([])

        engine.deleteMessage('missing')
        expect(engine.messages.value).toEqual([])
    })

    it('handles unpaired messages without deleting unrelated history', async () => {
        const engine = useAiChat(mockSqlEngine())
        engine.messages.value = [
            { id: 'system', role: 'system', content: 'context', timestamp: 0 },
            { id: 'user', role: 'user', content: 'old', timestamp: 0 }
        ]
        engine.regenerateMessage('user')
        expect(engine.messages.value).toHaveLength(2)

        mockStreamResponse(['data: {"type":"text","content":"answer"}\n\n'])
        engine.editMessage('user', 'revised')
        await vi.advanceTimersByTimeAsync(0)
        expect(engine.messages.value.map((m) => m.content)).toEqual([
            'context',
            'revised',
            'answer'
        ])

        engine.messages.value = [
            { id: 'assistant', role: 'assistant', content: 'solo', timestamp: 0 }
        ]
        engine.deleteMessage('assistant')
        expect(engine.messages.value).toEqual([])

        engine.messages.value = [{ id: 'user', role: 'user', content: 'solo', timestamp: 0 }]
        engine.deleteMessage('user')
        expect(engine.messages.value).toEqual([])
    })
})
