import {mount} from '@vue/test-utils'
import {describe, expect, it} from 'vitest'
import MarkdownRenderer from '@/components/docs/MarkdownRenderer.vue'

describe('MarkdownRenderer', () => {
    it('renders sanitized HTML via v-html', () => {
        // D-09: MarkdownRenderer receives sanitized HTML prop and renders via v-html
        const w = mount(MarkdownRenderer, {
            props: {html: '<h1>标题</h1><p>正文</p>'},
        })
        expect(w.html()).toContain('<h1')
        expect(w.html()).toContain('<p>正文</p>')
    })

    it('applies md-body class to root element', () => {
        // D-09: scoped .md-body CSS class on root element
        const w = mount(MarkdownRenderer, {
            props: {html: '<p>test</p>'},
        })
        expect(w.classes()).toContain('md-body')
    })

    it('does not introduce script tags when given clean html', () => {
        // Defense in depth: sanitization happens in useDocArticle (T-14-17),
        // but MarkdownRenderer itself must not add script tags to the DOM.
        const w = mount(MarkdownRenderer, {
            props: {html: '<p>safe content</p>'},
        })
        expect(w.find('script').exists()).toBe(false)
    })
})
