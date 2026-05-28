<template>
  <div class="border border-border rounded-lg bg-card p-4">
    <div class="flex items-center justify-between mb-3">
      <div class="text-sm font-bold text-secondary-foreground">&#x1F4CA; 图表：{{ result.name }}</div>
      <select
        v-model="chartType"
        class="text-xs border border-border rounded px-2 py-1 bg-card outline-none"
      >
        <option value="bar">柱状图</option>
        <option value="line">折线图</option>
        <option value="pie">饼图</option>
        <option value="doughnut">环形图</option>
        <option value="area">面积图</option>
        <option value="radar">雷达图</option>
      </select>
    </div>

    <div v-if="result.columns.length < 2" class="text-sm text-muted-foreground/70 text-center py-8">
      需要至少 2 列才能生成图表（1 个标签列 + 1 个数值列）
    </div>

    <div v-else-if="!hasNumericCol" class="text-sm text-muted-foreground/70 text-center py-8">
      需要至少 1 个数值列来生成图表
    </div>

    <div v-else-if="result.data.length === 0" class="text-sm text-muted-foreground/70 text-center py-8">
      暂无数据
    </div>

    <div v-else-if="!labelCol || selectedNumCols.length === 0" class="text-sm text-muted-foreground/70 text-center py-8">
      无法自动识别标签列和数值列
    </div>

    <div v-else class="flex flex-col gap-4">
      <!-- Controls -->
      <div class="flex items-center gap-4 text-xs flex-wrap">
        <div class="flex items-center gap-1">
          <span class="text-muted-foreground">标签列:</span>
          <select v-model="labelCol" class="border border-border rounded px-2 py-1 bg-card outline-none">
            <option v-for="c in result.columns" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-muted-foreground">数值列:</span>
          <div class="flex items-center gap-2 flex-wrap">
            <label
              v-for="c in numColCandidates"
              :key="c"
              class="flex items-center gap-1 cursor-pointer text-xs"
            >
              <input
                type="checkbox"
                :value="c"
                :checked="selectedNumCols.includes(c)"
                @change="toggleNumCol(c)"
                class="cursor-pointer"
              />
              {{ c }}
            </label>
          </div>
        </div>
        <label
          v-if="showStackedToggle"
          class="flex items-center gap-1 cursor-pointer text-xs"
        >
          <input type="checkbox" v-model="stacked" class="cursor-pointer" />
          <span class="text-muted-foreground">堆叠</span>
        </label>
      </div>

      <!-- Pie fallback notice -->
      <div
        v-if="isPieOrDoughnut && selectedNumCols.length > 1"
        class="text-xs text-amber-600"
      >
        （仅展示：{{ selectedNumCols[0] }}，饼图仅支持单数值列）
      </div>

      <!-- Chart container -->
      <div
        ref="containerRef"
        class="chart-container"
        style="width: 100%; min-height: 400px"
      />

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, toRaw, watch } from 'vue'
import type { TableSchema } from '../model/DatabaseTypes'
import { isNumericType } from '../utils/sql'
import { buildEChartsOption } from './chart/chartOptionBuilder'
import { useECharts } from './chart/useECharts'

const props = defineProps<{
  result: TableSchema
}>()

const chartType = ref<'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'radar'>('bar')
const labelCol = ref<string>('')
const selectedNumCols = ref<string[]>([])
const stacked = ref(false)

const { containerRef, render, dispose, resize } = useECharts()

const numColCandidates = computed(() => props.result.columns.filter((c) => isNumericCol(c)))

const hasNumericCol = computed(() => numColCandidates.value.length > 0)

const effectiveType = computed(() => effectiveChartType())

const showStackedToggle = computed(
  () => selectedNumCols.value.length > 1 && (effectiveType.value === 'bar' || effectiveType.value === 'area')
)

const isPieOrDoughnut = computed(() => effectiveType.value === 'pie' || effectiveType.value === 'doughnut')

function isNumericCol(col: string): boolean {
  const rawType = props.result.columnTypes[col] || ''
  if (isNumericType(rawType)) return true
  const nonNull = props.result.data.filter((r) => {
    const v = r[col]
    return v !== null && v !== undefined && v !== ''
  })
  if (nonNull.length === 0) return false
  return nonNull.every((r) => !Number.isNaN(Number(r[col])))
}

function toggleNumCol(col: string) {
  const idx = selectedNumCols.value.indexOf(col)
  if (idx >= 0) {
    selectedNumCols.value.splice(idx, 1)
  } else {
    selectedNumCols.value.push(col)
  }
}

function autoSelect() {
  for (const col of props.result.columns) {
    if (!isNumericCol(col)) {
      labelCol.value = col
      break
    }
  }
  const nums = numColCandidates.value
  selectedNumCols.value = nums.slice(0, Math.min(nums.length, 3))
  if (!labelCol.value && props.result.columns.length > 0) {
    labelCol.value = props.result.columns[0]
  }
}

function effectiveChartType(): string {
  return chartType.value as string
}

function buildDatasets(): { name: string; data: (number | null)[] }[] {
  const rawData = toRaw(props.result.data) as Record<string, unknown>[]

  const cols = isPieOrDoughnut.value ? selectedNumCols.value.slice(0, 1) : selectedNumCols.value

  return cols.map((col) => ({
    name: col,
    data: rawData.map((row) => {
      const v = row[col]
      return v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v)
    })
  }))
}

function buildAndRender() {
  const labels = toRaw(props.result.data).map((r: Record<string, unknown>) => String(r[labelCol.value] ?? ''))

  const eType = effectiveChartType()
  const datasets = buildDatasets()

  const config = {
    chartType: eType,
    labels,
    datasets,
    stacked: stacked.value
  }

  const option = buildEChartsOption(config)
  render(option)
}

// Shallow data trigger to avoid deep-watching large datasets
const dataTrigger = computed(() => `${props.result.columns.join(',')}|${props.result.data.length}`)

// Watch UI config + data trigger, re-render
watch([chartType, labelCol, stacked, dataTrigger], () => {
  if (selectedNumCols.value.length === 0 || !labelCol.value) return
  nextTick(buildAndRender)
})

// Watch selectedNumCols separately (array — needs deep)
watch(
  selectedNumCols,
  () => {
    if (selectedNumCols.value.length === 0 || !labelCol.value) return
    nextTick(buildAndRender)
  },
  { deep: true }
)

// Watch result specifically for column structure changes
watch(
  () => props.result,
  (newVal, oldVal) => {
    if (!oldVal) {
      autoSelect()
      return
    }

    const oldCols = oldVal.columns.join(',')
    const newCols = newVal.columns.join(',')

    if (oldCols !== newCols) {
      if (!newVal.columns.includes(labelCol.value)) {
        labelCol.value = ''
      }
      selectedNumCols.value = selectedNumCols.value.filter((c) => newVal.columns.includes(c))

      if (!labelCol.value || selectedNumCols.value.length === 0) {
        autoSelect()
      }
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.chart-container {
  transition: opacity 0.2s ease;
}
</style>
