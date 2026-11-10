import { mount } from '@vue/test-utils'
import * as echarts from 'echarts'
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'

import { useECharts } from '@/components/chart/useECharts'
import type { TableSchema } from '@/model/DatabaseTypes'

import ChartView from '../../components/ChartView.vue'

// Mock echarts: jsdom has no canvas support, so prevent ECharts from trying to init
vi.mock('echarts', () => {
    const mockInstance: Record<string, any> = {
        setOption: vi.fn(),
        resize: vi.fn(),
        dispose: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        clear: vi.fn(),
        isDisposed: vi.fn().mockReturnValue(false)
    }
    return {
        default: {
            init: vi.fn(() => mockInstance),
            dispose: vi.fn(),
            registerTheme: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn()
        },
        init: vi.fn(() => mockInstance),
        dispose: vi.fn(),
        registerTheme: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn()
    }
})

function makeResult(overrides: Partial<TableSchema> = {}): TableSchema {
    return {
        name: 'query_result',
        columns: ['name', 'salary', 'age'],
        columnTypes: { name: 'TEXT', salary: 'REAL', age: 'INTEGER' },
        data: [
            { name: 'Alice', salary: 9000, age: 30 },
            { name: 'Bob', salary: 7000, age: 25 },
            { name: 'Cathy', salary: 5000, age: 28 }
        ],
        ...overrides
    }
}

