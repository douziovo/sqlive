import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AiMessage } from '../viewmodel/useAiChat';

describe('useAiChat', () => {
    let useAiChat: any;
    let fetchSpy: ReturnType<typeof vi.fn>;

    const mockSqlEngine = () => ({
        executionError: { value: null as { line: number; message: string } | null },
        code: { value: 'SELECT 1;' },
        db: { tables: [] },
    });

    beforeEach(async () => {
        vi.useFakeTimers();
        fetchSpy = vi.fn();
        globalThis.fetch = fetchSpy as any;

        // Mock localStorage (compatible with @vueuse/core useLocalStorage)
        const store: Record<string, string> = {};
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store[key] ?? null,
            setItem: (key: string, val: string) => { store[key] = val; },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { Object.keys(store).forEach(k => delete store[k]); },
            get length() { return Object.keys(store).length; },
            key: (i: number) => Object.keys(store)[i] ?? null,
        });

        vi.resetModules();
        const mod = await import('../viewmodel/useAiChat');
        useAiChat = mod.useAiChat;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    function mockJsonResponse(data: any, ok = true, status = 200) {
        fetchSpy.mockResolvedValue({
            ok,
            status,
            json: () => Promise.resolve(data),
        });
    }

    function mockStreamResponse(chunks: string[]) {
        const encoder = new TextEncoder();
        let chunkIndex = 0;

        fetchSpy.mockResolvedValue({
            ok: true,
            status: 200,
            body: {
                getReader: () => {
                    let done = false;
                    return {
                        read: () => {
                            if (done) return Promise.resolve({ done: true, value: undefined });
                            if (chunkIndex >= chunks.length) {
                                done = true;
                                return Promise.resolve({ done: true, value: undefined });
                            }
                            const data = chunks[chunkIndex++];
                            return Promise.resolve({ done: false, value: encoder.encode(data) });
                        },
                    };
                },
            },
        });
    }

    it('initializes with default state', () => {
        const engine = useAiChat(mockSqlEngine());

        expect(engine.messages.value).toEqual([]);
        expect(engine.isLoading.value).toBe(false);
        expect(engine.showPanel.value).toBe(false); // panel starts closed
        expect(engine.suggestions.value).toEqual([]);
        expect(engine.autoAnalysisEnabled.value).toBe(true);
    });

    it('togglePanel switches panel visibility', () => {
        const engine = useAiChat(mockSqlEngine());

        engine.togglePanel();
        expect(engine.showPanel.value).toBe(true);

        engine.togglePanel();
        expect(engine.showPanel.value).toBe(false);
    });

    it('openPanel sets panel to visible', () => {
        const engine = useAiChat(mockSqlEngine());
        engine.openPanel();
        expect(engine.showPanel.value).toBe(true);
    });

    it('clearMessages empties message list', () => {
        const engine = useAiChat(mockSqlEngine());
        engine.messages.value = [{ id: '1', role: 'user', content: 'hi', timestamp: 0 }] as AiMessage[];
        engine.clearMessages();
        expect(engine.messages.value).toEqual([]);
    });

    it('sendMessage adds user and assistant messages', async () => {
        const engine = useAiChat(mockSqlEngine());

        mockStreamResponse(['data: Hello', 'data:  World\n', 'data: [DONE]\n']);

        const promise = engine.sendMessage('Hello AI');
        await vi.advanceTimersByTimeAsync(50);

        expect(engine.messages.value.length).toBe(2);
        expect(engine.messages.value[0].role).toBe('user');
        expect(engine.messages.value[0].content).toBe('Hello AI');
        expect(engine.messages.value[1].role).toBe('assistant');
        await promise;
        // After completion, streaming stops
        expect(engine.isLoading.value).toBe(false);
        expect(engine.messages.value[1].isStreaming).toBe(false);
    });

    it('sendMessage does nothing with empty text', async () => {
        const engine = useAiChat(mockSqlEngine());

        await engine.sendMessage('   ');
        expect(engine.messages.value.length).toBe(0);
    });

    it('cancelStream resets loading state', () => {
        const engine = useAiChat(mockSqlEngine());
        engine.isLoading.value = true;

        engine.cancelStream();
        expect(engine.isLoading.value).toBe(false);
    });

    it('markMastered adds topic and persists to localStorage', async () => {
        const engine = useAiChat(mockSqlEngine());

        engine.markMastered('joins');
        expect(engine.masteredTopics.value.has('joins')).toBe(true);
        // useLocalStorage writes are async; flush pending tasks
        await vi.runAllTimersAsync();
        expect(JSON.parse(localStorage.getItem('ai-mastered-topics')!)).toContain('joins');
    });
});
