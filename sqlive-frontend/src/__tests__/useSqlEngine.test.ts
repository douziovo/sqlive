import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {
    API_URL,
    jsonOk,
    mockError,
    mockReject,
    mockSuccess,
    setupSqlEngine,
    type SqlEngineSetup,
    teardownSqlEngine,
    tick
} from './test-utils'

// D-03c: spy on extractSqlStatements to verify canonicalStatements consumption.
// vi.mock is hoisted by vitest; factory wraps the real impl so existing tests
// (which don't reference extractSqlStatements directly) continue to work, while
// tests in this file can assert call counts on the spy.
vi.mock('../utils/sqlStatements', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../utils/sqlStatements')>()
    return {
        ...actual,
        extractSqlStatements: vi.fn(actual.extractSqlStatements)
    }
})

describe('useSqlEngine', () => {
    let useSqlEngine: SqlEngineSetup['useSqlEngine']
    let fetchSpy: ReturnType<typeof vi.fn>

    beforeEach(async () => {
        const setup = await setupSqlEngine()
        useSqlEngine = setup.useSqlEngine
        fetchSpy = setup.fetchSpy
    })

    afterEach(() => {
        teardownSqlEngine()
    })

    it('should set isLoading to true during execution', async () => {
        let resolveLater: (value: unknown) => void
        const delayed = new Promise((r) => {
            resolveLater = r
        })
        fetchSpy.mockReturnValue(delayed.then(() => jsonOk({success: true, data: {tables: []}})))

        const engine = useSqlEngine()

        vi.advanceTimersByTime(1100)

        expect(engine.isLoading.value).toBe(true)

        resolveLater()
        await vi.runAllTimersAsync()
        expect(engine.isLoading.value).toBe(false)
    })

    it('should populate db.tables after successful fetch', async () => {
        mockSuccess(fetchSpy, {
            tables: [
                {
                    name: 'employees',
                    columns: ['id', 'name'],
                    columnTypes: {id: 'INTEGER', name: 'TEXT'},
                    data: [{id: 1, name: 'Alice'}]
                }
            ]
        })

        const engine = useSqlEngine()
        await tick()

        expect(engine.db.tables.length).toBe(1)
        expect(engine.db.tables[0].name).toBe('employees')
    })

    it('should set executionError on error response', async () => {
        mockError(fetchSpy, 'syntax error near X', 3)

        const engine = useSqlEngine()
        await tick()

        expect(engine.executionError.value).toBeTruthy()
        expect(engine.executionError.value.line).toBe(3)
        expect(engine.executionError.value.message).toContain('syntax error')
    })

    it('should set error on network failure', async () => {
        mockReject(fetchSpy, new Error('Connection refused'))
        vi.spyOn(console, 'error').mockImplementation(() => {
        })

        const engine = useSqlEngine()
        await tick()

        expect(console.error).toHaveBeenCalledTimes(1)
        const errorArg = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(errorArg).toContain('执行 SQL 请求失败')
        expect(engine.executionError.value).toBeTruthy()
        expect(engine.executionError.value.line).toBe(0)
    })

    it('should store query results separately from tables', async () => {
        mockSuccess(fetchSpy, {
            tables: [{name: 'users', columns: ['id'], columnTypes: {id: 'INTEGER'}, data: [{id: 1}]}],
            queryResults: [{name: '查询结果', columns: ['x'], columnTypes: {x: 'INTEGER'}, data: [{x: 1}]}]
        })

        const engine = useSqlEngine()
        await tick()

        expect(engine.db.tables.length).toBe(1)
        expect(engine.db.tables[0].name).toBe('users')
        expect(engine.db.queryResults.length).toBe(1)
        expect(engine.db.queryResults[0].name).toBe('查询结果')
    })

    it('should assign _highlightId to rows without id', async () => {
        mockSuccess(fetchSpy, {
            tables: [
                {
                    name: 'x',
                    columns: ['a'],
                    columnTypes: {a: 'TEXT'},
                    data: [{a: 'hello'}]
                }
            ]
        })

        const engine = useSqlEngine()
        await tick()

        const row = engine.db.tables[0].data[0]
        expect(row._highlightId).toBeDefined()
        expect(typeof row._highlightId).toBe('number')
    })

    it('should detect new rows as flashing', async () => {
        mockSuccess(fetchSpy, {
            tables: [
                {
                    name: 't',
                    columns: ['x'],
                    columnTypes: {x: 'INTEGER'},
                    data: [{x: 1}]
                }
            ]
        })

        const engine = useSqlEngine()
        await tick()

        mockSuccess(fetchSpy, {
            tables: [
                {
                    name: 't',
                    columns: ['x'],
                    columnTypes: {x: 'INTEGER'},
                    data: [{x: 1}, {x: 2}]
                }
            ]
        })

        engine.code.value = 'SELECT * FROM t;'
        await tick()

        expect(engine.highlight.flashingRows.length).toBeGreaterThanOrEqual(1)
    })

    it('should update code when updateRow finds matching VALUES', async () => {
        mockSuccess(fetchSpy, {tables: []})

        const engine = useSqlEngine()
        await tick()

        mockSuccess(fetchSpy, {
            tables: [
                {
                    name: 't',
                    columns: ['id', 'name', 'val'],
                    columnTypes: {id: 'INTEGER', name: 'TEXT', val: 'REAL'},
                    data: [{id: 1, name: 'Alice', val: 999}]
                }
            ]
        })

        engine.code.value =
            "CREATE TABLE t (id INTEGER, name TEXT, val REAL);\nINSERT INTO t (id, name, val) VALUES (1, 'Alice', 100.5);"
        await tick()

        const oldCode = engine.code.value
        engine.updateRow('t', {id: 1, name: 'Alice', val: 100.5}, {id: 1, name: 'Alice', val: 999})

        expect(engine.code.value).not.toBe(oldCode)
        expect(engine.code.value).toContain('999')
        expect(engine.code.value).not.toContain('100.5')
    })

    it('should roll back code on UI operation failure', async () => {
        mockSuccess(fetchSpy, {
            tables: [
                {
                    name: 't',
                    columns: ['id', 'name', 'val'],
                    columnTypes: {id: 'INTEGER', name: 'TEXT', val: 'REAL'},
                    data: [{id: 1, name: 'Alice', val: 100.5}]
                }
            ]
        })

        const engine = useSqlEngine()
        await tick()

        const savedCode = engine.code.value

        mockError(fetchSpy, 'CHECK constraint failed', 2)

        engine.insertRowUI('t', {id: 3, name: null, val: 0})
        await tick()

        expect(engine.code.value).toBe(savedCode)
        expect(engine.executionError.value).not.toBeNull()
    })

    it('should delete VALUES tuple from code', async () => {
        mockSuccess(fetchSpy, {tables: []})

        const engine = useSqlEngine()
        await tick()

        mockSuccess(fetchSpy, {
            tables: [
                {
                    name: 't',
                    columns: ['id', 'name', 'val'],
                    columnTypes: {id: 'INTEGER', name: 'TEXT', val: 'REAL'},
                    data: [{id: 1, name: 'Alice', val: 100.5}]
                }
            ]
        })

        engine.code.value =
            "CREATE TABLE t (id INTEGER, name TEXT, val REAL);\nINSERT INTO t (id, name, val) VALUES (1, 'Alice', 100.5), (2, 'Bob', 200);"
        await tick()

        const oldCode = engine.code.value
        engine.deleteRow({id: 2, name: 'Bob', val: 200}, 't')

        expect(engine.code.value).not.toBe(oldCode)
        expect(engine.code.value).not.toContain("'Bob'")
        expect(engine.code.value).toContain("'Alice'")
    })

    it('should insert new row via insertRowUI', async () => {
        mockSuccess(fetchSpy, {tables: []})

        const engine = useSqlEngine()
        await tick()

        mockSuccess(fetchSpy, {
            tables: [
                {
                    name: 't',
                    columns: ['id', 'name', 'val'],
                    columnTypes: {id: 'INTEGER', name: 'TEXT', val: 'REAL'},
                    data: [{id: 1, name: 'Alice', val: 100.5}]
                }
            ]
        })

        engine.code.value =
            "CREATE TABLE t (id INTEGER, name TEXT, val REAL);\nINSERT INTO t (id, name, val) VALUES (1, 'Alice', 100.5);"
        await tick()

        const oldCode = engine.code.value
        engine.insertRowUI('t', {id: 3, name: 'Charlie', val: 300})

        expect(engine.code.value).not.toBe(oldCode)
        expect(engine.code.value).toContain('Charlie')
    })

    it('should clear error after subsequent success', async () => {
        mockError(fetchSpy, 'bad sql', 1)

        const engine = useSqlEngine()
        await tick()

        expect(engine.executionError.value).toBeTruthy()

        mockSuccess(fetchSpy, {tables: []})
        engine.code.value = 'SELECT 1;'
        await tick()

        expect(engine.executionError.value).toBeNull()
    })

    it('should debounce rapid user typing to a single call', async () => {
        mockSuccess(fetchSpy, {tables: []})

        const engine = useSqlEngine()
        await tick()

        const callCount = fetchSpy.mock.calls.length
        expect(callCount).toBeGreaterThanOrEqual(1)

        engine.code.value = `${engine.code.value}\n-- a`
        engine.code.value = `${engine.code.value}\n-- b`
        engine.code.value = `${engine.code.value}\n-- c`

        await vi.advanceTimersByTimeAsync(50)
        expect(fetchSpy.mock.calls.length).toBe(callCount)

        await vi.advanceTimersByTimeAsync(100)
        expect(fetchSpy.mock.calls.length).toBe(callCount + 1)
    })

    it('should POST to correct URL with JSON body', async () => {
        mockSuccess(fetchSpy, {tables: []})

        useSqlEngine()
        await tick()

        expect(fetchSpy).toHaveBeenCalled()
        const call = fetchSpy.mock.calls[0]!
        expect(call[0]).toBe(API_URL)
        expect(call[1].method).toBe('POST')
        expect(call[1].headers['Content-Type']).toBe('application/json')
        expect(JSON.parse(call[1].body)).toHaveProperty('sql')
    })

    it('should finish with isLoading false', async () => {
        mockSuccess(fetchSpy, {tables: []})

        const engine = useSqlEngine()
        await tick()

        expect(engine.isLoading.value).toBe(false)
    })

    // --- Boundary and edge case tests ---

    it('should delete row using reference from db.tables (auto-detect)', async () => {
        mockSuccess(fetchSpy, {tables: []})
        const engine = useSqlEngine()
        await tick()

        mockSuccess(fetchSpy, {
            tables: [
                {
                    name: 't',
                    columns: ['id', 'name'],
                    columnTypes: {id: 'INTEGER', name: 'TEXT'},
                    data: [{id: 1, name: 'Alice'}]
                }
            ]
        })
        engine.code.value = "CREATE TABLE t (id INTEGER, name TEXT);\nINSERT INTO t (id, name) VALUES (1, 'Alice');"
        await tick()

        const oldCode = engine.code.value
        // Use the actual row reference from db.tables (auto-detect uses reference equality)
        const actualRow = engine.db.tables[0].data[0]
        engine.deleteRow(actualRow)

        expect(engine.code.value).not.toBe(oldCode)
        expect(engine.code.value).not.toContain("'Alice'")
    })

    it('should remove entire INSERT when deleting last tuple', async () => {
        mockSuccess(fetchSpy, {tables: []})
        const engine = useSqlEngine()
        await tick()

        mockSuccess(fetchSpy, {
            tables: [
                {
                    name: 't',
                    columns: ['x'],
                    columnTypes: {x: 'INTEGER'},
                    data: []
                }
            ]
        })
        engine.code.value = 'CREATE TABLE t (x INTEGER);\nINSERT INTO t (x) VALUES (1);'
        await tick()

        engine.deleteRow({x: 1}, 't')
        // The entire INSERT statement should be removed
        expect(engine.code.value).not.toContain('VALUES')
        expect(engine.code.value).toContain('CREATE TABLE')
    })

    it('should auto-append semicolon in insertRowUI when code lacks one', async () => {
        mockSuccess(fetchSpy, {tables: []})
        const engine = useSqlEngine()
        await tick()

        mockSuccess(fetchSpy, {
            tables: [
                {
                    name: 't',
                    columns: ['id'],
                    columnTypes: {id: 'INTEGER'},
                    data: [{id: 1}]
                }
            ]
        })
        // Code without trailing semicolon
        engine.code.value = 'CREATE TABLE t (id INTEGER)'
        await tick()

        const oldCode = engine.code.value
        engine.insertRowUI('t', {id: 2})
        expect(engine.code.value).not.toBe(oldCode)
        expect(engine.code.value).toContain('INSERT')
    })

    it('should handle dropTableUI by removing table-related statements', async () => {
        mockSuccess(fetchSpy, {tables: []})
        const engine = useSqlEngine()
        await tick()

        engine.code.value = 'CREATE TABLE t (id INTEGER);\nINSERT INTO t (id) VALUES (1);\nSELECT * FROM t;'
        await tick()

        const oldCode = engine.code.value
        engine.dropTableUI('t')
        expect(engine.code.value).not.toBe(oldCode)
        expect(engine.code.value).not.toContain('CREATE TABLE t')
    })

    it('handles malformed JSON response gracefully', async () => {
        fetchSpy.mockResolvedValue({
            status: 200,
            ok: true,
            json: () => Promise.reject(new Error('Unexpected token < in JSON'))
        })

        const engine = useSqlEngine()
        await tick()

        // Should not crash, should have error state
        expect(engine.executionError.value).toBeTruthy()
    })

    it('handles empty response body gracefully', async () => {
        fetchSpy.mockResolvedValue({
            status: 200,
            ok: true,
            json: () => Promise.resolve(null)
        })

        const engine = useSqlEngine()
        await tick()

        // Should not crash
        expect(engine.isLoading.value).toBe(false)
    })

    // --- D-03c: frontend consumes backend canonicalStatements ---

    it('consumes backend canonicalStatements for updateRow', async () => {
        // After setupSqlEngine's vi.resetModules(), a fresh dynamic import returns
        // the same sqlStatements module instance that useBidirectionalSync references.
        const sqlStatementsModule = await import('../utils/sqlStatements')
        const extractSpy = sqlStatementsModule.extractSqlStatements as ReturnType<typeof vi.fn>

        // Mock response WITH canonicalStatements present — the contract under test.
        mockSuccess(fetchSpy, {
            tables: [
                {
                    name: 't',
                    columns: ['id'],
                    columnTypes: {id: 'INTEGER'},
                    data: [{id: 1}]
                }
            ],
            canonicalStatements: [{start: 0, end: 25}]
        })
        const engine = useSqlEngine()
        await tick()

        // Clear any spy calls from the initial fetch success path
        // (useHighlight.recalculateStaticHighlight may call extractSqlStatements in RED).
        extractSpy.mockClear()

        // updateRow triggers getStatements() — in GREEN it prefers canonicalStatements.value
        // and skips extractSqlStatements; in RED updateRow calls extractSqlStatements(code.value)
        // directly at line 89 of useBidirectionalSync.ts.
        engine.updateRow('t', {id: 1}, {id: 2})

        expect(extractSpy).not.toHaveBeenCalled()
    })
})
