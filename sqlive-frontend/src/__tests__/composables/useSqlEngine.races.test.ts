import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { jsonOk, setupSqlEngine, teardownSqlEngine, tick, type SqlEngineSetup } from '../test-utils'

const table = { name: 't', columns: ['id'], columnTypes: { id: 'INTEGER' }, data: [{ id: 1 }] }
const success = () => jsonOk({ data: { tables: [table] } })

describe('SQL request ownership and recovery', () => {
    let setup: SqlEngineSetup
    beforeEach(async () => {
        setup = await setupSqlEngine()
    })
    afterEach(teardownSqlEngine)

    it.each(['success', 'error', 'session'])(
        'ignores an old tab %s response before the next debounce fires',
        async (kind) => {
            let resolve!: (response: Response) => void
            setup.fetchSpy.mockImplementationOnce(
                () => new Promise<Response>((done) => (resolve = done))
            )
            const engine = setup.useSqlEngine()
            await tick()
            engine.addTab('second', 'SELECT 2;')
            const current = engine.tabs.value.find((tab) => tab.id === engine.activeTabId.value)!
            current.isModified = true

            resolve(
                Response.json(
                    kind === 'error'
                        ? { error: { message: 'old failure', line: 1 } }
                        : { data: { tables: [table] } },
                    { headers: kind === 'session' ? { 'X-Session-Recreated': 'true' } : {} }
                )
            )
            await tick(0)

            expect(setup.fetchSpy).toHaveBeenCalledTimes(1)
            expect(engine.code.value).toBe('SELECT 2;')
            expect(engine.db.tables).toEqual([])
            expect(engine.executionError.value).toBeNull()
            expect(engine.sessionRecreated.value).toBe(false)
            expect(current.isModified).toBe(true)
        }
    )

    it('ignores an old source response while new text is still being debounced', async () => {
        let resolve!: (response: Response) => void
        setup.fetchSpy.mockImplementationOnce(
            () => new Promise<Response>((done) => (resolve = done))
        )
        const engine = setup.useSqlEngine()
        await tick()
        engine.code.value = 'SELECT 99;'
        resolve(await success())
        await tick(0)

        expect(engine.db.tables).toEqual([])
        expect(engine.tabs.value[0].isModified).toBe(true)
    })

    it('cannot roll an old inline edit back into the next tab', async () => {
        setup.fetchSpy.mockImplementation(success)
        const engine = setup.useSqlEngine()
        engine.code.value = 'CREATE TABLE t(id INTEGER); INSERT INTO t VALUES (1);'
        await tick()
        let resolve!: (response: Response) => void
        setup.fetchSpy.mockImplementationOnce(
            () => new Promise<Response>((done) => (resolve = done))
        )
        engine.updateRow('t', { id: 1 }, { id: 2 })
        await tick(0)
        engine.addTab('second', 'SELECT 2;')
        resolve(Response.json({ error: { message: 'old constraint failure', line: 1 } }))
        await tick(0)

        expect(engine.code.value).toBe('SELECT 2;')
        expect(engine.executionError.value).toBeNull()
    })

    it.each(['network', 'malformed JSON'])(
        'rolls an insert back after %s and does not report a later success',
        async (failure) => {
            vi.spyOn(console, 'error').mockImplementation(() => {})
            setup.fetchSpy.mockImplementation(success)
            const engine = setup.useSqlEngine()
            const original = 'CREATE TABLE t(id INTEGER); INSERT INTO t VALUES (1);'
            engine.code.value = original
            await tick()
            if (failure === 'network') setup.fetchSpy.mockRejectedValueOnce(new Error('offline'))
            else setup.fetchSpy.mockResolvedValueOnce(new Response('<html>proxy error</html>'))

            engine.insertRowUI('t', { id: 2 })
            await tick(0)
            expect(engine.code.value).toBe(original)
            expect(engine.insertResult.value).toMatchObject({ success: false, tableName: 't' })
            expect(engine.isLoading.value).toBe(false)

            engine.code.value = 'SELECT 42;'
            await tick()
            expect(engine.insertResult.value?.success).toBe(false)
        }
    )

    it.each(['SQL', 'network'])(
        'preserves manual input after an inline edit is superseded and its successor has a %s error',
        async (failure) => {
            vi.spyOn(console, 'error').mockImplementation(() => {})
            setup.fetchSpy.mockImplementation(success)
            const engine = setup.useSqlEngine()
            engine.code.value = 'CREATE TABLE t(id INTEGER); INSERT INTO t VALUES (1);'
            await tick()

            let resolveOld!: (response: Response) => void
            setup.fetchSpy.mockImplementationOnce(
                () => new Promise<Response>((done) => (resolveOld = done))
            )
            engine.updateRow('t', { id: 1 }, { id: 2 })
            await tick(0)

            if (failure === 'SQL') {
                setup.fetchSpy.mockResolvedValueOnce(
                    Response.json({ error: { message: 'no such table: missing', line: 2 } })
                )
            } else setup.fetchSpy.mockRejectedValueOnce(new Error('offline'))
            const manualSource = `${engine.code.value}\nSELECT * FROM missing; -- user input`
            engine.code.value = manualSource
            await tick()

            expect(engine.code.value).toBe(manualSource)
            expect(engine.executionError.value).not.toBeNull()
            const currentError = engine.executionError.value
            resolveOld(Response.json({ error: { message: 'old edit failed', line: 1 } }))
            await tick(0)
            expect(engine.code.value).toBe(manualSource)
            expect(engine.executionError.value).toEqual(currentError)
        }
    )

    it('settles an interrupted insert without reporting a later manual execution as its success', async () => {
        setup.fetchSpy.mockImplementation(success)
        const engine = setup.useSqlEngine()
        engine.code.value = 'CREATE TABLE t(id INTEGER); INSERT INTO t VALUES (1);'
        await tick()
        let resolveOld!: (response: Response) => void
        setup.fetchSpy.mockImplementationOnce(
            () => new Promise<Response>((done) => (resolveOld = done))
        )
        engine.insertRowUI('t', { id: 2 })
        await tick(0)
        engine.code.value += '\nSELECT 42;'
        await tick()

        expect(engine.insertResult.value).toMatchObject({ success: false, tableName: 't' })
        resolveOld(await success())
        await tick(0)
        expect(engine.insertResult.value?.success).toBe(false)
        expect(engine.code.value).toContain('SELECT 42;')
    })

    it('cancels a pending request and debounce when its scope is disposed', async () => {
        setup.fetchSpy.mockImplementation(() => new Promise(() => {}))
        const scope = effectScope()
        const engine = scope.run(() => setup.useSqlEngine())!
        await tick()
        const signal = setup.fetchSpy.mock.calls[0][1].signal as AbortSignal
        engine.code.value = 'SELECT 2;'
        scope.stop()
        await tick()

        expect(signal.aborted).toBe(true)
        expect(setup.fetchSpy).toHaveBeenCalledTimes(1)
        expect(engine.isLoading.value).toBe(false)
    })

    it('keeps a valid active tab while closing the current tab synchronously', async () => {
        setup.fetchSpy.mockImplementation(success)
        const engine = setup.useSqlEngine()
        const first = engine.activeTabId.value
        engine.addTab('second', 'SELECT 2;')
        const second = engine.activeTabId.value
        expect(() => engine.closeTab(second)).not.toThrow()
        expect(engine.activeTabId.value).toBe(first)
        expect(() => engine.switchTab('missing')).not.toThrow()
        expect(engine.activeTabId.value).toBe(first)
        await tick()
    })
})
