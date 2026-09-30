import { describe, expect, it, vi } from 'vitest'
import { readSseStream } from '@/utils/sse'

function createMockResponse(chunks: (string | Uint8Array)[]): Response {
    const encoder = new TextEncoder()
    return new Response(
        new ReadableStream({
            start(controller) {
                for (const chunk of chunks)
                    controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
                controller.close()
            }
        })
    )
}

describe('readSseStream', () => {
    it('calls onEvent for a single data event', async () => {
        const events: string[] = []
        const response = createMockResponse(['data: hello\n\n'])
        await readSseStream(response, (data) => events.push(data))
        expect(events).toEqual(['hello'])
    })

    it('calls onEvent for multiple events', async () => {
        const events: string[] = []
        const response = createMockResponse(['data: first\n\ndata: second\n\n'])
        await readSseStream(response, (data) => events.push(data))
        expect(events).toEqual(['first', 'second'])
    })

    it('joins multiline data fields into one event', async () => {
        const events: string[] = []
        const response = createMockResponse(['data: line1\ndata: line2\n\n'])
        await readSseStream(response, (data) => events.push(data))
        expect(events).toEqual(['line1\nline2'])
    })

    it('ignores comment lines starting with colon', async () => {
        const events: string[] = []
        const response = createMockResponse([': comment line\ndata: real\n\n'])
        await readSseStream(response, (data) => events.push(data))
        expect(events).toEqual(['real'])
    })

    it('handles data with colon in value', async () => {
        const events: string[] = []
        const response = createMockResponse(['data: {"key": "value"}\n\n'])
        await readSseStream(response, (data) => events.push(data))
        expect(events).toEqual(['{"key": "value"}'])
    })

    it('strips exactly one leading space after colon per SSE spec', async () => {
        const events: string[] = []
        const response = createMockResponse(['data:  spaced value\n\n'])
        await readSseStream(response, (data) => events.push(data))
        // SSE spec: strip at most one space after colon. Input "data:  spaced" → " spaced value"
        expect(events).toEqual([' spaced value'])
    })

    it('handles [[DONE]] signal', async () => {
        const events: string[] = []
        const response = createMockResponse(['data: hello\n\ndata: [DONE]\n\n'])
        await readSseStream(response, (data) => events.push(data))
        expect(events).toContain('[DONE]')
    })

    it('handles chunked data where line is split across chunks', async () => {
        const events: string[] = []
        const response = createMockResponse(['data: hel', 'lo\n\n'])
        await readSseStream(response, (data) => events.push(data))
        expect(events).toEqual(['hello'])
    })

    it('handles \\r\\n line endings', async () => {
        const events: string[] = []
        const response = createMockResponse(['data: hello\r\n\r\n'])
        await readSseStream(response, (data) => events.push(data))
        expect(events).toEqual(['hello'])
    })

    it('handles empty body', async () => {
        const events: string[] = []
        const response = createMockResponse([])
        await readSseStream(response, (data) => events.push(data))
        expect(events).toEqual([])
    })

    it('throws on missing response body', async () => {
        const response = { body: null } as unknown as Response
        await expect(readSseStream(response, () => {})).rejects.toThrow('No response body')
    })

    it('ignores non-data fields', async () => {
        const events: string[] = []
        const response = createMockResponse(['event: update\ndata: payload\n\n'])
        await readSseStream(response, (data) => events.push(data))
        expect(events).toEqual(['payload'])
    })

    it('handles multiple events with mixed fields', async () => {
        const events: string[] = []
        const response = createMockResponse([
            'event: msg\ndata: first\n\n',
            'data: second\n\n',
            'id: 3\ndata: third\n\n'
        ])
        await readSseStream(response, (data) => events.push(data))
        expect(events).toEqual(['first', 'second', 'third'])
    })

    it('decodes UTF-8 and CRLF split across every byte boundary', async () => {
        const bytes = new TextEncoder().encode('data: 中文🙂\r\n\r\n')
        const events: string[] = []
        await readSseStream(
            createMockResponse(Array.from(bytes, (byte) => Uint8Array.of(byte))),
            (data) => events.push(data)
        )
        expect(events).toEqual(['中文🙂'])
    })

    it('discards an event without its terminating blank line', async () => {
        const onEvent = vi.fn()
        await readSseStream(createMockResponse(['data: incomplete']), onEvent)
        expect(onEvent).not.toHaveBeenCalled()
    })

    it('aborts a stalled stream and releases the source reader', async () => {
        const controller = new AbortController()
        const cancel = vi.fn()
        const response = new Response(new ReadableStream({ cancel }))
        const result = readSseStream(response, vi.fn(), controller.signal)
        const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' })
        controller.abort()
        await assertion
        expect(cancel).toHaveBeenCalledOnce()
        expect(response.body!.locked).toBe(false)
    })

    it('propagates callback failures and cancels the stream', async () => {
        const cancel = vi.fn()
        const response = new Response(
            new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('data: hello\n\n'))
                },
                cancel
            })
        )
        await expect(
            readSseStream(response, () => {
                throw new Error('callback failed')
            })
        ).rejects.toThrow('callback failed')
        expect(cancel).toHaveBeenCalledOnce()
        expect(response.body!.locked).toBe(false)
    })
})
