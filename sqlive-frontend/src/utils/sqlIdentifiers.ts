/** SQLite identifier helpers for editing known INSERT statements, not a SQL grammar. */
export function quoteSqlIdentifier(name: string): string {
    return `"${name.replaceAll('"', '""')}"`
}

export function maskSqlComments(sql: string): string {
    return sql.replaceAll(
        /'(?:[^']|'')*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]|--[^\r\n]*|\/\*[\s\S]*?\*\//gu,
        (token) =>
            token.startsWith('--') || token.startsWith('/*')
                ? token.replaceAll(/[^\r\n]/gu, ' ')
                : token
    )
}

interface SqlToken {
    value: string
    start: number
    end: number
    quoted: boolean
}

/** Reads one token from comment-masked SQL while preserving original UTF-16 offsets. */
export function readSqlToken(sql: string, from = 0): SqlToken | null {
    const match = /\S/u.exec(sql.slice(from))
    if (!match) return null
    const start = from + match.index
    const first = sql[start]
    const close = first === '[' ? ']' : first
    if ('"`[\''.includes(first)) {
        let end = start + 1
        while (end < sql.length) {
            if (sql[end] === close) {
                if (close !== ']' && sql[end + 1] === close) {
                    end += 2
                    continue
                }
                const raw = sql.slice(start + 1, end)
                return {
                    value: close === ']' ? raw : raw.split(close + close).join(close),
                    start,
                    end: end + 1,
                    quoted: true
                }
            }
            end++
        }
        return null
    }
    const word = /^[\p{L}\p{N}_$]+/u.exec(sql.slice(start))
    return {
        value: word?.[0] ?? first,
        start,
        end: start + (word?.[0].length ?? 1),
        quoted: false
    }
}

function isKeyword(token: SqlToken | null, keyword: string): boolean {
    return !!token && !token.quoted && token.value.toUpperCase() === keyword
}

export function sameSqlIdentifier(first: string, second: string): boolean {
    const fold = (value: string) => value.replaceAll(/[A-Z]/gu, (letter) => letter.toLowerCase())
    return fold(first) === fold(second)
}

export function parseInsertTarget(sql: string): {
    tableName: string
    columns: string[] | null
    valuesStart: number | null
} | null {
    const masked = maskSqlComments(sql)
    let token = readSqlToken(masked)
    if (!isKeyword(token, 'INSERT') && !isKeyword(token, 'REPLACE')) return null
    token = readSqlToken(masked, token!.end)
    if (isKeyword(token, 'OR')) {
        const conflict = readSqlToken(masked, token!.end)
        if (
            !conflict ||
            conflict.quoted ||
            !/^(ROLLBACK|ABORT|FAIL|IGNORE|REPLACE)$/iu.test(conflict.value)
        )
            return null
        token = readSqlToken(masked, conflict.end)
    }
    if (!isKeyword(token, 'INTO')) return null
    token = readSqlToken(masked, token!.end)
    if (!token) return null
    let tableName = token.value
    let next = readSqlToken(masked, token.end)
    if (next?.value === '.' && !next.quoted) {
        token = readSqlToken(masked, next.end)
        if (!token) return null
        tableName = token.value
        next = readSqlToken(masked, token.end)
    }
    let columns: string[] | null = null
    if (next?.value === '(' && !next.quoted) {
        columns = []
        for (;;) {
            const column = readSqlToken(masked, next.end)
            if (!column || (!column.quoted && /^[(),;]$/u.test(column.value))) return null
            columns.push(column.value)
            next = readSqlToken(masked, column.end)
            if (next?.value === ')' && !next.quoted) {
                next = readSqlToken(masked, next.end)
                break
            }
            if (next?.value !== ',' || next.quoted) return null
        }
    }
    return { tableName, columns, valuesStart: isKeyword(next, 'VALUES') ? next!.end : null }
}

export function parseColumnDefinition(definition: string): { name: string; type: string } {
    const token = readSqlToken(definition)
    if (!token) throw new Error('Column name is required')
    return { name: token.value, type: definition.slice(token.end).trim() }
}
