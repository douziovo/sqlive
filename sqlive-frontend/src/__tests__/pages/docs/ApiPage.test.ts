import {mount} from '@vue/test-utils'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * ApiPage test suite (W5 fix — lightweight fetchOpenApi retry unit test).
 *
 * Tests the fetch + retry-once + error/loading state logic in isolation.
 * @scalar/api-reference is mocked to never resolve (only fetchOpenApi logic
 * is under test, not Scalar rendering — that's covered by E2E docs-api.spec.ts).
 *
 * Uses vi.useFakeTimers() to fast-forward the 500ms retry delay without
 * real waiting (pattern from useAiStreaming.test.ts).
 *
 * File location note: src/__tests__/pages/docs/ is OUTSIDE vite.config.ts
 * coverage include list (only src/composables/**, src/utils/**, src/components/**
 * are included). The test runs and must pass for plan acceptance, but does
 * NOT count toward the 60% coverage threshold. This is intentional —
 * fetchOpenApi retry logic is unit-tested here, complementing E2E docs-api.
 */

// Mock @scalar/api-reference so dynamic import doesn't load the real 150KB lib.
// The mock resolves to a stub component; tests don't render it.
vi.mock('@scalar/api-reference', () => ({
    ApiReference: {
        name: 'ScalarApiReferenceMock',
        render: () => null,
    },
}))

import ApiPage from '@/pages/docs/ApiPage.vue'

const realFetch = globalThis.fetch

function mockFetchSequence(...responses: Array<{ok: boolean; status: number; body?: any} | Error>) {
    const calls = {count: 0}
    const fetchSpy = vi.fn().mockImplementation(async () => {
        const idx = calls.count
        calls.count++
        const res = responses[idx]
        if (res instanceof Error) throw res
        return {
            ok: res.ok,
            status: res.status,
            json: async () => res.body ?? {},
        }
    })
    globalThis.fetch = fetchSpy as any
    return {fetchSpy, calls}
}

describe('ApiPage fetchOpenApi retry logic', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        globalThis.fetch = realFetch
    })

    it('retries once after 500ms when first fetch fails, then succeeds', async () => {
        // W5 fix Test 1: first fetch 500, retry fetch 200 → openApiJson populated
        const {fetchSpy, calls} = mockFetchSequence(
            {ok: false, status: 500},
            {ok: true, status: 200, body: {openapi: '3.0', paths: {'/api/execute': {}}}},
        )

        const w = mount(ApiPage)
        // onMounted calls fetchOpenApi — first call fails (500)
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(500)
        // Allow microtasks to flush after timer
        await Promise.resolve()
        await w.vm.$nextTick()

        expect(calls.count).toBe(2)
        expect(fetchSpy).toHaveBeenCalledTimes(2)
        // loading should be false after retry succeeds
        // openApiJson should be populated
        const errorText = w.text()
        expect(errorText).not.toContain('API 文档暂时不可用')
    })

    it('shows error state when both fetches fail', async () => {
        // W5 fix Test 2: both fetches fail → error.value set, button visible
        mockFetchSequence(
            {ok: false, status: 500},
            {ok: false, status: 500},
        )

        const w = mount(ApiPage)
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(500)
        await Promise.resolve()
        await w.vm.$nextTick()

        expect(w.text()).toContain('API 文档暂时不可用')
        // UI-SPEC FLAG 1: retry button text is "重新加载 API 文档" (verb+noun)
        const retryBtn = w.find('button[aria-label="重新加载 API 文档"]')
        expect(retryBtn.exists()).toBe(true)
        expect(retryBtn.text()).toContain('重新加载 API 文档')
    })

    it('handleRetry re-invokes fetchOpenApi after error state', async () => {
        // W5 fix Test 3: after error, click retry → fetch called additional times
        const {fetchSpy} = mockFetchSequence(
            {ok: false, status: 500},
            {ok: false, status: 500},
            {ok: true, status: 200, body: {openapi: '3.0'}},
        )

        const w = mount(ApiPage)
        // First fetch + retry both fail → error state
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(500)
        await Promise.resolve()
        await w.vm.$nextTick()
        expect(fetchSpy).toHaveBeenCalledTimes(2)

        // Click retry button → handleRetry → fetchOpenApi again
        const retryBtn = w.find('button[aria-label="重新加载 API 文档"]')
        expect(retryBtn.exists()).toBe(true)
        await retryBtn.trigger('click')
        await vi.advanceTimersByTimeAsync(500)
        await Promise.resolve()
        await w.vm.$nextTick()

        // Should have made at least 3 total fetch calls (2 initial + 1 retry attempt)
        expect(fetchSpy).toHaveBeenCalledTimes(3)
    })
})
