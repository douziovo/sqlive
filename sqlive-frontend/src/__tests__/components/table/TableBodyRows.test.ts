import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { HighlightState, TableSchema } from '@/model/DatabaseTypes'
import TableBodyRows from '@/components/table/TableBodyRows.vue'
import { SQL_CONTEXT_KEY } from '@/model/injectionKeys'

const table: TableSchema = {
    name: 'users',
    columns: ['id', 'name', 'full_name'],
    columnTypes: {
        id: 'INTEGER',
        name: 'TEXT',
        full_name: 'TEXT GENERATED ALWAYS AS (name || \'!\') VIRTUAL'
    },
    data: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
    ]
}

function makeHighlight(overrides: Partial<HighlightState> = {}): HighlightState {
    return {
        actionType: 'none',
        activeTables: [],
        activeRows: [],
        activeColumns: [],
        flashingRows: [],
        refreshSeed: 0,
        ...overrides
    }
}

function mountBody(
    props: Record<string, unknown> = {},
    highlight: HighlightState = makeHighlight()
) {
    return mount(TableBodyRows, {
        props: {
            table,
            paginatedData: table.data,
            filterText: '',
            isAnimating: false,
            ...props
        },
        global: {
            provide: { [SQL_CONTEXT_KEY as symbol]: { highlight } }
        }
    })
}

describe('TableBodyRows', () => {
    it('renders a no-match row when the filter excludes everything', () => {
        const wrapper = mountBody({ paginatedData: [], filterText: 'zzz' })
        expect(wrapper.text()).toContain('无匹配数据')
    })

    it('emits delete-row with the row and table name', async () => {
        const wrapper = mountBody()
        await wrapper.find('button[title="删除此行"]').trigger('click')
        expect(wrapper.emitted('delete-row')?.[0][0]).toMatchObject({
            tableName: 'users',
            row: { id: 1 }
        })
    })

    it('blurs the textarea when Enter is pressed', async () => {
        const wrapper = mountBody()
        const textarea = wrapper.find('textarea')
        const blurSpy = vi.spyOn(textarea.element, 'blur')
        await textarea.trigger('keydown.enter')
        expect(blurSpy).toHaveBeenCalled()
    })

    it('emits update-cell when a cell is edited and blurred', async () => {
        const wrapper = mountBody()
        const nameTextarea = wrapper.findAll('textarea')[1] // name column
        await nameTextarea.setValue('Alicia')
        await nameTextarea.trigger('blur')
        expect(wrapper.emitted('update-cell')?.[0][0]).toMatchObject({
            tableName: 'users',
            newRow: { id: 1, name: 'Alicia' }
        })
    })

    it('rejects a non-numeric value in a numeric column', async () => {
        const wrapper = mountBody()
        const idTextarea = wrapper.find('textarea') // id column (INTEGER)
        await idTextarea.setValue('not-a-number')
        await idTextarea.trigger('blur')
        expect(wrapper.emitted('update-cell')).toBeUndefined()
    })

    it('marks VIRTUAL columns with the virtual style', () => {
        const wrapper = mountBody()
        const virtualCell = wrapper.findAll('td')[2]
        expect(virtualCell.classes()).toContain('bg-primary/10')
        expect(virtualCell.classes()).toContain('font-bold')
    })

    it('highlights the active row+column intersection', () => {
        const wrapper = mountBody(
            {},
            makeHighlight({
                activeRows: ['users:1'],
                activeColumns: ['name']
            })
        )
        const nameCell = wrapper.findAll('td')[1]
        expect(nameCell.find('textarea').classes()).toContain('text-black')
    })

    it('keys rows by _highlightId when the row has no id', () => {
        const wrapper = mountBody({
            paginatedData: [{ _highlightId: 'x1', name: 'NoId' }]
        })
        expect(wrapper.text()).toContain('NoId')
    })

    it('shows the flash overlay while animating a flashing row', () => {
        const wrapper = mountBody(
            { isAnimating: true },
            makeHighlight({ flashingRows: ['users:1'] })
        )
        expect(wrapper.findAll('td')[0].classes()).toContain('flash-overlay')
    })
})
