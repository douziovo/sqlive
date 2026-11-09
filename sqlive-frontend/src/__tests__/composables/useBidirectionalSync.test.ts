import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useBidirectionalSync } from '@/composables/useBidirectionalSync'
import type { DatabaseModel, TableSchema } from '@/model/DatabaseTypes'

type EngineMode = 'user' | 'reconciling' | 'rollback'

function makeUsersTable(): TableSchema {
    return {
        name: 'users',
        columns: ['id', 'name'],
        columnTypes: { id: 'INTEGER', name: 'TEXT' },
        data: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' }
        ]
    }
}

function makeDb(overrides: Partial<DatabaseModel> = {}): DatabaseModel {
    return {
        tables: [makeUsersTable()],
        queryResults: [],
        indexes: [],
        views: [],
        triggers: [],
        foreignKeys: [],
        metadata: null,
        ...overrides
    }
}

function makeTransitionFn() {
    return (_from: EngineMode, to: EngineMode, _ctx: string): EngineMode => to
}

function setup(initialCode: string, db?: DatabaseModel) {
    const mode = ref<EngineMode>('user')
    const codeRef = ref(initialCode)
    const code = computed({
        get: () => codeRef.value,
        set: (v: string) => {
            codeRef.value = v
        }
    })
    const flashCode = vi.fn()
    const transitionFn = makeTransitionFn()
    // D-R2-004: composable now takes tablesSource getter instead of whole DatabaseModel
    const dbRef = db ?? makeDb()
    const sync = useBidirectionalSync(code, () => dbRef.tables, mode, flashCode, transitionFn)
    return { sync, code, codeRef, mode, flashCode, db: dbRef }
}

