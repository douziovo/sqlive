import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { TableSchema } from '@/model/DatabaseTypes'

import ResultTable from '../../components/ResultTable.vue'

function makeResult(overrides: Partial<TableSchema> = {}): TableSchema {
    return {
        name: '查询结果 1',
        columns: ['id', 'name'],
        columnTypes: { id: 'INTEGER', name: 'TEXT' },
        data: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
            { id: 3, name: 'Cathy' }
        ],
        ...overrides
    }
}

describe('ResultTable', () => {
    it('renders result name', () => {
        const wrapper = mount(ResultTable, {
            props: { result: makeResult(), index: 0 }
        })
        expect(wrapper.text()).toContain('查询结果')
    })

    it('renders column count', () => {
        const wrapper = mount(ResultTable, {
            props: { result: makeResult(), index: 0 }
        })
        expect(wrapper.text()).toContain('2 列')
    })

    it('renders row count', () => {
        const wrapper = mount(ResultTable, {
            props: { result: makeResult(), index: 0 }
        })
        expect(wrapper.text()).toContain('3 行')
    })

    it('shows "查看图表" button when there are numeric columns', () => {
        const wrapper = mount(ResultTable, {
            props: {
                result: makeResult({
                    columns: ['id', 'name', 'salary'],
                    columnTypes: { id: 'INTEGER', name: 'TEXT', salary: 'REAL' },
                    data: [{ id: 1, name: 'Alice', salary: 9000 }]
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
                    columnTypes: { id: 'INTEGER', name: 'TEXT', salary: 'REAL' },
                    data: [{ id: 1, name: 'Alice', salary: 9000 }]
                }),
                index: 0
            },
            global: { stubs: { ChartView: true } }
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
            props: { result: makeResult(), index: 0 }
        })
        const filterInput = wrapper.find('input[placeholder="过滤..."]')
        expect(filterInput.exists()).toBe(true)
        expect(wrapper.find('table').exists()).toBe(true)
    })

    it('renders data rows', () => {
        const wrapper = mount(ResultTable, {
            props: { result: makeResult(), index: 0 }
        })
        // 3 data rows + 1 header row
        const rows = wrapper.findAll('tr')
        expect(rows.length).toBeGreaterThanOrEqual(3)
    })

    it('numbers the second result set for multi-statement queries', () => {
        const wrapper = mount(ResultTable, {
            props: { result: makeResult(), index: 1 }
        })
        expect(wrapper.text()).toContain('查询结果 2')
    })

    it('renders empty string for null/undefined cells', () => {
        const wrapper = mount(ResultTable, {
            props: {
                index: 0,
                result: makeResult({
                    data: [
                        { id: 1, name: null },
                        { id: null as unknown as number, name: undefined }
                    ]
                })
            }
        })
        const cells = wrapper.findAll('tbody td')
        expect(cells.length).toBe(4)
        // row1: id=1, name=null; row2: id=null, name=undefined
        expect(cells[0].text()).toBe('1')
        expect(cells[1].text()).toBe('')
        expect(cells[2].text()).toBe('')
        expect(cells[3].text()).toBe('')
    })
})

describe('ResultTable — sorting, filtering and pagination', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    function makePagedResult(): TableSchema {
        return {
            name: '查询结果 1',
            columns: ['id', 'name'],
            columnTypes: { id: 'INTEGER', name: 'TEXT' },
            data: Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `row${i + 1}` }))
        }
    }

    it('toggles sort asc → desc → off on header click', async () => {
        const wrapper = mount(ResultTable, {
            props: { result: makePagedResult(), index: 0 }
        })
        const idHeader = wrapper.findAll('th').find((th) => th.text().includes('id'))!
        expect(idHeader).toBeTruthy()

        // Default order ascending by DOM position (id 1..10)
        let firstRow = wrapper.find('tbody tr td')
        expect(firstRow.text()).toBe('1')

        await idHeader.trigger('click') // asc
        await nextTick()
        firstRow = wrapper.find('tbody tr td')
        expect(firstRow.text()).toBe('1')
        expect(idHeader.text()).toContain('▲')

        await idHeader.trigger('click') // desc
        await nextTick()
        firstRow = wrapper.find('tbody tr td')
        expect(firstRow.text()).toBe('25')
        expect(idHeader.text()).toContain('▼')

        await idHeader.trigger('click') // off
        await nextTick()
        firstRow = wrapper.find('tbody tr td')
        expect(firstRow.text()).toBe('1')
        expect(idHeader.text()).not.toContain('▲')
    })

    it('filters rows and shows the no-match row, then clears via the ✕ button', async () => {
        const wrapper = mount(ResultTable, {
            props: { result: makePagedResult(), index: 0 }
        })
        const filterInput = wrapper.find('input[placeholder="过滤..."]')
        await filterInput.setValue('row2')
        // useSortFilter debounces the filter for 200ms
        await vi.advanceTimersByTimeAsync(250)
        await nextTick()
        // row2, row20..row25 survive; matches stay in id order
        const ids = wrapper.findAll('tbody tr td:nth-child(1)').map((td) => td.text())
        expect(ids).toContain('2')
        expect(ids).toContain('25')
        expect(ids).not.toContain('1')

        await filterInput.setValue('zzz_no_match')
        await vi.advanceTimersByTimeAsync(250)
        await nextTick()
        expect(wrapper.text()).toContain('无匹配数据')

        // ✕ button only renders while filter text is non-empty
        const clearBtn = wrapper.findAll('button').find((b) => b.text().includes('✕'))
        expect(clearBtn).toBeTruthy()
        await clearBtn!.trigger('click')
        await vi.advanceTimersByTimeAsync(250)
        await nextTick()
        expect(wrapper.text()).not.toContain('无匹配数据')
        // Filter reset also returns the first full page
        expect(wrapper.find('tbody tr td').text()).toBe('1')
    })

    it('paginates: next/prev buttons, page-size select, and disabled states', async () => {
        const wrapper = mount(ResultTable, {
            props: { result: makePagedResult(), index: 0 }
        })
        expect(wrapper.text()).toContain('共 25 行')

        const prev = wrapper.findAll('button').find((b) => b.text().includes('上一页'))!
        const next = wrapper.findAll('button').find((b) => b.text().includes('下一页'))!
        expect(prev.attributes('disabled')).toBeDefined()
        expect(next.attributes('disabled')).toBeUndefined()

        await next.trigger('click')
        expect(wrapper.text()).toContain('2 / 3')
        expect(wrapper.find('tbody tr td').text()).toBe('11')
        expect(prev.attributes('disabled')).toBeUndefined()

        // Jump to last page → next disabled
        await next.trigger('click')
        await next.trigger('click')
        expect(wrapper.text()).toContain('3 / 3')
        expect(next.attributes('disabled')).toBeDefined()

        await prev.trigger('click')
        expect(wrapper.text()).toContain('2 / 3')

        // Back to page 1, then change page size to 100 → single page, bar hidden
        await prev.trigger('click')
        expect(wrapper.text()).toContain('1 / 3')
        const pageSizeSelect = wrapper.find('select')
        await pageSizeSelect.setValue('100')
        await nextTick()
        expect(wrapper.text()).not.toContain('上一页')
        expect(wrapper.findAll('tbody tr').length).toBe(25)
    })
})
