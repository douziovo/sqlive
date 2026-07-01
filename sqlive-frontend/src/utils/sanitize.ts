import DOMPurify from 'dompurify'

/**
 * Shared DOMPurify sanitize config (D-09).
 *
 * Used by AiChatPanel.vue (markdown render) and MarkdownRenderer.vue (docs pages)
 * to eliminate the inline-config double source.
 */
export const sanitizeConfig = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'hr',
    'img', 'a', 'strong', 'em', 'br', 'span', 'div',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel'],
}

/**
 * Tab-nabbing defense (Pitfall 9): force target=_blank + rel=noopener noreferrer
 * on every anchor tag after sanitize. Single-point config — all consumers benefit.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
  if (node.tagName && node.tagName.toUpperCase() === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})
