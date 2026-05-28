import * as echarts from 'echarts'

export const THEME_NAME = 'sqlive-chart'

export const COLOR_PALETTE = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#6366f1',
  '#f43f5e',
  '#14b8a6',
  '#eab308',
  '#0ea5e9',
  '#ff6b6b',
  '#a78bfa'
]

let registered = false

export function registerChartTheme(): void {
  if (registered) return
  echarts.registerTheme(THEME_NAME, {
    color: COLOR_PALETTE,
    textStyle: { fontFamily: 'inherit' }
  })
  registered = true
}
