import {describe, expect, it, vi} from 'vitest'
import type {DatabaseModel, TableSchema} from '@/model/DatabaseTypes'
import {useHighlight} from '@/composables/useHighlight'

vi.mock('@/utils/sqlStatements', () => ({
    extractSqlStatements: vi.fn((script: string) => {
        // Simple extraction: split on semicolons
        const parts = script.split(';').filter((s) => s.trim())
        let offset = 0
        return parts.map((text) => {
            const start = offset
            offset += text.length + 1
            return {text, start, end: offset}
        })
    }),
    compareValuesForHighlight: vi.fn((cellVal: any, op: string, target: string) => {
        const cleanTarget = target.replace(/^'|'$/g, '')
        switch (op) {
            case '=':
                return String(cellVal) === cleanTarget
            case '!=':
            case '<>':
                return String(cellVal) !== cleanTarget
            default:
                return false
        }
    })
}))

function makeTable(name: string, columns: string[], data: Record<string, any>[]): TableSchema {
    return {
        name,
        columns,
        columnTypes: Object.fromEntries(columns.map((c) => [c, 'TEXT'])),
        data: data.map((row, i) => ({_highlightId: i, ...row}))
    }
}

function makeDb(tables: TableSchema[]): DatabaseModel {
    return {
        tables,
        queryResults: [],
        indexes: [],
        views: [],
        triggers: [],
        foreignKeys: [],
        metadata: null
    }
}

describe('useHighlight', () => {
    it('initializes with empty highlight state', () => {
        const code = {value: ''}
        const db = makeDb([])
        const {highlight} = useHighlight(code, () => db.tables)

        expect(highlight.activeTables).toEqual([])
        expect(highlight.activeColumns).toEqual([])
        expect(highlight.activeRows).toEqual([])
        expect(highlight.flashingRows).toEqual([])
        expect(highlight.actionType).toBe('none')
        expect(highlight.refreshSeed).toBe(0)
    })

    it('recalculateStaticHighlight detects CREATE TABLE', () => {
        const code = {value: 'CREATE TABLE users (id INTEGER, name TEXT);'}
        const db = makeDb([])
        const {highlight, recalculateStaticHighlight} = useHighlight(code, () => db.tables)

        recalculateStaticHighlight()

        expect(highlight.actionType).toBe('ddl')
        expect(highlight.activeTables).toContain('users')
    })

    it('recalculateStaticHighlight detects INSERT INTO', () => {
        const code = {value: "INSERT INTO users (id, name) VALUES (1, 'Alice');"}
        const db = makeDb([])
        const {highlight, recalculateStaticHighlight} = useHighlight(code, () => db.tables)

        recalculateStaticHighlight()

        expect(highlight.actionType).toBe('insert')
        expect(highlight.activeTables).toContain('users')
    })

    it('recalculateStaticHighlight detects SELECT and highlights matching rows', () => {
        const usersTable = makeTable('users', ['id', 'name'], [
            {id: 1, name: 'Alice'},
            {id: 2, name: 'Bob'}
        ])
        const code = {value: "SELECT * FROM users WHERE name = 'Alice';"}
        const db = makeDb([usersTable])
        const {highlight, recalculateStaticHighlight} = useHighlight(code, () => db.tables)

        recalculateStaticHighlight()

        expect(highlight.actionType).toBe('select')
        expect(highlight.activeTables).toContain('users')
        expect(highlight.activeRows).toContain('users:1')
        expect(highlight.activeRows).not.toContain('users:2')
    })

    it('recalculateStaticHighlight collects SELECT columns', () => {
        const usersTable = makeTable('users', ['id', 'name', 'email'], [])
        const code = {value: 'SELECT id, name FROM users;'}
        const db = makeDb([usersTable])
        const {highlight, recalculateStaticHighlight} = useHighlight(code, () => db.tables)

        recalculateStaticHighlight()

        expect(highlight.activeColumns).toContain('id')
        expect(highlight.activeColumns).toContain('name')
        expect(highlight.activeColumns).not.toContain('email')
    })

    it('recalculateStaticHighlight with SELECT * collects all columns', () => {
        const usersTable = makeTable('users', ['id', 'name'], [])
        const code = {value: 'SELECT * FROM users;'}
        const db = makeDb([usersTable])
        const {highlight, recalculateStaticHighlight} = useHighlight(code, () => db.tables)

        recalculateStaticHighlight()

        expect(highlight.activeColumns).toContain('id')
        expect(highlight.activeColumns).toContain('name')
    })

    it('recalculateStaticHighlight resets previous state on re-run', () => {
        const code = {value: 'CREATE TABLE users (id INTEGER);'}
        const db = makeDb([])
        const {highlight, recalculateStaticHighlight} = useHighlight(code, () => db.tables)

        recalculateStaticHighlight()
        expect(highlight.activeTables).toContain('users')

        code.value = ''
        recalculateStaticHighlight()
        expect(highlight.activeTables).toEqual([])
        expect(highlight.actionType).toBe('none')
    })

    it('recalculateStaticHighlight increments refreshSeed', () => {
        const code = {value: ''}
        const db = makeDb([])
        const {highlight, recalculateStaticHighlight} = useHighlight(code, () => db.tables)

        recalculateStaticHighlight()
        expect(highlight.refreshSeed).toBe(1)

        recalculateStaticHighlight()
        expect(highlight.refreshSeed).toBe(2)
    })

    it('flashCode sets and clears highlightedCodeChunk', async () => {
        vi.useFakeTimers()
        const code = {value: ''}
        const db = makeDb([])
        const {highlightedCodeChunk, flashCode} = useHighlight(code, () => db.tables)

        expect(highlightedCodeChunk.value).toBeNull()

        flashCode('SELECT 1')
        expect(highlightedCodeChunk.value).toBe('SELECT 1')

        vi.advanceTimersByTime(1500)
        expect(highlightedCodeChunk.value).toBeNull()

        vi.useRealTimers()
    })

    it('handles JOIN with table alias highlighting', () => {
        const usersTable = makeTable('users', ['id', 'name'], [{id: 1, name: 'Alice'}])
        const ordersTable = makeTable('orders', ['id', 'user_id'], [{id: 10, user_id: 1}])
        const code = {value: 'SELECT u.name FROM users u JOIN orders o ON u.id = o.user_id;'}
        const db = makeDb([usersTable, ordersTable])
        const {highlight, recalculateStaticHighlight} = useHighlight(code, () => db.tables)

        recalculateStaticHighlight()

        expect(highlight.activeTables).toContain('users')
        expect(highlight.activeTables).toContain('orders')
    })

    it('ignores comments in SQL', () => {
        const code = {value: '-- this is a comment\nCREATE TABLE t (id INTEGER);'}
        const db = makeDb([])
        const {highlight, recalculateStaticHighlight} = useHighlight(code, () => db.tables)

        recalculateStaticHighlight()

        expect(highlight.actionType).toBe('ddl')
        expect(highlight.activeTables).toContain('t')
    })
})
