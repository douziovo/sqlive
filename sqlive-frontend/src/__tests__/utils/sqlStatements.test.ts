import { describe, expect, it } from 'vitest'
import {
  compareValuesForHighlight,
  enforceTypeConstraints,
  extractSqlStatements,
  isApproxEqual,
  normalizeAndCompare,
  parseExplicitColumns
} from '@/utils/sqlStatements'

// ============================================================
// extractSqlStatements
// ============================================================

describe('extractSqlStatements', () => {
  it('returns empty array for empty string', () => {
    expect(extractSqlStatements('')).toEqual([])
  })

  it('returns empty array for whitespace-only', () => {
    expect(extractSqlStatements('   \n  ')).toEqual([])
  })

  it('handles single statement', () => {
    const stmts = extractSqlStatements('SELECT 1;')
    expect(stmts).toHaveLength(1)
    expect(stmts[0].text).toBe('SELECT 1;')
  })

  it('handles multiple statements', () => {
    const stmts = extractSqlStatements('CREATE TABLE t (x INTEGER);\nINSERT INTO t VALUES (1);\nSELECT * FROM t;')
    expect(stmts).toHaveLength(3)
    expect(stmts[1].text).toBe('\nINSERT INTO t VALUES (1);')
  })

  it('tracks start and end positions', () => {
    const stmts = extractSqlStatements('A;B;C;')
    expect(stmts[0]).toEqual({ text: 'A;', start: 0, end: 2 })
    expect(stmts[1]).toEqual({ text: 'B;', start: 2, end: 4 })
    expect(stmts[2]).toEqual({ text: 'C;', start: 4, end: 6 })
  })

  it('ignores semicolons inside single-quoted strings', () => {
    const stmts = extractSqlStatements("INSERT INTO t VALUES ('hello; world');")
    expect(stmts).toHaveLength(1)
    expect(stmts[0].text).toContain("'hello; world'")
  })

  it('ignores semicolons inside double-quoted identifiers', () => {
    const stmts = extractSqlStatements('CREATE TABLE "t;est" (x INTEGER);')
    expect(stmts).toHaveLength(1)
    expect(stmts[0].text).toContain('"t;est"')
  })

  it('handles escaped single quotes', () => {
    const stmts = extractSqlStatements("INSERT INTO t VALUES ('it''s fine');")
    expect(stmts).toHaveLength(1)
  })

  it('ignores semicolons in -- line comments', () => {
    const stmts = extractSqlStatements('-- comment with ; inside\nSELECT 1;')
    expect(stmts).toHaveLength(1)
    expect(stmts[0].text).toContain('SELECT 1;')
  })

  it('ignores semicolons in /* block comments */', () => {
    const stmts = extractSqlStatements('/* block; comment */\nSELECT 1;')
    expect(stmts).toHaveLength(1)
  })

  it('handles statement without trailing semicolon', () => {
    const stmts = extractSqlStatements('SELECT 1')
    expect(stmts).toHaveLength(1)
    expect(stmts[0].text).toBe('SELECT 1')
  })

  it('skips trailing whitespace after last statement', () => {
    const stmts = extractSqlStatements('SELECT 1;\n  \n')
    expect(stmts).toHaveLength(1)
  })

  it('keeps comment-only script as a single statement', () => {
    // trim() only strips whitespace, not comment text, so comment-only input is kept as-is
    const stmts = extractSqlStatements('-- comment\n-- another comment')
    expect(stmts).toHaveLength(1)
    expect(stmts[0].text).toContain('-- comment')
  })

  it('keeps block-comment-only as a single statement', () => {
    const stmts = extractSqlStatements('/* block comment */')
    expect(stmts).toHaveLength(1)
    expect(stmts[0].text).toBe('/* block comment */')
  })

  it('handles mixed comment styles', () => {
    const stmts = extractSqlStatements('/* block */\n-- line\nSELECT 1;-- trailing\nSELECT 2;')
    expect(stmts).toHaveLength(2)
  })

  it('splits on semicolons inside BEGIN...END blocks', () => {
    // extractSqlStatements only tracks quote/comment state, not BEGIN/END depth
    const stmts = extractSqlStatements(
      "CREATE TRIGGER trg AFTER INSERT ON t BEGIN\n  INSERT INTO log VALUES ('fired');\nEND;"
    )
    expect(stmts).toHaveLength(2)
    expect(stmts[1].text).toContain('END;')
  })
})

// ============================================================
// enforceTypeConstraints
// ============================================================

