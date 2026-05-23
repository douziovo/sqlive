import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockSuccess, mockError, tick, setupSqlEngine, teardownSqlEngine } from './test-utils';

describe('Error display with multiple statements', () => {
    let useSqlEngine: any;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        const setup = await setupSqlEngine();
        useSqlEngine = setup.useSqlEngine;
        fetchSpy = setup.fetchSpy;
    });

    afterEach(() => {
        teardownSqlEngine();
    });

    it('should show error from 2nd CREATE TABLE', async () => {
        mockSuccess(fetchSpy, { tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [] }] });
        const engine = useSqlEngine();
        await tick();

        mockError(fetchSpy, 'near "BAD": syntax error', 5);
        engine.code.value = `CREATE TABLE a (id INTEGER);
CREATE TABLE b (name TEXT);

CREATE TABLE c (id BAD_TYPE);
`;
        await tick();

        expect(engine.executionError.value).toBeTruthy();
        expect(engine.executionError.value.line).toBe(5);
    });

    it('should show error from middle statement in multi-CREATE script', async () => {
        mockSuccess(fetchSpy, { tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [] }] });
        const engine = useSqlEngine();
        await tick();

        mockError(fetchSpy, 'table already exists', 3);
        engine.code.value = `CREATE TABLE t (x INTEGER);
CREATE TABLE t (y TEXT);
CREATE TABLE u (z INTEGER);`;
        await tick();

        expect(engine.executionError.value).toBeTruthy();
        expect(engine.executionError.value.message).toContain('table');
    });

    it('should keep error visible while user continues typing', async () => {
        mockSuccess(fetchSpy, { tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [] }] });
        const engine = useSqlEngine();
        await tick();

        mockError(fetchSpy, 'syntax error', 1);
        engine.code.value = 'BROKEN;';
        await tick();
        expect(engine.executionError.value).toBeTruthy();

        engine.code.value = 'BROKEN;\n-- fixing';
        await vi.advanceTimersByTimeAsync(500);
        expect(engine.executionError.value).toBeTruthy();
    });

    it('should clear error only after successful re-execution', async () => {
        mockSuccess(fetchSpy, { tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [] }] });
        const engine = useSqlEngine();
        await tick();

        mockError(fetchSpy, 'syntax error near X', 1);
        engine.code.value = 'BROKEN;';
        await tick();
        expect(engine.executionError.value).toBeTruthy();

        mockSuccess(fetchSpy, { tables: [{ name: 't', columns: ['x'], columnTypes: { x: 'INTEGER' }, data: [] }] });
        engine.code.value = 'CREATE TABLE t (x INTEGER); SELECT * FROM t;';
        await tick();
        expect(engine.executionError.value).toBeNull();
    });

    it('should not clear error during rollback cycle', async () => {
        mockSuccess(fetchSpy, {
            tables: [{
                name: 't', columns: ['id', 'name'],
                columnTypes: { id: 'INTEGER', name: 'TEXT' },
                data: [{ id: 1, name: 'Alice' }]
            }]
        });
        const engine = useSqlEngine();
        await tick();

        const savedCode = engine.code.value;

        mockError(fetchSpy, 'CHECK constraint failed', 2);
        engine.insertRowUI('t', { id: 3, name: null });

        await tick();

        expect(engine.code.value).toBe(savedCode);
        expect(engine.executionError.value).not.toBeNull();
        expect(engine.executionError.value.message).toContain('CHECK');
    });
});
