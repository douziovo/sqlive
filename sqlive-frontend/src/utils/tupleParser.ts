/**
 * Parse VALUES tuples from SQL INSERT statements, correctly handling
 * nested parentheses (function calls) and quoted strings.
 */

export function extractTuplesWithDepth(sql: string): { content: string; start: number; end: number }[] {
  const tuples: { content: string; start: number; end: number }[] = []
  const valuesIdx = sql.toUpperCase().indexOf('VALUES')
  if (valuesIdx === -1) return tuples

  let i = valuesIdx + 6
  while (i < sql.length) {
    while (i < sql.length && /\s/.test(sql[i])) i++
    if (i >= sql.length || sql[i] !== '(') break

    const tupleStart = i
    let depth = 0
    let inString = false
    let quoteChar = ''

    while (i < sql.length) {
      const c = sql[i]

      if (inString) {
        if (c === quoteChar) {
          if (i + 1 < sql.length && sql[i + 1] === quoteChar) {
            i += 2
            continue
          }
          inString = false
        }
        i++
        continue
      }

      if (c === "'" || c === '"') {
        inString = true
        quoteChar = c
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
            content: sql.substring(tupleStart + 1, i - 1),
            start: tupleStart,
            end: i
          })
          break
        }
        continue
      }

      i++
    }

    while (i < sql.length && (sql[i] === ',' || /\s/.test(sql[i]))) i++
  }

  return tuples
}

export function splitTupleContent(content: string): string[] {
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
        if (i + 1 < content.length && content[i + 1] === quoteChar) {
          current += content[i + 1]
          i++
          continue
        }
        inString = false
      }
      continue
    }

    if (c === "'" || c === '"') {
      inString = true
      quoteChar = c
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
