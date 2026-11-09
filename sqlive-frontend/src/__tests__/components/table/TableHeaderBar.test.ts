import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { HighlightState, IndexInfo, TableSchema, TriggerInfo, ViewInfo } from '@/model/DatabaseTypes'
import TableHeaderBar from '@/components/table/TableHeaderBar.vue'
import { SQL_CONTEXT_KEY } from '@/model/injectionKeys'

const table: TableSchema = {
    name: 'users',
    columns: ['id'],
    columnTypes: { id: 'INTEGER' },
    data: [{ id: 1 }]
}

const indexes: IndexInfo[] = [
    { name: 'idx_a', tableName: 'users', columns: ['id'], unique: false, sql: '' },
    { name: 'idx_b', tableName: 'users', columns: ['id'], unique: false, sql: '' }
]
const triggers: TriggerInfo[] = [
    { name: 'trg_a', tableName: 'users', sql: '' },
    { name: 'trg_b', tableName: 'users', sql: '' }
]
const views: ViewInfo[] = [{ name: 'v_a', sql: '' }]

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

function mountBar(
    props: Record<string, unknown> = {},
    highlight: HighlightState = makeHighlight()
) {
    return mount(TableHeaderBar, {
        props: {
            table,
            tableIndexes: indexes,
            tableTriggers: triggers,
            tableViews: views,
            isFlashTarget: false,
            isAnimating: false,
            ...props
        },
        global: {
            provide: { [SQL_CONTEXT_KEY as symbol]: { highlight } }
        }
    })
}

describe('TableHeaderBar', () => {
    it('emits drop-table from the trash button', async () => {
        const wrapper = mountBar()
        await wrapper.find('button[title="删除表格"]').trigger('click')
        expect(wrapper.emitted('drop-table')).toEqual([['users']])
    })

    it('badge clicks navigate to indexes / triggers / views tabs', async () => {
        const wrapper = mountBar()
        const badges = wrapper.findAll('span.cursor-pointer')
        expect(badges.length).toBe(3)

        await badges[0].trigger('click') // 📇 index badge
        await badges[1].trigger('click') // ⚡ trigger badge
        await badges[2].trigger('click') // 👁 view badge
        expect(wrapper.emitted('navigate-tab')).toEqual([
            [{ tab: 'indexes' }],
            [{ tab: 'triggers' }],
            [{ tab: 'views' }]
        ])
    })

    it('badge hover emits badge-enter / badge-leave and clicks do not bubble', async () => {
        const wrapper = mountBar()
        const badge = wrapper.findAll('span.cursor-pointer')[1]
        await badge.trigger('mouseenter')
        expect(wrapper.emitted('badge-enter')).toHaveLength(1)
        await badge.trigger('mouseleave')
        expect(wrapper.emitted('badge-leave')).toHaveLength(1)
        // click.stop: no navigation leaked through the header itself
        await badge.trigger('click')
        expect(wrapper.emitted('badge-enter')).toHaveLength(1)
    })

    it('every badge reports hover enter and leave', async () => {
        const wrapper = mountBar()
        const badges = wrapper.findAll('span.cursor-pointer')
        for (const badge of badges) {
            await badge.trigger('mouseenter')
            await badge.trigger('mouseleave')
        }
        expect(wrapper.emitted('badge-enter')).toHaveLength(badges.length)
        expect(wrapper.emitted('badge-leave')).toHaveLength(badges.length)
    })

    it('shows the DDL highlight ring when the table is the active DDL target', () => {
        const wrapper = mountBar(
            {},
            makeHighlight({ actionType: 'ddl', activeTables: ['users'] })
        )
        expect(wrapper.find('.ring-2').classes()).toContain('text-purple-700')
    })

    it('shows the DML highlight ring for a non-DDL action on the table', () => {
        const wrapper = mountBar(
            {},
            makeHighlight({ actionType: 'insert', activeTables: ['users'] })
        )
        expect(wrapper.find('.ring-2').classes()).toContain('text-primary')
    })

    it('shows the flash animation while animating a DDL target table', () => {
        const wrapper = mountBar(
            { isAnimating: true },
            makeHighlight({ actionType: 'ddl', activeTables: ['users'] })
        )
        expect(wrapper.find('.animate-flash').exists()).toBe(true)
    })

    it('hides badges when the table has no indexes/triggers/views', () => {
        const wrapper = mountBar({
            tableIndexes: [],
            tableTriggers: [],
            tableViews: []
        })
        expect(wrapper.findAll('span.cursor-pointer').length).toBe(0)
    })
})
