import {describe, expect, it, vi, beforeEach} from 'vitest'
import {ref} from 'vue'

// Mock the three modules useDocArticle depends on (per plan Step 4).
// import.meta.glob is NOT mocked — it loads the real .md stubs from
// src/content/docs/, so 'intro' slug resolves to the real intro.md content.
vi.mock('@/utils/sanitize', () => ({
    sanitizeConfig: {ALLOWED_TAGS: ['h1', 'p'], ALLOWED_ATTR: []},
}))

vi.mock('marked', () => ({
    marked: {
        parse: vi.fn(),
    },
}))

vi.mock('dompurify', () => ({
    default: {
        sanitize: vi.fn(),
        addHook: vi.fn(),
    },
}))

import {useDocArticle} from '@/composables/useDocArticle'
import {marked} from 'marked'
import DOMPurify from 'dompurify'

describe('useDocArticle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns sanitized HTML when slug is found', () => {
        // D-03: marked.parse + DOMPurify.sanitize with shared sanitizeConfig
        vi.mocked(marked.parse).mockReturnValueOnce('<h1>Intro</h1><p>content</p>')
        vi.mocked(DOMPurify.sanitize).mockReturnValueOnce('<h1>Intro</h1><p>content</p>')

        const slug = ref('intro')
        const {html} = useDocArticle(slug)

        expect(html.value).toBe('<h1>Intro</h1><p>content</p>')
        // marked.parse called with the raw markdown content (contains H1 '项目介绍')
        expect(marked.parse).toHaveBeenCalledWith(
            expect.stringContaining('# 项目介绍'),
            {breaks: true, gfm: true},
        )
        // DOMPurify.sanitize called with marked output + shared sanitizeConfig
        expect(DOMPurify.sanitize).toHaveBeenCalledWith(
            '<h1>Intro</h1><p>content</p>',
            expect.objectContaining({ALLOWED_TAGS: expect.any(Array)}),
        )
    })

    it('returns null when slug is not found', () => {
        // Error Handling 4.1: non-existent slug → raw null → html null
        const slug = ref('nonexistent')
        const {raw, html} = useDocArticle(slug)

        expect(raw.value).toBeNull()
        expect(html.value).toBeNull()
        expect(marked.parse).not.toHaveBeenCalled()
    })

    it('strips script tags via DOMPurify sanitize', () => {
        // T-14-17: marked output with script tag, DOMPurify strips it
        vi.mocked(marked.parse).mockReturnValueOnce('<script>alert(1)</script><p>safe</p>')
        vi.mocked(DOMPurify.sanitize).mockReturnValueOnce('<p>safe</p>')

        const slug = ref('intro')
        const {html} = useDocArticle(slug)

        expect(html.value).toBe('<p>safe</p>')
        expect(html.value).not.toContain('<script>')
        expect(html.value).not.toContain('alert(1)')
    })

    it('falls back to <pre> when marked.parse throws', () => {
        // Error Handling 4.8: marked.parse exception → <pre>{raw}</pre> fallback
        vi.mocked(marked.parse).mockImplementationOnce(() => {
            throw new Error('parse error')
        })

        const slug = ref('intro')
        const {raw, html} = useDocArticle(slug)

        expect(html.value).toBe('<pre>' + raw.value + '</pre>')
        expect(html.value).toContain('<pre>')
        expect(html.value).toContain('项目介绍')
        // DOMPurify.sanitize should NOT be called when marked threw (fallback bypasses sanitize)
        expect(DOMPurify.sanitize).not.toHaveBeenCalled()
    })
})
