export function escapeHtml(str: string): string {
    return str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

export function highlightMatch(
    text: string,
    query: string,
    className = 'bg-yellow-200 rounded-sm'
): string {
    if (!query?.trim()) return escapeHtml(text)
    const escaped = escapeHtml(text)
    const escapedQuery = escapeHtml(query.trim()).replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    return escaped.replaceAll(
        new RegExp(`(${escapedQuery})`, 'giu'),
        `<mark class="${className}">$1</mark>`
    )
}
