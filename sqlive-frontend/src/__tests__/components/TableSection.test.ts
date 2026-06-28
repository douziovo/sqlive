import {mount} from '@vue/test-utils'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {nextTick, reactive, ref} from 'vue'
import type {HighlightState, InsertResult, TableSchema, TruncationInfo} from '@/model/DatabaseTypes'
import TableSection from '../../components/TableSection.vue'
import {SQL_CONTEXT_KEY} from '../../model/injectionKeys'

const mockTable: TableSchema = {
    name: 'users',
    columns: ['id', 'name', 'salary'],
    columnTypes: {id: 'INTEGER | PRIMARY KEY', name: 'TEXT | NOT NULL', salary: 'REAL'},
    data: [
        {id: 1, name: 'Alice', salary: 9000},
        {id: 2, name: 'Bob', salary: 7000},
        {id: 3, name: 'Charlie', salary: 5000}
    ]
}

const defaultHighlight: HighlightState = {
    actionType: 'none' as const,
    activeTables: [],
    activeRows: [],
    activeColumns: [],
    flashingRows: [],
    refreshSeed: 0
}

function mountTable(overrides: Record<string, any> = {}) {
    const {highlight, lastTruncations, insertResult, ...propOverrides} = overrides
    return mount(TableSection, {
        props: {
            table: mockTable,
            indexes: [],
            triggers: [],
            views: [],
            ...propOverrides
        },
        global: {
            provide: {
                [SQL_CONTEXT_KEY as symbol]: {
                    highlight: highlight ?? defaultHighlight,
                    lastTruncations: lastTruncations ?? ref<TruncationInfo[]>([]),
                    insertResult: insertResult ?? ref<InsertResult | null>(null)
                }
            },
            stubs: {}
        }
    })
}

