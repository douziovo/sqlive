import {describe, expect, it} from 'vitest'
import {determineCardinality, foreignKeysToEdges, tablesToNodes} from '@/composables/useErDiagram'
import type {ForeignKeyInfo, TableSchema} from '@/model/DatabaseTypes'

// ── Test Data ──

function makeUsersTable(): TableSchema {
    return {
        name: 'users',
        columns: ['id', 'name', 'dept_id'],
        columnTypes: {id: 'INTEGER | PRIMARY KEY', name: 'TEXT | NOT NULL', dept_id: 'INTEGER'},
        data: []
    }
}

function makeDeptsTable(): TableSchema {
    return {
        name: 'departments',
        columns: ['id', 'name'],
        columnTypes: {id: 'INTEGER | PRIMARY KEY', name: 'TEXT | UNIQUE'},
        data: []
    }
}

function makeOrdersTable(): TableSchema {
    return {
        name: 'orders',
        columns: ['id', 'user_id', 'total'],
        columnTypes: {id: 'INTEGER | PRIMARY KEY', user_id: 'INTEGER', total: 'REAL'},
        data: []
    }
}

// ── Tests ──

describe('tablesToNodes', () => {
    it('maps one table to one node', () => {
        const nodes = tablesToNodes([makeUsersTable()], [])
        expect(nodes).toHaveLength(1)
        expect(nodes[0].id).toBe('table-users')
        expect(nodes[0].type).toBe('table')
        expect(nodes[0].data.tableName).toBe('users')
    })

    it('marks PRIMARY KEY column', () => {
        const nodes = tablesToNodes([makeUsersTable()], [])
        const cols = nodes[0].data.columns
        const pkCol = cols.find((c) => c.name === 'id')
        expect(pkCol?.isPrimaryKey).toBe(true)
        expect(pkCol?.isForeignKey).toBe(false)
    })

    it('marks FOREIGN KEY column with reference info', () => {
        const fks: ForeignKeyInfo[] = [
            {name: 'fk_dept', fromTable: 'users', fromColumn: 'dept_id', toTable: 'departments', toColumn: 'id'}
        ]
        const nodes = tablesToNodes([makeUsersTable(), makeDeptsTable()], fks)
        const cols = nodes[0].data.columns
        const fkCol = cols.find((c) => c.name === 'dept_id')
        expect(fkCol?.isForeignKey).toBe(true)
        expect(fkCol?.referencedTable).toBe('departments')
        expect(fkCol?.referencedColumn).toBe('id')
    })

    it('marks UNIQUE column (non-PK)', () => {
        const nodes = tablesToNodes([makeDeptsTable()], [])
        const cols = nodes[0].data.columns
        const uqCol = cols.find((c) => c.name === 'name')
        expect(uqCol?.isUnique).toBe(true)
        expect(uqCol?.isPrimaryKey).toBe(false)
    })

    it('does not mark PK as UNIQUE', () => {
        const nodes = tablesToNodes([makeUsersTable()], [])
        const cols = nodes[0].data.columns
        const pkCol = cols.find((c) => c.name === 'id')
        expect(pkCol?.isPrimaryKey).toBe(true)
        expect(pkCol?.isUnique).toBe(false)
    })
})

describe('determineCardinality', () => {
    it('returns 一对一 when both sides are unique', () => {
        const result = determineCardinality(makeUsersTable(), makeDeptsTable(), 'id', 'id')
        // users.id is PK, depts.id is PK → 一对一
        expect(result).toBe('一对一')
    })

    it('returns 一对多 when from side is unique', () => {
        const result = determineCardinality(makeDeptsTable(), makeUsersTable(), 'id', 'dept_id')
        // depts.id is PK, users.dept_id is not → 一对多
        expect(result).toBe('一对多')
    })

    it('returns 多对一 as default', () => {
        const result = determineCardinality(makeOrdersTable(), makeUsersTable(), 'user_id', 'id')
        // orders.user_id is not PK/UNIQUE → 多对一 (default)
        expect(result).toBe('多对一')
    })
})