describe('ChartView', () => {
    it('debounces resize and releases the observer and timer on unmount', async () => {
        vi.useFakeTimers()
        let notifyResize = () => {}
        const disconnect = vi.fn()
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: () => void) {
                    notifyResize = callback
                }
                //noinspection JSUnusedGlobalSymbols -- ResizeObserver mock 形状：useECharts 在挂载时调用实例的 observe，静态分析看不到该调用
                observe() {}
                //noinspection JSUnusedGlobalSymbols -- 同上，disconnect 由 unmount 路径调用，并在下方 expect(disconnect) 断言中校验
                disconnect = disconnect
            }
        )
        const wrapper = mount({
            setup() {
                const chart = useECharts()
                chart.render({ series: [] })
                return () => h('div', { ref: chart.containerRef })
            }
        })
        try {
            await nextTick()
            const chart = vi.mocked(echarts.init).mock.results.at(-1)!.value
            expect(chart.setOption).toHaveBeenCalledExactlyOnceWith(
                { series: [] },
                { notMerge: true }
            )
            Object.defineProperty(wrapper.element, 'clientWidth', { value: 200 })
            notifyResize()
            vi.advanceTimersByTime(50)
            notifyResize()
            vi.advanceTimersByTime(99)
            expect(chart.resize).not.toHaveBeenCalled()
            vi.advanceTimersByTime(1)
            expect(chart.resize).toHaveBeenCalledOnce()
            notifyResize()
            wrapper.unmount()
            vi.advanceTimersByTime(200)
            expect(chart.resize).toHaveBeenCalledOnce()
            expect(chart.dispose).toHaveBeenCalledOnce()
            expect(disconnect).toHaveBeenCalled()
        } finally {
            wrapper.unmount()
            vi.unstubAllGlobals()
            vi.useRealTimers()
        }
    })

    it('renders chart type selector', () => {
        const wrapper = mount(ChartView, {
            props: { result: makeResult() }
        })
        const select = wrapper.find('select')
        expect(select.exists()).toBe(true)
        expect(wrapper.text()).toContain('柱状图')
        expect(wrapper.text()).toContain('折线图')
        expect(wrapper.text()).toContain('饼图')
    })

    it('shows message when fewer than 2 columns', () => {
        const wrapper = mount(ChartView, {
            props: {
                result: makeResult({
                    columns: ['name'],
                    columnTypes: { name: 'TEXT' },
                    data: [{ name: 'Alice' }]
                })
            }
        })
        expect(wrapper.text()).toContain('需要至少 2 列')
    })

    it('shows message when no numeric column', () => {
        const wrapper = mount(ChartView, {
            props: {
                result: makeResult({
                    columns: ['a', 'b'],
                    columnTypes: { a: 'TEXT', b: 'TEXT' },
                    data: [{ a: 'x', b: 'y' }]
                })
            }
        })
        expect(wrapper.text()).toContain('需要至少 1 个数值列')
    })

    it('renders chart container div when valid data present', () => {
        const wrapper = mount(ChartView, {
            props: { result: makeResult() }
        })
        const chartContainer = wrapper.find('.chart-container')
        expect(chartContainer.exists()).toBe(true)
    })

    it('renders label column select and numeric column checkboxes', async () => {
        const wrapper = mount(ChartView, {
            props: { result: makeResult() }
        })
        await nextTick()
        // Should have at least 2 selects: chart type + label column
        const selects = wrapper.findAll('select')
        expect(selects.length).toBeGreaterThanOrEqual(2)
        // Should have numeric column checkboxes
        const checkboxes = wrapper.findAll('input[type="checkbox"]')
        expect(checkboxes.length).toBeGreaterThan(0)
    })

    it('auto-selects first non-numeric column as label', async () => {
        const wrapper = mount(ChartView, {
            props: { result: makeResult() }
        })
        await nextTick()
        expect(wrapper.text()).toContain('标签列')
        expect(wrapper.text()).toContain('数值列')
    })

    it('changes chartType when pie is selected', async () => {
        const wrapper = mount(ChartView, {
            props: { result: makeResult() }
        })
        await nextTick()
        // chart type select is the first select
        const selects = wrapper.findAll('select')
        const chartTypeSelect = selects[0]
        await chartTypeSelect.setValue('pie')
        await nextTick()
        expect((chartTypeSelect.element as HTMLSelectElement).value).toBe('pie')
    })

    it('treats a column of null/empty values as non-numeric', () => {
        const wrapper = mount(ChartView, {
            props: {
                result: makeResult({
                    columns: ['name', 'empty'],
                    columnTypes: { name: 'TEXT', empty: 'TEXT' },
                    data: [
                        { name: 'Alice', empty: null },
                        { name: 'Bob', empty: '' }
                    ]
                })
            }
        })
        expect(wrapper.text()).toContain('需要至少 1 个数值列')
    })

    it('falls back to the first column as label when every column is numeric', async () => {
        const wrapper = mount(ChartView, {
            props: {
                result: makeResult({
                    columns: ['a', 'b'],
                    columnTypes: { a: 'INTEGER', b: 'REAL' },
                    data: [
                        { a: 1, b: 2 },
                        { a: 3, b: 4 }
                    ]
                })
            }
        })
        await nextTick()
        const labelSelect = wrapper.findAll('select')[1]
        expect((labelSelect.element as HTMLSelectElement).value).toBe('a')
    })

    it('checkbox click deselects and reselects a numeric column', async () => {
        const wrapper = mount(ChartView, { props: { result: makeResult() } })
        await nextTick()
        const checkbox = wrapper.find('input[type="checkbox"]') // salary
        expect((checkbox.element as HTMLInputElement).checked).toBe(true)

        await checkbox.setValue(false)
        expect((checkbox.element as HTMLInputElement).checked).toBe(false)

        await checkbox.setValue(true)
        expect((checkbox.element as HTMLInputElement).checked).toBe(true)
    })

    it('shows the stacked toggle only for bar/area charts with 2+ numeric columns', async () => {
        const wrapper = mount(ChartView, { props: { result: makeResult() } })
        await nextTick()
        // salary + age selected → toggle visible for bar
        expect(wrapper.find('input[type="checkbox"][value="salary"]').exists()).toBe(true)
        const stackedCheckbox = wrapper.findAll('input[type="checkbox"]').at(-1)
        expect(stackedCheckbox!.element.nextElementSibling?.textContent).toContain('堆叠')

        // pie → no stacked toggle
        const selects = wrapper.findAll('select')
        await selects[0].setValue('pie')
        await nextTick()
        expect(wrapper.text()).not.toContain('堆叠')
    })

    it('shows the pie single-column notice when several numeric columns are selected', async () => {
        const wrapper = mount(ChartView, { props: { result: makeResult() } })
        await nextTick()
        const selects = wrapper.findAll('select')
        await selects[0].setValue('doughnut')
        await nextTick()
        expect(wrapper.text()).toContain('饼图仅支持单数值列')
    })

    it('re-autoselects columns when the result columns change', async () => {
        const wrapper = mount(ChartView, { props: { result: makeResult() } })
        await nextTick()
        let labelSelect = wrapper.findAll('select')[1]
        expect((labelSelect.element as HTMLSelectElement).value).toBe('name')

        // New result with different columns — old label/numeric cols disappear
        await wrapper.setProps({
            result: makeResult({
                name: 'other',
                columns: ['city', 'temp'],
                columnTypes: { city: 'TEXT', temp: 'REAL' },
                data: [
                    { city: 'A', temp: 1 },
                    { city: 'B', temp: 2 }
                ]
            })
        })
        await nextTick()
        await nextTick()
        labelSelect = wrapper.findAll('select')[1]
        expect((labelSelect.element as HTMLSelectElement).value).toBe('city')
        const checkbox = wrapper.find('input[type="checkbox"]')
        expect(checkbox.attributes('value')).toBe('temp')
    })

    it('keeps selections that still exist when result columns change', async () => {
        const wrapper = mount(ChartView, { props: { result: makeResult() } })
        await nextTick()
        // drop only 'age' — name/salary remain valid
        await wrapper.setProps({
            result: makeResult({
                columns: ['name', 'salary'],
                columnTypes: { name: 'TEXT', salary: 'REAL' },
                data: [
                    { name: 'Alice', salary: 9000 },
                    { name: 'Bob', salary: 7000 }
                ]
            })
        })
        await nextTick()
        const labelSelect = wrapper.findAll('select')[1]
        expect((labelSelect.element as HTMLSelectElement).value).toBe('name')
        expect(wrapper.find('input[type="checkbox"]').attributes('value')).toBe('salary')
    })

    it('switching the label column re-renders with the new labels', async () => {
        const wrapper = mount(ChartView, { props: { result: makeResult() } })
        await nextTick()
        const labelSelect = wrapper.findAll('select')[1]
        expect((labelSelect.element as HTMLSelectElement).value).toBe('name')
        await labelSelect.setValue('salary')
        await nextTick()
        expect((labelSelect.element as HTMLSelectElement).value).toBe('salary')
    })

    it('toggling the stacked checkbox flips the stacked state', async () => {
        const wrapper = mount(ChartView, { props: { result: makeResult() } })
        await nextTick()
        const stackedCheckbox = wrapper.findAll('input[type="checkbox"]').at(-1)!
        expect((stackedCheckbox.element as HTMLInputElement).checked).toBe(false)
        await stackedCheckbox.setValue(true)
        expect((stackedCheckbox.element as HTMLInputElement).checked).toBe(true)
        await stackedCheckbox.setValue(false)
        expect((stackedCheckbox.element as HTMLInputElement).checked).toBe(false)
    })

    it('shows the empty-data notice when the result has no rows', () => {
        const wrapper = mount(ChartView, {
            props: {
                result: makeResult({
                    data: [],
                    columns: ['name', 'salary'],
                    columnTypes: { name: 'TEXT', salary: 'REAL' }
                })
            }
        })
        expect(wrapper.text()).toContain('暂无数据')
    })
})
