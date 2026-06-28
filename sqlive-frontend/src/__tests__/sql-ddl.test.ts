import {afterEach, beforeEach, describe, expect, it, type vi} from 'vitest'
import {mockSuccess, setupSqlEngine, type SqlEngineSetup, teardownSqlEngine, tick} from './test-utils'

describe('SQL DDL statements', () => {
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
    describe('DDL — CREATE TABLE', () => {
        it('should handle basic CREATE TABLE', async () => {
            mockSuccess(fetchSpy, {tables: [{name: 't', columns: ['id'], columnTypes: {id: 'INTEGER'}, data: []}]})
            const engine = useSqlEngine()
            engine.code.value = 'CREATE TABLE t (id INTEGER);'
            await tick()
            expect(engine.db.tables[0].name).toBe('t')
        })

        it('should handle quoted table name', async () => {
            mockSuccess(fetchSpy, {tables: [{name: 'My Table', columns: ['x'], columnTypes: {x: 'INTEGER'}, data: []}]})
            const engine = useSqlEngine()
            engine.code.value = 'CREATE TABLE "My Table" (x INTEGER);'
            await tick()
            expect(engine.db.tables[0].name).toBe('My Table')
        })

        it('should handle IF NOT EXISTS', async () => {
            mockSuccess(fetchSpy, {tables: [{name: 't', columns: ['x'], columnTypes: {x: 'INTEGER'}, data: []}]})
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
            mockSuccess(fetchSpy, {tables: [{name: 'tmp_data', columns: ['x'], columnTypes: {x: 'INTEGER'}, data: []}]})
            const engine = useSqlEngine()
            engine.code.value = 'CREATE TEMP TABLE tmp_data (x INTEGER);'
            await tick()
            expect(engine.db.tables[0].name).toBe('tmp_data')
        })

        it('should handle CREATE TABLE AS SELECT', async () => {
            mockSuccess(fetchSpy, {tables: [{name: 'backup', columns: ['id'], columnTypes: {id: 'INTEGER'}, data: []}]})
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
                tables: [{name: 'employees', columns: ['id'], columnTypes: {id: 'INTEGER'}, data: [{id: 1}]}]
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
                        columnTypes: {id: 'INTEGER', email: 'TEXT | NOT NULL DEFAULT'},
                        data: [{id: 1, email: ''}]
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
            mockSuccess(fetchSpy, {tables: []})
            const engine = useSqlEngine()
            engine.code.value = 'DROP TABLE users;'
            await tick()
            expect(engine.executionError.value).toBeNull()
            expect(engine.db.tables).toHaveLength(0)
        })

        it('should handle DROP TABLE IF EXISTS', async () => {
            mockSuccess(fetchSpy, {tables: []})
            const engine = useSqlEngine()
            engine.code.value = 'DROP TABLE IF EXISTS users;'
            await tick()
            expect(engine.executionError.value).toBeNull()
        })

        it('should handle CREATE INDEX', async () => {
            mockSuccess(fetchSpy, {
                tables: [{name: 'users', columns: ['name'], columnTypes: {name: 'TEXT'}, data: []}],
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
                tables: [{name: 'users', columns: ['email'], columnTypes: {email: 'TEXT'}, data: []}],
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
                tables: [{name: 't', columns: ['a'], columnTypes: {a: 'INTEGER'}, data: []}],
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
                    {
                        name: 'employees',
                        columns: ['name', 'salary'],
                        columnTypes: {name: 'TEXT', salary: 'REAL'},
                        data: []
                    },
                    {
                        name: 'high_earners',
                        columns: ['name', 'salary'],
                        columnTypes: {name: 'TEXT', salary: 'REAL'},
                        data: []
                    }
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
            mockSuccess(fetchSpy, {tables: [], views: []})
            const engine = useSqlEngine()
            engine.code.value = 'DROP VIEW IF EXISTS high_earners;'
            await tick()
            expect(engine.executionError.value).toBeNull()
        })
    })

    // ============================================================
    //  DML — INSERT
    // ============================================================

    describe('SQLite-specific features', () => {
        it('should handle AUTOINCREMENT', async () => {
            mockSuccess(fetchSpy, {
                tables: [{
                    name: 't',
                    columns: ['id'],
                    columnTypes: {id: 'INTEGER | PRIMARY KEY AUTOINCREMENT'},
                    data: []
                }]
            })
            const engine = useSqlEngine()
            engine.code.value = 'CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT);'
            await tick()
            expect(engine.executionError.value).toBeNull()
            expect(engine.db.tables[0].columnTypes.id).toContain('AUTOINCREMENT')
        })

        it('should handle CHECK constraint', async () => {
            mockSuccess(fetchSpy, {
                tables: [{name: 't', columns: ['age'], columnTypes: {age: 'INTEGER | CHECK'}, data: []}]
            })
            const engine = useSqlEngine()
            engine.code.value = 'CREATE TABLE t (age INTEGER CHECK(age > 0 AND age < 150));'
            await tick()
            expect(engine.executionError.value).toBeNull()
            expect(engine.db.tables[0].columnTypes.age).toContain('CHECK')
        })

        it('should handle DEFAULT with expressions', async () => {
            mockSuccess(fetchSpy, {
                tables: [{name: 't', columns: ['created'], columnTypes: {created: 'TEXT | DEFAULT'}, data: []}]
            })
            const engine = useSqlEngine()
            engine.code.value = "CREATE TABLE t (created TEXT DEFAULT (datetime('now')));"
            await tick()
            expect(engine.executionError.value).toBeNull()
            expect(engine.db.tables[0].columnTypes.created).toContain('DEFAULT')
        })

        it('should handle UNIQUE constraint', async () => {
            mockSuccess(fetchSpy, {
                tables: [{name: 't', columns: ['email'], columnTypes: {email: 'TEXT | UNIQUE'}, data: []}]
            })
            const engine = useSqlEngine()
            engine.code.value = 'CREATE TABLE t (email TEXT UNIQUE);'
            await tick()
            expect(engine.executionError.value).toBeNull()
            expect(engine.db.tables[0].columnTypes.email).toContain('UNIQUE')
        })

        it('should handle FOREIGN KEY', async () => {
            mockSuccess(fetchSpy, {
                tables: [{name: 't', columns: ['ref_id'], columnTypes: {ref_id: 'INTEGER'}, data: []}],
                foreignKeys: [{name: '', fromTable: 't', fromColumn: 'ref_id', toTable: 'parent', toColumn: 'id'}]
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
            mockSuccess(fetchSpy, {tables: []})
            const engine = useSqlEngine()
            engine.code.value = 'PRAGMA foreign_keys = ON;'
            await tick()
            expect(engine.executionError.value).toBeNull()
        })

        it('should handle VACUUM', async () => {
            mockSuccess(fetchSpy, {tables: []})
            const engine = useSqlEngine()
            engine.code.value = 'VACUUM;'
            await tick()
            expect(engine.executionError.value).toBeNull()
        })

        it('should handle sqlite_master query', async () => {
            mockSuccess(fetchSpy, {
                tables: [],
                queryResults: [{name: '查询结果', columns: ['name'], columnTypes: {name: 'TEXT'}, data: [{name: 't'}]}]
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
                        columnTypes: {id: 'INTEGER', created_at: 'TEXT', event_date: 'DATE', event_time: 'TIME'},
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
                        columnTypes: {abs: 'INTEGER', round: 'REAL', random: 'INTEGER', max: 'INTEGER', min: 'INTEGER'},
                        data: [{abs: 42, round: 3.14, random: 123, max: 10, min: 1}]
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
                    {
                        name: 't',
                        columns: ['id', 'name'],
                        columnTypes: {id: 'INTEGER | PRIMARY KEY', name: 'TEXT'},
                        data: []
                    }
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
                        columnTypes: {name: 'TEXT', salary: 'REAL', rank: 'INTEGER', dept_rank: 'INTEGER'},
                        data: [{name: 'Alice', salary: 9000, rank: 1, dept_rank: 1}]
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

})
