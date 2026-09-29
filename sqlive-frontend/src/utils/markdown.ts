import DOMPurify from 'dompurify'
import { marked, type Tokens } from 'marked'

/**
 * Browser Markdown helpers for search indexing and document titles.
 *
 * Used by useDocsSearch (builds MiniSearch index from .md raw) and
 * DocsLayout (extracts H1 for document.title).
 */

/**
 * Extract the first H1 heading text from raw markdown.
 * Returns null when no H1 is present.
 *
 * Example: extractH1('# 编辑器\n\nbody') === '编辑器'
 */
export function extractH1(raw: string): string | null {
    const heading = marked
        .lexer(raw)
        .find((token): token is Tokens.Heading => token.type === 'heading' && token.depth === 1)
    return heading?.text.trim() ?? null
}

/**
 * Strip markdown syntax to plain text for search indexing.
 * Removes code blocks, inline code, headings, emphasis markers;
 * extracts link text from [text](url).
 */
export function stripMarkdown(raw: string): string {
    const fragment = DOMPurify.sanitize(marked.parse(raw, { async: false }), {
        RETURN_DOM_FRAGMENT: true
    })
    fragment.querySelectorAll('pre, code, h1, h2, h3, h4, h5, h6').forEach((node) => node.remove())
    fragment.querySelectorAll('br, p, li, td, th').forEach((node) => node.append(' '))
    return (fragment.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Convert a globbed module path to a slug.
 * Example: '/src/content/docs/usage/editor.md' -> 'usage/editor'
 */
export function pathToSlug(path: string): string {
    return path.replace(/^.*\/content\/docs\//, '').replace(/\.md$/, '')
}