describe('enforceTypeConstraints', () => {
  it('returns null as-is', () => {
    expect(enforceTypeConstraints(null, 'VARCHAR(10)').value).toBeNull()
  })

  it('returns undefined as-is', () => {
    expect(enforceTypeConstraints(undefined, 'VARCHAR(10)').value).toBeUndefined()
  })

  it('truncates string exceeding VARCHAR limit', () => {
    const result = enforceTypeConstraints('hello world', 'VARCHAR(5)')
    expect(result.value).toBe('hello')
    expect(result.truncated).toEqual({ originalLength: 11, maxLength: 5 })
  })

  it('truncates string exceeding CHAR limit', () => {
    const result = enforceTypeConstraints('abcdefghij', 'CHAR(3)')
    expect(result.value).toBe('abc')
    expect(result.truncated).toEqual({ originalLength: 10, maxLength: 3 })
  })

  it('returns full string within VARCHAR limit', () => {
    const result = enforceTypeConstraints('hi', 'VARCHAR(10)')
    expect(result.value).toBe('hi')
    expect(result.truncated).toBeUndefined()
  })

  it('returns value unchanged for non-VARCHAR types', () => {
    expect(enforceTypeConstraints('hello', 'INTEGER').value).toBe('hello')
    expect(enforceTypeConstraints('text', 'TEXT').value).toBe('text')
  })

  it('truncates numbers (stringified) exceeding VARCHAR limit', () => {
    const result = enforceTypeConstraints('1234567890', 'VARCHAR(3)')
    expect(result.value).toBe('123')
    expect(result.truncated).toEqual({ originalLength: 10, maxLength: 3 })
  })
})

// ============================================================
// isApproxEqual
// ============================================================

describe('isApproxEqual', () => {
  it('returns true for equal numbers', () => {
    expect(isApproxEqual(1.0, 1.0)).toBe(true)
  })

  it('returns true for close-enough numbers', () => {
    expect(isApproxEqual(1.0000000001, 1.0000000002)).toBe(true)
  })

  it('returns false for clearly different numbers', () => {
    expect(isApproxEqual(1.0, 2.0)).toBe(false)
  })

  it('handles zero', () => {
    expect(isApproxEqual(0.0, 0.0)).toBe(true)
    expect(isApproxEqual(0.0, 0.00001)).toBe(false)
  })

  it('handles negative numbers', () => {
    expect(isApproxEqual(-1.5, -1.5)).toBe(true)
    expect(isApproxEqual(-1.0, 1.0)).toBe(false)
  })
})

// ============================================================
// normalizeAndCompare
// ============================================================

describe('normalizeAndCompare', () => {
  describe('NULL handling', () => {
    it('matches NULL string to null db value', () => {
      expect(normalizeAndCompare(null, 'NULL')).toBe(true)
    })

    it('matches NULL string to undefined db value', () => {
      expect(normalizeAndCompare(undefined, 'NULL')).toBe(true)
    })

    it('matches NULL (case-insensitive)', () => {
      expect(normalizeAndCompare(null, 'null')).toBe(true)
    })

    it('matches empty SQL value to null db value', () => {
      expect(normalizeAndCompare(null, '')).toBe(true)
    })

    it('does not match NULL to non-null db value', () => {
      expect(normalizeAndCompare('hello', 'NULL')).toBe(false)
    })

    it('does not match non-NULL to null db value', () => {
      expect(normalizeAndCompare(null, 'hello')).toBe(false)
    })
  })

  describe('quoted strings', () => {
    it('matches quoted string to same db string', () => {
      expect(normalizeAndCompare('hello', "'hello'")).toBe(true)
    })

    it('handles escaped single quotes', () => {
      expect(normalizeAndCompare("it's", "'it''s'")).toBe(true)
    })

    it('handles double-quoted strings', () => {
      expect(normalizeAndCompare('test', '"test"')).toBe(true)
    })

    it('does not match different strings', () => {
      expect(normalizeAndCompare('hello', "'world'")).toBe(false)
    })

    it('trims whitespace in comparison', () => {
      expect(normalizeAndCompare('hello', "'hello '")).toBe(true)
    })
  })

  describe('numeric comparison', () => {
    it('matches numeric values', () => {
      expect(normalizeAndCompare(42, '42')).toBe(true)
    })

    it('matches floating point values', () => {
      expect(normalizeAndCompare(3.14, '3.14')).toBe(true)
    })

    it('matches with fuzzy tolerance', () => {
      expect(normalizeAndCompare(100, '100.0')).toBe(true)
    })

    it('does not match different numbers', () => {
      expect(normalizeAndCompare(42, '99')).toBe(false)
    })

    it('matches stringified numbers', () => {
      expect(normalizeAndCompare('42', '42')).toBe(true)
    })
  })

  describe('unquoted string fallback', () => {
    it('compares unquoted strings as-is', () => {
      expect(normalizeAndCompare('abc', 'abc')).toBe(true)
    })

    it('does not match different unquoted strings', () => {
      expect(normalizeAndCompare('abc', 'xyz')).toBe(false)
    })
  })
})

// ============================================================
// parseExplicitColumns
// ============================================================

