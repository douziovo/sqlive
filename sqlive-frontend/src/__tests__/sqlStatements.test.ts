import { afterEach, beforeEach, describe, expect, it, type vi } from 'vitest'
import { mockSuccess, type SqlEngineSetup, setupSqlEngine, teardownSqlEngine, tick } from './test-utils'

describe('SQL statement handling', () => {
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

  // ============================================================
  //  DDL — CREATE TABLE
  // ============================================================

  describe('DDL — CREATE TABLE', () => {
    it('should handle basic CREATE TABLE', async () => {
      mockSuccess(fetchSpy, { tables: [{ name: 't', columns: ['id'], columnTypes: { id: 'INTEGER' }, data: [] }] })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE TABLE t (id INTEGER);'
      await tick()
      expect(engine.db.tables[0].name).toBe('t')
    })

    it('should handle quoted table name', async () => {
      mockSuccess(fetchSpy, { tables: [{ name: 'My Table', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [] }] })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE TABLE "My Table" (x INTEGER);'
      await tick()
      expect(engine.db.tables[0].name).toBe('My Table')
    })

    it('should handle IF NOT EXISTS', async () => {
      mockSuccess(fetchSpy, { tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [] }] })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE TABLE IF NOT EXISTS t (x INTEGER);'
      await tick()
      expect(engine.db.tables.length).toBe(1)
    })

    it('should handle multiple columns with constraints', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 'users',
            columns: ['id', 'name', 'email', 'age', 'salary', 'created_at'],
            columnTypes: {
              id: 'INTEGER | PRIMARY KEY AUTOINCREMENT',
              name: 'TEXT | NOT NULL',
              email: 'TEXT | UNIQUE',
              age: 'INTEGER | DEFAULT 0',
              salary: 'REAL | CHECK',
              created_at: 'TEXT | DEFAULT CURRENT_TIMESTAMP'
            },
            data: []
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                age INTEGER DEFAULT 0,
                salary REAL CHECK(salary > 0),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );`
      await tick()
      const t = engine.db.tables[0]
      expect(t.columns.length).toBe(6)
      expect(t.columnTypes.id).toContain('INTEGER')
    })

    it('should handle TEMP TABLE', async () => {
      mockSuccess(fetchSpy, { tables: [{ name: 'tmp_data', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [] }] })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE TEMP TABLE tmp_data (x INTEGER);'
      await tick()
      expect(engine.db.tables[0].name).toBe('tmp_data')
    })

    it('should handle CREATE TABLE AS SELECT', async () => {
      mockSuccess(fetchSpy, { tables: [{ name: 'backup', columns: ['id'], columnTypes: { id: 'INTEGER' }, data: [] }] })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE TABLE backup AS SELECT id FROM users;'
      await tick()
      expect(engine.db.tables[0].name).toBe('backup')
    })
  })

  // ============================================================
  //  DDL — ALTER / DROP / INDEX / VIEW
  // ============================================================

  describe('DDL — ALTER, DROP, INDEX, VIEW', () => {
    it('should handle ALTER TABLE RENAME TO', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 'employees', columns: ['id'], columnTypes: { id: 'INTEGER' }, data: [{ id: 1 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = 'ALTER TABLE users RENAME TO employees;'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].name).toBe('employees')
    })

    it('should handle ALTER TABLE ADD COLUMN', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 'users',
            columns: ['id', 'email'],
            columnTypes: { id: 'INTEGER', email: 'TEXT | NOT NULL DEFAULT' },
            data: [{ id: 1, email: '' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = "ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT '';"
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].columns).toContain('email')
    })

    it('should handle DROP TABLE', async () => {
      mockSuccess(fetchSpy, { tables: [] })
      const engine = useSqlEngine()
      engine.code.value = 'DROP TABLE users;'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables).toHaveLength(0)
    })

    it('should handle DROP TABLE IF EXISTS', async () => {
      mockSuccess(fetchSpy, { tables: [] })
      const engine = useSqlEngine()
      engine.code.value = 'DROP TABLE IF EXISTS users;'
      await tick()
      expect(engine.executionError.value).toBeNull()
    })

    it('should handle CREATE INDEX', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 'users', columns: ['name'], columnTypes: { name: 'TEXT' }, data: [] }],
        indexes: [
          {
            name: 'idx_name',
            tableName: 'users',
            columns: ['name'],
            unique: false,
            sql: 'CREATE INDEX idx_name ON users (name)'
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE INDEX idx_name ON users (name);'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.indexes).toHaveLength(1)
      expect(engine.db.indexes[0].name).toBe('idx_name')
    })

    it('should handle CREATE UNIQUE INDEX', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 'users', columns: ['email'], columnTypes: { email: 'TEXT' }, data: [] }],
        indexes: [
          {
            name: 'idx_email',
            tableName: 'users',
            columns: ['email'],
            unique: true,
            sql: 'CREATE UNIQUE INDEX idx_email ON users (email)'
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE UNIQUE INDEX idx_email ON users (email);'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.indexes[0].unique).toBe(true)
    })

    it('should handle CREATE INDEX IF NOT EXISTS', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['a'], columnTypes: { a: 'INTEGER' }, data: [] }],
        indexes: [
          {
            name: 'idx_a',
            tableName: 't',
            columns: ['a'],
            unique: false,
            sql: 'CREATE INDEX IF NOT EXISTS idx_a ON t (a)'
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE INDEX IF NOT EXISTS idx_a ON t (a);'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.indexes[0].name).toBe('idx_a')
    })

    it('should handle CREATE VIEW', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          { name: 'employees', columns: ['name', 'salary'], columnTypes: { name: 'TEXT', salary: 'REAL' }, data: [] },
          { name: 'high_earners', columns: ['name', 'salary'], columnTypes: { name: 'TEXT', salary: 'REAL' }, data: [] }
        ],
        views: [
          {
            name: 'high_earners',
            sql: 'CREATE VIEW high_earners AS SELECT name, salary FROM employees WHERE salary > 5000'
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE employees (name TEXT, salary REAL);
CREATE VIEW high_earners AS SELECT name, salary FROM employees WHERE salary > 5000;
SELECT * FROM high_earners;`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.views).toHaveLength(1)
      expect(engine.db.views[0].name).toBe('high_earners')
    })

    it('should handle DROP VIEW', async () => {
      mockSuccess(fetchSpy, { tables: [], views: [] })
      const engine = useSqlEngine()
      engine.code.value = 'DROP VIEW IF EXISTS high_earners;'
      await tick()
      expect(engine.executionError.value).toBeNull()
    })
  })

  // ============================================================
  //  DML — INSERT
  // ============================================================

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

  describe('DQL — SELECT', () => {
    it('should handle basic SELECT', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [{ x: 1 }] }],
        queryResults: [{ name: '查询结果', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [{ x: 1 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT * FROM t;'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.queryResults).toHaveLength(1)
    })

    it('should handle SELECT with WHERE and multiple conditions', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [{ name: '查询结果', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [{ x: 5 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = "SELECT * FROM t WHERE x > 0 AND y < 100 OR z = 'test';"
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.queryResults[0].data.length).toBe(1)
    })

    it('should handle SELECT DISTINCT', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name'],
            columnTypes: { name: 'TEXT' },
            data: [{ name: 'Alice' }, { name: 'Bob' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT DISTINCT name FROM users;'
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(2)
    })

    it('should handle SELECT with ORDER BY', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name'],
            columnTypes: { name: 'TEXT' },
            data: [{ name: 'Alice' }, { name: 'Bob' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT * FROM t ORDER BY name ASC, age DESC;'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.queryResults).toHaveLength(1)
    })

    it('should handle SELECT with LIMIT and OFFSET', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          { name: '查询结果', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [{ x: 11 }, { x: 12 }] }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT * FROM t LIMIT 10 OFFSET 20;'
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(2)
    })

    it('should handle SELECT with GROUP BY and HAVING', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['dept', 'cnt'],
            columnTypes: { dept: 'TEXT', cnt: 'INTEGER' },
            data: [{ dept: 'IT', cnt: 10 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT dept, COUNT(*) FROM employees GROUP BY dept HAVING COUNT(*) > 5;'
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(1)
    })

    it('should handle SELECT with aggregate functions', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['cnt', 'sum', 'avg', 'max', 'min'],
            columnTypes: { cnt: 'INTEGER', sum: 'REAL', avg: 'REAL', max: 'INTEGER', min: 'INTEGER' },
            data: [{ cnt: 100, sum: 5000, avg: 50, max: 99, min: 1 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT COUNT(*), SUM(salary), AVG(age), MAX(score), MIN(score) FROM t;'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.queryResults[0].data[0].cnt).toBe(100)
    })

    it('should handle INNER JOIN', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['id', 'a_id'],
            columnTypes: { id: 'INTEGER', a_id: 'INTEGER' },
            data: [{ id: 1, a_id: 1 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT * FROM a INNER JOIN b ON a.id = b.a_id;'
      await tick()
      expect(engine.db.queryResults).toHaveLength(1)
    })

    it('should handle LEFT JOIN', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['id', 'a_id'],
            columnTypes: { id: 'INTEGER', a_id: 'INTEGER' },
            data: [{ id: 1, a_id: 1 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT * FROM a LEFT JOIN b ON a.id = b.a_id;'
      await tick()
      expect(engine.db.queryResults[0].data).toHaveLength(1)
    })

    it('should handle CROSS JOIN', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['id'],
            columnTypes: { id: 'INTEGER' },
            data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT * FROM a CROSS JOIN b;'
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(4)
    })

    it('should handle table alias with AS', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          { name: '查询结果', columns: ['name'], columnTypes: { name: 'TEXT' }, data: [{ name: 'Alice' }] }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT e.name FROM employees AS e WHERE e.salary > 5000;'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.queryResults[0].data[0].name).toBe('Alice')
    })

    it('should handle table alias without AS', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'dept'],
            columnTypes: { name: 'TEXT', dept: 'TEXT' },
            data: [{ name: 'Alice', dept: 'IT' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT e.name, d.name FROM employees e JOIN departments d ON e.dept_id = d.id;'
      await tick()
      expect(engine.executionError.value).toBeNull()
    })

    it('should handle subquery in FROM', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['id', 'name'],
            columnTypes: { id: 'INTEGER', name: 'TEXT' },
            data: [{ id: 1, name: 'Alice' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT * FROM (SELECT id, name FROM users WHERE age > 18) AS adults;'
      await tick()
      expect(engine.db.queryResults[0].data).toHaveLength(1)
    })

    it('should handle subquery in WHERE', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [{ name: '查询结果', columns: ['id'], columnTypes: { id: 'INTEGER' }, data: [{ id: 1 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT * FROM t WHERE id IN (SELECT id FROM other WHERE x > 0);'
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(1)
    })

    it('should handle UNION', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name'],
            columnTypes: { name: 'TEXT' },
            data: [{ name: 'Alice' }, { name: 'Bob' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT name FROM a UNION SELECT name FROM b;'
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(2)
    })

    it('should handle UNION ALL', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name'],
            columnTypes: { name: 'TEXT' },
            data: [{ name: 'Alice' }, { name: 'Bob' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT name FROM a UNION ALL SELECT name FROM b;'
      await tick()
      expect(engine.db.queryResults[0].data).toHaveLength(2)
    })

    it('should handle CASE expression', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'level'],
            columnTypes: { name: 'TEXT', level: 'TEXT' },
            data: [{ name: 'Alice', level: 'High' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT name,
                CASE WHEN salary > 8000 THEN 'High'
                     WHEN salary > 5000 THEN 'Medium'
                     ELSE 'Low'
                END AS level
                FROM employees;`
      await tick()
      expect(engine.db.queryResults[0].data[0].level).toBe('High')
    })

    it('should handle LIKE operator', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          { name: '查询结果', columns: ['name'], columnTypes: { name: 'TEXT' }, data: [{ name: 'Alice' }] }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = "SELECT * FROM t WHERE name LIKE 'A%';"
      await tick()
      expect(engine.db.queryResults[0].data).toHaveLength(1)
    })

    it('should handle BETWEEN operator', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [{ name: '查询结果', columns: ['age'], columnTypes: { age: 'INTEGER' }, data: [{ age: 30 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT * FROM t WHERE age BETWEEN 18 AND 65;'
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(1)
    })

    it('should handle IS NULL / IS NOT NULL', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          { name: '查询结果', columns: ['name'], columnTypes: { name: 'TEXT' }, data: [{ name: 'Alice' }] }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT * FROM t WHERE email IS NULL AND name IS NOT NULL;'
      await tick()
      expect(engine.db.queryResults[0].data).toHaveLength(1)
    })

    it('should handle EXISTS subquery', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [{ name: '查询结果', columns: ['id'], columnTypes: { id: 'INTEGER' }, data: [{ id: 1 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT * FROM a WHERE EXISTS (SELECT 1 FROM b WHERE b.a_id = a.id);'
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(1)
    })
  })

  // ============================================================
  //  Parsing edge cases
  // ============================================================

  describe('Parsing edge cases', () => {
    it('should handle semicolons inside single-quoted strings', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'TEXT' }, data: [{ x: 'hello; world' }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = "CREATE TABLE t (x TEXT);\nINSERT INTO t VALUES ('hello; world');\nSELECT * FROM t;"
      await tick()
      expect(engine.db.tables[0].data[0].x).toBe('hello; world')
    })

    it('should handle semicolons inside double-quoted identifiers', async () => {
      mockSuccess(fetchSpy, { tables: [{ name: 't;est', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [] }] })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE TABLE "t;est" (x INTEGER);'
      await tick()
      expect(engine.db.tables[0].name).toBe('t;est')
    })

    it('should handle escaped single quotes', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'TEXT' }, data: [{ x: "it's" }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = "CREATE TABLE t (x TEXT);\nINSERT INTO t VALUES ('it''s');\nSELECT * FROM t;"
      await tick()
      expect(engine.db.tables[0].data[0].x).toBe("it's")
    })

    it('should handle -- line comments', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [{ x: 1 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = `-- This is a comment
CREATE TABLE t (x INTEGER);
-- Another comment with ; semicolon inside
INSERT INTO t VALUES (1);
SELECT * FROM t; -- trailing comment`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].data.length).toBe(1)
    })

    it('should handle /* block comments */', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [{ x: 1 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = `/* multi-line
block comment with ; inside */
CREATE TABLE t (x INTEGER);
INSERT INTO t VALUES (1);
SELECT * FROM t;`
      await tick()
      expect(engine.db.tables[0].data.length).toBe(1)
    })

    it('should handle empty script', async () => {
      mockSuccess(fetchSpy, { tables: [] })
      const engine = useSqlEngine()
      engine.code.value = ''
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables.length).toBe(0)
    })

    it('should handle whitespace-only script', async () => {
      mockSuccess(fetchSpy, { tables: [] })
      const engine = useSqlEngine()
      engine.code.value = '   \n  \n  '
      await tick()
      expect(engine.executionError.value).toBeNull()
    })

    it('should handle trailing semicolon', async () => {
      mockSuccess(fetchSpy, { tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [] }] })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE TABLE t (x INTEGER);\n'
      await tick()
      expect(engine.db.tables.length).toBe(1)
    })

    it('should handle statement without trailing semicolon', async () => {
      mockSuccess(fetchSpy, { tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [] }] })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE TABLE t (x INTEGER)'
      await tick()
      expect(engine.db.tables.length).toBe(1)
    })
  })

  // ============================================================
  //  Bidirectional sync — updateRow / deleteRow / insertRowUI
  // ============================================================

  describe('Bidirectional sync', () => {
    it('should match VALUES by explicit column order', async () => {
      mockSuccess(fetchSpy, { tables: [] })
      const engine = useSqlEngine()
      await tick()

      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['a', 'b', 'c'],
            columnTypes: { a: 'INTEGER', b: 'TEXT', c: 'REAL' },
            data: [{ a: 1, b: 'x', c: 3.14 }]
          }
        ]
      })
      engine.code.value = "CREATE TABLE t (a INTEGER, b TEXT, c REAL);\nINSERT INTO t (b, c, a) VALUES ('x', 3.14, 1);"
      await tick()

      const oldCode = engine.code.value
      engine.updateRow('t', { a: 1, b: 'x', c: 3.14 }, { a: 1, b: 'y', c: 3.14 })
      expect(engine.code.value).not.toBe(oldCode)
      expect(engine.code.value).toContain("'y'")
    })

    it('should handle multi-row INSERT in updateRow', async () => {
      mockSuccess(fetchSpy, { tables: [] })
      const engine = useSqlEngine()
      await tick()

      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['x', 'y'],
            columnTypes: { x: 'INTEGER', y: 'TEXT' },
            data: [
              { x: 1, y: 'a' },
              { x: 2, y: 'b' }
            ]
          }
        ]
      })
      engine.code.value =
        "CREATE TABLE t (x INTEGER, y TEXT);\nINSERT INTO t (x, y) VALUES (1, 'a'), (2, 'b'), (3, 'c');"
      await tick()

      engine.updateRow('t', { x: 2, y: 'b' }, { x: 2, y: 'updated' })
      expect(engine.code.value).toContain("'updated'")
      expect(engine.code.value).not.toContain("'b'")
      expect(engine.code.value).toContain("'a'")
      expect(engine.code.value).toContain("'c'")
    })

    it('should delete row from middle of multi-row INSERT', async () => {
      mockSuccess(fetchSpy, { tables: [] })
      const engine = useSqlEngine()
      await tick()

      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['x', 'y'],
            columnTypes: { x: 'INTEGER', y: 'TEXT' },
            data: [
              { x: 1, y: 'a' },
              { x: 3, y: 'c' }
            ]
          }
        ]
      })
      engine.code.value =
        "CREATE TABLE t (x INTEGER, y TEXT);\nINSERT INTO t (x, y) VALUES (1, 'a'), (2, 'b'), (3, 'c');"
      await tick()

      engine.deleteRow({ x: 2, y: 'b' }, 't')
      expect(engine.code.value).not.toContain("'b'")
      expect(engine.code.value).toContain("'a'")
      expect(engine.code.value).toContain("'c'")
    })

    it('should insert new row into existing INSERT', async () => {
      mockSuccess(fetchSpy, { tables: [] })
      const engine = useSqlEngine()
      await tick()

      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['x', 'y'],
            columnTypes: { x: 'INTEGER', y: 'TEXT' },
            data: [{ x: 1, y: 'a' }]
          }
        ]
      })
      engine.code.value = "CREATE TABLE t (x INTEGER, y TEXT);\nINSERT INTO t (x, y) VALUES (1, 'a');"
      await tick()

      const oldCode = engine.code.value
      engine.insertRowUI('t', { x: 2, y: 'b' })
      expect(engine.code.value).not.toBe(oldCode)
      expect(engine.code.value).toContain('2')
      expect(engine.code.value).toContain("'b'")
    })

    it('should match numeric values regardless of string representation', async () => {
      mockSuccess(fetchSpy, { tables: [] })
      const engine = useSqlEngine()
      await tick()

      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['id', 'val'],
            columnTypes: { id: 'INTEGER', val: 'REAL' },
            data: [{ id: 1, val: 100 }]
          }
        ]
      })
      engine.code.value = 'CREATE TABLE t (id INTEGER, val REAL);\nINSERT INTO t (id, val) VALUES (1, 100.0);'
      await tick()

      engine.updateRow('t', { id: 1, val: 100 }, { id: 1, val: 200 })
      expect(engine.code.value).toContain('200')
    })

    it('should handle NULL matching in tuples', async () => {
      mockSuccess(fetchSpy, { tables: [] })
      const engine = useSqlEngine()
      await tick()

      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 't',
            columns: ['id', 'name'],
            columnTypes: { id: 'INTEGER', name: 'TEXT' },
            data: [{ id: 1, name: null }]
          }
        ]
      })
      engine.code.value = 'CREATE TABLE t (id INTEGER, name TEXT);\nINSERT INTO t (id, name) VALUES (1, NULL);'
      await tick()

      engine.updateRow('t', { id: 1, name: null }, { id: 1, name: 'Bob' })
      expect(engine.code.value).toContain("'Bob'")
    })
  })

  // ============================================================
  //  Complex multi-statement scripts
  // ============================================================

  describe('Multi-statement scripts', () => {
    it('should handle full DDL+DML+DQL script', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 'employees',
            columns: ['id', 'name', 'salary'],
            columnTypes: { id: 'INTEGER', name: 'TEXT', salary: 'REAL' },
            data: [{ id: 1, name: 'Alice', salary: 7500 }]
          },
          {
            name: 'departments',
            columns: ['id', 'name'],
            columnTypes: { id: 'INTEGER', name: 'TEXT' },
            data: [{ id: 1, name: 'IT' }]
          }
        ],
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'total'],
            columnTypes: { name: 'TEXT', total: 'INTEGER' },
            data: [{ name: 'Alice', total: 7500 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

CREATE TABLE employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    salary REAL,
    dept_id INTEGER,
    FOREIGN KEY (dept_id) REFERENCES departments(id)
);

INSERT INTO departments (name) VALUES ('IT'), ('Sales'), ('HR');

INSERT INTO employees (name, salary, dept_id) VALUES
('Alice', 7500, 1),
('Bob', 5000, 2),
('Charlie', 9200, 1),
('David', 4800, 3);

SELECT e.name, d.name as dept
FROM employees e
JOIN departments d ON e.dept_id = d.id
WHERE e.salary > 5000
ORDER BY e.salary DESC;`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle script with mixed comment styles', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [{ x: 1 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = `/*
 * Initialize database
 * Author: dev
 */
-- Drop existing table
DROP TABLE IF EXISTS t;

-- Create new table
CREATE TABLE t (x INTEGER);  /* with comment */

-- Insert data
INSERT INTO t VALUES (1); -- test row

-- Query data
SELECT * FROM t;
`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].data.length).toBe(1)
    })
  })

  // ============================================================
  //  SQLite-specific features
  // ============================================================

  describe('SQLite-specific features', () => {
    it('should handle AUTOINCREMENT', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['id'], columnTypes: { id: 'INTEGER | PRIMARY KEY AUTOINCREMENT' }, data: [] }]
      })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT);'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].columnTypes.id).toContain('AUTOINCREMENT')
    })

    it('should handle CHECK constraint', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['age'], columnTypes: { age: 'INTEGER | CHECK' }, data: [] }]
      })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE TABLE t (age INTEGER CHECK(age > 0 AND age < 150));'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].columnTypes.age).toContain('CHECK')
    })

    it('should handle DEFAULT with expressions', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['created'], columnTypes: { created: 'TEXT | DEFAULT' }, data: [] }]
      })
      const engine = useSqlEngine()
      engine.code.value = "CREATE TABLE t (created TEXT DEFAULT (datetime('now')));"
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].columnTypes.created).toContain('DEFAULT')
    })

    it('should handle UNIQUE constraint', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['email'], columnTypes: { email: 'TEXT | UNIQUE' }, data: [] }]
      })
      const engine = useSqlEngine()
      engine.code.value = 'CREATE TABLE t (email TEXT UNIQUE);'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].columnTypes.email).toContain('UNIQUE')
    })

    it('should handle FOREIGN KEY', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['ref_id'], columnTypes: { ref_id: 'INTEGER' }, data: [] }],
        foreignKeys: [{ name: '', fromTable: 't', fromColumn: 'ref_id', toTable: 'parent', toColumn: 'id' }]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE t (
                ref_id INTEGER,
                FOREIGN KEY (ref_id) REFERENCES parent(id)
            );`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.foreignKeys).toHaveLength(1)
      expect(engine.db.foreignKeys[0].toTable).toBe('parent')
    })

    it('should handle PRAGMA statements', async () => {
      mockSuccess(fetchSpy, { tables: [] })
      const engine = useSqlEngine()
      engine.code.value = 'PRAGMA foreign_keys = ON;'
      await tick()
      expect(engine.executionError.value).toBeNull()
    })

    it('should handle VACUUM', async () => {
      mockSuccess(fetchSpy, { tables: [] })
      const engine = useSqlEngine()
      engine.code.value = 'VACUUM;'
      await tick()
      expect(engine.executionError.value).toBeNull()
    })

    it('should handle sqlite_master query', async () => {
      mockSuccess(fetchSpy, {
        tables: [],
        queryResults: [{ name: '查询结果', columns: ['name'], columnTypes: { name: 'TEXT' }, data: [{ name: 't' }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = "SELECT name FROM sqlite_master WHERE type='table';"
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.queryResults[0].data[0].name).toBe('t')
    })

    it('should handle date/time functions', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          {
            name: 'events',
            columns: ['id', 'created_at', 'event_date', 'event_time'],
            columnTypes: { id: 'INTEGER', created_at: 'TEXT', event_date: 'DATE', event_time: 'TIME' },
            data: []
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                created_at TEXT DEFAULT (datetime('now')),
                event_date DATE,
                event_time TIME
            );
            INSERT INTO events (event_date, event_time) VALUES (date('now'), time('now'));
            SELECT * FROM events WHERE created_at > datetime('now', '-7 days');`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].name).toBe('events')
    })

    it('should handle string functions', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['upper', 'lower', 'len', 'substr', 'replace', 'trim', 'full_title'],
            columnTypes: {
              upper: 'TEXT',
              lower: 'TEXT',
              len: 'INTEGER',
              substr: 'TEXT',
              replace: 'TEXT',
              trim: 'TEXT',
              full_title: 'TEXT'
            },
            data: []
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT
                UPPER(name),
                LOWER(email),
                LENGTH(description),
                SUBSTR(title, 1, 10),
                REPLACE(text, 'old', 'new'),
                TRIM(whitespace_col),
                name || ' - ' || title AS full_title
            FROM t;`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.queryResults[0].columns).toContain('full_title')
    })

    it('should handle math functions', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['abs', 'round', 'random', 'max', 'min'],
            columnTypes: { abs: 'INTEGER', round: 'REAL', random: 'INTEGER', max: 'INTEGER', min: 'INTEGER' },
            data: [{ abs: 42, round: 3.14, random: 123, max: 10, min: 1 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = 'SELECT ABS(x), ROUND(y, 2), RANDOM(), MAX(a, b), MIN(a, b) FROM t;'
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.queryResults[0].data[0].abs).toBe(42)
    })

    it('should handle trigger-like CONFLICT clause', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          { name: 't', columns: ['id', 'name'], columnTypes: { id: 'INTEGER | PRIMARY KEY', name: 'TEXT' }, data: [] }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE t (
                id INTEGER PRIMARY KEY ON CONFLICT REPLACE,
                name TEXT NOT NULL ON CONFLICT IGNORE
            );`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.tables[0].columns).toContain('name')
    })

    it('should handle WITH clause (CTE)', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'salary', 'avg_sal'],
            columnTypes: { name: 'TEXT', salary: 'REAL', avg_sal: 'REAL' },
            data: [{ name: 'Alice', salary: 9000, avg_sal: 7000 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `WITH dept_avg AS (
                SELECT dept_id, AVG(salary) AS avg_sal FROM employees GROUP BY dept_id
            )
            SELECT e.name, e.salary, d.avg_sal
            FROM employees e
            JOIN dept_avg d ON e.dept_id = d.dept_id
            WHERE e.salary > d.avg_sal;`
      await tick()
      expect(engine.db.queryResults[0].data[0].name).toBe('Alice')
    })

    it('should handle window functions (SQLite 3.25+)', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'salary', 'rank', 'dept_rank'],
            columnTypes: { name: 'TEXT', salary: 'REAL', rank: 'INTEGER', dept_rank: 'INTEGER' },
            data: [{ name: 'Alice', salary: 9000, rank: 1, dept_rank: 1 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT
                name,
                salary,
                ROW_NUMBER() OVER (ORDER BY salary DESC) AS rank,
                RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS dept_rank
            FROM employees;`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.queryResults[0].data[0].rank).toBe(1)
    })
  })

  // ============================================================
  //  Triggers (complex parsing)
  // ============================================================

  describe('Triggers', () => {
    it('should handle CREATE TRIGGER with BEGIN...END', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 'log', columns: ['msg'], columnTypes: { msg: 'TEXT' }, data: [] }],
        triggers: [
          {
            name: 'trg_test',
            tableName: 'log',
            sql: "CREATE TRIGGER trg_test AFTER INSERT ON log BEGIN INSERT INTO log (msg) VALUES ('trigger fired'); END"
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE log (msg TEXT);
CREATE TRIGGER trg_test AFTER INSERT ON log
BEGIN
    INSERT INTO log (msg) VALUES ('trigger fired');
END;`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.triggers).toHaveLength(1)
      expect(engine.db.triggers[0].name).toBe('trg_test')
    })

    it('should handle trigger with nested CASE...END', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['val'], columnTypes: { val: 'REAL' }, data: [] }],
        triggers: [{ name: 'trg_complex', tableName: 't', sql: 'CREATE TRIGGER trg_complex...' }]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE t (val REAL);
CREATE TRIGGER trg_complex BEFORE INSERT ON t
BEGIN
    UPDATE t SET val = CASE
        WHEN NEW.val IS NULL THEN 0
        ELSE NEW.val
    END;
END;`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.triggers).toHaveLength(1)
    })

    it('should handle trigger with WHEN condition', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['salary'], columnTypes: { salary: 'REAL' }, data: [] }],
        triggers: [{ name: 'trg_high', tableName: 't', sql: 'CREATE TRIGGER...' }]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE t (salary REAL);
CREATE TRIGGER trg_high AFTER INSERT ON t
WHEN NEW.salary > 10000
BEGIN
    INSERT INTO t (salary) VALUES (0);
END;`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.triggers[0].name).toBe('trg_high')
    })

    it('should handle UPDATE OF specific columns trigger', async () => {
      mockSuccess(fetchSpy, {
        tables: [{ name: 't', columns: ['name', 'salary'], columnTypes: { name: 'TEXT', salary: 'REAL' }, data: [] }],
        triggers: [{ name: 'trg_salary_change', tableName: 't', sql: 'CREATE TRIGGER...' }]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE t (name TEXT, salary REAL);
CREATE TRIGGER trg_salary_change AFTER UPDATE OF salary ON t
BEGIN
    INSERT INTO t (name, salary) VALUES (OLD.name, NEW.salary);
END;`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.triggers).toHaveLength(1)
    })

    it('should handle multiple triggers on same table', async () => {
      mockSuccess(fetchSpy, {
        tables: [
          { name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [] },
          { name: 'audit', columns: ['msg'], columnTypes: { msg: 'TEXT' }, data: [] }
        ],
        triggers: [
          { name: 'trg_ins', tableName: 't', sql: '...' },
          { name: 'trg_upd', tableName: 't', sql: '...' },
          { name: 'trg_del', tableName: 't', sql: '...' }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE t (x INTEGER);
CREATE TABLE audit (msg TEXT);
CREATE TRIGGER trg_ins AFTER INSERT ON t
BEGIN INSERT INTO audit (msg) VALUES ('insert'); END;
CREATE TRIGGER trg_upd AFTER UPDATE ON t
BEGIN INSERT INTO audit (msg) VALUES ('update'); END;
CREATE TRIGGER trg_del AFTER DELETE ON t
BEGIN INSERT INTO audit (msg) VALUES ('delete'); END;`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.triggers).toHaveLength(3)
    })
  })

  // ============================================================
  //  CTE / Recursive CTE
  // ============================================================

  describe('CTE and Recursive CTE', () => {
    it('should handle simple WITH clause', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [{ name: '查询结果', columns: ['n'], columnTypes: { n: 'INTEGER' }, data: [{ n: 1 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = `WITH cte AS (SELECT 1 AS n)
SELECT n FROM cte;`
      await tick()
      expect(engine.db.queryResults[0].data[0].n).toBe(1)
    })

    it('should handle chained CTEs', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [{ name: '查询结果', columns: ['y'], columnTypes: { y: 'INTEGER' }, data: [{ y: 2 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = `WITH
  a AS (SELECT 1 AS x),
  b AS (SELECT x * 2 AS y FROM a)
SELECT y FROM b;`
      await tick()
      expect(engine.db.queryResults[0].data[0].y).toBe(2)
    })

    it('should handle CTE with JOIN and aggregation', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'salary', 'avg_sal'],
            columnTypes: { name: 'TEXT', salary: 'REAL', avg_sal: 'REAL' },
            data: [{ name: 'Alice', salary: 9000, avg_sal: 7000 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `WITH dept_avg AS (
    SELECT dept_id, AVG(salary) AS avg_sal FROM employees GROUP BY dept_id
)
SELECT e.name, e.salary, d.avg_sal
FROM employees e JOIN dept_avg d ON e.dept_id = d.dept_id
WHERE e.salary > d.avg_sal;`
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(1)
    })

    it('should handle recursive CTE (number sequence)', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['n', 'square'],
            columnTypes: { n: 'INTEGER', square: 'INTEGER' },
            data: Array.from({ length: 10 }, (_, i) => ({ n: i + 1, square: (i + 1) ** 2 }))
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `WITH RECURSIVE seq(n) AS (
    SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 10
)
SELECT n, n * n AS square FROM seq;`
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(10)
    })

    it('should handle recursive CTE (Fibonacci)', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['n', 'fib_value'],
            columnTypes: { n: 'INTEGER', fib_value: 'INTEGER' },
            data: Array.from({ length: 11 }, (_, i) => ({ n: i, fib_value: i }))
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `WITH RECURSIVE fib(a, b, n) AS (
    SELECT 0, 1, 0
    UNION ALL
    SELECT b, a + b, n + 1 FROM fib WHERE n < 10
)
SELECT n, a AS fib_value FROM fib;`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.queryResults[0].data.length).toBeGreaterThan(0)
    })

    it('should handle recursive CTE (tree traversal)', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['id', 'name', 'path', 'level'],
            columnTypes: { id: 'INTEGER', name: 'TEXT', path: 'TEXT', level: 'INTEGER' },
            data: []
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `CREATE TABLE org (id INTEGER, name TEXT, parent_id INTEGER);
WITH RECURSIVE org_path(id, name, path, level) AS (
    SELECT id, name, name, 0 FROM org WHERE parent_id IS NULL
    UNION ALL
    SELECT t.id, t.name, op.path || ' > ' || t.name, op.level + 1
    FROM org t JOIN org_path op ON t.parent_id = op.id
)
SELECT * FROM org_path;`
      await tick()
      expect(engine.executionError.value).toBeNull()
    })
  })

  // ============================================================
  //  Set operations
  // ============================================================

  describe('Set operations', () => {
    it('should handle INTERSECT', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [{ name: '查询结果', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [{ x: 1 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT 1 AS x INTERSECT SELECT 1 AS x;`
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(1)
    })

    it('should handle EXCEPT', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [{ name: '查询结果', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [{ x: 1 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT 1 AS x EXCEPT SELECT 2 AS x;`
      await tick()
      expect(engine.db.queryResults[0].data).toHaveLength(1)
    })
  })

  // ============================================================
  //  UPSERT (ON CONFLICT)
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

  describe('NULL handling', () => {
    it('should handle COALESCE', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          { name: '查询结果', columns: ['val'], columnTypes: { val: 'TEXT' }, data: [{ val: 'fallback' }] }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT COALESCE(NULL, NULL, 'fallback') AS val;`
      await tick()
      expect(engine.db.queryResults[0].data[0].val).toBe('fallback')
    })

    it('should handle IFNULL', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [{ name: '查询结果', columns: ['val'], columnTypes: { val: 'TEXT' }, data: [{ val: 'default' }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT IFNULL(NULL, 'default') AS val;`
      await tick()
      expect(engine.db.queryResults[0].data[0].val).toBe('default')
    })

    it('should handle NULLIF', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['same', 'diff'],
            columnTypes: { same: 'INTEGER', diff: 'INTEGER' },
            data: [{ same: null, diff: 10 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT NULLIF(10, 10) AS same, NULLIF(10, 20) AS diff;`
      await tick()
      expect(engine.db.queryResults[0].data[0].same).toBeNull()
      expect(engine.db.queryResults[0].data[0].diff).toBe(10)
    })
  })

  // ============================================================
  //  Additional JOIN types
  // ============================================================

  describe('Additional JOIN types', () => {
    it('should handle SELF JOIN', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'colleague'],
            columnTypes: { name: 'TEXT', colleague: 'TEXT' },
            data: [{ name: 'Alice', colleague: 'Bob' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT e1.name, e2.name AS colleague
FROM employees e1 JOIN employees e2 ON e1.dept_id = e2.dept_id
WHERE e1.id != e2.id;`
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(1)
    })

    it('should handle NATURAL JOIN', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [{ name: '查询结果', columns: ['id'], columnTypes: { id: 'INTEGER' }, data: [{ id: 1 }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT * FROM a NATURAL JOIN b;`
      await tick()
      expect(engine.db.queryResults[0].data).toHaveLength(1)
    })
  })

  // ============================================================
  //  All window function variants
  // ============================================================

  describe('All window function variants', () => {
    it('should handle ROW_NUMBER, RANK, DENSE_RANK, NTILE', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'salary', 'rn', 'rk', 'dr', 'nt'],
            columnTypes: { name: 'TEXT', salary: 'REAL', rn: 'INTEGER', rk: 'INTEGER', dr: 'INTEGER', nt: 'INTEGER' },
            data: [{ name: 'Alice', salary: 9000, rn: 1, rk: 1, dr: 1, nt: 1 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT name, salary,
    ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn,
    RANK()       OVER (ORDER BY salary DESC) AS rk,
    DENSE_RANK() OVER (ORDER BY salary DESC) AS dr,
    NTILE(4)     OVER (ORDER BY salary DESC) AS nt
FROM employees;`
      await tick()
      expect(engine.db.queryResults[0].data[0].rn).toBe(1)
    })

    it('should handle LAG and LEAD', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'salary', 'prev', 'next'],
            columnTypes: { name: 'TEXT', salary: 'REAL', prev: 'REAL', next: 'REAL' },
            data: [{ name: 'Bob', salary: 7000, prev: 5000, next: 9000 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT name, salary,
    LAG(salary, 1, 0)  OVER (ORDER BY salary) AS prev,
    LEAD(salary, 1, 0) OVER (ORDER BY salary) AS next
FROM employees;`
      await tick()
      expect(engine.db.queryResults[0].data[0].prev).toBe(5000)
    })

    it('should handle FIRST_VALUE and LAST_VALUE', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'salary', 'highest', 'lowest'],
            columnTypes: { name: 'TEXT', salary: 'REAL', highest: 'TEXT', lowest: 'TEXT' },
            data: [{ name: 'Alice', salary: 9000, highest: 'Alice', lowest: 'Bob' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT name, salary,
    FIRST_VALUE(name) OVER (PARTITION BY dept_id ORDER BY salary DESC) AS highest,
    LAST_VALUE(name)  OVER (PARTITION BY dept_id ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS lowest
FROM employees;`
      await tick()
      expect(engine.db.queryResults[0].data[0].highest).toBe('Alice')
    })

    it('should handle CUME_DIST and PERCENT_RANK', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'salary', 'cd', 'pr'],
            columnTypes: { name: 'TEXT', salary: 'REAL', cd: 'REAL', pr: 'REAL' },
            data: [{ name: 'Alice', salary: 9000, cd: 1.0, pr: 1.0 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT name, salary,
    ROUND(CUME_DIST() OVER (ORDER BY salary), 3) AS cd,
    ROUND(PERCENT_RANK() OVER (ORDER BY salary), 3) AS pr
FROM employees;`
      await tick()
      expect(engine.executionError.value).toBeNull()
      expect(engine.db.queryResults[0].data[0].cd).toBeGreaterThan(0)
    })
  })

  // ============================================================
  //  String functions
  // ============================================================

  describe('String functions', () => {
    it('should handle basic string functions', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['u', 'l', 'len', 'sub', 'rep', 'tr', 'ltr', 'rtr', 'pos', 'concat'],
            columnTypes: {
              u: 'TEXT',
              l: 'TEXT',
              len: 'INTEGER',
              sub: 'TEXT',
              rep: 'TEXT',
              tr: 'TEXT',
              ltr: 'TEXT',
              rtr: 'TEXT',
              pos: 'INTEGER',
              concat: 'TEXT'
            },
            data: [
              {
                u: 'HELLO',
                l: 'world',
                len: 4,
                sub: 'hel',
                rep: 'a_b',
                tr: 'x',
                ltr: 'a',
                rtr: 'b',
                pos: 7,
                concat: 'AB'
              }
            ]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT
    UPPER('hello') AS u, LOWER('WORLD') AS l, LENGTH('test') AS len,
    SUBSTR('hello', 1, 3) AS sub, REPLACE('a-b', '-', '_') AS rep,
    TRIM('  x  ') AS tr, LTRIM('  a') AS ltr, RTRIM('b  ') AS rtr,
    INSTR('hello world', 'w') AS pos, 'A' || 'B' AS concat;`
      await tick()
      expect(engine.db.queryResults[0].data[0].u).toBe('HELLO')
    })

    it('should handle LIKE operator', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [{ name: '查询结果', columns: ['name'], columnTypes: { name: 'TEXT' }, data: [{ name: '张三' }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT * FROM t WHERE name LIKE '张%' OR name LIKE '李_';`
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(1)
    })

    it('should handle GLOB operator', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [{ name: '查询结果', columns: ['name'], columnTypes: { name: 'TEXT' }, data: [{ name: '张三' }] }]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT * FROM t WHERE name GLOB '[张李]*';`
      await tick()
      expect(engine.db.queryResults[0].data).toHaveLength(1)
    })
  })

  // ============================================================
  //  Date / time functions
  // ============================================================

  describe('Date / time functions', () => {
    it('should handle date and time functions', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['d', 't', 'dt', 'tomorrow', 'month_start', 'fmt', 'jd', 'ue'],
            columnTypes: {
              d: 'TEXT',
              t: 'TEXT',
              dt: 'TEXT',
              tomorrow: 'TEXT',
              month_start: 'TEXT',
              fmt: 'TEXT',
              jd: 'REAL',
              ue: 'INTEGER'
            },
            data: [
              {
                d: '2025-01-15',
                t: '10:30:00',
                dt: '2025-01-15 10:30:00',
                tomorrow: '2025-01-16',
                month_start: '2025-01-01',
                fmt: '2025-01-15',
                jd: 2460000.0,
                ue: 1700000000
              }
            ]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT
    date('now') AS d, time('now') AS t, datetime('now') AS dt,
    datetime('now', '+1 day') AS tomorrow,
    datetime('now', 'start of month') AS month_start,
    strftime('%Y-%m-%d', 'now') AS fmt,
    julianday('now') AS jd,
    unixepoch('now') AS ue;`
      await tick()
      expect(engine.db.queryResults[0].data[0].fmt).toBe('2025-01-15')
    })

    it('should handle date calculations', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['hire_date', 'days_employed'],
            columnTypes: { hire_date: 'TEXT', days_employed: 'REAL' },
            data: [{ hire_date: '2020-01-01', days_employed: 2000 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT
    hire_date,
    julianday('now') - julianday(hire_date) AS days_employed
FROM employees;`
      await tick()
      expect(engine.db.queryResults[0].data[0].days_employed).toBeGreaterThan(0)
    })
  })

  // ============================================================
  //  Math / aggregate extras
  // ============================================================

  describe('Math and aggregate extras', () => {
    it('should handle COUNT DISTINCT', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['dept_count'],
            columnTypes: { dept_count: 'INTEGER' },
            data: [{ dept_count: 3 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT COUNT(DISTINCT dept_id) AS dept_count FROM employees;`
      await tick()
      expect(engine.db.queryResults[0].data[0].dept_count).toBe(3)
    })

    it('should handle GROUP_CONCAT with ORDER BY', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['dept_id', 'members'],
            columnTypes: { dept_id: 'INTEGER', members: 'TEXT' },
            data: [{ dept_id: 1, members: 'Alice, Bob' }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT dept_id, GROUP_CONCAT(name, ', ') AS members
FROM employees GROUP BY dept_id;`
      await tick()
      expect(engine.db.queryResults[0].data[0].members).toBe('Alice, Bob')
    })

    it('should handle TOTAL', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          { name: '查询结果', columns: ['total'], columnTypes: { total: 'REAL' }, data: [{ total: 50000 }] }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT TOTAL(salary) FROM employees;`
      await tick()
      expect(engine.db.queryResults[0].data[0].total).toBe(50000)
    })

    it('should handle ABS and ROUND', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['a', 'r', 'rand'],
            columnTypes: { a: 'INTEGER', r: 'REAL', rand: 'INTEGER' },
            data: [{ a: 42, r: Math.PI, rand: 73 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT ABS(-42) AS a, ROUND(3.14159, 3) AS r, RANDOM() % 100 AS rand;`
      await tick()
      expect(engine.db.queryResults[0].data[0].a).toBe(42)
    })
  })

  // ============================================================
  //  DML extras
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

  describe('Subquery extras', () => {
    it('should handle scalar subquery in SELECT', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'salary', 'avg_all'],
            columnTypes: { name: 'TEXT', salary: 'REAL', avg_all: 'REAL' },
            data: [{ name: 'Alice', salary: 9000, avg_all: 7500 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT name, salary,
    (SELECT ROUND(AVG(salary), 2) FROM employees) AS avg_all
FROM employees;`
      await tick()
      expect(engine.db.queryResults[0].data[0].avg_all).toBe(7500)
    })

    it('should handle NOT IN subquery', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          { name: '查询结果', columns: ['name'], columnTypes: { name: 'TEXT' }, data: [{ name: 'Alice' }] }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT name FROM employees
WHERE id NOT IN (SELECT emp_id FROM projects);`
      await tick()
      expect(engine.db.queryResults[0].data.length).toBe(1)
    })

    it('should handle ALL / ANY subquery (using MAX as SQLite does not support ALL)', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'salary'],
            columnTypes: { name: 'TEXT', salary: 'REAL' },
            data: [{ name: 'Alice', salary: 9000 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT name, salary FROM employees
WHERE salary > (SELECT MAX(salary) FROM employees WHERE dept_id = 2);`
      await tick()
      expect(engine.db.queryResults[0].data[0].name).toBe('Alice')
    })

    it('should handle multi-column subquery', async () => {
      mockSuccess(fetchSpy, {
        queryResults: [
          {
            name: '查询结果',
            columns: ['name', 'dept_id', 'salary'],
            columnTypes: { name: 'TEXT', dept_id: 'INTEGER', salary: 'REAL' },
            data: [{ name: 'Alice', dept_id: 1, salary: 9000 }]
          }
        ]
      })
      const engine = useSqlEngine()
      engine.code.value = `SELECT name, dept_id, salary FROM employees
WHERE (dept_id, salary) IN (
    SELECT dept_id, MAX(salary) FROM employees GROUP BY dept_id
);`
      await tick()
      expect(engine.db.queryResults[0].data).toHaveLength(1)
    })
  })
})
