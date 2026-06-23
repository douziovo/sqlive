import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { Ref } from 'vue'
import { ref } from 'vue'
import type { DatabaseModel } from '@/model/DatabaseTypes'
import type { AiMessage } from '@/composables/useAiChat'
import type { DisplayHandler } from '@/composables/useInlineActions'

vi.mock('@/utils/aiFormatter', () => ({
  formatErrorAnalysis: vi.fn((data: any) => `formatted-error: ${data.summary || data.content}`),
  formatExplain: vi.fn((data: any) => `formatted-explain: ${data.summary || data.content}`),
  formatFixCode: vi.fn((data: any) => `formatted-fix: ${data.fixedCode || data.content}`),
  formatOptimize: vi.fn((data: any) => `formatted-optimize: ${data.optimizedCode || data.content}`),
  formatGenerateSql: vi.fn((code: string) => `formatted-sql: ${code}`)
}))

import { useInlineActions } from '@/composables/useInlineActions'

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
    onResult: (content: string, actions: any[]) => calls.push({ type: 'result', content, actions }),
    onError: (message: string) => calls.push({ type: 'error', message })
  }
}

function mockFetchSuccess(data: any) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data })
  }) as any
}

function mockFetchFailure(error: string) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: false, error })
  }) as any
}

function mockFetchNetworkError(err: Error) {
  globalThis.fetch = vi.fn().mockRejectedValue(err) as any
}

function makeState(overrides?: Partial<{
  code: string
  error: { line: number; message: string } | null
}>) {
  return {
    isLoading: ref(false) as Ref<boolean>,
    messages: ref([]) as Ref<AiMessage[]>,
    code: ref(overrides?.code ?? 'SELECT 1;') as Ref<string>,
    db: makeDb(),
    error: ref(overrides?.error ?? null) as Ref<{ line: number; message: string } | null>
  }
}

describe('useInlineActions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('analyzeError', () => {
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

      const state = makeState()
      const display = makeDisplay()
      const { analyzeError } = useInlineActions(state)

      await analyzeError({ line: 1, message: 'error' }, display)

      expect(display.calls.some((c) => c.type === 'error')).toBe(true)
      expect(state.isLoading.value).toBe(false)
    })

    it('handles network error gracefully', async () => {
      mockFetchNetworkError(new Error('Connection refused'))

      const state = makeState()
      const display = makeDisplay()
      const { analyzeError } = useInlineActions(state)

      await analyzeError({ line: 1, message: 'error' }, display)

      expect(display.calls.some((c) => c.type === 'error')).toBe(true)
      expect(state.isLoading.value).toBe(false)
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
        optimizedCode: 'SELECT id FROM users WHERE id > 0;',
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
})
