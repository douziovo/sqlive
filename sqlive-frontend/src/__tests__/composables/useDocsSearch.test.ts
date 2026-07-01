import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * useDocsSearch test suite (D-07 — MiniSearch lazy index + error fallback).
 *
 * Module singleton pattern (per RESEARCH.md Example 3 + useAiChat.ts lines 59-81):
 * `let index`, `indexReady`, `indexError` live at module scope and survive
 * across `useDocsSearch()` calls. To isolate tests, each test loads a fresh
 * module instance via `vi.resetModules()` + dynamic `import()`.
 *
 * Mock strategy:
 * - `minisearch` mocked with a class that counts constructor calls and
 *   returns canned search results for 'edit' queries.
 * - `shouldThrow` flag (on the hoisted mock object) lets test 5 simulate
 *   MiniSearch instantiation failure without vi.doMock/unmock (which would
 *   also strip the hoisted vi.mock and break subsequent tests).
 */
const mockMinisearch = vi.hoisted(() => {
    const ctorCalls = {count: 0}
    const shouldThrow = {value: false}
    return {
        ctorCalls,
        shouldThrow,
        MockMiniSearch: class MockMiniSearch {
            constructor() {
                ctorCalls.count++
                if (shouldThrow.value) throw new Error('MiniSearch init failed')
            }

            addAll() {
            }

            search(q: string) {
                return q.includes('edit')
                    ? [{
                        slug: 'usage/editor',
                        title: '编辑器',
                        category: 'usage',
                        score: 1,
                    }]
                    : []
            }
        },
    }
})

vi.mock('minisearch', () => ({default: mockMinisearch.MockMiniSearch}))

beforeEach(() => {
    // Reset module registry so `let index = null` and refs re-initialize per test
    vi.resetModules()
    mockMinisearch.ctorCalls.count = 0
    mockMinisearch.shouldThrow.value = false
})

afterEach(() => {
    vi.restoreAllMocks()
    mockMinisearch.shouldThrow.value = false
})

async function loadUseDocsSearch() {
    return (await import('@/composables/useDocsSearch')).useDocsSearch
}

describe('useDocsSearch', () => {
    it('builds index on first ensureIndex call', async () => {
        // D-07: ensureIndex lazily builds MiniSearch index; indexReady becomes true
        const useDocsSearch = await loadUseDocsSearch()
        const {ensureIndex, indexReady, indexError} = useDocsSearch()
        await ensureIndex()
        expect(indexReady.value).toBe(true)
        expect(indexError.value).toBe(false)
        expect(mockMinisearch.ctorCalls.count).toBe(1)
    })

    it('does not rebuild on second ensureIndex call', async () => {
        // D-07 singleton: second ensureIndex is a no-op (index already built)
        const useDocsSearch = await loadUseDocsSearch()
        const {ensureIndex} = useDocsSearch()
        await ensureIndex()
        await ensureIndex()
        expect(mockMinisearch.ctorCalls.count).toBe(1)
    })

    it('prefix match "edit" hits editor article', async () => {
        // D-07: prefix search returns results with title/slug/category/score
        const useDocsSearch = await loadUseDocsSearch()
        const {ensureIndex, search} = useDocsSearch()
        await ensureIndex()
        const results = search('edit')
        expect(results).toHaveLength(1)
        expect(results[0].slug).toBe('usage/editor')
        expect(results[0].title).toBe('编辑器')
        expect(results[0].category).toBe('usage')
        expect(results[0].score).toBe(1)
    })

    it('empty query returns empty array', async () => {
        // D-07: empty/whitespace query returns [] without calling index.search
        const useDocsSearch = await loadUseDocsSearch()
        const {ensureIndex, search} = useDocsSearch()
        await ensureIndex()
        expect(search('')).toEqual([])
        expect(search('   ')).toEqual([])
    })

    it('marks unavailable when minisearch init fails', async () => {
        // D-07 error fallback: if MiniSearch import or instantiation throws,
        // indexError becomes true (does NOT throw to caller). Sidebar nav still works.
        mockMinisearch.shouldThrow.value = true
        const useDocsSearch = await loadUseDocsSearch()
        const {ensureIndex, indexError, indexReady} = useDocsSearch()
        await ensureIndex()
        expect(indexError.value).toBe(true)
        expect(indexReady.value).toBe(false)
    })
})
