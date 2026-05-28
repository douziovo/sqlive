import { describe, expect, it } from 'vitest'
import { escapeHtml } from '@/utils/html'

describe('escapeHtml', () => {
  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('escapes & to &amp;', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes < to &lt;', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes > to &gt;', () => {
    expect(escapeHtml('</tag>')).toBe('&lt;/tag&gt;')
  })

  it('escapes " to &quot;', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
  })

  it("escapes ' to &#39;", () => {
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('handles plain text without changes', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('handles multiple special characters', () => {
    const input = '<a href="test">&</a>'
    const output = escapeHtml(input)
    expect(output).toBe('&lt;a href=&quot;test&quot;&gt;&amp;&lt;/a&gt;')
  })

  it('handles numbers and unicode', () => {
    expect(escapeHtml('你好世界123')).toBe('你好世界123')
  })
})
