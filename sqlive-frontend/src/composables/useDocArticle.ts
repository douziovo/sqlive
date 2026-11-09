import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, type Ref } from 'vue'

import { sanitizeConfig } from '@/utils/sanitize'

/**
 * useDocArticle — slug → markdown raw → marked.parse → DOMPurify.sanitize.
 *
 * Articles are bundled at build time via import.meta.glob (Vite 8 new syntax
 * per  — `query: '?raw', import: 'default'`, NOT deprecated `as: 'raw'`).
 * Non-existent slugs resolve to null → ArticlePage redirects to /docs/not-found
 * (Error Handling 4.1).
 *
 * marked.parse is wrapped in try/catch with `<pre>` fallback (Error Handling 4.8).
 * marked.parse uses explicit synchronous mode, returning a string.
 */
const articles = import.meta.glob<string>('/src/content/docs/**/*.md', {
    query: '?raw',
    import: 'default',
    eager: true
})

export function useDocArticle(slug: Ref<string>) {
    const raw = computed(() => {
        const path = `/src/content/docs/${slug.value}.md`
        return articles[path] ?? null
    })

    const html = computed(() => {
        if (!raw.value) return null
        try {
            // async: false keeps the parser result synchronous and typed as string.
            const parsed = marked.parse(raw.value, { async: false, breaks: true, gfm: true })
            // shared sanitizeConfig with afterSanitizeAttributes hook
            // (target=_blank + rel=noopener noreferrer on every <a>).
            return DOMPurify.sanitize(parsed, sanitizeConfig)
        } catch {
            // Error Handling 4.8: marked.parse exception → escaped <pre> fallback
            // (escape so raw markdown is shown as text, not rendered as HTML)
            const escaped = raw.value
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
            return `<pre>${escaped}</pre>`
        }
    })

    return { raw, html }
}
