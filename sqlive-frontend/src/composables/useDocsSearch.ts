import type MiniSearchType from 'minisearch'
import {ref} from 'vue'
import {extractH1, stripMarkdown, pathToSlug} from '@/utils/markdown'

/**
 * useDocsSearch — MiniSearch lazy index + search + error fallback (D-07).
 *
 * Singleton pattern: `index`, `indexReady`, `indexError` live at module scope
 * and survive component unmount (per RESEARCH.md Example 3 + useAiChat.ts
 * lines 59-81 module-level singleton pattern). `ensureIndex()` is idempotent —
 * first call builds the index; subsequent calls are no-ops.
 *
 * Vite 8 `import.meta.glob` new syntax (Pitfall 3): `query: '?raw', import:
 * 'default', eager: true` (NOT deprecated `as: 'raw'`).
 *
 * MiniSearch is dynamically imported on first `ensureIndex()` (~6KB gzip lazy
 * load). If the import or index build fails, `indexError` becomes true and
 * `search()` returns [] — sidebar navigation still works (D-07 error fallback
 * does NOT throw to caller).
 *
 * D-07 locked config: prefix true, fuzzy 0.2, boost title x2.
 */
const articles = import.meta.glob('/src/content/docs/**/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>

// Module-level singleton state — survives component unmount.
let index: MiniSearchType | null = null
const indexError = ref(false)
const indexReady = ref(false)

export function useDocsSearch() {
    /**
     * Lazily build the MiniSearch index on first call. Idempotent — subsequent
     * calls return early. On any failure (import error, instantiation error),
     * sets indexError=true and does NOT throw (D-07 error fallback).
     */
    async function ensureIndex(): Promise<void> {
        if (index || indexError.value) return
        try {
            const MiniSearch = (await import('minisearch')).default
            const docs = Object.entries(articles).map(([path, raw]) => ({
                id: path,
                slug: pathToSlug(path),
                title: extractH1(raw) ?? pathToSlug(path),
                content: stripMarkdown(raw),
                category: path.split('/').slice(-2, -1)[0],
            }))
            index = new MiniSearch({
                fields: ['title', 'content'],
                storeFields: ['title', 'slug', 'category'],
                searchOptions: {prefix: true, fuzzy: 0.2, boost: { title: 2 }},
            })
            index.addAll(docs)
            indexReady.value = true
        } catch (e) {
            console.error('MiniSearch index build failed:', e)
            indexError.value = true
        }
    }

    /**
     * Search the index. Returns [] when index is not built or query is empty.
     * Results include slug/title/category/score (D-07 storeFields).
     */
    function search(query: string): Array<{
        slug: string
        title: string
        category: string
        score: number
    }> {
        if (!index || !query.trim()) return []
        return index.search(query).map((r: any) => ({
            slug: r.slug,
            title: r.title,
            category: r.category,
            score: r.score,
        }))
    }

    return {ensureIndex, search, indexReady, indexError}
}
