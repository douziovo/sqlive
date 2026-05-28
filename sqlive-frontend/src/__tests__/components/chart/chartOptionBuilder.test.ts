import { describe, expect, it } from 'vitest'
import { buildEChartsOption, decideDualAxis } from '../../../components/chart/chartOptionBuilder'

describe('decideDualAxis', () => {
  it('returns disabled for single dataset', () => {
    const result = decideDualAxis([{ name: 'a', data: [1, 2, 3] }])
    expect(result.enabled).toBe(false)
  })

  it('returns disabled when magnitude gap < 2', () => {
    const result = decideDualAxis([
      { name: 'salary', data: [5000, 6000, 7000] },
      { name: 'bonus', data: [1000, 2000, 3000] }
    ])
    expect(result.enabled).toBe(false)
  })

  it('enables dual axis when magnitude gap >= 2', () => {
    const result = decideDualAxis([
      { name: 'age', data: [25, 30, 35] },
      { name: 'revenue', data: [1000000, 2000000, 3000000] }
    ])
    expect(result.enabled).toBe(true)
    expect(result.leftIndices).toContain(0)
    expect(result.rightIndices).toContain(1)
  })

  it('handles zero values safely', () => {
    const result = decideDualAxis([
      { name: 'all_zero', data: [0, 0, 0] },
      { name: 'revenue', data: [1000000, 2000000, 3000000] }
    ])
    expect(result.enabled).toBe(true)
  })

  it('handles null values in data', () => {
    const result = decideDualAxis([
      { name: 'age', data: [25, null, 35] },
      { name: 'revenue', data: [1000000, 2000000, null] }
    ])
    expect(result.enabled).toBe(true)
  })
})

describe('buildEChartsOption', () => {
  it('builds bar chart option', () => {
    const option = buildEChartsOption({
      chartType: 'bar',
      labels: ['Alice', 'Bob'],
      datasets: [{ name: 'salary', data: [100, 200] }],
      stacked: false
    })
    expect(option.xAxis).toBeDefined()
    expect(option.yAxis).toBeDefined()
    expect(option.series).toHaveLength(1)
    expect((option.series?.[0] as Record<string, unknown>).type).toBe('bar')
  })

  it('maps area to line type with areaStyle', () => {
    const option = buildEChartsOption({
      chartType: 'area',
      labels: ['A', 'B'],
      datasets: [{ name: 'x', data: [1, 2] }],
      stacked: false
    })
    const s = option.series?.[0] as Record<string, unknown>
    expect(s.type).toBe('line')
    expect(s.areaStyle).toBeDefined()
  })

  it('maps doughnut to pie type with radius', () => {
    const option = buildEChartsOption({
      chartType: 'doughnut',
      labels: ['A', 'B'],
      datasets: [{ name: 'x', data: [30, 70] }],
      stacked: false
    })
    const s = option.series?.[0] as Record<string, unknown>
    expect(s.type).toBe('pie')
    expect(s.radius).toEqual(['40%', '70%'])
  })

  it('builds radar option without xAxis/yAxis', () => {
    const option = buildEChartsOption({
      chartType: 'radar',
      labels: ['Jan', 'Feb'],
      datasets: [{ name: 'revenue', data: [100, 200] }],
      stacked: false
    })
    expect(option.radar).toBeDefined()
    expect(option.xAxis).toBeUndefined()
    expect(option.yAxis).toBeUndefined()
  })

  it('builds dual axis yAxis array', () => {
    const option = buildEChartsOption({
      chartType: 'bar',
      labels: ['A', 'B'],
      datasets: [
        { name: 'age', data: [25, 30] },
        { name: 'revenue', data: [1000000, 2000000] }
      ],
      stacked: false
    })
    expect(Array.isArray(option.yAxis)).toBe(true)
    const yArr = option.yAxis as Record<string, unknown>[]
    expect(yArr).toHaveLength(2)
    expect(yArr[0].type).toBe('value')
    expect(yArr[1].type).toBe('value')
  })

  it('maps null to dash string in series data', () => {
    const option = buildEChartsOption({
      chartType: 'line',
      labels: ['A', 'B', 'C'],
      datasets: [{ name: 'x', data: [1, null, 3] }],
      stacked: false
    })
    const data = (option.series?.[0] as Record<string, unknown>).data as (number | string)[]
    expect(data[1]).toBe('-')
  })

  it('adds stack name when stacked is true', () => {
    const option = buildEChartsOption({
      chartType: 'bar',
      labels: ['A', 'B'],
      datasets: [
        { name: 'x', data: [1, 2] },
        { name: 'y', data: [3, 4] }
      ],
      stacked: true
    })
    const s0 = option.series?.[0] as Record<string, unknown>
    expect(s0.stack).toBe('stack-all')
  })

  it('adds (右轴) suffix to right-axis series name', () => {
    const option = buildEChartsOption({
      chartType: 'bar',
      labels: ['A', 'B'],
      datasets: [
        { name: 'age', data: [25, 30] },
        { name: 'revenue', data: [1000000, 2000000] }
      ],
      stacked: false
    })
    const s0 = option.series?.[0] as Record<string, unknown>
    const s1 = option.series?.[1] as Record<string, unknown>
    expect(s1.name).toContain('(右轴)')
    expect(s1.yAxisIndex).toBe(1)
    expect(s0.yAxisIndex).toBe(0)
  })
})
