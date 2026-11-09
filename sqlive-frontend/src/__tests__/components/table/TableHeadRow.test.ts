import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { HighlightState, TableSchema } from '@/model/DatabaseTypes'
import TableHeadRow from '@/components/table/TableHeadRow.vue'
import { SQL_CONTEXT_KEY } from '@/model/injectionKeys'

const table: TableSchema = {
    name: 'users',
    columns: ['id', 'name', 'note'],
    columnTypes: { id: 'INTEGER', name: 'TEXT', note: '' },
    data: []
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

function mountRow(
    props: Record<string, unknown> = {},
    highlight: HighlightState = makeHighlight()
) {
    return mount(TableHeadRow, {
        props: {
            table,
            columnIndexes: { id: ['idx_a', 'idx_b'] },
            sortColumn: null,
            sortDir: null,
            ...props
        },
        global: {
            provide: { [SQL_CONTEXT_KEY as symbol]: { highlight } }
        }
    })
}

describe('TableHeadRow', () => {
    it('emits toggle-sort when a header cell is clicked', async () => {
        const wrapper = mountRow()
        await wrapper.findAll('th')[1].trigger('click')
        expect(wrapper.emitted('toggle-sort')).toEqual([['name']])
    })

    it('shows asc/desc arrows next to the sorted column', async () => {
        const wrapper = mountRow({ sortColumn: 'name', sortDir: 'asc' })
        expect(wrapper.text()).toContain('▲')
        await wrapper.setProps({ sortDir: 'desc' })
        expect(wrapper.text()).toContain('▼')
        expect(wrapper.text()).not.toContain('▲')
    })

    it('falls back to "unknown" for a column without a type', () => {
        const wrapper = mountRow()
        const noteHeader = wrapper.findAll('th').find((th) => th.text().includes('note'))!
        expect(noteHeader.text()).toContain('unknown')
    })

    it('index badge: navigates on click and emits hover events', async () => {
        const wrapper = mountRow()
        const idHeader = wrapper.findAll('th')[0]
        const badge = idHeader.find('div.cursor-pointer')
        expect(badge.text()).toContain('2') // two indexes on id

        await badge.trigger('mouseenter')
        expect(wrapper.emitted('column-idx-enter')).toHaveLength(1)
        await badge.trigger('mouseleave')
        expect(wrapper.emitted('badge-leave')).toHaveLength(1)

        await badge.trigger('click')
        expect(wrapper.emitted('navigate-tab')).toEqual([[{ tab: 'indexes' }]])
        // click.stop must not also emit toggle-sort from the header cell
        expect(wrapper.emitted('toggle-sort')).toBeUndefined()
    })

    it('highlights active columns from the highlight state', () => {
        const wrapper = mountRow({}, makeHighlight({ activeColumns: ['name'] }))
        const nameHeader = wrapper.findAll('th')[1]
        expect(nameHeader.classes()).toContain('text-primary')
    })
})
