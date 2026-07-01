/**
 * Markdown helper pure functions (D-07 search wiring + D-12 document.title).
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
  const match = raw.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : null
}

/**
 * Strip markdown syntax to plain text for search indexing.
 * Removes code blocks, inline code, headings, emphasis markers;
 * extracts link text from [text](url).
 */
export function stripMarkdown(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, '')        // fenced code blocks
    .replace(/`[^`]+`/g, '')                // inline code
    .replace(/^#+\s+.+$/gm, '')             // headings
    .replace(/[*_~]+/g, '')                 // emphasis markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links: keep text
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Convert a globbed module path to a slug.
 * Example: '/src/content/docs/usage/editor.md' -> 'usage/editor'
 */
export function pathToSlug(path: string): string {
  return path
    .replace(/^.*\/content\/docs\//, '')
    .replace(/\.md$/, '')
}