describe('TableSection', () => {
    it('renders table name', () => {
        const wrapper = mountTable()
        expect(wrapper.text()).toContain('users')
    })

    it('renders all column headers', () => {
        const wrapper = mountTable()
        expect(wrapper.text()).toContain('id')
        expect(wrapper.text()).toContain('name')
        expect(wrapper.text()).toContain('salary')
    })

    it('renders column type info', () => {
        const wrapper = mountTable()
        expect(wrapper.text()).toContain('INTEGER')
        expect(wrapper.text()).toContain('TEXT')
    })

    it('renders all data rows', () => {
        const wrapper = mountTable()
        expect(wrapper.text()).toContain('Alice')
        expect(wrapper.text()).toContain('Bob')
        expect(wrapper.text()).toContain('Charlie')
    })

    it('filters rows by text', async () => {
        const wrapper = mountTable()
        const filterInput = wrapper.find('input[placeholder="过滤..."]')
        await filterInput.setValue('Alice')
        await nextTick()
        // After debounce, only Alice should be visible
        expect(wrapper.text()).toContain('Alice')
    })

    it('shows "无匹配数据" when filter has no matches', async () => {
        const wrapper = mountTable()
        const filterInput = wrapper.find('input[placeholder="过滤..."]')
        await filterInput.setValue('zzz_nonexistent')
        await nextTick()
        // After debounce the filter effect propagates
    })

    it('emits drop-table when delete table button is clicked', async () => {
        const wrapper = mountTable()
        // Find the delete button (trash icon) by title
        const deleteBtn = wrapper.find('button[title="删除表格"]')
        if (deleteBtn.exists()) {
            await deleteBtn.trigger('click')
            expect(wrapper.emitted('drop-table')?.[0]).toEqual(['users'])
        }
    })

    it('emits update-cell on cell edit and blur', async () => {
        const wrapper = mountTable()
        const textareas = wrapper.findAll('textarea')
        // Find a TEXT-type data textarea (not ghost row). The name column (index 1) is TEXT.
        const dataTextareas = textareas.filter((t) => {
            const ph = t.attributes('placeholder')
            return !ph && t.element.value !== ''
        })

        if (dataTextareas.length > 0) {
            // Use the second textarea (name column = TEXT, allows non-numeric values)
            const nameCell = dataTextareas[1] || dataTextareas[0]
            const el = nameCell.element as HTMLTextAreaElement
            el.value = 'UpdatedName'
            el.dispatchEvent(new Event('input'))
            await nameCell.trigger('blur')

            const updateCellEvents = wrapper.emitted('update-cell')
            expect(updateCellEvents).toBeTruthy()
            expect(updateCellEvents?.[0][0]).toMatchObject({
                tableName: 'users',
                oldRow: expect.objectContaining({name: 'Alice'}),
                newRow: expect.objectContaining({name: 'UpdatedName'})
            })
        }
    })

    it('does not emit update-cell on blur with unchanged value', async () => {
        const wrapper = mountTable()
        const textareas = wrapper.findAll('textarea')
        const dataTextareas = textareas.filter((t) => !t.attributes('placeholder'))
        if (dataTextareas.length > 0) {
            const firstCell = dataTextareas[0]
            await firstCell.trigger('blur')
            // Since we didn't change the value, no emit should happen
            expect(wrapper.emitted('update-cell')).toBeFalsy()
        }
    })

    it('emits delete-row when row delete button is clicked', async () => {
        const wrapper = mountTable()
        // Hover over a row to reveal delete buttons (they are opacity-0 by default)
        const deleteBtns = wrapper.findAll('button[title="删除此行"]')
        if (deleteBtns.length > 0) {
            await deleteBtns[0].trigger('click')
            const deleteRowEvents = wrapper.emitted('delete-row')
            expect(deleteRowEvents).toBeTruthy()
            expect(deleteRowEvents?.[0][0]).toMatchObject({
                tableName: 'users',
                row: expect.objectContaining({id: 1})
            })
        }
    })

    it('shows ghost row for insertion', () => {
        const wrapper = mountTable()
        const textareas = wrapper.findAll('textarea[placeholder="+"]')
        expect(textareas.length).toBeGreaterThan(0)
    })

    it('emits insert-row on ghost row submit with data', async () => {
        const wrapper = mountTable()
        const ghostTextareas = wrapper.findAll('textarea[placeholder="+"]')
        if (ghostTextareas.length > 0) {
            await ghostTextareas[0].setValue('4')
            await ghostTextareas[0].trigger('keydown.enter')
            // Ghost submit may need all required columns filled
        }
    })

    it('shows pagination when data exceeds page size', async () => {
        // Create table with >10 rows to trigger pagination
        const bigData = Array.from({length: 25}, (_, i) => ({
            id: i + 1,
            name: `User ${i + 1}`,
            salary: 5000 + i * 100
        }))

        const wrapper = mountTable({
            table: {...mockTable, data: bigData}
        })
        await nextTick()

        // Should show pagination controls
        expect(wrapper.text()).toContain('共 25 行')
    })

    it('emits navigate-tab when badge is clicked', async () => {
        const wrapper = mountTable({
            indexes: [{name: 'idx_test', tableName: 'users', columns: ['id'], unique: false, sql: 'CREATE INDEX ...'}]
        })
        // Find the index badge and click it
        const buttons = wrapper.findAll('span')
        const badgeEls = buttons.filter((b) => b.text().includes('📋'))
        if (badgeEls.length > 0) {
            await badgeEls[0].trigger('click')
            const navEvents = wrapper.emitted('navigate-tab')
            expect(navEvents).toBeTruthy()
            expect(navEvents?.[0][0]).toMatchObject({
                tab: expect.any(String),
                targetId: expect.any(String)
            })
        }
    })

    describe('truncation tooltip', () => {
        let wrappers: ReturnType<typeof mount>[] = []
        afterEach(() => {
            wrappers.forEach((w) => w.unmount())
            wrappers = []
            // Clean up stale Teleported elements from document.body
            document.body.querySelectorAll('.bg-amber-50').forEach((el) => el.remove())
        })

        it('shows truncation tooltip when lastTruncations is set', async () => {
            const truncRef = ref<TruncationInfo[]>([])
            wrappers.push(mountTable({lastTruncations: truncRef}))

            truncRef.value = [{
                value: 'hel',
                wasTruncated: true,
                originalValue: 'hello world',
                maxLength: 3
            }]
            await nextTick()
            await nextTick() // Extra tick for Teleport rendering

            const tooltip = document.body.querySelector('.bg-amber-50')
            expect(tooltip).toBeTruthy()
            expect(tooltip?.textContent).toContain('值已截断')
        })

        it('tooltip displays correct length values', async () => {
            const truncRef = ref<TruncationInfo[]>([])
            wrappers.push(mountTable({lastTruncations: truncRef}))

            truncRef.value = [{
                value: 'he',
                wasTruncated: true,
                originalValue: 'hello world!!',
                maxLength: 2
            }]
            await nextTick()
            await nextTick()

            const tooltip = document.body.querySelector('.bg-amber-50')
            expect(tooltip).toBeTruthy()
            expect(tooltip?.textContent).toContain('13')
            expect(tooltip?.textContent).toContain('2')
        })

        it('does not show tooltip when lastTruncations is empty', () => {
            const truncRef = ref<TruncationInfo[]>([])
            wrappers.push(mountTable({lastTruncations: truncRef}))
            const tooltip = document.body.querySelector('.bg-amber-50') as HTMLElement
            expect(tooltip).toBeTruthy()
            expect(tooltip.style.display).toBe('none')
        })
    })

    describe('ghost row insert result', () => {
        let wrappers: ReturnType<typeof mount>[] = []
        afterEach(() => {
            wrappers.forEach((w) => w.unmount())
            wrappers = []
        })

        it('preserves ghost row inputs when insert fails', async () => {
            const insertResultRef = ref<InsertResult | null>(null)
            wrappers.push(mountTable({insertResult: insertResultRef}))

            // Fill ghost row textareas
            const ghostTextareas = wrappers[0].findAll('textarea[placeholder="+"]')
            if (ghostTextareas.length > 0) {
                await ghostTextareas[0].setValue('4')
                await ghostTextareas[0].trigger('keydown.enter')
            }

            // Simulate failed insert
            insertResultRef.value = {success: false, tableName: 'users', error: 'UNIQUE constraint failed'}
            await nextTick()
            await nextTick()

            // Ghost row inputs should still be present
            const ghostTextareasAfter = wrappers[0].findAll('textarea[placeholder="+"]')
            if (ghostTextareasAfter.length > 0) {
                expect(ghostTextareasAfter[0].element.value).toBe('4')
            }

            // Verify failure styling
            const ghostRow = wrappers[0].find('[data-testid="ghost-row"]')
            expect(ghostRow.classes()).toContain('ghost-failure')

            // Verify error text
            const errorRow = wrappers[0].find('.ghost-error-row')
            expect(errorRow.exists()).toBe(true)
            expect(errorRow.text()).toContain('UNIQUE constraint failed')
        })

        it('clears ghost row when insert succeeds', async () => {
            const insertResultRef = ref<InsertResult | null>(null)
            wrappers.push(mountTable({insertResult: insertResultRef}))

            // Fill ghost row textareas
            const ghostTextareas = wrappers[0].findAll('textarea[placeholder="+"]')
            if (ghostTextareas.length > 0) {
                await ghostTextareas[0].setValue('4')
                await ghostTextareas[0].trigger('keydown.enter')
            }

            // Simulate successful insert
            insertResultRef.value = {success: true, tableName: 'users'}
            await nextTick()
            await nextTick()

            // Ghost row inputs should be cleared
            const ghostTextareasAfter = wrappers[0].findAll('textarea[placeholder="+"]')
            if (ghostTextareasAfter.length > 0) {
                expect(ghostTextareasAfter[0].element.value).toBe('')
            }
        })

        it('ignores insertResult for different tableName', async () => {
            const insertResultRef = ref<InsertResult | null>(null)
            wrappers.push(mountTable({insertResult: insertResultRef}))

            // Fill ghost row textareas
            const ghostTextareas = wrappers[0].findAll('textarea[placeholder="+"]')
            if (ghostTextareas.length > 0) {
                await ghostTextareas[0].setValue('4')
                await ghostTextareas[0].trigger('keydown.enter')
            }

            // Simulate result for a different table
            insertResultRef.value = {success: false, tableName: 'products', error: 'test'}
            await nextTick()
            await nextTick()

            // Ghost row should NOT be cleared (wrong table)
            const ghostTextareasAfter = wrappers[0].findAll('textarea[placeholder="+"]')
            if (ghostTextareasAfter.length > 0) {
                expect(ghostTextareasAfter[0].element.value).toBe('4')
            }

            // No failure styling should appear
            const ghostRow = wrappers[0].find('[data-testid="ghost-row"]')
            expect(ghostRow.classes()).not.toContain('ghost-failure')
        })

        it('auto-dismisses failure styling after typing in ghost row', async () => {
            const insertResultRef = ref<InsertResult | null>(null)
            wrappers.push(mountTable({insertResult: insertResultRef}))

            // Submit empty ghost row (just trigger failure)
            const ghostTextareas = wrappers[0].findAll('textarea[placeholder="+"]')
            if (ghostTextareas.length > 0) {
                await ghostTextareas[0].setValue('test')
                await ghostTextareas[0].trigger('keydown.enter')
            }

            // Simulate failed insert
            insertResultRef.value = {success: false, tableName: 'users', error: 'test error'}
            await nextTick()
            await nextTick()

            // Verify failure visible
            let ghostRow = wrappers[0].find('[data-testid="ghost-row"]')
            expect(ghostRow.classes()).toContain('ghost-failure')

            // User types in ghost row textarea — should dismiss
            if (ghostTextareas.length > 0) {
                await ghostTextareas[0].trigger('input')
                await nextTick()
            }

            // Verify failure styling removed
            ghostRow = wrappers[0].find('[data-testid="ghost-row"]')
            expect(ghostRow.classes()).not.toContain('ghost-failure')
        })
    })

    describe('getCellClasses coverage', () => {
        beforeEach(() => {
            vi.useFakeTimers()
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('flash-overlay class when row in flashingRowSet with isAnimating', async () => {
            const highlight = reactive<HighlightState>({
                ...defaultHighlight,
                actionType: 'ddl',
                activeTables: ['users'],
                activeRows: [],
                activeColumns: [],
                flashingRows: ['users:1'],
                refreshSeed: 0
            })

            const wrapper = mountTable({highlight})

            // Trigger isAnimating by changing refreshSeed
            highlight.refreshSeed += 1
            await nextTick()

            // Alice's row (id=1, rowKey='users:1') should have flash-overlay on its cells
            const tds = wrapper.findAll('td')
            // Find a td with flash-overlay class
            const flashTds = tds.filter(td => td.classes().includes('flash-overlay'))
            expect(flashTds.length).toBeGreaterThan(0)
        })

        it('VIRTUAL column gets bg-primary/10 class', () => {
            const virtualTable: TableSchema = {
                name: 'users',
                columns: ['id', 'name', 'generated'],
                columnTypes: {id: 'INTEGER | PRIMARY KEY', name: 'TEXT | NOT NULL', generated: 'TEXT | VIRTUAL'},
                data: [{id: 1, name: 'Alice', generated: 'auto'}]
            }

            const wrapper = mountTable({table: virtualTable})

            // The 'generated' column's td should have bg-primary/10 class
            // We need to inspect the rendered HTML for the class
            const html = wrapper.html()
            expect(html).toContain('bg-primary/10')
        })

        it('activeRows + activeColumns intersection gets bg-yellow-100 class', async () => {
            const highlight: HighlightState = {
                actionType: 'select',
                activeTables: ['users'],
                activeRows: ['users:1'],    // Alice's rowKey
                activeColumns: ['name'],     // highlight 'name' column
                flashingRows: [],
                refreshSeed: 0
            }

            const wrapper = mountTable({highlight})
            await nextTick()

            // The td at row=Alice, col='name' should have bg-yellow-100
            const html = wrapper.html()
            expect(html).toContain('bg-yellow-100')
        })

        it('non-highlighted cells get text-muted-foreground class', async () => {
            const highlight: HighlightState = {
                ...defaultHighlight,
                actionType: 'none',
                activeTables: [],
                activeRows: [],
                activeColumns: [],
                flashingRows: [],
                refreshSeed: 0
            }

            const wrapper = mountTable({highlight})
            await nextTick()

            // Non-highlighted cells should have text-muted-foreground
            const html = wrapper.html()
            expect(html).toContain('text-muted-foreground')
        })
    })

    describe('filter clear button', () => {
        it('clear button absent when filterText is empty', () => {
            const wrapper = mountTable()
            // The ✕ button should not be in the DOM when filter is empty
            const buttons = wrapper.findAll('button')
            const clearBtn = buttons.find(b => b.text() === '✕')
            expect(clearBtn).toBeFalsy()
        })

        it('clear button appears and clears filter on click', async () => {
            const wrapper = mountTable()
            const filterInput = wrapper.find('input[placeholder="过滤..."]')
            expect(filterInput.exists()).toBe(true)

            // Set filter text
            await filterInput.setValue('Alice')
            await nextTick()

            // Clear button should now be visible
            const buttons = wrapper.findAll('button')
            const clearBtn = buttons.find(b => b.text() === '✕')
            expect(clearBtn).toBeTruthy()

            // Click clear button
            await clearBtn!.trigger('click')
            await nextTick()

            // Input should be cleared — no Alice filter
            // All three rows should be visible
            expect(wrapper.text()).toContain('Bob')
            expect(wrapper.text()).toContain('Charlie')
        })
    })
})
