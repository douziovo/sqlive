import {afterEach, beforeEach, describe, expect, it, type vi} from 'vitest'
import {mockSuccess, setupSqlEngine, type SqlEngineSetup, teardownSqlEngine, tick} from './test-utils'

describe('SQL parsing and CTE features', () => {
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
    describe('Parsing edge cases', () => {
        it('should handle semicolons inside single-quoted strings', async () => {
            mockSuccess(fetchSpy, {
                tables: [{name: 't', columns: ['x'], columnTypes: {x: 'TEXT'}, data: [{x: 'hello; world'}]}]
            })
            const engine = useSqlEngine()
            engine.code.value = "CREATE TABLE t (x TEXT);\nINSERT INTO t VALUES ('hello; world');\nSELECT * FROM t;"
            await tick()
            expect(engine.db.tables[0].data[0].x).toBe('hello; world')
        })

        it('should handle semicolons inside double-quoted identifiers', async () => {
            mockSuccess(fetchSpy, {tables: [{name: 't;est', columns: ['x'], columnTypes: {x: 'INTEGER'}, data: []}]})
            const engine = useSqlEngine()
            engine.code.value = 'CREATE TABLE "t;est" (x INTEGER);'
            await tick()
            expect(engine.db.tables[0].name).toBe('t;est')
        })

        it('should handle escaped single quotes', async () => {
            mockSuccess(fetchSpy, {
                tables: [{name: 't', columns: ['x'], columnTypes: {x: 'TEXT'}, data: [{x: "it's"}]}]
            })
            const engine = useSqlEngine()
            engine.code.value = "CREATE TABLE t (x TEXT);\nINSERT INTO t VALUES ('it''s');\nSELECT * FROM t;"
            await tick()
            expect(engine.db.tables[0].data[0].x).toBe("it's")
        })

        it('should handle -- line comments', async () => {
            mockSuccess(fetchSpy, {
                tables: [{name: 't', columns: ['x'], columnTypes: {x: 'INTEGER'}, data: [{x: 1}]}]
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
                tables: [{name: 't', columns: ['x'], columnTypes: {x: 'INTEGER'}, data: [{x: 1}]}]
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
            mockSuccess(fetchSpy, {tables: []})
            const engine = useSqlEngine()
            engine.code.value = ''
            await tick()
            expect(engine.executionError.value).toBeNull()
            expect(engine.db.tables.length).toBe(0)
        })

        it('should handle whitespace-only script', async () => {
            mockSuccess(fetchSpy, {tables: []})
            const engine = useSqlEngine()
            engine.code.value = '   \n  \n  '
            await tick()
            expect(engine.executionError.value).toBeNull()
        })

        it('should handle trailing semicolon', async () => {
            mockSuccess(fetchSpy, {tables: [{name: 't', columns: ['x'], columnTypes: {x: 'INTEGER'}, data: []}]})
            const engine = useSqlEngine()
            engine.code.value = 'CREATE TABLE t (x INTEGER);\n'
            await tick()
            expect(engine.db.tables.length).toBe(1)
        })

        it('should handle statement without trailing semicolon', async () => {
            mockSuccess(fetchSpy, {tables: [{name: 't', columns: ['x'], columnTypes: {x: 'INTEGER'}, data: []}]})
            const engine = useSqlEngine()
            engine.code.value = 'CREATE TABLE t (x INTEGER)'
            await tick()
            expect(engine.db.tables.length).toBe(1)
        })
    })

    // ============================================================
    //  Bidirectional sync — updateRow / deleteRow / insertRowUI
    // ============================================================

    describe('Multi-statement scripts', () => {
        it('should handle full DDL+DML+DQL script', async () => {
            mockSuccess(fetchSpy, {
                tables: [
                    {
                        name: 'employees',
                        columns: ['id', 'name', 'salary'],
                        columnTypes: {id: 'INTEGER', name: 'TEXT', salary: 'REAL'},
                        data: [{id: 1, name: 'Alice', salary: 7500}]
                    },
                    {
                        name: 'departments',
                        columns: ['id', 'name'],
                        columnTypes: {id: 'INTEGER', name: 'TEXT'},
                        data: [{id: 1, name: 'IT'}]
                    }
                ],
                queryResults: [
                    {
                        name: '查询结果',
                        columns: ['name', 'total'],
                        columnTypes: {name: 'TEXT', total: 'INTEGER'},
                        data: [{name: 'Alice', total: 7500}]
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
                tables: [{name: 't', columns: ['x'], columnTypes: {x: 'INTEGER'}, data: [{x: 1}]}]
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

    describe('CTE and Recursive CTE', () => {
        it('should handle simple WITH clause', async () => {
            mockSuccess(fetchSpy, {
                queryResults: [{name: '查询结果', columns: ['n'], columnTypes: {n: 'INTEGER'}, data: [{n: 1}]}]
            })
            const engine = useSqlEngine()
            engine.code.value = `WITH cte AS (SELECT 1 AS n)
SELECT n FROM cte;`
            await tick()
            expect(engine.db.queryResults[0].data[0].n).toBe(1)
        })

        it('should handle chained CTEs', async () => {
            mockSuccess(fetchSpy, {
                queryResults: [{name: '查询结果', columns: ['y'], columnTypes: {y: 'INTEGER'}, data: [{y: 2}]}]
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
                        columnTypes: {name: 'TEXT', salary: 'REAL', avg_sal: 'REAL'},
                        data: [{name: 'Alice', salary: 9000, avg_sal: 7000}]
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
                        columnTypes: {n: 'INTEGER', square: 'INTEGER'},
                        data: Array.from({length: 10}, (_, i) => ({n: i + 1, square: (i + 1) ** 2}))
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
                        columnTypes: {n: 'INTEGER', fib_value: 'INTEGER'},
                        data: Array.from({length: 11}, (_, i) => ({n: i, fib_value: i}))
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
                        columnTypes: {id: 'INTEGER', name: 'TEXT', path: 'TEXT', level: 'INTEGER'},
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

})
