import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { TableSchema } from '@/model/DatabaseTypes'
import ErDiagram from '../../components/er/ErDiagram.vue'

const mockTables: TableSchema[] = [
    {
        name: 'users',
        columns: ['id', 'name', 'dept_id'],
        columnTypes: { id: 'INTEGER | PRIMARY KEY', name: 'TEXT | NOT NULL', dept_id: 'INTEGER' },
        data: []
    },
    {
        name: 'departments',
        columns: ['id', 'name'],
        columnTypes: { id: 'INTEGER | PRIMARY KEY', name: 'TEXT | UNIQUE' },
        data: []
    }
]

const stubs = {
    VueFlow: true,
    Background: true,
    MiniMap: true,
    ErTableNode: true
}

const fitView = vi.fn()
const setCenter = vi.fn()
const FlowStub = defineComponent({
    name: 'TestFlow',
    props: ['nodes', 'edges'],
    emits: ['pane-ready', 'node-double-click'],
    methods: { fitView, setCenter },
    template: '<div class="flow"><slot /></div>'
})
const SearchStub = defineComponent({
    name: 'TestSearch',
    props: ['modelValue', 'visible', 'matchCount', 'currentIndex', 'totalCount'],
    emits: ['update:modelValue', 'close', 'prev', 'next'],
    template: '<div />'
})

function mountInteractive(tables = mockTables) {
    fitView.mockClear()
    setCenter.mockClear()
    return mount(ErDiagram, {
        props: { tables, foreignKeys: [] },
        global: {
            stubs: { VueFlow: FlowStub, Background: true, MiniMap: true, ErSearchBar: SearchStub }
        }
    })
}

describe('ErDiagram', () => {
    it('shows empty state when no tables', () => {
        const wrapper = mount(ErDiagram, {
            props: { tables: [], foreignKeys: [] },
            global: { stubs }
        })

        expect(wrapper.text()).toContain('暂无数据表')
    })

    it('renders VueFlow area when tables exists', () => {
        const wrapper = mount(ErDiagram, {
            props: { tables: mockTables, foreignKeys: [] },
            global: { stubs }
        })

        // Should NOT show empty state
        expect(wrapper.text()).not.toContain('暂无数据表')
    })

    it('renders ErToolbar', () => {
        const wrapper = mount(ErDiagram, {
            props: { tables: mockTables, foreignKeys: [] },
            global: { stubs }
        })

        // Verifies the component mounts and includes ErToolbar stub
        expect(wrapper.findComponent({ name: 'ErToolbar' }).exists()).toBe(true)
    })

    it('renders ErSearchBar', () => {
        const wrapper = mount(ErDiagram, {
            props: { tables: mockTables, foreignKeys: [] },
            global: { stubs }
        })

        expect(wrapper.findComponent({ name: 'ErSearchBar' }).exists()).toBe(true)
    })

    it('handles empty foreignKeys gracefully', () => {
        const wrapper = mount(ErDiagram, {
            props: { tables: mockTables, foreignKeys: [] },
            global: { stubs }
        })

        // Should render without errors
        expect(wrapper.exists()).toBe(true)
    })

    it('handles foreignKeys with tables', () => {
        const wrapper = mount(ErDiagram, {
            props: {
                tables: mockTables,
                foreignKeys: [
                    {
                        name: 'fk_dept',
                        fromTable: 'users',
                        fromColumn: 'dept_id',
                        toTable: 'departments',
                        toColumn: 'id'
                    }
                ]
            },
            global: { stubs }
        })

        expect(wrapper.exists()).toBe(true)
    })

    it('lays out tables when the pane becomes ready and navigates on table double click', async () => {
        const wrapper = mountInteractive()
        const flow = wrapper.findComponent(FlowStub)

        flow.vm.$emit('pane-ready')
        await flushPromises()
        expect(flow.props('nodes')).toHaveLength(2)
        expect(fitView).toHaveBeenCalledWith({ duration: 300 })

        flow.vm.$emit('node-double-click', { node: { data: { tableName: 'users' } } })
        expect(wrapper.emitted('navigate-tab')?.[0]).toEqual([
            { tab: 'tables', targetId: 'table-users' }
        ])

        await wrapper.find('button[title="自动布局"]').trigger('click')
        await flushPromises()
        expect(fitView).toHaveBeenCalledTimes(2)
        await wrapper.find('button[title="适应视图"]').trigger('click')
        expect(fitView).toHaveBeenCalledTimes(3)

        await wrapper.find('button[title="切换小地图"]').trigger('click')
        expect(wrapper.findComponent({ name: 'MiniMap' }).exists()).toBe(true)
        wrapper.unmount()
    })

    it('searches visible tables with keyboard shortcut and cycles through matches', async () => {
        const wrapper = mountInteractive()
        Object.defineProperty(wrapper.element, 'offsetParent', { get: () => document.body })
        wrapper.findComponent(FlowStub).vm.$emit('pane-ready')
        await flushPromises()

        const shortcut = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, cancelable: true })
        document.dispatchEvent(shortcut)
        await nextTick()
        expect(shortcut.defaultPrevented).toBe(true)
        const search = wrapper.findComponent(SearchStub)
        expect(search.props('visible')).toBe(true)

        search.vm.$emit('update:modelValue', 'name')
        await flushPromises()
        expect(search.props('matchCount')).toBe(2)
        expect(search.props('currentIndex')).toBe(0)
        expect(flowNodes(wrapper).filter((n) => n.data.isActiveMatch)).toHaveLength(1)
        expect(setCenter).toHaveBeenCalledTimes(1)

        search.vm.$emit('next')
        await nextTick()
        expect(search.props('currentIndex')).toBe(1)
        expect(setCenter).toHaveBeenCalledTimes(2)
        search.vm.$emit('prev')
        await nextTick()
        expect(search.props('currentIndex')).toBe(0)

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
        await nextTick()
        expect(search.props('visible')).toBe(false)
        expect(search.props('modelValue')).toBe('')
        wrapper.unmount()
    })

    it('updates the diagram when tables appear after opening', async () => {
        const wrapper = mountInteractive([])
        expect(wrapper.text()).toContain('暂无数据表')

        await wrapper.setProps({ tables: mockTables })
        wrapper.findComponent(FlowStub).vm.$emit('pane-ready')
        await flushPromises()
        expect(flowNodes(wrapper)).toHaveLength(2)
        expect(fitView).toHaveBeenCalled()
        wrapper.unmount()
    })
})

function flowNodes(wrapper: ReturnType<typeof mountInteractive>) {
    return wrapper.findComponent(FlowStub).props('nodes') as Array<{
        data: { isActiveMatch?: boolean }
    }>
}
