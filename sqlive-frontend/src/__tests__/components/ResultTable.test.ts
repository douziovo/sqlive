import {mount} from '@vue/test-utils'
import {describe, expect, it} from 'vitest'
import type {TableSchema} from '@/model/DatabaseTypes'
import ResultTable from '../../components/ResultTable.vue'

function makeResult(overrides: Partial<TableSchema> = {}): TableSchema {
    return {
        name: '查询结果 1',
        columns: ['id', 'name'],
        columnTypes: {id: 'INTEGER', name: 'TEXT'},
        data: [
            {id: 1, name: 'Alice'},
            {id: 2, name: 'Bob'},
            {id: 3, name: 'Cathy'}
        ],
        ...overrides
    }
}

describe('ResultTable', () => {
    it('renders result name', () => {
        const wrapper = mount(ResultTable, {
            props: {result: makeResult(), index: 0}
        })
        expect(wrapper.text()).toContain('查询结果')
    })

    it('renders column count', () => {
        const wrapper = mount(ResultTable, {
            props: {result: makeResult(), index: 0}
        })
        expect(wrapper.text()).toContain('2 列')
    })

    it('renders row count', () => {
        const wrapper = mount(ResultTable, {
            props: {result: makeResult(), index: 0}
        })
        expect(wrapper.text()).toContain('3 行')
    })

    it('shows "查看图表" button when there are numeric columns', () => {
        const wrapper = mount(ResultTable, {
            props: {
                result: makeResult({
                    columns: ['id', 'name', 'salary'],
                    columnTypes: {id: 'INTEGER', name: 'TEXT', salary: 'REAL'},
                    data: [{id: 1, name: 'Alice', salary: 9000}]
                }),
                index: 0
            }
        })
        expect(wrapper.text()).toContain('查看图表')
    })

    it('toggles chart view on button click', async () => {
        const wrapper = mount(ResultTable, {
            props: {
                result: makeResult({
                    columns: ['id', 'name', 'salary'],
                    columnTypes: {id: 'INTEGER', name: 'TEXT', salary: 'REAL'},
                    data: [{id: 1, name: 'Alice', salary: 9000}]
                }),
                index: 0
            },
            global: {stubs: {ChartView: true}}
        })

        const buttons = wrapper.findAll('button')
        const chartBtn = buttons.find((b) => b.text().includes('查看图表'))
        expect(chartBtn).toBeTruthy()

        // Click to show chart
        await chartBtn?.trigger('click')
        expect(wrapper.text()).toContain('隐藏图表')

        // Click to hide
        await chartBtn?.trigger('click')
        expect(wrapper.text()).toContain('查看图表')
    })

    it('renders filter input and table', () => {
        const wrapper = mount(ResultTable, {
            props: {result: makeResult(), index: 0}
        })
        const filterInput = wrapper.find('input[placeholder="过滤..."]')
        expect(filterInput.exists()).toBe(true)
        expect(wrapper.find('table').exists()).toBe(true)
    })

    it('renders data rows', () => {
        const wrapper = mount(ResultTable, {
            props: {result: makeResult(), index: 0}
        })
        // 3 data rows + 1 header row
        const rows = wrapper.findAll('tr')
        expect(rows.length).toBeGreaterThanOrEqual(3)
    })
})
