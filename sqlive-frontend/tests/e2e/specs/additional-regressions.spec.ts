import { expect, gotoApp, test } from '../fixtures/sql-editor.fixture'

test('edits and deletes the second generated-key row without changing the first', async ({
    page,
    sqlEditor
}) => {
    await gotoApp(page)
    const script =
        'CREATE TABLE duplicate_rows(id INTEGER PRIMARY KEY, name TEXT); ' +
        "INSERT INTO duplicate_rows(name) VALUES ('same'), ('same');"
    const initial = page.waitForResponse(
        (response) =>
            response.url().includes('/api/execute') &&
            response.request().postDataJSON()?.sql === script
    )
    await sqlEditor.setText(script)
    expect((await (await initial).json()).error).toBeFalsy()

    const rows = page.locator('#table-duplicate_rows tbody tr')
    const secondName = rows.nth(1).locator('td:nth-child(2) textarea')
    await expect(secondName).toHaveValue('same')
    const edited = page.waitForResponse(
        (response) =>
            response.url().includes('/api/execute') &&
            response.request().postDataJSON()?.sql.includes('UPDATE "duplicate_rows"')
    )
    await secondName.fill('changed')
    await secondName.press('Tab')
    expect((await (await edited).json()).error).toBeFalsy()
    await expect(rows.first().locator('td:nth-child(2) textarea')).toHaveValue('same')
    await expect(secondName).toHaveValue('changed')

    const deleted = page.waitForResponse(
        (response) =>
            response.url().includes('/api/execute') &&
            response.request().postDataJSON()?.sql.includes('DELETE FROM "duplicate_rows"')
    )
    await rows.nth(1).hover()
    await rows.nth(1).locator('button[title="删除此行"]').click()
    const result = await (await deleted).json()
    expect(result.error).toBeFalsy()
    expect(
        result.data.tables.find((table: { name: string }) => table.name === 'duplicate_rows').data
    ).toEqual([{ id: 1, name: 'same' }])
    await expect(rows).toHaveCount(2) // One data row and the insert row.
    await expect(rows.first().locator('td:nth-child(2) textarea')).toHaveValue('same')
})

test('executes writes after a trailing backslash string and a quoted semicolon', async ({
    page,
    sqlEditor
}) => {
    await gotoApp(page)
    const script = String.raw`
CREATE TABLE [semi;table](id INTEGER PRIMARY KEY, path TEXT);
INSERT INTO [semi;table] VALUES(1, 'C:\');
INSERT INTO [semi;table] VALUES(2, 'later');
SELECT COUNT(*) AS total FROM [semi;table];`.trim()
    const executed = page.waitForResponse(
        (response) =>
            response.url().includes('/api/execute') &&
            response.request().postDataJSON()?.sql === script
    )
    await sqlEditor.setText(script)
    const result = await (await executed).json()
    expect(result.error).toBeFalsy()
    expect(result.data.tables[0].data).toEqual([
        { id: 1, path: 'C:\\' },
        { id: 2, path: 'later' }
    ])
    expect(result.data.queryResults[0].data).toEqual([{ total: 2 }])
    await expect(page.locator('[id="table-semi;table"] tbody tr')).toHaveCount(3)
})

test('resets both main and TEMP objects before rebuilding the same TEMP table', async ({
    request
}, testInfo) => {
    const dbName = `temp_${testInfo.project.name}_${testInfo.workerIndex}_${Date.now()}`
    const execute = async (sql: string) => {
        const response = await request.post('/api/execute', {
            data: { sql, dbName, reset: true }
        })
        expect(response.ok()).toBe(true)
        return response.json()
    }
    const first = await execute(
        'CREATE TABLE scratch(id); INSERT INTO main.scratch VALUES(1); ' +
            'CREATE TEMP TABLE scratch(id); INSERT INTO scratch VALUES(9);'
    )
    expect(first.error).toBeFalsy()
    expect(first.data.tables[0].data).toEqual([{ id: 9 }])

    const cleared = await execute('SELECT * FROM scratch;')
    expect(cleared.error.message).toContain('no such table')

    const rebuilt = await execute(
        'CREATE TEMP TABLE scratch(id); INSERT INTO scratch VALUES(7); SELECT * FROM scratch;'
    )
    expect(rebuilt.error).toBeFalsy()
    expect(rebuilt.data.queryResults[0].data).toEqual([{ id: 7 }])
})
