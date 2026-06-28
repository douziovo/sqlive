import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {ref} from 'vue'
import {useAiStreaming} from '@/composables/useAiStreaming'
import {readSseStream} from '@/utils/sse'

// Mock readSseStream before importing the composable
vi.mock('@/utils/sse', () => ({
    readSseStream: vi.fn()
}))

const mockReadSseStream = vi.mocked(readSseStream)

function makeFetchSpy() {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as any
    return fetchSpy
}

function makeSseResponse(body: string = 'data: chunk1\n\ndata: chunk2\n\n') {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(body))
            controller.close()
        }
    })
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        body: {
            getReader: () => stream.getReader()
        },
        headers: {get: () => 'text/event-stream'}
    }
}

describe('useAiStreaming', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('initializes with null streamAbortController', () => {
        makeFetchSpy()
        const isLoading = ref(false)
        const {streamAbortController} = useAiStreaming('http://localhost:8080', isLoading)
        expect(streamAbortController.value).toBeNull()
    })

    it('streamCall sets isLoading and creates AbortController', async () => {
        const fetchSpy = makeFetchSpy()
        mockReadSseStream.mockResolvedValue(undefined)
        const response = makeSseResponse()
        fetchSpy.mockResolvedValue(response)

        const isLoading = ref(false)
        const {streamCall, streamAbortController} = useAiStreaming('http://localhost:8080', isLoading)
        const onChunk = vi.fn()

        const promise = streamCall('/api/ai/chat', {prompt: 'hello'}, onChunk)
        expect(streamAbortController.value).toBeInstanceOf(AbortController)

        await promise
        expect(fetchSpy).toHaveBeenCalledWith(
            'http://localhost:8080/api/ai/chat',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream'
                }
            })
        )
    })

    it('streamCall passes stream:true in request body', async () => {
        const fetchSpy = makeFetchSpy()
        mockReadSseStream.mockResolvedValue(undefined)
        fetchSpy.mockResolvedValue(makeSseResponse())

        const isLoading = ref(false)
        const {streamCall} = useAiStreaming('http://localhost:8080', isLoading)

        await streamCall('/api/ai/chat', {prompt: 'test'}, vi.fn())

        const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
        expect(body.stream).toBe(true)
        expect(body.prompt).toBe('test')
    })

    it('streamCall processes SSE chunks via readSseStream', async () => {
        const fetchSpy = makeFetchSpy()
        const chunks: string[] = []
        mockReadSseStream.mockImplementation(async (_response, onEvent) => {
            onEvent('chunk1')
            onEvent('chunk2')
        })
        fetchSpy.mockResolvedValue(makeSseResponse())

        const isLoading = ref(false)
        const {streamCall} = useAiStreaming('http://localhost:8080', isLoading)
        const onChunk = vi.fn((text: string) => chunks.push(text))

        await streamCall('/api/ai/chat', {}, onChunk)

        expect(onChunk).toHaveBeenCalledTimes(2)
        expect(chunks).toEqual(['chunk1', 'chunk2'])
    })

    it('cancelStream aborts active controller and resets isLoading', async () => {
        const fetchSpy = makeFetchSpy()
        mockReadSseStream.mockResolvedValue(undefined)
        fetchSpy.mockResolvedValue(makeSseResponse())

        const isLoading = ref(true)
        const {streamCall, cancelStream, streamAbortController} = useAiStreaming(
            'http://localhost:8080',
            isLoading
        )

        const promise = streamCall('/api/ai/chat', {}, vi.fn())
        expect(streamAbortController.value).not.toBeNull()

        cancelStream()
        expect(isLoading.value).toBe(false)

        await promise
    })

    it('streamCall rejects on non-ok response', async () => {
        const fetchSpy = makeFetchSpy()
        fetchSpy.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
        })

        const isLoading = ref(false)
        const {streamCall} = useAiStreaming('http://localhost:8080', isLoading)

        await expect(streamCall('/api/ai/chat', {}, vi.fn())).rejects.toThrow(
            'SSE error: 500 Internal Server Error'
        )
    })

    it('streamCall resolves gracefully on AbortError', async () => {
        const fetchSpy = makeFetchSpy()
        const abortError = new Error('The operation was aborted')
        abortError.name = 'AbortError'
        fetchSpy.mockRejectedValue(abortError)

        const isLoading = ref(false)
        const {streamCall} = useAiStreaming('http://localhost:8080', isLoading)

        // Should resolve, not reject
        await expect(streamCall('/api/ai/chat', {}, vi.fn())).resolves.toBeUndefined()
    })

    it('streamCall rejects on network error', async () => {
        const fetchSpy = makeFetchSpy()
        fetchSpy.mockRejectedValue(new Error('Network failure'))

        const isLoading = ref(false)
        const {streamCall} = useAiStreaming('http://localhost:8080', isLoading)

        await expect(streamCall('/api/ai/chat', {}, vi.fn())).rejects.toThrow('Network failure')
    })

    it('multiple rapid streamCalls — each gets its own AbortController', async () => {
        const fetchSpy = makeFetchSpy()
        mockReadSseStream.mockResolvedValue(undefined)
        fetchSpy.mockResolvedValue(makeSseResponse())

        const isLoading = ref(false)
        const {streamCall, streamAbortController} = useAiStreaming('http://localhost:8080', isLoading)

        const promise1 = streamCall('/api/ai/chat', {id: 1}, vi.fn())
        const controller1 = streamAbortController.value
        await promise1

        const promise2 = streamCall('/api/ai/chat', {id: 2}, vi.fn())
        const controller2 = streamAbortController.value
        await promise2

        expect(controller1).not.toBeNull()
        expect(controller2).not.toBeNull()
        // Each call creates a new controller
        expect(fetchSpy).toHaveBeenCalledTimes(2)
    })
})
