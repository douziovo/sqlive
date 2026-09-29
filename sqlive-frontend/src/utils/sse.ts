import { EventSourceParserStream } from 'eventsource-parser/stream'

/** Read SSE data events; fetch remains responsible for HTTP and authentication. */
export async function readSseStream(
    response: Response,
    onEvent: (data: string) => void,
    signal?: AbortSignal
): Promise<void> {
    if (!response.body) throw new Error('No response body')

    await response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .pipeTo(
            new WritableStream({
                write: ({ data }) => {
                    onEvent(data)
                }
            }),
            { signal }
        )
}