describe('foreignKeysToEdges', () => {
    it('creates one edge per foreign key', () => {
        const fks: ForeignKeyInfo[] = [
            {name: 'fk_dept', fromTable: 'users', fromColumn: 'dept_id', toTable: 'departments', toColumn: 'id'}
        ]
        const edges = foreignKeysToEdges(fks, [makeUsersTable(), makeDeptsTable()])
        expect(edges).toHaveLength(1)
        expect(edges[0].source).toBe('table-users')
        expect(edges[0].target).toBe('table-departments')
        expect(edges[0].type).toBe('smoothstep')
    })

    it('includes FK name in label when present', () => {
        const fks: ForeignKeyInfo[] = [
            {name: 'fk_dept', fromTable: 'users', fromColumn: 'dept_id', toTable: 'departments', toColumn: 'id'}
        ]
        const edges = foreignKeysToEdges(fks, [makeUsersTable(), makeDeptsTable()])
        expect(edges[0].label).toBe('fk_dept: 多对一')
    })

    it('uses cardinality-only label when FK has no name', () => {
        const fks: ForeignKeyInfo[] = [
            {name: '', fromTable: 'orders', fromColumn: 'user_id', toTable: 'users', toColumn: 'id'}
        ]
        const edges = foreignKeysToEdges(fks, [makeOrdersTable(), makeUsersTable()])
        expect(edges[0].label).toBe('多对一')
    })

    it('shows full FK name without truncation', () => {
        const fks: ForeignKeyInfo[] = [
            {
                name: 'fk_orders_user_id_ref_users_id',
                fromTable: 'orders',
                fromColumn: 'user_id',
                toTable: 'users',
                toColumn: 'id'
            }
        ]
        const edges = foreignKeysToEdges(fks, [makeOrdersTable(), makeUsersTable()])
        expect(edges[0].label).toBe('fk_orders_user_id_ref_users_id: 多对一')
    })

    it('filters out FK when target table is not in the schema', () => {
        const fks: ForeignKeyInfo[] = [
            {name: 'fk_orphan', fromTable: 'users', fromColumn: 'dept_id', toTable: 'nonexistent', toColumn: 'id'}
        ]
        const edges = foreignKeysToEdges(fks, [makeUsersTable()])
        expect(edges).toHaveLength(0)
    })

    it('filters out FK when source table is not in the schema', () => {
        const fks: ForeignKeyInfo[] = [
            {name: 'fk_orphan', fromTable: 'ghost', fromColumn: 'x', toTable: 'users', toColumn: 'id'}
        ]
        const edges = foreignKeysToEdges(fks, [makeUsersTable()])
        expect(edges).toHaveLength(0)
    })

    it('returns empty array for empty inputs', () => {
        const edges = foreignKeysToEdges([], [])
        expect(edges).toHaveLength(0)
    })
})

describe('search filtering', () => {
    it('marks node as filtered when neither table name nor columns match', () => {
        const nodes = tablesToNodes([makeUsersTable(), makeDeptsTable()], [])
        const q = 'xyz'
        const results = nodes.map((n) => ({
            ...n,
            data: {
                ...n.data,
                isFiltered:
                    !n.data.tableName.toLowerCase().includes(q) && !n.data.columns.some((c) => c.name.toLowerCase().includes(q))
            }
        }))

        expect(results[0].data.isFiltered).toBe(true) // users: no match
        expect(results[1].data.isFiltered).toBe(true) // departments: no match
    })

    it('does not filter node when any column name matches search', () => {
        const nodes = tablesToNodes([makeUsersTable(), makeDeptsTable()], [])
        const q = 'dept_id'
        const results = nodes.map((n) => ({
            ...n,
            data: {
                ...n.data,
                isFiltered:
                    !n.data.tableName.toLowerCase().includes(q) && !n.data.columns.some((c) => c.name.toLowerCase().includes(q))
            }
        }))

        // users: table name 'users' doesn't match 'dept_id', but column 'dept_id' does
        expect(results[0].data.isFiltered).toBe(false)
        // departments: neither table name nor columns match 'dept_id'
        expect(results[1].data.isFiltered).toBe(true)
    })
})
