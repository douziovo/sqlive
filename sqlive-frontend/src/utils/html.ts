export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

export function highlightMatch(text: string, query: string, className = 'bg-yellow-200 rounded-sm'): string {
    if (!query?.trim()) return escapeHtml(text)
    const escaped = escapeHtml(text)
    const escapedQuery = escapeHtml(query.trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return escaped.replace(new RegExp(`(${escapedQuery})`, 'gi'), `<mark class="${className}">$1</mark>`)
}