describe('parseExplicitColumns', () => {
  it('extracts column list from INSERT with explicit columns', () => {
    const cols = parseExplicitColumns("INSERT INTO t (id, name, val) VALUES (1, 'Alice', 100.5);")
    expect(cols).toEqual(['id', 'name', 'val'])
  })

  it('returns null for INSERT without column list', () => {
    const cols = parseExplicitColumns("INSERT INTO t VALUES (1, 'Alice');")
    expect(cols).toBeNull()
  })

  it('strips backtick quotes from column names', () => {
    const cols = parseExplicitColumns("INSERT INTO t (`select`, `from`) VALUES (1, 'x');")
    expect(cols).toEqual(['select', 'from'])
  })

  it('strips double quotes from column names', () => {
    const cols = parseExplicitColumns('INSERT INTO t ("col one", "col two") VALUES (1, 2);')
    expect(cols).toEqual(['col one', 'col two'])
  })

  it('returns null when table name contains spaces', () => {
    // The regex [\w`\"']+ does not match spaces in table names
    const cols = parseExplicitColumns("INSERT INTO 'My Table' (a, b) VALUES (1, 2);")
    expect(cols).toBeNull()
  })

  it('returns null for non-INSERT SQL', () => {
    expect(parseExplicitColumns('SELECT * FROM t;')).toBeNull()
    expect(parseExplicitColumns('CREATE TABLE t (x INTEGER);')).toBeNull()
  })
})

// ============================================================
// compareValuesForHighlight
// ============================================================

describe('compareValuesForHighlight', () => {
  describe('equality operator', () => {
    it('matches equal strings', () => {
      expect(compareValuesForHighlight('hello', '=', "'hello'")).toBe(true)
    })

    it('does not match different strings', () => {
      expect(compareValuesForHighlight('hello', '=', "'world'")).toBe(false)
    })

    it('matches equal numbers', () => {
      expect(compareValuesForHighlight(42, '=', '42')).toBe(true)
    })

    it('matches unquoted numeric', () => {
      expect(compareValuesForHighlight(100, '=', '100')).toBe(true)
    })
  })

  describe('comparison operators', () => {
    it('handles > with numbers', () => {
      expect(compareValuesForHighlight(10, '>', '5')).toBe(true)
      expect(compareValuesForHighlight(3, '>', '5')).toBe(false)
    })

    it('handles < with numbers', () => {
      expect(compareValuesForHighlight(3, '<', '5')).toBe(true)
      expect(compareValuesForHighlight(10, '<', '5')).toBe(false)
    })

    it('handles >= with numbers', () => {
      expect(compareValuesForHighlight(5, '>=', '5')).toBe(true)
      expect(compareValuesForHighlight(6, '>=', '5')).toBe(true)
      expect(compareValuesForHighlight(4, '>=', '5')).toBe(false)
    })

    it('handles <= with numbers', () => {
      expect(compareValuesForHighlight(5, '<=', '5')).toBe(true)
      expect(compareValuesForHighlight(3, '<=', '5')).toBe(true)
      expect(compareValuesForHighlight(7, '<=', '5')).toBe(false)
    })

    it('handles != and <> with numbers', () => {
      expect(compareValuesForHighlight(5, '!=', '3')).toBe(true)
      expect(compareValuesForHighlight(5, '!=', '5')).toBe(false)
      expect(compareValuesForHighlight(5, '<>', '5.0')).toBe(false)
    })
  })

  describe('LIKE operator', () => {
    it('matches % wildcard at start', () => {
      expect(compareValuesForHighlight('hello world', 'LIKE', "'%world'")).toBe(true)
    })

    it('matches % wildcard at end', () => {
      expect(compareValuesForHighlight('hello world', 'LIKE', "'hello%'")).toBe(true)
    })

    it('matches % wildcard both sides', () => {
      expect(compareValuesForHighlight('hello world', 'LIKE', "'%ello wor%'")).toBe(true)
    })

    it('matches _ single char wildcard', () => {
      expect(compareValuesForHighlight('cat', 'LIKE', "'c_t'")).toBe(true)
      expect(compareValuesForHighlight('cot', 'LIKE', "'c_t'")).toBe(true)
      expect(compareValuesForHighlight('cart', 'LIKE', "'c_t'")).toBe(false)
    })

    it('is case-insensitive', () => {
      expect(compareValuesForHighlight('HELLO', 'LIKE', "'hello'")).toBe(true)
    })

    it('escapes regex special chars in pattern', () => {
      expect(compareValuesForHighlight('a.b', 'LIKE', "'a.b'")).toBe(true)
      expect(compareValuesForHighlight('axb', 'LIKE', "'a.b'")).toBe(false)
    })
  })

  describe('string comparison fallback', () => {
    it('compares strings with >', () => {
      expect(compareValuesForHighlight('b', '>', "'a'")).toBe(true)
      expect(compareValuesForHighlight('a', '>', "'b'")).toBe(false)
    })

    it('compares strings with =', () => {
      expect(compareValuesForHighlight('hello', '=', "'hello'")).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('returns false for unknown operator', () => {
      expect(compareValuesForHighlight('test', 'CONTAINS', 'test')).toBe(false)
    })

    it('compares empty strings', () => {
      expect(compareValuesForHighlight('', '=', "''")).toBe(true)
    })
  })
})
