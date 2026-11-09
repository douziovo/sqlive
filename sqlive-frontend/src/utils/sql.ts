const NUMERIC_TYPE_RE = /INT|DECIMAL|FLOAT|DOUBLE|NUMERIC|REAL/iu

export function isNumericType(type: string): boolean {
    return NUMERIC_TYPE_RE.test(type)
}

export function parsePrimaryType(rawType: string): string {
    return rawType.split('|')[0].trim()
}

export function extractTriggerTiming(sql: string): string {
    const m = sql?.match(
        /(BEFORE|AFTER|INSTEAD\s+OF)\s+(DELETE|INSERT|UPDATE)(\s+OF\s+\w+(?:\s*,\s*\w+)*)?/iu
    )
    return m ? m[0].toUpperCase() : ''
}

export function toSqlLiteral(val?: unknown, type?: string): string {
    if (val === null || val === undefined || val === '') return 'NULL'
    // oxlint-disable-next-line typescript/no-base-to-string -- SQL cell values retain their existing JavaScript string representation.
    if (type && isNumericType(type) && !Number.isNaN(Number(val))) return String(val)
    // oxlint-disable-next-line typescript/no-base-to-string -- SQL cell values retain their existing JavaScript string representation.
    return `'${String(val).replaceAll("'", "''")}'`
}
