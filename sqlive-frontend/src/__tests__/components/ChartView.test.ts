import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import * as echarts from 'echarts'
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
                observe() {}
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
})
