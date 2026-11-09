import { ofetch, type FetchContext } from 'ofetch'

import { API_BASE } from '../config'
import { resolveAiApiKey } from '../utils/aiApiKey'

function prepareRequest({ options }: FetchContext) {
    if (options.responseType === 'json') options.parseResponse = JSON.parse
    // ofetch's timeout only creates a controller when no caller signal is supplied.
    if (options.signal && options.timeout) {
        options.signal = AbortSignal.any([options.signal, AbortSignal.timeout(options.timeout)])
    }
}

/** Shared transport policy; SQL writes and AI calls must never be replayed automatically. */
export const http = ofetch.create(
    {
        retry: 0,
        timeout: 60_000,
        responseType: 'json',
        onRequest: prepareRequest,
        onRequestError({ error, options }) {
            // Preserve cancellation identity for the SQL and streaming state machines.
            if (options.signal?.aborted) throw options.signal.reason
            if (error?.name === 'AbortError') throw error
        }
    },
    { fetch: (request, options) => globalThis.fetch(request, options) }
)

export function createAiClient(baseURL = API_BASE) {
    return http.create({
        baseURL,
        timeout: 90_000,
        onRequest: [
            prepareRequest,
            ({ options }) => {
                const apiKey = resolveAiApiKey()
                if (apiKey) options.headers.set('X-API-Key', apiKey)
            }
        ]
    })
}
