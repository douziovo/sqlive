import { describe, expect, it } from 'vitest'
import { extractH1, pathToSlug, stripMarkdown } from '@/utils/markdown'

describe('extractH1', () => {
  it('extracts the first H1 heading text', () => {
    expect(extractH1('# 编辑器\n\nbody')).toBe('编辑器')
  })

  it('returns null when no H1 is present', () => {
    expect(extractH1('plain text without heading')).toBeNull()
  })

  it('ignores H2 and lower', () => {
    expect(extractH1('## not h1\n# real h1')).toBe('real h1')
  })

  it('handles H1 with trailing whitespace', () => {
    expect(extractH1('#   spaced title   \nbody')).toBe('spaced title')
  })
})

describe('stripMarkdown', () => {
  it('strips fenced code blocks', () => {
    expect(stripMarkdown('before\n```js\nconst x = 1\n```\nafter')).toBe('before after')
  })

  it('strips inline code', () => {
    expect(stripMarkdown('use `foo` here')).toBe('use here')
  })

  it('strips heading markers', () => {
    expect(stripMarkdown('# Title\n## Sub')).toBe('')
  })

  it('extracts link text, drops URL', () => {
    expect(stripMarkdown('see [docs](https://example.com)')).toBe('see docs')
  })

  it('strips emphasis markers', () => {
    expect(stripMarkdown('*bold* and _italic_')).toBe('bold and italic')
  })

  it('collapses whitespace and trims', () => {
    const out = stripMarkdown('a\n\nb   c\n\nd')
    expect(out).toBe('a b c d')
  })
})

describe('pathToSlug', () => {
  it('converts full glob path to slug', () => {
    expect(pathToSlug('/src/content/docs/usage/editor.md')).toBe('usage/editor')
  })

  it('handles root-level articles', () => {
    expect(pathToSlug('/src/content/docs/intro.md')).toBe('intro')
  })

  it('is idempotent on already-stripped slugs', () => {
    expect(pathToSlug('usage/editor')).toBe('usage/editor')
  })
})
