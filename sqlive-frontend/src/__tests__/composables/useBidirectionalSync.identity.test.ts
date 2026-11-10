import { DatabaseSync } from 'node:sqlite'

import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useBidirectionalSync } from '@/composables/useBidirectionalSync'
import type { TableSchema } from '@/model/DatabaseTypes'

describe('source row identity with real SQLite', () => {
    for (const inserts of [
        "INSERT INTO t(name) VALUES ('same'), ('same');",
        "INSERT INTO t(name) VALUES ('same'); INSERT INTO t(name) VALUES ('same');"
    ]) {
        for (const operation of ['update', 'delete']) {
            it(`${operation} preserves the other generated-key row: ${inserts}`, () => {
                const db = new DatabaseSync(':memory:')
                try {
                    const source = ref(
                        `CREATE TABLE t(id INTEGER PRIMARY KEY, name TEXT); ${inserts}`
                    )
                    db.exec(source.value)
                    const rows = db.prepare('SELECT * FROM t').all()
                    const table: TableSchema = {
                        name: 't',
                        columns: ['id', 'name'],
                        columnTypes: { id: 'INTEGER | PRIMARY KEY', name: 'TEXT' },
                        data: rows
                    }
                    const code = computed({
                        get: () => source.value,
                        set: (value) => {
                            source.value = value
                        }
                    })
                    const sync = useBidirectionalSync(
                        code,
                        () => [table],
                        ref('user'),
                        vi.fn(),
                        (_from, to) => to
                    )
                    if (operation === 'update')
                        sync.updateRow('t', rows[1], { id: 2, name: 'changed' })
                    else sync.deleteRow(rows[1], 't')
                    expect(source.value).toContain(inserts)
                    db.exec('DROP TABLE t;')
                    db.exec(source.value)
                    expect(
                        db
                            .prepare('SELECT * FROM t ORDER BY id')
                            .all()
                            .map((row) => ({ ...row }))
                    ).toEqual(
                        operation === 'update'
                            ? [
                                  { id: 1, name: 'same' },
                                  { id: 2, name: 'changed' }
                              ]
                            : [{ id: 1, name: 'same' }]
                    )
                } finally {
                    db.close()
                }
            })
        }
    }

    for (const operation of ['update', 'delete']) {
        it(`reports ambiguous ${operation} without a primary key`, () => {
            const source = ref("INSERT INTO t VALUES ('same'); INSERT INTO t VALUES ('same');")
            const initial = source.value
            const code = computed({
                get: () => source.value,
                set: (value) => {
                    source.value = value
                }
            })
            const error = vi.fn()
            const row = { name: 'same' }
            const sync = useBidirectionalSync(
                code,
                () => [
                    {
                        name: 't',
                        columns: ['name'],
                        columnTypes: { name: 'TEXT' },
                        data: [row, { ...row }]
                    }
                ],
                ref('user'),
                vi.fn(),
                (_from, to) => to,
                undefined,
                error
            )
            if (operation === 'update') sync.updateRow('t', row, { name: 'changed' })
            else sync.deleteRow(row, 't')
            expect(source.value).toBe(initial)
            expect(error).toHaveBeenCalledWith(expect.stringContaining('多条源记录'))
        })
    }
})
