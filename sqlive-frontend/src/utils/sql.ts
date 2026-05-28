const NUMERIC_TYPE_RE = /INT|DECIMAL|FLOAT|DOUBLE|NUMERIC|REAL/i

export function isNumericType(type: string): boolean {
  return NUMERIC_TYPE_RE.test(type)
}

export function parsePrimaryType(rawType: string): string {
  return rawType.split('|')[0].trim()
}

export function extractTriggerTiming(sql: string): string {
  const m = sql?.match(/(BEFORE|AFTER|INSTEAD\s+OF)\s+(DELETE|INSERT|UPDATE)(\s+OF\s+\w+(?:\s*,\s*\w+)*)?/i)
  return m ? m[0].toUpperCase() : ''
}

export function toSqlLiteral(val: any, type?: string): string {
  if (val === null || val === undefined || val === '') return 'NULL'
  if (type && isNumericType(type) && !Number.isNaN(Number(val))) return String(val)
  return `'${String(val).replace(/'/g, "''")}'`
}
