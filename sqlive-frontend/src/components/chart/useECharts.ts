import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useResizeObserver, useTimeoutFn } from '@vueuse/core'
import { registerChartTheme, THEME_NAME } from './chartTheme'

registerChartTheme()

export function useECharts() {
    const containerRef = ref<HTMLDivElement | null>(null)
    let chartInstance: echarts.ECharts | null = null
    let pendingOption: EChartsOption | null = null
    let mounted = false
    const { start: scheduleResize, stop: stopResize } = useTimeoutFn(resize, 100, {
        immediate: false
    })
    useResizeObserver(containerRef, () => scheduleResize())

    function initChart(dom: HTMLDivElement): echarts.ECharts {
        chartInstance = echarts.init(dom, THEME_NAME)

        if (pendingOption) {
            chartInstance.setOption(pendingOption, { notMerge: true })
            pendingOption = null
        }
        return chartInstance
    }

    function render(option: EChartsOption) {
        if (chartInstance) {
            chartInstance.setOption(option, { notMerge: true })
            return
        }
        if (mounted && containerRef.value) {
            initChart(containerRef.value).setOption(option, { notMerge: true })
            return
        }
        pendingOption = option
    }

    function dispose() {
        stopResize()
        chartInstance?.dispose()
        chartInstance = null
    }

    function resize() {
        if (containerRef.value && containerRef.value.clientWidth > 0) {
            chartInstance?.resize()
        }
    }

    onMounted(() => {
        mounted = true
        if (pendingOption && containerRef.value) {
            initChart(containerRef.value)
        }
    })

    onBeforeUnmount(dispose)

    return { containerRef, render, dispose, resize }
}
