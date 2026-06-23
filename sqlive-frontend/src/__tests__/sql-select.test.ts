import { afterEach, beforeEach, describe, expect, it, type vi } from 'vitest'
import { mockSuccess, type SqlEngineSetup, setupSqlEngine, teardownSqlEngine, tick } from './test-utils'

describe('SQL SELECT and query features', () => {
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
