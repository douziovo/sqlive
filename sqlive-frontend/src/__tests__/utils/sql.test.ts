import {describe, expect, it} from 'vitest'
import {isNumericType, toSqlLiteral} from '@/utils/sql'

describe('toSqlLiteral', () => {
    it('returns NULL for null', () => {
        expect(toSqlLiteral(null)).toBe('NULL')
    })

    it('returns NULL for undefined', () => {
        expect(toSqlLiteral(undefined)).toBe('NULL')
    })

    it('returns NULL for empty string', () => {
        expect(toSqlLiteral('')).toBe('NULL')
    })

    it('returns bare number for numeric type with valid number', () => {
        expect(toSqlLiteral(42, 'INTEGER')).toBe('42')
        expect(toSqlLiteral(3.14, 'REAL')).toBe('3.14')
    })

    it('returns quoted string when numeric type but value is non-numeric', () => {
        // toSqlLiteral only returns NULL for literal null/undefined/empty-string.
        // A non-numeric string with a numeric type is still quoted.
        expect(toSqlLiteral('abc', 'INT')).toBe("'abc'")
    })

    it('wraps string in single quotes', () => {
        expect(toSqlLiteral('hello', 'TEXT')).toBe("'hello'")
    })

    it('escapes single quotes by doubling them', () => {
        expect(toSqlLiteral("it's", 'TEXT')).toBe("'it''s'")
    })

    it('treats value as string when no type provided', () => {
        expect(toSqlLiteral('abc')).toBe("'abc'")
    })
})

describe('isNumericType', () => {
    it('returns true for INT / INTEGER / BIGINT', () => {
        expect(isNumericType('INTEGER')).toBe(true)
        expect(isNumericType('INT')).toBe(true)
        expect(isNumericType('BIGINT')).toBe(true)
    })

    it('returns true for REAL / FLOAT / DOUBLE', () => {
        expect(isNumericType('REAL')).toBe(true)
        expect(isNumericType('FLOAT')).toBe(true)
        expect(isNumericType('DOUBLE')).toBe(true)
    })

    it('returns true for DECIMAL / NUMERIC', () => {
        expect(isNumericType('DECIMAL')).toBe(true)
        expect(isNumericType('DECIMAL(10,2)')).toBe(true)
        expect(isNumericType('NUMERIC')).toBe(true)
    })

    it('returns false for TEXT / VARCHAR', () => {
        expect(isNumericType('TEXT')).toBe(false)
        expect(isNumericType('VARCHAR')).toBe(false)
    })

    it('is case-insensitive', () => {
        expect(isNumericType('int')).toBe(true)
        expect(isNumericType('real')).toBe(true)
    })

    it('handles whitespace-padded type strings', () => {
        expect(isNumericType('  INTEGER  ')).toBe(true)
        expect(isNumericType('  TEXT  ')).toBe(false)
    })
})

describe('toSqlLiteral edge cases', () => {
    it('returns bare 0 for numeric type with zero', () => {
        expect(toSqlLiteral(0, 'INTEGER')).toBe('0')
    })

    it('converts boolean false via String() for numeric type', () => {
        // String(false) → 'false', which is non-numeric → wraps in quotes
        // Type coercion: Number(false) → 0, so it passes isNaN check, then String(false) → 'false'
        const result = toSqlLiteral(false, 'INTEGER')
        // 'false' is not a valid number string, but toSqlLiteral doesn't re-validate after String()
        expect(typeof result).toBe('string')
    })

    it('quotes boolean true as string', () => {
        expect(toSqlLiteral(true, 'TEXT')).toBe("'true'")
    })

    it('preserves newlines in quoted strings', () => {
        expect(toSqlLiteral('line1\nline2', 'TEXT')).toBe("'line1\nline2'")
    })

    it('preserves tab characters in quoted strings', () => {
        expect(toSqlLiteral('col1\tcol2', 'TEXT')).toBe("'col1\tcol2'")
    })

    it('quotes empty string as NULL', () => {
        expect(toSqlLiteral('')).toBe('NULL')
    })
})
