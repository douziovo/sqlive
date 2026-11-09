import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAiClient, http } from '@/lib/http'
import { readSseStream } from '@/utils/sse'

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.useRealTimers()
    localStorage.clear()
})

describe('HTTP transport', () => {
    it('rejects malformed JSON instead of treating a proxy error page as API data', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>proxy error</html>')))
        await expect(http('/api/execute')).rejects.toBeInstanceOf(SyntaxError)
    })
    it('can request an AI endpoint when browser storage is unavailable', async () => {
        vi.stubEnv('VITE_AI_API_KEY', '')
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Storage unavailable', 'SecurityError')
        })
        const fetchSpy = vi.fn().mockResolvedValue(Response.json({ success: true }))
        vi.stubGlobal('fetch', fetchSpy)

        await expect(createAiClient()('/chat', { method: 'POST', body: {} })).resolves.toEqual({
            success: true
        })
        expect(fetchSpy.mock.calls[0][1].headers.has('X-API-Key')).toBe(false)
    })
    it('serializes JSON and keeps caller headers', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(Response.json({ value: 42 }))
        vi.stubGlobal('fetch', fetchSpy)

        await expect(
            http('/api/execute', {
                method: 'POST',
                body: { sql: 'SELECT 42' },
                headers: { 'X-Request-ID': 'example' }
            })
        ).resolves.toEqual({ value: 42 })

        const [url, options] = fetchSpy.mock.calls[0]
        expect(url).toBe('/api/execute')
        expect(JSON.parse(options.body)).toEqual({ sql: 'SELECT 42' })
        expect(options.headers.get('Content-Type')).toBe('application/json')
        expect(options.headers.get('X-Request-ID')).toBe('example')
    })

    it('reads the AI key for each request and keeps it off public requests', async () => {
        vi.stubEnv('VITE_AI_API_KEY', '')
        const fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(Response.json({})))
        vi.stubGlobal('fetch', fetchSpy)
        const ai = createAiClient('/api/ai/')

        localStorage.setItem('ai_api_key', 'first-key')
        await ai('/chat', { method: 'POST', body: {} })
        localStorage.setItem('ai_api_key', 'second-key')
        await ai('/explain', { method: 'POST', body: {} })
        localStorage.removeItem('ai_api_key')
        await ai('/chat', { method: 'POST', body: {} })
        await http('/api/knowledge/graph')

        expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
            '/api/ai/chat',
            '/api/ai/explain',
            '/api/ai/chat',
            '/api/knowledge/graph'
        ])
        expect(fetchSpy.mock.calls.map(([, options]) => options.headers.get('X-API-Key'))).toEqual([
            'first-key',
            'second-key',
            null,
            null
        ])
    })

    it('never retries rejected SQL writes or AI calls', async () => {
        const fetchSpy = vi
            .fn()
            .mockImplementation(() =>
                Promise.resolve(Response.json({ error: 'busy' }, { status: 503 }))
            )
        vi.stubGlobal('fetch', fetchSpy)
        await expect(http('/api/execute', { method: 'POST', body: {} })).rejects.toMatchObject({
            status: 503,
            data: { error: 'busy' }
        })
        expect(fetchSpy).toHaveBeenCalledTimes(1)

        fetchSpy.mockRejectedValue(new Error('offline'))
        await expect(createAiClient()('/chat', { method: 'POST', body: {} })).rejects.toThrow(
            'offline'
        )
        expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('preserves a caller cancellation without retrying', async () => {
        const controller = new AbortController()
        const fetchSpy = vi.fn().mockImplementation((_request, options) => {
            controller.abort()
            return Promise.reject(options.signal.reason)
        })
        vi.stubGlobal('fetch', fetchSpy)

        await expect(http('/api/execute', { signal: controller.signal })).rejects.toMatchObject({
            name: 'AbortError'
        })
        expect(fetchSpy).toHaveBeenCalledTimes(1)
        expect(fetchSpy.mock.calls[0][1].signal.aborted).toBe(true)
    })

    it('times out a stalled request', async () => {
        vi.useFakeTimers()
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(
                (_request, options) =>
                    new Promise((_resolve, reject) => {
                        options.signal.addEventListener('abort', () =>
                            reject(options.signal.reason)
                        )
                    })
            )
        )
        const request = expect(
            http('/api/knowledge/graph', { timeout: 100 })
        ).rejects.toMatchObject({
            name: 'TimeoutError'
        })
        await vi.advanceTimersByTimeAsync(101)
        await request
    })

    it('passes streaming bodies directly to the existing SSE parser', async () => {
        const controller = new AbortController()
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response('data: first\n\ndata: second\n\n', {
                headers: { 'Content-Type': 'text/event-stream' }
            })
        )
        vi.stubGlobal('fetch', fetchSpy)
        const response = await createAiClient().raw('/chat', {
            method: 'POST',
            body: { stream: true },
            responseType: 'stream',
            timeout: 0,
            signal: controller.signal,
            headers: { Accept: 'text/event-stream' }
        })
        const events: string[] = []
        await readSseStream(response, (data) => events.push(data), controller.signal)
        expect(events).toEqual(['first', 'second'])
        expect(fetchSpy.mock.calls[0][1].signal).toBe(controller.signal)
        expect(fetchSpy.mock.calls[0][1].headers.get('Accept')).toBe('text/event-stream')
    })
})
