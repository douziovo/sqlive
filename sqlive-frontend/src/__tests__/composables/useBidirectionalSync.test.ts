import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { DatabaseModel, TableSchema } from '@/model/DatabaseTypes'
import { useBidirectionalSync } from '@/composables/useBidirectionalSync'

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
    set: (v: string) => { codeRef.value = v }
  })
  const flashCode = vi.fn()
  const transitionFn = makeTransitionFn()
  const sync = useBidirectionalSync(code, db ?? makeDb(), mode, flashCode, transitionFn)
  return { sync, code, codeRef, mode, flashCode }
}

describe('useBidirectionalSync', () => {
  describe('beginReconcile', () => {
    it('saves current code as lastValidCode and transitions to reconciling', () => {
      const initial = 'INSERT INTO users VALUES (1, \'Alice\');'
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
      const initial = 'INSERT INTO users VALUES (1, \'Alice\');'
      const { sync, code } = setup(initial)

      sync.beginReconcile()
      code.value = 'MODIFIED CODE'

      // getLastValidCode should still return the code at reconcile time
      expect(sync.getLastValidCode()).toBe(initial)
    })
  })

  describe('updateRow', () => {
    it('replaces matching VALUES tuple in code', () => {
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\');'
      const { sync, code } = setup(initial)

      sync.updateRow('users', { id: 1, name: 'Alice' }, { id: 1, name: 'Alicia' })

      expect(code.value).toContain('(1, \'Alicia\')')
      expect(code.value).not.toContain('(1, \'Alice\')')
    })

    it('calls flashCode with the new tuple SQL', () => {
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\');'
      const { sync, flashCode } = setup(initial)

      sync.updateRow('users', { id: 1, name: 'Alice' }, { id: 1, name: 'Alicia' })

      expect(flashCode).toHaveBeenCalledWith(expect.stringContaining('Alicia'))
    })

    it('transitions mode to reconciling during update', () => {
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\');'
      const { sync, mode } = setup(initial)

      sync.updateRow('users', { id: 1, name: 'Alice' }, { id: 1, name: 'Alicia' })

      expect(mode.value).toBe('reconciling')
    })

    it('warns when tuple not found in code', () => {
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\');'
      const { sync } = setup(initial)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      sync.updateRow('users', { id: 999, name: 'Nobody' }, { id: 999, name: 'Ghost' })

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('无法定位'))
      warnSpy.mockRestore()
    })
  })

  describe('deleteRow', () => {
    it('removes matching VALUES tuple from code', () => {
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\'), (2, \'Bob\');'
      const { sync, code } = setup(initial)

      sync.deleteRow({ id: 1, name: 'Alice' }, 'users')

      expect(code.value).not.toContain('Alice')
      expect(code.value).toContain('Bob')
    })

    it('removes entire INSERT when deleting only row', () => {
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\');'
      const { sync, code } = setup(initial)

      sync.deleteRow({ id: 1, name: 'Alice' }, 'users')

      // The entire statement should be removed
      expect(code.value.trim()).toBe('')
    })

    it('transitions mode to reconciling during delete', () => {
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\');'
      const { sync, mode } = setup(initial)

      sync.deleteRow({ id: 1, name: 'Alice' }, 'users')

      expect(mode.value).toBe('reconciling')
    })

    it('auto-detects table name from db when not provided', () => {
      const db = makeDb()
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\'), (2, \'Bob\');'
      const { sync, code } = setup(initial, db)

      // Must pass the actual object reference from db.tables[0].data for auto-detect to work
      sync.deleteRow(db.tables[0].data[1])

      expect(code.value).not.toContain('Bob')
      expect(code.value).toContain('Alice')
    })

    it('does nothing when row is not found', () => {
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\');'
      const { sync, code } = setup(initial)

      sync.deleteRow({ id: 999, name: 'Nobody' }, 'users')

      expect(code.value).toBe(initial)
    })
  })

  describe('insertRowUI', () => {
    it('appends a new INSERT statement to code', () => {
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\');'
      const { sync, code } = setup(initial)

      sync.insertRowUI('users', { id: 3, name: 'Charlie' })

      expect(code.value).toContain('INSERT INTO users (id, name) VALUES (3, \'Charlie\');')
    })

    it('calls flashCode with the new INSERT SQL', () => {
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\');'
      const { sync, flashCode } = setup(initial)

      sync.insertRowUI('users', { id: 3, name: 'Charlie' })

      expect(flashCode).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'))
    })

    it('adds semicolon before new INSERT if missing', () => {
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\')'
      const { sync, code } = setup(initial)

      sync.insertRowUI('users', { id: 3, name: 'Charlie' })

      // The code normalizes: adds semicolon, newline, then new INSERT
      expect(code.value).toContain(';')
      expect(code.value).toContain('INSERT INTO users (id, name) VALUES (3, \'Charlie\');')
    })

    it('does nothing for unknown table', () => {
      const initial = 'INSERT INTO users (id, name) VALUES (1, \'Alice\');'
      const { sync, code } = setup(initial)

      sync.insertRowUI('nonexistent', { id: 1, name: 'Test' })

      expect(code.value).toBe(initial)
    })
  })

  describe('addNewTable', () => {
    it('appends CREATE TABLE and optional INSERT to code', () => {
      const initial = 'SELECT 1;'
      const { sync, code } = setup(initial)

      sync.addNewTable('products', ['id INTEGER', 'price REAL'], [{ 'id INTEGER': 1, 'price REAL': 9.99 }])

      expect(code.value).toContain('CREATE TABLE products')
      expect(code.value).toContain('INSERT INTO products')
    })

    it('appends only CREATE TABLE when no data provided', () => {
      const initial = 'SELECT 1;'
      const { sync, code } = setup(initial)

      sync.addNewTable('products', ['id INTEGER', 'price REAL'], [])

      expect(code.value).toContain('CREATE TABLE products')
      expect(code.value).not.toContain('INSERT INTO products')
    })
  })

  describe('dropTableUI', () => {
    it('removes all statements referencing the table', () => {
      const initial = 'CREATE TABLE users (id INTEGER, name TEXT);\nINSERT INTO users VALUES (1, \'Alice\');'
      const { sync, code } = setup(initial)

      sync.dropTableUI('users')

      expect(code.value).not.toContain('users')
    })
  })

  describe('lastTruncations', () => {
    it('initializes as empty array', () => {
      const { sync } = setup('SELECT 1;')
      expect(sync.lastTruncations.value).toEqual([])
    })
  })
})