describe('useBidirectionalSync', () => {
    describe('beginReconcile', () => {
        it('saves current code as lastValidCode and transitions to reconciling', () => {
            const initial = "INSERT INTO users VALUES (1, 'Alice');"
            const { sync, mode } = setup(initial)

            sync.beginReconcile()

            expect(sync.getLastValidCode()).toBe(initial)
            expect(mode.value).toBe('reconciling')
        })
    })

    describe('getLastValidCode', () => {
        it('returns initial code before any reconcile', () => {
            const initial = 'SELECT 1;'
            const { sync } = setup(initial)
            expect(sync.getLastValidCode()).toBe(initial)
        })

        it('returns code at time of last reconcile', () => {
            const initial = "INSERT INTO users VALUES (1, 'Alice');"
            const { sync, code } = setup(initial)

            sync.beginReconcile()
            code.value = 'MODIFIED CODE'

            // getLastValidCode should still return the code at reconcile time
            expect(sync.getLastValidCode()).toBe(initial)
        })
    })

    describe('updateRow', () => {
        it('replaces matching VALUES tuple in code', () => {
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice');"
            const { sync, code } = setup(initial)

            sync.updateRow('users', { id: 1, name: 'Alice' }, { id: 1, name: 'Alicia' })

            expect(code.value).toContain("(1, 'Alicia')")
            expect(code.value).not.toContain("(1, 'Alice')")
        })

        it('calls flashCode with the new tuple SQL', () => {
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice');"
            const { sync, flashCode } = setup(initial)

            sync.updateRow('users', { id: 1, name: 'Alice' }, { id: 1, name: 'Alicia' })

            expect(flashCode).toHaveBeenCalledWith(expect.stringContaining('Alicia'))
        })

        it('transitions mode to reconciling during update', () => {
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice');"
            const { sync, mode } = setup(initial)

            sync.updateRow('users', { id: 1, name: 'Alice' }, { id: 1, name: 'Alicia' })

            expect(mode.value).toBe('reconciling')
        })

        it('warns when tuple not found in code', () => {
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice');"
            const { sync } = setup(initial)
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

            sync.updateRow('users', { id: 999, name: 'Nobody' }, { id: 999, name: 'Ghost' })

            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('无法定位'))
            warnSpy.mockRestore()
        })
    })

    describe('deleteRow', () => {
        it('removes matching VALUES tuple from code', () => {
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice'), (2, 'Bob');"
            const { sync, code } = setup(initial)

            sync.deleteRow({ id: 1, name: 'Alice' }, 'users')

            expect(code.value).not.toContain('Alice')
            expect(code.value).toContain('Bob')
        })

        it('removes entire INSERT when deleting only row', () => {
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice');"
            const { sync, code } = setup(initial)

            sync.deleteRow({ id: 1, name: 'Alice' }, 'users')

            // The entire statement should be removed
            expect(code.value.trim()).toBe('')
        })

        it('transitions mode to reconciling during delete', () => {
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice');"
            const { sync, mode } = setup(initial)

            sync.deleteRow({ id: 1, name: 'Alice' }, 'users')

            expect(mode.value).toBe('reconciling')
        })

        it('auto-detects table name from db when not provided', () => {
            const db = makeDb()
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice'), (2, 'Bob');"
            const { sync, code } = setup(initial, db)

            // Must pass the actual object reference from db.tables[0].data for auto-detect to work
            sync.deleteRow(db.tables[0].data[1])

            expect(code.value).not.toContain('Bob')
            expect(code.value).toContain('Alice')
        })

        it('does nothing when row is not found', () => {
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice');"
            const { sync, code } = setup(initial)

            sync.deleteRow({ id: 999, name: 'Nobody' }, 'users')

            expect(code.value).toBe(initial)
        })
    })

    describe('insertRowUI', () => {
        it('appends a new INSERT statement to code', () => {
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice');"
            const { sync, code } = setup(initial)

            sync.insertRowUI('users', { id: 3, name: 'Charlie' })

            expect(code.value).toContain(
                `INSERT INTO "users" ("id", "name") VALUES (3, 'Charlie');`
            )
        })

        it('calls flashCode with the new INSERT SQL', () => {
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice');"
            const { sync, flashCode } = setup(initial)

            sync.insertRowUI('users', { id: 3, name: 'Charlie' })

            expect(flashCode).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "users"'))
        })

        it('adds semicolon before new INSERT if missing', () => {
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice')"
            const { sync, code } = setup(initial)

            sync.insertRowUI('users', { id: 3, name: 'Charlie' })

            // The code normalizes: adds semicolon, newline, then new INSERT
            expect(code.value).toContain(';')
            expect(code.value).toContain(
                `INSERT INTO "users" ("id", "name") VALUES (3, 'Charlie');`
            )
        })

        it('does nothing for unknown table', () => {
            const initial = "INSERT INTO users (id, name) VALUES (1, 'Alice');"
            const { sync, code } = setup(initial)

            sync.insertRowUI('nonexistent', { id: 1, name: 'Test' })

            expect(code.value).toBe(initial)
        })
    })

    describe('addNewTable', () => {
        it('appends CREATE TABLE and optional INSERT to code', () => {
            const initial = 'SELECT 1;'
            const { sync, code } = setup(initial)

            sync.addNewTable(
                'products',
                ['id INTEGER', 'price REAL'],
                [{ 'id INTEGER': 1, 'price REAL': 9.99 }]
            )

            expect(code.value).toContain('CREATE TABLE "products"')
            expect(code.value).toContain('INSERT INTO "products"')
        })

        it('appends only CREATE TABLE when no data provided', () => {
            const initial = 'SELECT 1;'
            const { sync, code } = setup(initial)

            sync.addNewTable('products', ['id INTEGER', 'price REAL'], [])

            expect(code.value).toContain('CREATE TABLE "products"')
            expect(code.value).not.toContain('INSERT INTO "products"')
        })
    })

    describe('dropTableUI', () => {
        it('appends an explicit DROP while preserving the original script', () => {
            const initial =
                "CREATE TABLE users (id INTEGER, name TEXT);\nINSERT INTO users VALUES (1, 'Alice');"
            const { sync, code } = setup(initial)

            sync.dropTableUI('users')

            expect(code.value).toBe(`${initial}\nDROP TABLE "users";`)
        })
    })

    describe('lastTruncations', () => {
        it('initializes as empty array', () => {
            const { sync } = setup('SELECT 1;')
            expect(sync.lastTruncations.value).toEqual([])
        })
    })

    describe('identifier and source boundaries', () => {
        it.each(['update', 'delete'])('does not confuse a.b with axb during %s', (action) => {
            const initial = `INSERT INTO axb (id, name) VALUES (1, 'Alice');\nINSERT INTO "a.b" (id, name) VALUES (1, 'Alice');`
            const table = { ...makeUsersTable(), name: 'a.b' }
            const { sync, code } = setup(initial, makeDb({ tables: [table] }))
            if (action === 'update') {
                sync.updateRow('a.b', { id: 1, name: 'Alice' }, { id: 1, name: 'Ann' })
                expect(code.value).toContain(`INSERT INTO "a.b" (id, name) VALUES (1, 'Ann');`)
            } else {
                sync.deleteRow({ id: 1, name: 'Alice' }, 'a.b')
                expect(code.value).not.toContain('INSERT INTO "a.b"')
            }
            expect(code.value).toContain("INSERT INTO axb (id, name) VALUES (1, 'Alice');")
        })

        it('edits the actual tuple after a duplicate in a comment and preserves -- in strings', () => {
            const initial = `-- (1, 'hello--world')\nINSERT INTO "users" ("ID", "NAME") VALUES (1, 'hello--world');`
            const { sync, code } = setup(initial)
            sync.updateRow('users', { id: 1, name: 'hello--world' }, { id: 1, name: 'changed' })
            expect(code.value).toBe(
                `-- (1, 'hello--world')\nINSERT INTO "users" ("ID", "NAME") VALUES (1, 'changed');`
            )
        })

        it('deletes commas separated by comments and removes a single tuple with a trailing comment', () => {
            const { sync, code } = setup(
                `INSERT INTO users VALUES (1, 'Alice') /* delimiter */, (2, 'Bob');`
            )
            sync.deleteRow({ id: 1, name: 'Alice' }, 'users')
            expect(code.value).toBe(`INSERT INTO users VALUES  (2, 'Bob');`)
            code.value = `INSERT INTO users VALUES (2, 'Bob') /* trailing */;`
            sync.deleteRow({ id: 2, name: 'Bob' }, 'users')
            expect(code.value).toBe('')
        })

        it('quotes actual table and column names on inserted rows', () => {
            const table: TableSchema = {
                name: 'order "中文',
                columns: ['select', 'full "name'],
                columnTypes: { select: 'INTEGER', 'full "name': 'TEXT' },
                data: []
            }
            const { sync, code } = setup('', makeDb({ tables: [table] }))
            sync.insertRowUI(table.name, { select: 7, 'full "name': 'value' })
            expect(code.value).toBe(
                `INSERT INTO "order ""中文" ("select", "full ""name") VALUES (7, 'value');`
            )
        })

        it('reads initial data by actual names rather than column definitions', () => {
            const { sync, code } = setup('')
            sync.addNewTable(
                'order',
                ['"full ""name" TEXT', 'id INTEGER'],
                [{ 'full "name': 'Alice', id: 7 }]
            )
            expect(code.value).toBe(
                `CREATE TABLE "order" (\n  "full ""name" TEXT,\n  "id" INTEGER\n);\nINSERT INTO "order" VALUES ('Alice', 7);`
            )
        })

        it('preserves unrelated strings, comments and dependencies when dropping a table', () => {
            const initial = `CREATE TABLE a (id);\nINSERT INTO b VALUES ('a'); -- a is a value\nCREATE VIEW v AS SELECT * FROM a;`
            const { sync, code } = setup(initial)
            sync.dropTableUI('a')
            expect(code.value).toBe(`${initial}\nDROP TABLE "a";`)
        })

        it('appends DROP safely after an unfinished statement ending in a line comment', () => {
            const initial = 'SELECT 1 -- trailing;'
            const { sync, code } = setup(initial)
            sync.dropTableUI('a"b')
            expect(code.value).toBe(`${initial}\n;\nDROP TABLE "a""b";`)
        })

        it('keeps user mode when a row or table cannot be found', () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {})
            const { sync, mode } = setup('SELECT 1;')
            sync.updateRow('users', { id: 1 }, { id: 2 })
            sync.deleteRow({ id: 1 }, 'users')
            sync.insertRowUI('missing', { id: 1 })
            expect(mode.value).toBe('user')
        })
    })
    describe('edge branches', () => {
        it('updateRow warns when a bare INSERT references an unknown table', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
            // INSERT without an explicit column list; "ghost" table is not in tablesSource
            const { sync, codeRef } = setup("INSERT INTO ghost VALUES (1, 'A');")
            sync.updateRow('ghost', { id: 1, name: 'A' }, { id: 1, name: 'Ann' })
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('无法定位原始代码行'))
            expect(codeRef.value).toBe("INSERT INTO ghost VALUES (1, 'A');")
        })

        it('updateRow skips tuples whose arity does not match the table columns', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
            const { sync } = setup("INSERT INTO users VALUES (1, 'A', 'extra');")
            sync.updateRow('users', { id: 1, name: 'A' }, { id: 1, name: 'Ann' })
            expect(warn).toHaveBeenCalled()
        })

        it('deleteRow does nothing when the row belongs to no known table', () => {
            const { sync, codeRef } = setup("INSERT INTO users VALUES (1, 'A');")
            sync.deleteRow({ id: 99, name: 'Nobody' })
            expect(codeRef.value).toBe("INSERT INTO users VALUES (1, 'A');")
        })

        it('records truncations when an edited value exceeds its column length', () => {
            const db = makeDb()
            db.tables[0].columnTypes.name = 'VARCHAR(3)'
            const { sync, codeRef } = setup("INSERT INTO users (id, name) VALUES (1, 'Alice');", db)
            sync.updateRow('users', { id: 1, name: 'Alice' }, { id: 1, name: 'Alexander' })
            expect(codeRef.value).toContain("'Ale'")
            expect(sync.lastTruncations.value.length).toBe(1)
            expect(sync.lastTruncations.value[0]).toMatchObject({ column: 'name' })
        })

        it('insertRowUI records truncations for over-long inserted values', () => {
            const db = makeDb()
            db.tables[0].columnTypes.name = 'VARCHAR(3)'
            const { sync, codeRef } = setup("INSERT INTO users (id, name) VALUES (1, 'A');", db)
            sync.insertRowUI('users', { id: 2, name: 'Bartholomew' })
            expect(codeRef.value).toContain("'Bar'")
            expect(sync.lastTruncations.value.length).toBe(1)
        })

        it('addNewTable tolerates tables without any insert data', () => {
            const { sync, codeRef } = setup('SELECT 1;')
            sync.addNewTable('logs', ['id'], [])
            expect(codeRef.value).toContain('CREATE TABLE "logs"')
            expect(codeRef.value).not.toContain('INSERT INTO "logs"')
        })
    })
})
