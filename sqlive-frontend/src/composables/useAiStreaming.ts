import { type Ref, ref } from 'vue'
import { readSseStream } from '../utils/sse'

export function useAiStreaming(apiBase: string, isLoading: Ref<boolean>) {
    const streamAbortController = ref<AbortController | null>(null)

    async function streamCall(
        endpoint: string,
        body: unknown,
        onChunk: (text: string) => void
    ): Promise<void> {
        try {
            const controller = new AbortController()
            streamAbortController.value = controller

            // CR-02: wire X-API-Key so the backend ApiKeyFilter authorizes /api/ai/** in
            // production (AI_API_KEY set). Build-time env var takes precedence; fall back
            // to localStorage so end users can paste a key without rebuilding. typeof
            // guard keeps the composable testable in non-browser contexts.
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream'
            }
            const apiKey =
                import.meta.env.VITE_AI_API_KEY ||
                (typeof localStorage !== 'undefined' ? localStorage.getItem('ai_api_key') : null)
            if (apiKey) headers['X-API-Key'] = apiKey

            const response = await fetch(`${apiBase}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...(body as Record<string, unknown>), stream: true }),
                signal: controller.signal
            })
            if (!response.ok) {
                throw new Error(`SSE error: ${response.status} ${response.statusText}`)
            }
            await readSseStream(response, onChunk, controller.signal)
        } catch (err) {
            if (!(err instanceof Error || err instanceof DOMException) || err.name !== 'AbortError')
                throw err
        }
    }

    function cancelStream(): void {
        streamAbortController.value?.abort()
        isLoading.value = false
    }

    return { streamCall, cancelStream, streamAbortController }
}
