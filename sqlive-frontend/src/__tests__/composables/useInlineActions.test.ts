import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { ref } from 'vue'

import type { AiMessage } from '@/composables/useAiChat'
import type { DisplayHandler } from '@/composables/useInlineActions'
import { useInlineActions } from '@/composables/useInlineActions'
import type { DatabaseModel } from '@/model/DatabaseTypes'

import { jsonOk } from '../test-utils'

vi.mock('@/utils/aiFormatter', () => ({
    formatErrorAnalysis: vi.fn((data: any) => `formatted-error: ${data.summary || data.content}`),
    formatExplain: vi.fn((data: any) => `formatted-explain: ${data.summary || data.content}`),
    formatFixCode: vi.fn((data: any) => `formatted-fix: ${data.fixedCode || data.content}`),
    formatOptimize: vi.fn((data: any) => `formatted-optimize: ${data.fixedCode || data.content}`),
    formatGenerateSql: vi.fn((code: string) => `formatted-sql: ${code}`)
}))

function makeDb(): DatabaseModel {
    return {
        tables: [
            {
                name: 'users',
                columns: ['id', 'name'],
                columnTypes: { id: 'INTEGER', name: 'TEXT' },
                data: [{ id: 1, name: 'Alice' }]
            }
        ],
        queryResults: [],
        indexes: [],
        views: [],
        triggers: [],
        foreignKeys: [],
        metadata: null
    }
}

function makeDisplay(): DisplayHandler & { calls: any[] } {
    const calls: any[] = []
    return {
        calls,
        onLoading: (mode: string) => calls.push({ type: 'loading', mode }),
        onResult: (content: string, actions: any[]) =>
            calls.push({ type: 'result', content, actions }),
        onError: (message: string) => calls.push({ type: 'error', message })
    }
}

function mockFetchSuccess(data: any) {
    globalThis.fetch = vi.fn().mockImplementation(() => jsonOk({ success: true, data })) as any
}

function mockFetchFailure(error: string) {
    globalThis.fetch = vi.fn().mockImplementation(() => jsonOk({ success: false, error })) as any
}

function mockFetchNetworkError(err: Error) {
    globalThis.fetch = vi.fn().mockRejectedValue(err) as any
}

function makeState(
    overrides?: Partial<{
        code: string
        error: { line: number; message: string } | null
    }>
) {
    // D-R2-004: composable now takes tablesSource getter instead of whole DatabaseModel
    const db = makeDb()
    return {
        isLoading: ref(false),
        messages: ref([]) as Ref<AiMessage[]>,
        code: ref(overrides?.code ?? 'SELECT 1;'),
        tablesSource: () => db.tables,
        error: ref(overrides?.error ?? null) as Ref<{ line: number; message: string } | null>
    }
}

