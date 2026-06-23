import { afterEach, beforeEach, describe, expect, it, type vi } from 'vitest'
import { mockSuccess, type SqlEngineSetup, setupSqlEngine, teardownSqlEngine, tick } from './test-utils'

describe('SQL DML statements', () => {
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
  describe('DML — INSERT', () => {
    it('should handle INSERT with explicit columns', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['id', 'name', 'val'],
            columnTypes: { id: 'INTEGER', name: 'TEXT', val: 'REAL' },
            data: [{ id: 1, name: 'Alice', val: 100.5 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value =
        "CREATE TABLE t (id INTEGER, name TEXT, val REAL);\nINSERT INTO t (id, name, val) VALUES (1, 'Alice', 100.5);"
      await tick()
      expect(engine.db.tables[0].data.length).toBe(1)
    })

    it('should handle INSERT without column list', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['id', 'name'],
            columnTypes: { id: 'INTEGER', name: 'TEXT' },
            data: [{ id: 1, name: 'Alice' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = "CREATE TABLE t (id INTEGER, name TEXT);\nINSERT INTO t VALUES (1, 'Alice');"
      await tick()
      expect(engine.db.tables[0].data[0].name).toBe('Alice')
    })

    it('should handle multi-row INSERT', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['x', 'y'],
            columnTypes: { x: 'INTEGER', y: 'TEXT' },
            data: [
              { x: 1, y: 'a' },
              { x: 2, y: 'b' },
              { x: 3, y: 'c' }
            ]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value =
        "CREATE TABLE t (x INTEGER, y TEXT);\nINSERT INTO t (x, y) VALUES (1, 'a'), (2, 'b'), (3, 'c');"
      await tick()
      expect(engine.db.tables[0].data.length).toBe(3)
    })

    it('should handle INSERT with NULL and numbers', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['a', 'b', 'c'],
            columnTypes: { a: 'INTEGER', b: 'TEXT', c: 'REAL' },
            data: [{ a: null, b: 'hello', c: 3.14 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value =
        "CREATE TABLE t (a INTEGER, b TEXT, c REAL);\nINSERT INTO t (a, b, c) VALUES (NULL, 'hello', 3.14);"
      await tick()
      const row = engine.db.tables[0].data[0]
      expect(row.b).toBe('hello')
    })

    it('should handle INSERT OR REPLACE', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['id', 'name'],
            columnTypes: { id: 'INTEGER', name: 'TEXT' },
            data: [{ id: 1, name: 'Alice' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = "INSERT OR REPLACE INTO t (id, name) VALUES (1, 'Alice');"
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].data).toHaveLength(1)
    })

    it('should handle INSERT OR IGNORE', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['id', 'name'],
            columnTypes: { id: 'INTEGER', name: 'TEXT' },
            data: [{ id: 1, name: 'Alice' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = "INSERT OR IGNORE INTO t (id, name) VALUES (1, 'Alice');"
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].data[0].name).toBe('Alice')
    })

    it('should handle backtick-quoted column names', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['select', 'from'],
            columnTypes: { select: 'INTEGER', from: 'TEXT' },
            data: [{ select: 1, from: 'x' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value =
        "CREATE TABLE t (`select` INTEGER, `from` TEXT);\nINSERT INTO t (`select`, `from`) VALUES (1, 'x');"
      await tick()
      expect(engine.db.tables[0].data[0].from).toBe('x')
    })
  })

  // ============================================================
  //  DML — UPDATE / DELETE
  // ============================================================

  describe('DML — UPDATE and DELETE', () => {
    it('should handle UPDATE with WHERE', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['id', 'name'],
            columnTypes: { id: 'INTEGER', name: 'TEXT' },
            data: [{ id: 1, name: 'Bob' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = "UPDATE t SET name = 'Bob' WHERE id = 1;"
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].data[0].name).toBe('Bob')
    })

    it('should handle UPDATE with multiple columns', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['id', 'name', 'age'],
            columnTypes: { id: 'INTEGER', name: 'TEXT', age: 'INTEGER' },
            data: [{ id: 1, name: 'Bob', age: 30 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = "UPDATE t SET name = 'Bob', age = 30 WHERE id = 1;"
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].data[0].age).toBe(30)
    })

    it('should handle UPDATE without WHERE', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          { name: 't', columns: ['active'], columnTypes: { active: 'INTEGER' }, data: [{ active: 1 }, { active: 1 }] }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'UPDATE t SET active = 1;'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].data).toHaveLength(2)
    })

    it('should handle DELETE with WHERE', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['id'], columnTypes: { id: 'INTEGER' }, data: [] }]
      })
      const engine = useSqlEngine()
      engine.code.value = 'DELETE FROM t WHERE id = 1;'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].data).toHaveLength(0)
    })

    it('should handle DELETE without WHERE', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['id'], columnTypes: { id: 'INTEGER' }, data: [] }]
      })
      const engine = useSqlEngine()
      engine.code.value = 'DELETE FROM t;'
      await tick()
      expect(engine.executionError.value).toBeNull()
    })
  })

  // ============================================================
  //  DQL — SELECT
  // ============================================================

  describe('UPSERT — ON CONFLICT', () => {
    it('should handle INSERT ... ON CONFLICT DO UPDATE', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['id', 'name'],
            columnTypes: { id: 'INTEGER', name: 'TEXT' },
            data: [{ id: 1, name: 'Alice' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `INSERT INTO t (id, name) VALUES (1, 'Alice')
ON CONFLICT(id) DO UPDATE SET name = excluded.name;`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].data[0].name).toBe('Alice')
    })

    it('should handle INSERT ... ON CONFLICT DO NOTHING', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['id', 'name'],
            columnTypes: { id: 'INTEGER', name: 'TEXT' },
            data: [{ id: 1, name: 'Alice' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `INSERT INTO t (id, name) VALUES (1, 'Alice')
ON CONFLICT DO NOTHING;`
      await tick()
      expect(engine.db.tables[0].data).toHaveLength(1)
    })

    it('should handle INSERT OR REPLACE', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['id', 'name'],
            columnTypes: { id: 'INTEGER', name: 'TEXT' },
            data: [{ id: 1, name: 'Alice' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `INSERT OR REPLACE INTO t (id, name) VALUES (1, 'Alice');`
      await tick()
      expect(engine.db.tables[0].data[0].name).toBe('Alice')
    })
  })

  // ============================================================
  //  NULL handling functions
  // ============================================================

  describe('DML extras', () => {
    it('should handle INSERT INTO ... SELECT', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 'backup',
            columns: ['name', 'salary'],
            columnTypes: { name: 'TEXT', salary: 'REAL' },
            data: [{ name: 'Alice', salary: 12000 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE backup (name TEXT, salary REAL);
INSERT INTO backup SELECT name, salary FROM employees WHERE salary > 10000;`
      await tick()
      expect(engine.db.tables[0].data[0].name).toBe('Alice')
    })

    it('should handle DELETE with subquery', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['id'], columnTypes: { id: 'INTEGER' }, data: [] }]
      })
      const engine = useSqlEngine()
      engine.code.value = `DELETE FROM t WHERE id IN (SELECT id FROM other WHERE status = 'inactive');`
      await tick()
      expect(engine.executionError.value).toBeNull()
    })

    it('should handle UPDATE with subquery', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 'employees',
            columns: ['id', 'salary'],
            columnTypes: { id: 'INTEGER', salary: 'REAL' },
            data: [{ id: 1, salary: 7000 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `UPDATE employees SET salary = (SELECT AVG(salary) FROM employees) WHERE id = 1;`
      await tick()
      expect(engine.executionError.value).toBeNull()
    })
  })

  // ============================================================
  //  Subquery extras
  // ============================================================

})
