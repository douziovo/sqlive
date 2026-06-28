import {afterEach, beforeEach, describe, expect, it, type vi} from 'vitest'
import {mockSuccess, setupSqlEngine, type SqlEngineSetup, teardownSqlEngine, tick} from './test-utils'

describe('Bidirectional sync', () => {
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
    describe('Bidirectional sync', () => {
        it('should match VALUES by explicit column order', async () => {
            mockSuccess(fetchSpy, {tables: []})
            const engine = useSqlEngine()
            await tick()

            mockSuccess(fetchSpy, {
                tables: [
                    {
                        name: 't',
                        columns: ['a', 'b', 'c'],
                        columnTypes: {a: 'INTEGER', b: 'TEXT', c: 'REAL'},
                        data: [{a: 1, b: 'x', c: 3.14}]
                    }
                ]
            })
            engine.code.value = "CREATE TABLE t (a INTEGER, b TEXT, c REAL);\nINSERT INTO t (b, c, a) VALUES ('x', 3.14, 1);"
            await tick()

            const oldCode = engine.code.value
            engine.updateRow('t', {a: 1, b: 'x', c: 3.14}, {a: 1, b: 'y', c: 3.14})
            expect(engine.code.value).not.toBe(oldCode)
            expect(engine.code.value).toContain("'y'")
        })

        it('should handle multi-row INSERT in updateRow', async () => {
            mockSuccess(fetchSpy, {tables: []})
            const engine = useSqlEngine()
            await tick()

            mockSuccess(fetchSpy, {
                tables: [
                    {
                        name: 't',
                        columns: ['x', 'y'],
                        columnTypes: {x: 'INTEGER', y: 'TEXT'},
                        data: [
                            {x: 1, y: 'a'},
                            {x: 2, y: 'b'}
                        ]
                    }
                ]
            })
            engine.code.value =
                "CREATE TABLE t (x INTEGER, y TEXT);\nINSERT INTO t (x, y) VALUES (1, 'a'), (2, 'b'), (3, 'c');"
            await tick()

            engine.updateRow('t', {x: 2, y: 'b'}, {x: 2, y: 'updated'})
            expect(engine.code.value).toContain("'updated'")
            expect(engine.code.value).not.toContain("'b'")
            expect(engine.code.value).toContain("'a'")
            expect(engine.code.value).toContain("'c'")
        })

        it('should delete row from middle of multi-row INSERT', async () => {
            mockSuccess(fetchSpy, {tables: []})
            const engine = useSqlEngine()
            await tick()

            mockSuccess(fetchSpy, {
                tables: [
                    {
                        name: 't',
                        columns: ['x', 'y'],
                        columnTypes: {x: 'INTEGER', y: 'TEXT'},
                        data: [
                            {x: 1, y: 'a'},
                            {x: 3, y: 'c'}
                        ]
                    }
                ]
            })
            engine.code.value =
                "CREATE TABLE t (x INTEGER, y TEXT);\nINSERT INTO t (x, y) VALUES (1, 'a'), (2, 'b'), (3, 'c');"
            await tick()

            engine.deleteRow({x: 2, y: 'b'}, 't')
            expect(engine.code.value).not.toContain("'b'")
            expect(engine.code.value).toContain("'a'")
            expect(engine.code.value).toContain("'c'")
        })

        it('should insert new row into existing INSERT', async () => {
            mockSuccess(fetchSpy, {tables: []})
            const engine = useSqlEngine()
            await tick()

            mockSuccess(fetchSpy, {
                tables: [
                    {
                        name: 't',
                        columns: ['x', 'y'],
                        columnTypes: {x: 'INTEGER', y: 'TEXT'},
                        data: [{x: 1, y: 'a'}]
                    }
                ]
            })
            engine.code.value = "CREATE TABLE t (x INTEGER, y TEXT);\nINSERT INTO t (x, y) VALUES (1, 'a');"
            await tick()

            const oldCode = engine.code.value
            engine.insertRowUI('t', {x: 2, y: 'b'})
            expect(engine.code.value).not.toBe(oldCode)
            expect(engine.code.value).toContain('2')
            expect(engine.code.value).toContain("'b'")
        })

        it('should match numeric values regardless of string representation', async () => {
            mockSuccess(fetchSpy, {tables: []})
            const engine = useSqlEngine()
            await tick()

            mockSuccess(fetchSpy, {
                tables: [
                    {
                        name: 't',
                        columns: ['id', 'val'],
                        columnTypes: {id: 'INTEGER', val: 'REAL'},
                        data: [{id: 1, val: 100}]
                    }
                ]
            })
            engine.code.value = 'CREATE TABLE t (id INTEGER, val REAL);\nINSERT INTO t (id, val) VALUES (1, 100.0);'
            await tick()

            engine.updateRow('t', {id: 1, val: 100}, {id: 1, val: 200})
            expect(engine.code.value).toContain('200')
        })

        it('should handle NULL matching in tuples', async () => {
            mockSuccess(fetchSpy, {tables: []})
            const engine = useSqlEngine()
            await tick()

            mockSuccess(fetchSpy, {
                tables: [
                    {
                        name: 't',
                        columns: ['id', 'name'],
                        columnTypes: {id: 'INTEGER', name: 'TEXT'},
                        data: [{id: 1, name: null}]
                    }
                ]
            })
            engine.code.value = 'CREATE TABLE t (id INTEGER, name TEXT);\nINSERT INTO t (id, name) VALUES (1, NULL);'
            await tick()

            engine.updateRow('t', {id: 1, name: null}, {id: 1, name: 'Bob'})
            expect(engine.code.value).toContain("'Bob'")
        })
    })

    // ============================================================
    //  Complex multi-statement scripts
    // ============================================================

})
