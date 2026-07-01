import DOMPurify from 'dompurify'
import {marked} from 'marked'
import {computed, type Ref} from 'vue'
import {sanitizeConfig} from '@/utils/sanitize'

/**
 * useDocArticle — slug → markdown raw → marked.parse → DOMPurify.sanitize (D-03).
 *
 * Articles are bundled at build time via import.meta.glob (Vite 8 new syntax
 * per Pitfall 3 — `query: '?raw', import: 'default'`, NOT deprecated `as: 'raw'`).
 * Non-existent slugs resolve to null → ArticlePage redirects to /docs/not-found
 * (Error Handling 4.1).
 *
 * marked.parse is wrapped in try/catch with `<pre>` fallback (Error Handling 4.8).
 * marked.parse return type is explicitly cast to string (Pitfall 8 — marked v18
 * can return Promise<string> under async option; we use sync mode).
 */
const articles = import.meta.glob('/src/content/docs/**/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>

export function useDocArticle(slug: Ref<string>) {
    const raw = computed(() => {
        const path = `/src/content/docs/${slug.value}.md`
        return articles[path] ?? null
    })

    const html = computed(() => {
        if (!raw.value) return null
        try {
            // Pitfall 8: explicit `as string` — marked.parse can return
            // string | Promise<string>; we use sync mode (no `async: true`).
            const parsed = marked.parse(raw.value, {breaks: true, gfm: true}) as string
            // D-09: shared sanitizeConfig with afterSanitizeAttributes hook
            // (target=_blank + rel=noopener noreferrer on every <a>).
            return DOMPurify.sanitize(parsed, sanitizeConfig)
        } catch (e) {
            // Error Handling 4.8: marked.parse exception → escaped <pre> fallback
            // (escape so raw markdown is shown as text, not rendered as HTML)
            const escaped = raw.value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
            return `<pre>${escaped}</pre>`
        }
    })

    return {raw, html}
}
