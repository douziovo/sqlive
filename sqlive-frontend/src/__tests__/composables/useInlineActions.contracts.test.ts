import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useInlineActions, type DisplayHandler } from '@/composables/useInlineActions'

afterEach(() => vi.unstubAllGlobals())

describe('AI error response contract', () => {
    it('shows the server error message for every inline operation', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(() =>
                Promise.resolve(
                    Response.json({
                        success: false,
                        error: { message: 'provider unavailable', line: 0 }
                    })
                )
            )
        )
        const onError = vi.fn()
        const display: DisplayHandler = { onLoading: vi.fn(), onResult: vi.fn(), onError }
        const actions = useInlineActions({
            isLoading: ref(false),
            messages: ref([]),
            code: ref('SELECT 1;'),
            tablesSource: () => [],
            error: ref(null)
        })
        await actions.analyzeError({ message: 'syntax error', line: 1 }, display)
        await actions.fixCode(display)
        await actions.explain('SELECT 1;', display)
        await actions.optimize('SELECT 1;', display)
        await actions.generateSql('make a table', display)

        expect(onError).toHaveBeenCalledTimes(5)
        for (const [message] of onError.mock.calls) {
            expect(message).toContain('provider unavailable')
            expect(message).not.toContain('[object Object]')
        }
    })
})
