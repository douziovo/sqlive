import DOMPurify from 'dompurify'
import { describe, expect, it } from 'vitest'
import { sanitizeConfig } from '@/utils/sanitize'

describe('sanitizeConfig', () => {
    it('removes active content and makes sanitized links safe to open', () => {
        const html = DOMPurify.sanitize(
            '<a href="https://example.com" target="_self" rel="opener">docs</a><script>alert(1)</script><span>safe</span>',
            sanitizeConfig
        )
        const container = document.createElement('div')
        container.innerHTML = html

        const link = container.querySelector('a')!
        expect(link.getAttribute('href')).toBe('https://example.com')
        expect(link.getAttribute('target')).toBe('_blank')
        expect(link.getAttribute('rel')).toBe('noopener noreferrer')
        expect(container.querySelector('script')).toBeNull()
        expect(container.querySelector('span')?.textContent).toBe('safe')
    })
})
