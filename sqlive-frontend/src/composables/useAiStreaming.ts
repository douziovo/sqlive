import {type Ref, ref} from 'vue'
import {readSseStream} from '../utils/sse'

export function useAiStreaming(apiBase: string, isLoading: Ref<boolean>) {
    const streamAbortController = ref<AbortController | null>(null)

    function streamCall(endpoint: string, body: unknown, onChunk: (text: string) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const controller = new AbortController()
            streamAbortController.value = controller

            fetch(`${apiBase}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream'
                },
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
