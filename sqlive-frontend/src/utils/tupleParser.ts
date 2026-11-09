import { maskSqlComments, readSqlToken } from './sqlIdentifiers'

/**
 * Parse VALUES tuples from SQL INSERT statements, correctly handling
 * nested parentheses (function calls) and quoted strings.
 */

export function extractTuplesWithDepth(
    sql: string,
    valuesStart?: number
): { content: string; start: number; end: number }[] {
    const tuples: { content: string; start: number; end: number }[] = []
    const masked = maskSqlComments(sql)
    if (valuesStart === undefined) {
        let token = readSqlToken(masked)
        while (token && (token.quoted || token.value.toUpperCase() !== 'VALUES')) {
            token = readSqlToken(masked, token.end)
        }
        if (!token) return tuples
        valuesStart = token.end
    }

    let i = valuesStart
    while (i < sql.length) {
        while (i < sql.length && /\s/u.test(masked[i])) i++
        if (i >= sql.length || masked[i] !== '(') break

        const tupleStart = i
        let depth = 0
        let inString = false
        let quoteChar = ''

        while (i < sql.length) {
            const c = masked[i]

            if (inString) {
                if (c === quoteChar) {
                    if (quoteChar !== ']' && i + 1 < sql.length && masked[i + 1] === quoteChar) {
                        i += 2
                        continue
                    }
                    inString = false
                }
                i++
                continue
            }

            if (c === "'" || c === '"' || c === '`' || c === '[') {
                inString = true
                quoteChar = c === '[' ? ']' : c
                i++
                continue
            }

            if (c === '(') {
                depth++
                i++
                continue
            }
            if (c === ')') {
                depth--
                i++
                if (depth === 0) {
                    tuples.push({
                        content: sql.slice(tupleStart + 1, i - 1),
                        start: tupleStart,
                        end: i
                    })
                    break
                }
                continue
            }

            i++
        }

        while (i < sql.length && (masked[i] === ',' || /\s/u.test(masked[i]))) i++
    }

    return tuples
}

export function splitTupleContent(content: string): string[] {
    content = maskSqlComments(content)
    const values: string[] = []
    let current = ''
    let depth = 0
    let inString = false
    let quoteChar = ''

    for (let i = 0; i < content.length; i++) {
        const c = content[i]

        if (inString) {
            current += c
            if (c === quoteChar) {
                if (quoteChar !== ']' && i + 1 < content.length && content[i + 1] === quoteChar) {
                    current += content[i + 1]
                    i++
                    continue
                }
                inString = false
            }
            continue
        }

        if (c === "'" || c === '"' || c === '`' || c === '[') {
            inString = true
            quoteChar = c === '[' ? ']' : c
            current += c
            continue
        }

        if (c === '(') {
            depth++
            current += c
            continue
        }
        if (c === ')') {
            depth--
            current += c
            continue
        }

        if (c === ',' && depth === 0) {
            values.push(current.trim())
            current = ''
            continue
        }

        current += c
    }

    if (current.trim()) {
        values.push(current.trim())
    }

    return values
}
