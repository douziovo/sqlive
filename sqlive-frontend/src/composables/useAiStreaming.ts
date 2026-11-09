import { type Ref, ref } from 'vue'
import { tryOnScopeDispose } from '@vueuse/core'
import { createAiClient } from '../lib/http'
import { readSseStream } from '../utils/sse'

export function useAiStreaming(apiBase: string, isLoading: Ref<boolean>) {
    const aiClient = createAiClient(apiBase)
    const streamAbortController = ref<AbortController | null>(null)

    async function streamCall(
        endpoint: string,
        body: unknown,
        onChunk: (text: string) => void
    ): Promise<void> {
        const controller = new AbortController()
        streamAbortController.value?.abort()
        streamAbortController.value = controller
        try {
            const response = await aiClient.raw(endpoint, {
                method: 'POST',
                headers: { Accept: 'text/event-stream' },
                body: { ...(body as Record<string, unknown>), stream: true },
                responseType: 'stream',
                timeout: 0,
                signal: controller.signal
            })
            await readSseStream(
                response,
                (chunk) => {
                    if (!controller.signal.aborted && streamAbortController.value === controller)
                        onChunk(chunk)
                },
                controller.signal
            )
        } catch (err) {
            if (!(err instanceof Error || err instanceof DOMException) || err.name !== 'AbortError')
                throw err
        } finally {
            if (streamAbortController.value === controller) streamAbortController.value = null
        }
    }

    function cancelStream(): void {
        streamAbortController.value?.abort()
        streamAbortController.value = null
        isLoading.value = false
    }

    tryOnScopeDispose(cancelStream)

    return { streamCall, cancelStream, streamAbortController }
}
