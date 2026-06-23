import { afterEach, beforeEach, describe, expect, it, type vi } from 'vitest'
import { mockSuccess, type SqlEngineSetup, setupSqlEngine, teardownSqlEngine, tick } from './test-utils'

describe('SQL functions and triggers', () => {
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

})
