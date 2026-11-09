import { describe, expect, it } from 'vitest'
import {
    maskSqlComments,
    parseColumnDefinition,
    parseInsertTarget,
    quoteSqlIdentifier,
    sameSqlIdentifier
} from '@/utils/sqlIdentifiers'

describe('SQL identifiers', () => {
    it.each(['order', 'full name', '中文', 'a.b', 'a"b'])('quotes SQLite name %s', (name) => {
        const quoted = quoteSqlIdentifier(name)
        expect(quoted).toBe(`"${name.replaceAll('"', '""')}"`)
        expect(parseInsertTarget(`INSERT INTO ${quoted} VALUES (1)`)?.tableName).toBe(name)
    })

    it('compares SQLite ASCII case without equating non-ASCII names', () => {
        expect(sameSqlIdentifier('Users', 'USERS')).toBe(true)
        expect(sameSqlIdentifier('Ä', 'ä')).toBe(false)
        expect(sameSqlIdentifier('a.b', 'axb')).toBe(false)
    })

    it('reads schema, quoted columns, conflict syntax and the actual VALUES offset', () => {
        const sql = `-- VALUES (0)\nINSERT OR REPLACE INTO "main"."values archive" ("VALUES", [full name], \`a\`\`b\`) /* VALUES */ VALUES (1, 2, 3)`
        const target = parseInsertTarget(sql)
        expect(target).toMatchObject({
            tableName: 'values archive',
            columns: ['VALUES', 'full name', 'a`b']
        })
        expect(sql.slice(target!.valuesStart!)).toBe(' (1, 2, 3)')
    })

    it('supports SQLite REPLACE and returns no tuple offset for INSERT SELECT', () => {
        expect(parseInsertTarget('REPLACE INTO [order] VALUES (1)')?.tableName).toBe('order')
        expect(parseInsertTarget('INSERT INTO t (a) SELECT 1')).toEqual({
            tableName: 't',
            columns: ['a'],
            valuesStart: null
        })
        expect(parseInsertTarget("SELECT 'INSERT INTO t VALUES (1)' ")).toBeNull()
        expect(parseInsertTarget('INSERT OR UNKNOWN INTO t VALUES (1)')).toBeNull()
        expect(parseInsertTarget('INSERT INTO t (a b) VALUES (1)')).toBeNull()
    })

    it('masks only comments, keeping literal content and original offsets', () => {
        const sql = `'a--b/*c*/', "--id", \`/*id*/\`, [--id] -- comment\n/* block */ VALUES`
        const masked = maskSqlComments(sql)
        expect(masked.length).toBe(sql.length)
        expect(masked).toContain(`'a--b/*c*/', "--id", \`/*id*/\`, [--id]`)
        expect(masked.indexOf('VALUES')).toBe(sql.indexOf('VALUES'))
        expect(masked).not.toContain('comment')
        expect(masked).not.toContain('block')
    })

    it('separates actual names from their type and constraints', () => {
        expect(parseColumnDefinition('id INTEGER PRIMARY KEY')).toEqual({
            name: 'id',
            type: 'INTEGER PRIMARY KEY'
        })
        expect(parseColumnDefinition('"full ""name" TEXT')).toEqual({
            name: 'full "name',
            type: 'TEXT'
        })
    })
})
