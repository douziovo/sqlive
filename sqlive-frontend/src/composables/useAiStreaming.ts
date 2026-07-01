import {type Ref, ref} from 'vue'
import {readSseStream} from '../utils/sse'

export function useAiStreaming(apiBase: string, isLoading: Ref<boolean>) {
    const streamAbortController = ref<AbortController | null>(null)

    function streamCall(endpoint: string, body: unknown, onChunk: (text: string) => void): Promise<void> {
        return new Promise((resolve, reject) => {
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
            const apiKey = import.meta.env.VITE_AI_API_KEY
                || (typeof localStorage !== 'undefined' ? localStorage.getItem('ai_api_key') : null)
            if (apiKey) headers['X-API-Key'] = apiKey

            fetch(`${apiBase}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({...(body as Record<string, unknown>), stream: true}),
                signal: controller.signal
            })
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error(`SSE error: ${response.status} ${response.statusText}`)
                    }

                    await readSseStream(
                        response,
                        (data) => {
                            onChunk(data)
                        },
                        controller.signal
                    )

                    resolve()
                })
                .catch((err) => {
                    if (err.name === 'AbortError') {
                        resolve()
                    } else {
                        reject(err)
                    }
                })
        })
    }

    function cancelStream(): void {
        streamAbortController.value?.abort()
        isLoading.value = false
    }

    return {streamCall, cancelStream, streamAbortController}
}
