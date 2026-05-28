import type { EChartsOption } from 'echarts'

export interface ChartConfig {
  chartType: string
  labels: string[]
  datasets: { name: string; data: (number | null)[] }[]
  stacked: boolean
}

export interface DualAxisDecision {
  enabled: boolean
  leftIndices: number[]
  rightIndices: number[]
  leftAxisName: string
  rightAxisName: string
}

function getMagnitude(val: number): number {
  if (val === 0) return 0
  return Math.floor(Math.log10(Math.abs(val)))
}

function getMedian(vals: number[]): number {
  if (vals.length === 0) return 0
  const sorted = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function decideDualAxis(datasets: { name: string; data: (number | null)[] }[]): DualAxisDecision {
  if (datasets.length < 2) {
    return { enabled: false, leftIndices: [], rightIndices: [], leftAxisName: '', rightAxisName: '' }
  }

  const mags = datasets.map((ds, i) => {
    const nums = ds.data.filter((v) => v != null && !Number.isNaN(v)) as number[]
    return { index: i, name: ds.name, mag: getMagnitude(getMedian(nums)) }
  })
  mags.sort((a, b) => a.mag - b.mag)

  const gaps: number[] = []
  for (let i = 0; i < mags.length - 1; i++) {
    gaps.push(mags[i + 1].mag - mags[i].mag)
  }

  const maxGap = Math.max(...gaps)
  if (maxGap < 2) {
    return { enabled: false, leftIndices: [], rightIndices: [], leftAxisName: '', rightAxisName: '' }
  }

  // Tie-breaker: first occurrence of max gap
  const cutIdx = gaps.indexOf(maxGap) + 1
  const leftMags = mags.slice(0, cutIdx)
  const rightMags = mags.slice(cutIdx)

  if (leftMags.length === 0 || rightMags.length === 0) {
    return { enabled: false, leftIndices: [], rightIndices: [], leftAxisName: '', rightAxisName: '' }
  }

  function axisName(entries: typeof leftMags): string {
    if (entries.length === 1) return entries[0].name
    return ''
  }

  return {
    enabled: true,
    leftIndices: leftMags.map((m) => m.index),
    rightIndices: rightMags.map((m) => m.index),
    leftAxisName: axisName(leftMags),
    rightAxisName: axisName(rightMags)
  }
}

function echartType(type: string): string {
  switch (type) {
    case 'area':
      return 'line'
    case 'doughnut':
      return 'pie'
    default:
      return type
  }
}

function toEChartsData(data: (number | null)[]): (number | string)[] {
  return data.map((v) => (v == null || Number.isNaN(v) ? '-' : v))
}

const IS_CARTESIAN = new Set(['bar', 'line', 'area'])

export function buildEChartsOption(config: ChartConfig): EChartsOption {
  const { chartType, labels, datasets, stacked } = config
  const eType = echartType(chartType)
  const dualAxis = IS_CARTESIAN.has(chartType) ? decideDualAxis(datasets) : ({ enabled: false } as DualAxisDecision)

  if (chartType === 'radar') {
    const allVals: number[] = []
    for (const ds of datasets) {
      for (const v of ds.data) {
        if (v != null && !Number.isNaN(v)) allVals.push(v)
      }
    }
    const globalMax = allVals.length > 0 ? Math.max(...allVals) * 1.1 : 100
    const globalMin = allVals.length > 0 ? Math.min(...allVals) : 0

    const indicators = labels.map((label) => {
      const ind: Record<string, unknown> = { name: label, max: globalMax }
      if (globalMin < 0) {
        ind.min = globalMin * 1.1
      } else {
        ind.min = 0
      }
      return ind
    })

    return {
      radar: {
        indicator: indicators,
        center: ['50%', '50%'],
        radius: '70%'
      },
      tooltip: {},
      series: datasets.map((ds) => ({
        type: 'radar',
        name: ds.name,
        data: [{ value: ds.data.map((v) => (v == null || Number.isNaN(v) ? 0 : v)) }]
      }))
    }
  }

  if (chartType === 'pie' || chartType === 'doughnut') {
    const ds = datasets[0]
    return {
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: chartType === 'doughnut' ? ['40%', '70%'] : '70%',
          data: ds.data.map((v, i) => ({
            name: labels[i],
            value: v == null || Number.isNaN(v) ? 0 : v
          })),
          label: {
            show: true,
            position: 'outside',
            formatter: '{b}  {d}%'
          },
          labelLine: { show: true, length: 15, length2: 25 }
        }
      ]
    }
  }

  // Cartesian charts: bar, line, area
  const yAxis: EChartsOption['yAxis'] = dualAxis.enabled
    ? [
        { type: 'value', name: dualAxis.leftAxisName, alignTicks: true },
        { type: 'value', name: dualAxis.rightAxisName, alignTicks: true }
      ]
    : { type: 'value' }

  const series = datasets.map((ds, i) => {
    const isLeft = !dualAxis.enabled || dualAxis.leftIndices.includes(i)
    const isRight = dualAxis.enabled && dualAxis.rightIndices.includes(i)
    const stackName = stacked ? (dualAxis.enabled ? (isLeft ? 'stack-left' : 'stack-right') : 'stack-all') : undefined

    const s: Record<string, unknown> = {
      type: eType,
      name: isRight ? `${ds.name} (右轴)` : ds.name,
      data: toEChartsData(ds.data),
      yAxisIndex: isRight ? 1 : 0
    }
    if (stackName) s.stack = stackName
    if (chartType === 'area') s.areaStyle = {}
    return s
  })

  return {
    xAxis: { type: 'category', data: labels },
    yAxis,
    series: series as EChartsOption['series'],
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: dualAxis.enabled ? '8%' : '4%', containLabel: true }
  }
}
