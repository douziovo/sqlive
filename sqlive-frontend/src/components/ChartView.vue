<template>
  <div class="border border-border rounded-lg bg-card p-4">
    <div class="flex items-center justify-between mb-3">
      <div class="text-sm font-bold text-secondary-foreground">&#x1F4CA; 图表：{{ result.name }}</div>
      <div class="flex items-center gap-2">
        <select
          v-model="chartType"
          class="text-xs border border-border rounded px-2 py-1 bg-card outline-none"
        >
          <option value="bar">柱状图</option>
          <option value="line">折线图</option>
          <option value="pie">饼图</option>
        </select>
      </div>
    </div>

    <div v-if="result.columns.length < 2" class="text-sm text-muted-foreground/70 text-center py-8">
      需要至少 2 列才能生成图表（1 个标签列 + 1 个数值列）
    </div>

    <div v-else-if="!hasNumericCol" class="text-sm text-muted-foreground/70 text-center py-8">
      需要至少 1 个数值列来生成图表
    </div>

    <div v-else-if="labelCol && numCols.length" class="flex flex-col gap-4">
      <!-- Axis picker -->
      <div class="flex items-center gap-4 text-xs">
        <div class="flex items-center gap-1">
          <span class="text-muted-foreground">标签列:</span>
          <select v-model="labelCol" class="border border-border rounded px-2 py-1 bg-card outline-none">
            <option v-for="c in result.columns" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-muted-foreground">数值列:</span>
          <select v-model="selectedNumCol" class="border border-border rounded px-2 py-1 bg-card outline-none text-xs">
            <option v-for="c in numColCandidates" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
      </div>

      <div
        :style="{ height: chartType === 'pie' ? '400px' : '320px' }"
        class="chart-canvas-wrapper"
      >
        <canvas ref="canvasRef"></canvas>
      </div>
    </div>

    <div v-else class="text-sm text-muted-foreground/70 text-center py-8">
      无法自动识别标签列和数值列
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Chart, registerables } from 'chart.js';
import type { TableSchema } from '../model/DatabaseTypes';
import { isNumericType } from '../utils/sql';
import type { Plugin } from 'chart.js';

Chart.register(...registerables);

const leaderLinePlugin: Plugin = {
  id: 'leaderLines',
  afterDatasetsDraw(chart) {
    const type = (chart.config as unknown as Record<string, unknown>).type;
    if (type !== 'pie' && type !== 'doughnut') return;

    const ctx = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data.length) return;

    const dataset = chart.data.datasets[0];
    const total = dataset.data.reduce((sum: number, v: any) => sum + (Number(v) || 0), 0);
    if (total === 0) return;

    ctx.save();

    meta.data.forEach((arc: any, i: number) => {
      const value = Number(dataset.data[i]);
      if (value == null || value === 0) return;

      const percentage = ((value / total) * 100).toFixed(1);
      const label = String(chart.data.labels?.[i] ?? '');
      const text = `${label}  ${percentage}%`;

      const midAngle = (arc.startAngle + arc.endAngle) / 2;
      const outerR = arc.outerRadius || 0;
      const cx = arc.x;
      const cy = arc.y;

      const color = String((dataset.backgroundColor as any)?.[i] || '#94a3b8');

      // Line from arc edge outward, then horizontal
      const startR = outerR + 4;
      const startX = cx + Math.cos(midAngle) * startR;
      const startY = cy + Math.sin(midAngle) * startR;

      const bendR = outerR + 20;
      const bendX = cx + Math.cos(midAngle) * bendR;
      const bendY = cy + Math.sin(midAngle) * bendR;

      const dir = Math.cos(midAngle) > 0 ? 1 : -1;
      const endX = bendX + dir * 28;
      const endY = bendY;

      // Draw leader line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(bendX, bendY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Dot at arc edge
      ctx.beginPath();
      ctx.arc(startX, startY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Label text
      const textPad = 5;
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = dir > 0 ? 'left' : 'right';
      ctx.fillStyle = '#334155';
      ctx.fillText(text, endX + dir * textPad, endY);
    });

    ctx.restore();
  },
};

