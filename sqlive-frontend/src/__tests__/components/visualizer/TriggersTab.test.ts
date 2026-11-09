import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { TriggerInfo } from '@/model/DatabaseTypes'
import TriggersTab from '@/components/visualizer/TriggersTab.vue'
import SortFilterToolbar from '@/components/SortFilterToolbar.vue'

const triggers: TriggerInfo[] = [
    {
        name: 'trg_b',
        tableName: 'users',
        sql: 'CREATE TRIGGER trg_b AFTER INSERT ON users BEGIN SELECT 1; END'
    },
    {
        name: 'trg_a',
        tableName: 'orders',
        sql: 'CREATE TRIGGER trg_a BEFORE UPDATE ON orders BEGIN SELECT 2; END'
    }
]

function mountTab(props: Partial<{ triggers: TriggerInfo[]; flashTarget: string | null }> = {}) {
    return mount(TriggersTab, {
        props: { triggers, flashTarget: null, ...props }
    })
}

describe('TriggersTab', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('renders the empty state when there are no triggers', () => {
        const wrapper = mountTab({ triggers: [] })
        expect(wrapper.text()).toContain('暂无触发器')
        expect(wrapper.text()).toContain('CREATE TRIGGER')
    })

    it('emits navigate to the owning table when a card is clicked', async () => {
        const wrapper = mountTab()
        await wrapper.find('#trigger-trg_b').trigger('click')
        expect(wrapper.emitted('navigate')).toEqual([
            [{ tab: 'tables', targetId: 'table-users' }]
        ])
    })

    it('does not navigate when clicking the SQL preview (click.stop)', async () => {
        const wrapper = mountTab()
        await wrapper.find('#trigger-trg_a pre').trigger('click')
        expect(wrapper.emitted('navigate')).toBeUndefined()
    })

    it('sorts by name and by table name', async () => {
        const wrapper = mountTab()
        const toolbar = wrapper.findComponent(SortFilterToolbar)
        const ids = () => wrapper.findAll('[id^="trigger-"]').map((c) => c.attributes('id'))

        toolbar.vm.$emit('toggle-sort', 'name')
        await nextTick()
        expect(ids()).toEqual(['trigger-trg_a', 'trigger-trg_b'])

        toolbar.vm.$emit('toggle-sort', 'table')
        await nextTick()
        expect(ids()[0]).toBe('trigger-trg_a') // orders < users
    })

    it('filters on SQL text and shows the no-match state', async () => {
        const wrapper = mountTab()
        const input = wrapper.findComponent(SortFilterToolbar).find('input')
        await input.setValue('BEFORE')
        await vi.advanceTimersByTimeAsync(250)
        expect(wrapper.findAll('[id^="trigger-"]').length).toBe(1)
        expect(wrapper.text()).toContain('trg_a')

        await input.setValue('zzz')
        await vi.advanceTimersByTimeAsync(250)
        expect(wrapper.text()).toContain('无匹配的触发器')
    })

    it('handles a trigger without SQL', async () => {
        const wrapper = mountTab({ triggers: [{ name: 'trg_nosql', tableName: 'users', sql: '' }] })
        // The pre always renders; an empty SQL just shows no text
        expect(wrapper.find('pre').text()).toBe('')
        expect(wrapper.text()).toContain('trg_nosql')
    })
})
