import type {EChartsOption} from 'echarts'
import * as echarts from 'echarts'
import {onBeforeUnmount, onMounted, ref} from 'vue'
import {registerChartTheme, THEME_NAME} from './chartTheme'

registerChartTheme()

export function useECharts() {
    const containerRef = ref<HTMLDivElement | null>(null)
    let chartInstance: echarts.ECharts | null = null
    let resizeObserver: ResizeObserver | null = null
    let pendingOption: EChartsOption | null = null
    let mounted = false

    function initChart(dom: HTMLDivElement) {
        chartInstance = echarts.init(dom, THEME_NAME)

        let resizeTimer: ReturnType<typeof setTimeout> | null = null
        const resize = () => {
            if (resizeTimer) clearTimeout(resizeTimer)
            resizeTimer = setTimeout(() => {
                if (containerRef.value && containerRef.value.clientWidth > 0) {
                    chartInstance?.resize()
                }
            }, 100)
        }

        resizeObserver = new ResizeObserver(() => resize())
        resizeObserver.observe(dom)

        if (pendingOption) {
            chartInstance.setOption(pendingOption, {notMerge: true})
            pendingOption = null
        }
    }

    function render(option: EChartsOption) {
        if (chartInstance) {
            chartInstance.setOption(option, {notMerge: true})
            return
        }
        if (mounted && containerRef.value) {
            initChart(containerRef.value)
            chartInstance?.setOption(option, {notMerge: true})
            return
        }
        pendingOption = option
    }

    function dispose() {
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
            chartInstance?.setOption(pendingOption, {notMerge: true})
            pendingOption = null
        }
    })

    onBeforeUnmount(() => {
        if (resizeObserver && containerRef.value) {
            resizeObserver.unobserve(containerRef.value)
            resizeObserver.disconnect()
        }
        dispose()
    })

    return {containerRef, render, dispose, resize}
}