Chart.register(leaderLinePlugin);

const props = defineProps<{
  result: TableSchema;
}>();

const chartType = ref<'bar' | 'line' | 'pie'>('bar');
const labelCol = ref<string>('');
const selectedNumCol = ref<string>('');
const canvasRef = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const numColCandidates = computed(() =>
  props.result.columns.filter(c => isNumericCol(c))
);

const hasNumericCol = computed(() => numColCandidates.value.length > 0);

const numCols = computed(() => {
  if (selectedNumCol.value) return [selectedNumCol.value];
  return numColCandidates.value.slice(0, 1);
});

function isNumericCol(col: string): boolean {
  const rawType = props.result.columnTypes[col] || '';
  if (isNumericType(rawType)) return true;
  // Heuristic: check if all non-null values are numeric
  const nonNull = props.result.data.filter(r => { const v = r[col]; return v !== null && v !== undefined && v !== ''; });
  if (nonNull.length === 0) return false;
  return nonNull.every(r => { const v = r[col]; return !isNaN(Number(v)); });
}

function autoSelect() {
  // Pick first non-numeric column as label
  for (const col of props.result.columns) {
    if (!isNumericCol(col)) {
      labelCol.value = col;
      break;
    }
  }
  // Auto-select first numeric column
  const nums = numColCandidates.value;
  selectedNumCol.value = nums[0] || '';

  // If no non-numeric column found, use first column as label
  if (!labelCol.value && props.result.columns.length > 0) {
    labelCol.value = props.result.columns[0];
  }
}

const colorPalette = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

function buildAnimation(type: 'bar' | 'line' | 'pie') {
  switch (type) {
    case 'bar':
      return {
        duration: 600,
        easing: 'easeOutQuart' as const,
        delay: (ctx: any) => ctx.type === 'data' ? ctx.dataIndex * 60 : 0,
      };
    case 'line':
      return {
        duration: 1000,
        easing: 'easeInOutQuart' as const,
        delay: (ctx: any) => ctx.type === 'data' ? ctx.dataIndex * 60 : 0,
      };
    case 'pie':
      return {
        animateScale: true,
        animateRotate: true,
        duration: 2000,
        easing: 'easeOutBack' as const,
      };
    default:
      return { duration: 1000 };
  }
}

function buildChartConfig() {
  const labels = props.result.data.map(r => String(r[labelCol.value] ?? ''));

  const datasets = numCols.value.map((col, i) => ({
    label: col,
    data: props.result.data.map(r => {
      const v = r[col];
      return v === null || v === undefined || v === '' ? null : Number(v);
    }),
    backgroundColor: chartType.value === 'pie'
      ? labels.map((_, j) => colorPalette[j % colorPalette.length])
      : colorPalette[i % colorPalette.length] + '99',
    borderColor: colorPalette[i % colorPalette.length],
    borderWidth: 1,
  }));

  return {
    type: chartType.value,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: chartType.value === 'pie' ? { padding: { top: 50, bottom: 50, left: 70, right: 70 } } : {},
      animation: buildAnimation(chartType.value),
      plugins: {
        legend: {
          display: chartType.value !== 'pie',
          position: 'top' as const,
          labels: { font: { size: 13 }, boxWidth: 14 },
        },
      },
      scales: chartType.value === 'pie' ? {} : {
        x: { ticks: { font: { size: 12 } } },
        y: { ticks: { font: { size: 12 } }, beginAtZero: true },
      },
    },
  };
}

function renderChart() {
  if (!canvasRef.value || !labelCol.value || numCols.value.length === 0) return;

  const config = buildChartConfig();

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  chartInstance = new Chart(canvasRef.value, config);
}

watch(() => [chartType.value, labelCol.value, selectedNumCol.value], () => {
  nextTick(renderChart);
}, { deep: true });

watch(() => props.result, () => {
  autoSelect();
  nextTick(renderChart);
}, { immediate: true });

onMounted(() => {
  autoSelect();
  nextTick(renderChart);
});

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
});
</script>

<style scoped>
.chart-canvas-wrapper {
  transition: opacity 0.2s ease;
}
</style>