describe('useInlineActions', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('analyzeError', () => {
        /** 断言失败路径下 analyzeError 上报到 display.onError 并复位 isLoading */
        async function expectAnalyzeErrorReported() {
            const state = makeState()
            const display = makeDisplay()
            const { analyzeError } = useInlineActions(state)

            await analyzeError({ line: 1, message: 'error' }, display)

            expect(display.calls.some((c) => c.type === 'error')).toBe(true)
            expect(state.isLoading.value).toBe(false)
        }

        it('calls API and displays formatted error analysis on success', async () => {
            mockFetchSuccess({
                summary: 'syntax error analysis',
                content: 'You have a typo',
                fixedCode: 'SELECT 1;',
                tips: ['Check syntax']
            })

            const state = makeState()
            const display = makeDisplay()
            const { analyzeError } = useInlineActions(state)

            await analyzeError({ line: 3, message: 'syntax error' }, display)

            expect(state.isLoading.value).toBe(false)
            expect(display.calls.some((c) => c.type === 'loading')).toBe(true)
            expect(display.calls.some((c) => c.type === 'result')).toBe(true)
            expect(state.messages.value.length).toBe(1)
            expect(state.messages.value[0].role).toBe('assistant')
        })

        it('displays error on API failure response', async () => {
            mockFetchFailure('AI service unavailable')

            await expectAnalyzeErrorReported()
        })

        it('handles network error gracefully', async () => {
            mockFetchNetworkError(new Error('Connection refused'))

            await expectAnalyzeErrorReported()
        })

        it('sets isLoading to true during API call', async () => {
            let resolveFetch: (v: any) => void
            globalThis.fetch = vi.fn().mockReturnValue(
                new Promise((r) => {
                    resolveFetch = r
                })
            ) as any

            const state = makeState()
            const display = makeDisplay()
            const { analyzeError } = useInlineActions(state)

            const promise = analyzeError({ line: 1, message: 'err' }, display)
            expect(state.isLoading.value).toBe(true)

            resolveFetch!({
                ok: true,
                json: () => Promise.resolve({ success: true, data: { summary: 'ok' } })
            })
            await promise

            expect(state.isLoading.value).toBe(false)
        })
    })

    describe('fixCode', () => {
        it('returns fixed code on success', async () => {
            mockFetchSuccess({
                content: 'Here is the fix',
                fixedCode: 'SELECT * FROM users;',
                summary: 'Fixed the query'
            })

            const state = makeState({ error: { line: 1, message: 'error' } })
            const display = makeDisplay()
            const { fixCode } = useInlineActions(state)

            const result = await fixCode(display)

            expect(result).toBe('SELECT * FROM users;')
            expect(display.calls.some((c) => c.type === 'result')).toBe(true)
        })

        it('returns null on API failure', async () => {
            mockFetchFailure('Cannot fix')

            const state = makeState()
            const display = makeDisplay()
            const { fixCode } = useInlineActions(state)

            const result = await fixCode(display)

            expect(result).toBeNull()
            expect(display.calls.some((c) => c.type === 'error')).toBe(true)
        })

        it('returns null on network error', async () => {
            mockFetchNetworkError(new Error('timeout'))

            const state = makeState()
            const display = makeDisplay()
            const { fixCode } = useInlineActions(state)

            const result = await fixCode(display)

            expect(result).toBeNull()
            expect(state.isLoading.value).toBe(false)
        })
    })

    describe('explain', () => {
        it('calls API and displays explanation on success', async () => {
            mockFetchSuccess({
                summary: 'This query selects all users',
                content: 'Detailed explanation',
                stepByStep: [{ step: 1, what: 'FROM clause', why: 'Specifies table' }],
                tips: ['Use indexes']
            })

            const state = makeState()
            const display = makeDisplay()
            const { explain } = useInlineActions(state)

            await explain('SELECT * FROM users', display)

            expect(display.calls.some((c) => c.type === 'result')).toBe(true)
            expect(state.messages.value.length).toBe(1)
        })

        it('displays error on API failure', async () => {
            mockFetchFailure('Cannot explain')

            const state = makeState()
            const display = makeDisplay()
            const { explain } = useInlineActions(state)

            await explain('SELECT 1', display)

            expect(display.calls.some((c) => c.type === 'error')).toBe(true)
        })
    })

    describe('optimize', () => {
        it('returns optimized code on success', async () => {
            mockFetchSuccess({
                summary: 'Optimized query',
                fixedCode: 'SELECT id FROM users WHERE id > 0;',
                explanation: 'Added index hint'
            })

            const state = makeState()
            const display = makeDisplay()
            const { optimize } = useInlineActions(state)

            const result = await optimize('SELECT * FROM users', display)

            expect(result).toBe('SELECT id FROM users WHERE id > 0;')
            expect(display.calls.some((c) => c.type === 'result')).toBe(true)
        })

        it('returns null on API failure', async () => {
            mockFetchFailure('Cannot optimize')

            const state = makeState()
            const display = makeDisplay()
            const { optimize } = useInlineActions(state)

            const result = await optimize('SELECT 1', display)

            expect(result).toBeNull()
        })
    })

    describe('generateSql', () => {
        it('extracts SQL from code block in response', async () => {
            mockFetchSuccess({
                content: 'Here is the SQL:\n```sql\nCREATE TABLE t (id INTEGER);\n```\nDone.',
                fixedCode: undefined
            })

            const state = makeState()
            const display = makeDisplay()
            const { generateSql } = useInlineActions(state)

            const result = await generateSql('create a table', display)

            expect(result).toBe('CREATE TABLE t (id INTEGER);')
            expect(display.calls.some((c) => c.type === 'result')).toBe(true)
        })

        it('falls back to fixedCode if no code block', async () => {
            mockFetchSuccess({
                content: 'No code block here',
                fixedCode: 'CREATE TABLE t (id INTEGER);'
            })

            const state = makeState()
            const display = makeDisplay()
            const { generateSql } = useInlineActions(state)

            const result = await generateSql('create a table', display)

            expect(result).toBe('CREATE TABLE t (id INTEGER);')
        })

        it('falls back to content when no code block and no fixedCode', async () => {
            mockFetchSuccess({
                content: 'No SQL here',
                fixedCode: undefined
            })

            const state = makeState()
            const display = makeDisplay()
            const { generateSql } = useInlineActions(state)

            const result = await generateSql('create a table', display)

            // generateSql falls back to content when no code block and no fixedCode
            expect(result).toBe('No SQL here')
            expect(display.calls.some((c) => c.type === 'result')).toBe(true)
        })

        it('returns null when API returns no usable content', async () => {
            mockFetchSuccess({
                content: undefined,
                fixedCode: undefined
            })

            const state = makeState()
            const display = makeDisplay()
            const { generateSql } = useInlineActions(state)

            const result = await generateSql('create a table', display)

            expect(result).toBeNull()
            expect(display.calls.some((c) => c.type === 'error')).toBe(true)
        })
    })

    it('sends the stored API key with inline requests', async () => {
        localStorage.setItem('ai_api_key', 'test-key')
        try {
            mockFetchSuccess({ fixedCode: 'SELECT 1' })
            await useInlineActions(makeState()).fixCode(makeDisplay())

            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.any(Headers)
                })
            )
            expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toBeInstanceOf(Headers)
            expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get('X-API-Key')).toBe(
                'test-key'
            )
        } finally {
            localStorage.removeItem('ai_api_key')
        }
    })

    it('reports HTTP errors while generating SQL', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as any
        const display = makeDisplay()
        const result = await useInlineActions(makeState()).generateSql('create a table', display)

        expect(result).toBeNull()
        expect(display.calls).toContainEqual({
            type: 'error',
            message: expect.stringContaining('503')
        })
    })

    it('reports network failures for explanations and optimizations', async () => {
        mockFetchNetworkError(new Error('offline'))
        const state = makeState()
        const display = makeDisplay()
        const actions = useInlineActions(state)

        await actions.explain('SELECT 1', display)
        expect(await actions.optimize('SELECT 1', display)).toBeNull()

        expect(display.calls.filter((c) => c.type === 'error')).toEqual([
            { type: 'error', message: expect.stringContaining('offline') },
            { type: 'error', message: expect.stringContaining('offline') }
        ])
        expect(state.isLoading.value).toBe(false)
    })
    describe('edge branches', () => {
        it('maps a degenerate tables source to an empty schema payload', async () => {
            let captured: any
            globalThis.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
                captured = JSON.parse(init.body)
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ success: true, data: { content: 'ok' } })
                })
            }) as any

            const state = {
                isLoading: ref(false),
                messages: ref([]),
                code: ref('SELECT 1;'),
                tablesSource: () => null,
                error: ref(null)
            }
            // @ts-expect-error deliberate null source to exercise the fallback
            await useInlineActions(state).explain('SELECT 1', makeDisplay())
            expect(captured.schema).toEqual([])

            // Table entries missing columns/columnTypes fall back to empty values
            const state2 = {
                ...state,
                tablesSource: () => [{ name: 'odd' }]
            }
            // @ts-expect-error deliberate partial table from an older saved payload
            await useInlineActions(state2).explain('SELECT 1', makeDisplay())
            expect(captured.schema).toEqual([{ table: 'odd', columns: [], columnTypes: {} }])
        })

        it('uses the generic failure text when the API omits the error field', async () => {
            globalThis.fetch = vi.fn().mockImplementation(() => jsonOk({ success: false })) as any
            const display = makeDisplay()
            const actions = useInlineActions(makeState())

            await actions.analyzeError({ line: 1, message: 'boom' }, display)
            expect(await actions.fixCode(display)).toBeNull()
            await actions.explain('SELECT 1', display)
            expect(await actions.optimize('SELECT 1', display)).toBeNull()
            expect(await actions.generateSql('make sql', display)).toBeNull()

            const errors = display.calls.filter((c) => c.type === 'error')
            expect(errors.map((e: any) => e.message)).toEqual([
                'AI 分析失败：未知错误',
                'AI 修复失败：未知错误',
                '解释失败：未知错误',
                '优化失败：未知错误',
                '无法生成 SQL：未知错误'
            ])
        })

        it('normalizes non-Error rejections through the transport', async () => {
            globalThis.fetch = vi.fn().mockRejectedValue('plain string') as any
            const display = makeDisplay()
            await useInlineActions(makeState()).analyzeError({ line: 1, message: 'x' }, display)
            expect(display.calls).toContainEqual({
                type: 'error',
                message: expect.stringContaining('plain string')
            })
        })

        it('returns null fixedCode when the fix response has none', async () => {
            mockFetchSuccess({ content: 'already fine', fixedCode: undefined })
            const display = makeDisplay()
            const result = await useInlineActions(makeState()).fixCode(display)
            expect(result).toBeNull()
            expect(display.calls.some((c) => c.type === 'result')).toBe(true)
        })

        it('uses the formatted content when the explain summary is empty', async () => {
            mockFetchSuccess({ summary: '', content: 'plain content' })
            const state = makeState()
            await useInlineActions(state).explain('SELECT 1', makeDisplay())
            expect(state.messages.value[0].content).toBe('formatted-explain: plain content')
        })

        it('omits the apply-fix action when optimization returns no code', async () => {
            mockFetchSuccess({ content: 'no better version', fixedCode: undefined })
            const display = makeDisplay()
            const result = await useInlineActions(makeState()).optimize('SELECT 1', display)
            expect(result).toBeNull()
            const resultCall = display.calls.find((c) => c.type === 'result')!
            expect(resultCall.actions).toEqual([{ label: '💬 追问', action: 'follow-up' }])
        })

        it('uses the summary for the persisted error-analysis message when present', async () => {
            mockFetchSuccess({ summary: 'short summary', content: 'long content' })
            const state = makeState()
            await useInlineActions(state).analyzeError({ line: 2, message: 'bad' }, makeDisplay())
            expect(state.messages.value[0].content).toContain('short summary')
        })
    })
})
