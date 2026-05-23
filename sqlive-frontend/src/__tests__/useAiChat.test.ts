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
        expect(engine.showInlineResult.value).toBe(false);
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

    it('closeInline resets inline state', () => {
        const engine = useAiChat(mockSqlEngine());
        engine.showInlineResult.value = true;
        engine.inlineContent.value = 'test';
        engine.inlineActions.value = [{ label: 'Test', action: 'test' }];

        engine.closeInline();

        expect(engine.showInlineResult.value).toBe(false);
        expect(engine.inlineContent.value).toBe('');
        expect(engine.inlineActions.value).toEqual([]);
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

    it('analyzeError calls API and sets inline content', async () => {
        const engine = useAiChat(mockSqlEngine());

        mockJsonResponse({
            success: true,
            data: {
                summary: 'Syntax error detected',
                content: 'Detailed analysis...',
                fixedCode: 'SELECT 1',
                tips: ['Tip 1', 'Tip 2'],
            },
        });

        const promise = engine.analyzeError({ line: 3, message: 'syntax error' });
        // Let microtasks process
        await vi.advanceTimersByTimeAsync(0);
        await promise;

        expect(engine.showInlineResult.value).toBe(true);
        expect(engine.inlineMode.value).toBe('error-analysis');
        expect(engine.inlineContent.value).toContain('Syntax error detected');
        expect(engine.inlineContent.value).toContain('SELECT 1');
        expect(engine.inlineActions.value.some((a: any) => a.action === 'apply-fix')).toBe(true);
    });

    it('analyzeError handles API failure gracefully', async () => {
        const engine = useAiChat(mockSqlEngine());

        mockJsonResponse({ success: false, error: 'Server error' });

        const promise = engine.analyzeError({ line: 1, message: 'fail' });
        await vi.advanceTimersByTimeAsync(0);
        await promise;

        expect(engine.inlineContent.value).toContain('AI 分析失败');
    });

    it('fixCode returns fixed code on success', async () => {
        const engine = useAiChat(mockSqlEngine());
        engine.code = { value: 'SELEKT 1;' }; // Override to set code context

        mockJsonResponse({
            success: true,
            data: { fixedCode: 'SELECT 1;', summary: 'Typo fix', explanation: 'SELEKT -> SELECT' },
        });

        const result = await engine.fixCode();
        expect(result).toBe('SELECT 1;');
        expect(engine.inlineMode.value).toBe('fix-code');
        expect(engine.inlineContent.value).toContain('SELECT 1;');
    });

    it('fixCode returns null on failure', async () => {
        const engine = useAiChat(mockSqlEngine());

        mockJsonResponse({ success: false, error: 'Cannot fix' });

        const result = await engine.fixCode();
        expect(result).toBeNull();
    });

    it('explain populates inline content with step-by-step breakdown', async () => {
        const engine = useAiChat(mockSqlEngine());

        mockJsonResponse({
            success: true,
            data: {
                summary: 'Simple SELECT',
                stepByStep: [
                    { step: 1, what: 'SELECT', why: 'Selects columns' },
                    { step: 2, what: 'FROM', why: 'Specifies table' },
                ],
                tips: ['Use aliases for clarity'],
            },
        });

        await engine.explain('SELECT * FROM t');
        expect(engine.inlineMode.value).toBe('explain');
        expect(engine.inlineContent.value).toContain('Selects columns');
        expect(engine.inlineContent.value).toContain('Use aliases');
    });

    it('optimize shows optimized code comparison', async () => {
        const engine = useAiChat(mockSqlEngine());

        mockJsonResponse({
            success: true,
            data: {
                summary: 'Added index hint',
                optimizedCode: 'SELECT * FROM t WITH (INDEX(idx))',
                explanation: 'Force index usage',
            },
        });

        await engine.optimize('SELECT * FROM t');
        expect(engine.inlineMode.value).toBe('optimize');
        expect(engine.inlineContent.value).toContain('SELECT * FROM t WITH (INDEX(idx))');
        expect(engine.inlineActions.value.some((a: any) => a.action === 'apply-fix')).toBe(true);
    });

    it('generateSql extracts SQL from code block in response', async () => {
        const engine = useAiChat(mockSqlEngine());

        mockJsonResponse({
            success: true,
            data: { content: 'Here is the SQL:\n```sql\nCREATE TABLE t(id INT);\n```\nEnjoy!' },
        });

        const result = await engine.generateSql('Create a table');
        expect(result).toBe('CREATE TABLE t(id INT);');
        expect(engine.inlineContent.value).toContain('CREATE TABLE t(id INT);');
    });

    it('generateSql falls back to content when no code block found', async () => {
        const engine = useAiChat(mockSqlEngine());

        mockJsonResponse({ success: true, data: { content: 'Plain text response' } });

        const result = await engine.generateSql('Create a table');
        expect(result).toBe('Plain text response');
    });

    it('generateSql returns null on API failure', async () => {
        const engine = useAiChat(mockSqlEngine());

        fetchSpy.mockRejectedValue(new Error('Network error'));

        const result = await engine.generateSql('Create a table');
        expect(result).toBeNull();
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
