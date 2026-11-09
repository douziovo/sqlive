import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { IndexInfo } from '@/model/DatabaseTypes'
import IndexesTab from '@/components/visualizer/IndexesTab.vue'
import SortFilterToolbar from '@/components/SortFilterToolbar.vue'

const indexes: IndexInfo[] = [
    {
        name: 'idx_b_users',
        tableName: 'users',
        columns: ['name'],
        unique: false,
        sql: 'CREATE INDEX idx_b_users ON users(name)'
    },
    {
        name: 'idx_a_orders',
        tableName: 'orders',
        columns: ['oid', 'uid'],
        unique: true,
        sql: 'CREATE UNIQUE INDEX idx_a_orders ON orders(oid, uid)'
    }
]

function mountTab(props: Partial<{ indexes: IndexInfo[]; flashTarget: string | null }> = {}) {
    return mount(IndexesTab, {
        props: { indexes, flashTarget: null, ...props }
    })
}

describe('IndexesTab', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('renders the empty state when there are no indexes', () => {
        const wrapper = mountTab({ indexes: [] })
        expect(wrapper.text()).toContain('暂无索引')
        expect(wrapper.text()).toContain('CREATE INDEX')
    })

    it('emits navigate to the owning table when a card is clicked', async () => {
        const wrapper = mountTab()
        await wrapper.find('#index-idx_b_users').trigger('click')
        expect(wrapper.emitted('navigate')).toEqual([
            [{ tab: 'tables', targetId: 'table-users' }]
        ])
    })

    it('does not navigate when clicking the SQL preview (click.stop)', async () => {
        const wrapper = mountTab()
        await wrapper.find('#index-idx_a_orders pre').trigger('click')
        expect(wrapper.emitted('navigate')).toBeUndefined()
    })

    it('sorts by name, table, column count and unique flag', async () => {
        const wrapper = mountTab()
        const toolbar = wrapper.findComponent(SortFilterToolbar)
        const cardIds = () =>
            wrapper.findAll('[id^="index-"]').map((c) => c.attributes('id'))

        // name asc: idx_a_orders before idx_b_users
        toolbar.vm.$emit('toggle-sort', 'name')
        await nextTick()
        expect(cardIds()).toEqual(['index-idx_a_orders', 'index-idx_b_users'])
        // name desc flips
        toolbar.vm.$emit('toggle-sort', 'name')
        await nextTick()
        expect(cardIds()).toEqual(['index-idx_b_users', 'index-idx_a_orders'])

        // table: orders before users
        toolbar.vm.$emit('toggle-sort', 'table')
        await nextTick()
        expect(cardIds()[0]).toBe('index-idx_a_orders')

        // cols asc: the single-column index (1) sorts before the composite (2)
        toolbar.vm.$emit('toggle-sort', 'cols')
        await nextTick()
        expect(cardIds()[0]).toBe('index-idx_b_users')

        // unique: unique index first
        toolbar.vm.$emit('toggle-sort', 'unique')
        await nextTick()
        expect(cardIds()[0]).toBe('index-idx_a_orders')
    })

    it('filters by column name and shows the no-match state', async () => {
        const wrapper = mountTab()
        const input = wrapper.findComponent(SortFilterToolbar).find('input')
        await input.setValue('uid')
        await vi.advanceTimersByTimeAsync(250)
        expect(wrapper.findAll('[id^="index-"]').length).toBe(1)
        expect(wrapper.text()).toContain('idx_a_orders')

        await input.setValue('zzz')
        await vi.advanceTimersByTimeAsync(250)
        expect(wrapper.text()).toContain('无匹配的索引')
    })

    it('applies the flash animation class to the flashing card', () => {
        const wrapper = mountTab({ flashTarget: 'index-idx_b_users' })
        expect(wrapper.find('#index-idx_b_users').classes()).toContain('animate-flash')
    })
})
