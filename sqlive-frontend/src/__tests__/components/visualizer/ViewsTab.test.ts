import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { TableSchema, ViewInfo } from '@/model/DatabaseTypes'
import ViewsTab from '@/components/visualizer/ViewsTab.vue'
import SortFilterToolbar from '@/components/SortFilterToolbar.vue'

const views: ViewInfo[] = [
    { name: 'v_beta', sql: 'CREATE VIEW v_beta AS SELECT * FROM orders' },
    { name: 'v_alpha', sql: 'CREATE VIEW v_alpha AS SELECT * FROM users' }
]

const tables: TableSchema[] = [
    { name: 'users', columns: [], columnTypes: {}, data: [] },
    { name: 'orders', columns: [], columnTypes: {}, data: [] }
]

function mountTab(props: Partial<{ views: ViewInfo[]; tables: TableSchema[]; flashTarget: string | null }> = {}) {
    return mount(ViewsTab, {
        props: { views, tables, flashTarget: null, ...props }
    })
}

describe('ViewsTab', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('renders the empty state when there are no views', () => {
        const wrapper = mountTab({ views: [] })
        expect(wrapper.text()).toContain('暂无视图')
        expect(wrapper.text()).toContain('CREATE VIEW')
    })

    it('emits navigate with the table target when the SQL references a table', async () => {
        const wrapper = mountTab()
        await wrapper.find('#view-v_alpha').trigger('click')
        expect(wrapper.emitted('navigate')).toEqual([[{ tab: 'tables', targetId: 'table-users' }]])
    })

    it('falls back to a plain tables navigation when no table matches the SQL', async () => {
        const wrapper = mountTab({
            views: [{ name: 'v_none', sql: 'CREATE VIEW v_none AS SELECT 1' }],
            tables: []
        })
        await wrapper.find('#view-v_none').trigger('click')
        expect(wrapper.emitted('navigate')).toEqual([[{ tab: 'tables' }]])
    })

    it('treats a view without SQL as non-matching but still renders it', async () => {
        const wrapper = mountTab({
            views: [{ name: 'v_nosql', sql: '' }],
            tables: [tables[0]]
        })
        expect(wrapper.text()).toContain('v_nosql')
        await wrapper.find('#view-v_nosql').trigger('click')
        // Empty SQL contains nothing — plain navigation without a target id
        expect(wrapper.emitted('navigate')).toEqual([[{ tab: 'tables' }]])
    })

    it('does not navigate when clicking the SQL preview (click.stop)', async () => {
        const wrapper = mountTab()
        await wrapper.find('#view-v_beta pre').trigger('click')
        expect(wrapper.emitted('navigate')).toBeUndefined()
    })

    it('sorts views by name and filters on SQL text', async () => {
        const wrapper = mountTab()
        const toolbar = wrapper.findComponent(SortFilterToolbar)
        toolbar.vm.$emit('toggle-sort', 'name')
        await nextTick()
        const ids = wrapper.findAll('[id^="view-"]').map((c) => c.attributes('id'))
        expect(ids).toEqual(['view-v_alpha', 'view-v_beta'])

        await toolbar.find('input').setValue('orders')
        await vi.advanceTimersByTimeAsync(250)
        expect(wrapper.findAll('[id^="view-"]').length).toBe(1)
        expect(wrapper.text()).toContain('v_beta')

        await toolbar.find('input').setValue('zzz')
        await vi.advanceTimersByTimeAsync(250)
        expect(wrapper.text()).toContain('无匹配的视图')
    })

    it('applies the flash animation class to the flashing card', () => {
        const wrapper = mountTab({ flashTarget: 'view-v_alpha' })
        expect(wrapper.find('#view-v_alpha').classes()).toContain('animate-flash')
    })
})
