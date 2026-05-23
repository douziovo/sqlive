import { describe, it, expect, vi } from 'vitest';
import { readSseStream } from '@/utils/sse';

function createMockResponse(chunks: string[]): Response {
    const encoder = new TextEncoder();
    let index = 0;
    return {
        body: {
            getReader: () => {
                let done = false;
                return {
                    read: () => {
                        if (done) return Promise.resolve({ done: true, value: undefined });
                        if (index >= chunks.length) {
                            done = true;
                            return Promise.resolve({ done: true, value: undefined });
                        }
                        const chunk = chunks[index++];
                        return Promise.resolve({ done: false, value: encoder.encode(chunk) });
                    },
                    releaseLock: vi.fn(),
                    cancel: vi.fn(),
                };
            },
        },
    } as unknown as Response;
}

describe('readSseStream', () => {
    it('calls onEvent for a single data event', async () => {
        const events: string[] = [];
        const response = createMockResponse(['data: hello\n\n']);
        await readSseStream(response, (data) => events.push(data));
        expect(events).toEqual(['hello']);
    });

    it('calls onEvent for multiple events', async () => {
        const events: string[] = [];
        const response = createMockResponse(['data: first\n\ndata: second\n\n']);
        await readSseStream(response, (data) => events.push(data));
        expect(events).toEqual(['first', 'second']);
    });

    it('joins multiline data fields into one event', async () => {
        const events: string[] = [];
        const response = createMockResponse(['data: line1\ndata: line2\n\n']);
        await readSseStream(response, (data) => events.push(data));
        expect(events).toEqual(['line1\nline2']);
    });

    it('ignores comment lines starting with colon', async () => {
        const events: string[] = [];
        const response = createMockResponse([': comment line\ndata: real\n\n']);
        await readSseStream(response, (data) => events.push(data));
        expect(events).toEqual(['real']);
    });

    it('handles data with colon in value', async () => {
        const events: string[] = [];
        const response = createMockResponse(['data: {"key": "value"}\n\n']);
        await readSseStream(response, (data) => events.push(data));
        expect(events).toEqual(['{"key": "value"}']);
    });

    it('strips exactly one leading space after colon per SSE spec', async () => {
        const events: string[] = [];
        const response = createMockResponse(['data:  spaced value\n\n']);
        await readSseStream(response, (data) => events.push(data));
        // SSE spec: strip at most one space after colon. Input "data:  spaced" → " spaced value"
        expect(events).toEqual([' spaced value']);
    });

    it('handles [[DONE]] signal', async () => {
        const events: string[] = [];
        const response = createMockResponse(['data: hello\n\ndata: [DONE]\n\n']);
        await readSseStream(response, (data) => events.push(data));
        expect(events).toContain('[DONE]');
    });

    it('handles chunked data where line is split across chunks', async () => {
        const events: string[] = [];
        const response = createMockResponse(['data: hel', 'lo\n\n']);
        await readSseStream(response, (data) => events.push(data));
        expect(events).toEqual(['hello']);
    });

    it('handles \\r\\n line endings', async () => {
        const events: string[] = [];
        const response = createMockResponse(['data: hello\r\n\r\n']);
        await readSseStream(response, (data) => events.push(data));
        expect(events).toEqual(['hello']);
    });

    it('handles empty body', async () => {
        const events: string[] = [];
        const response = createMockResponse([]);
        await readSseStream(response, (data) => events.push(data));
        expect(events).toEqual([]);
    });

    it('throws on missing response body', async () => {
        const response = { body: null } as unknown as Response;
        await expect(readSseStream(response, () => {})).rejects.toThrow('No response body');
    });

    it('ignores non-data fields', async () => {
        const events: string[] = [];
        const response = createMockResponse(['event: update\ndata: payload\n\n']);
        await readSseStream(response, (data) => events.push(data));
        expect(events).toEqual(['payload']);
    });

    it('handles multiple events with mixed fields', async () => {
        const events: string[] = [];
        const response = createMockResponse([
            'event: msg\ndata: first\n\n',
            'data: second\n\n',
            'id: 3\ndata: third\n\n',
        ]);
        await readSseStream(response, (data) => events.push(data));
        expect(events).toEqual(['first', 'second', 'third']);
    });

    it('respects abort signal', async () => {
        const controller = new AbortController();
        const encoder = new TextEncoder();
        const response = {
            body: {
                getReader: () => {
                    let called = false;
                    return {
                        read: () => {
                            if (!called) {
                                called = true;
                                controller.abort();
                                return Promise.resolve({ done: false, value: encoder.encode('data: partial') });
                            }
                            return Promise.resolve({ done: true, value: undefined });
                        },
                        releaseLock: vi.fn(),
                        cancel: vi.fn(),
                    };
                },
            },
        } as unknown as Response;

        await expect(readSseStream(response, () => {}, controller.signal)).rejects.toThrow();
    });
});
