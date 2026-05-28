<template>
  <div class="mb-10">
    <div class="text-lg font-bold px-3 py-2 rounded-md inline-flex items-center gap-2 mb-3 bg-card text-black border border-border shadow-sm">
      <span>&#x1F4CA;</span>
      <span>{{ resultName }}</span>
      <span class="text-xs text-muted-foreground/70 font-normal">{{ result.columns.length }} 列 | {{ totalRows }} 行</span>
      <button
        @click="showChart = !showChart"
        class="text-xs px-2 py-1 rounded border border-border hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors font-normal"
      >
        {{ showChart ? '隐藏图表' : '查看图表' }}
      </button>
    </div>

    <Transition name="chart-expand">
      <ChartView v-if="showChart" :result="result" class="mb-4" />
    </Transition>

    <div class="overflow-x-auto shadow-lg border border-border rounded-lg bg-card relative">
      <!-- Filter bar -->
      <div class="px-3 py-2 border-b border-border bg-muted/50 flex items-center gap-2">
        <span class="text-xs text-muted-foreground/70">&#x1F50D;</span>
        <input
            v-model="filterText"
            type="text"
            placeholder="过滤..."
            class="text-sm bg-transparent outline-none flex-1 text-muted-foreground placeholder-muted-foreground/50"
        />
        <button
            v-if="filterText"
            @click="filterText = ''"
            class="text-muted-foreground/50 hover:text-muted-foreground text-xs leading-none"
        >&#x2715;</button>
      </div>

      <table class="min-w-full text-sm text-left text-muted-foreground table-auto border-collapse">
        <thead class="text-xs text-secondary-foreground uppercase bg-secondary border-b border-border">
        <tr>
          <th
              v-for="col in result.columns" :key="col"
              @click="toggleSort(col)"
              class="px-4 py-3 border-b-2 transition-colors duration-200 align-top cursor-pointer select-none hover:bg-secondary/50"
              style="min-width: 150px;"
              :class="[sortColumn === col ? 'bg-primary/10 text-primary border-primary/40' : 'border-transparent']"
          >
            <div class="text-sm font-bold whitespace-nowrap flex items-center gap-1">
              {{ col }}
              <span v-if="sortColumn === col && sortDir === 'asc'" class="text-primary text-xs">&#x25B2;</span>
              <span v-if="sortColumn === col && sortDir === 'desc'" class="text-primary text-xs">&#x25BC;</span>
            </div>
            <div class="text-[10px] text-muted-foreground/70 font-mono mt-1 lowercase whitespace-nowrap overflow-hidden text-ellipsis" :title="result.columnTypes[col]">
              {{ result.columnTypes[col] || 'unknown' }}
            </div>
          </th>
        </tr>
        </thead>
        <tbody>
        <tr v-if="paginatedData.length === 0 && filterText" class="border-b">
          <td :colspan="result.columns.length" class="px-4 py-8 text-center text-muted-foreground/70 text-sm italic">
            无匹配数据
          </td>
        </tr>
        <tr
            v-for="(row, idx) in paginatedData"
            :key="idx"
            class="border-b last:border-b-0 transition-colors duration-200 hover:bg-muted"
        >
          <td
              v-for="col in result.columns"
              :key="col"
              class="px-4 py-2 text-muted-foreground border-r last:border-r-0 border-border align-top"
          >
            <div class="whitespace-pre-wrap break-all min-h-[1.5em] px-1 py-1">
              {{ row[col] !== null && row[col] !== undefined ? row[col] : '' }}
            </div>
          </td>
        </tr>
        </tbody>
      </table>

      <!-- Pagination bar -->
      <div v-if="totalPages > 1" class="px-3 py-2 border-t border-border bg-muted/50 flex items-center justify-between text-xs text-muted-foreground">
        <span>共 {{ totalRows }} 行</span>
        <div class="flex items-center gap-2">
          <select v-model="pageSize" class="text-xs border border-border rounded px-1 py-1 bg-card outline-none">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
          <button
              @click="currentPage--"
              :disabled="currentPage <= 1"
              class="px-2 py-1 rounded border border-border bg-card disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary"
          >&#x2190; 上一页</button>
          <span>{{ currentPage }} / {{ totalPages }}</span>
          <button
              @click="currentPage++"
              :disabled="currentPage >= totalPages"
              class="px-2 py-1 rounded border border-border bg-card disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary"
          >下一页 &#x2192;</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTablePipeline } from '../composables/useTablePipeline'
import type { TableSchema } from '../model/DatabaseTypes'
import ChartView from './ChartView.vue'

const showChart = ref(false)

const props = defineProps<{
  result: TableSchema
  index: number
}>()

const resultName = computed(() => (props.index === 0 ? '查询结果' : `查询结果 ${props.index + 1}`))

const {
  sortColumn,
  sortDir,
  toggleSort,
  filterText,
  filterColumns,
  currentPage,
  pageSize,
  paginatedData,
  totalRows,
  totalPages
} = useTablePipeline(
  () => props.result.data,
  () => props.result.columnTypes
)
filterColumns.value = props.result.columns
</script>

<style scoped>
.chart-expand-enter-active {
  transition: opacity 0.3s ease-out;
}
.chart-expand-leave-active {
  transition: opacity 0.2s ease-in;
}
.chart-expand-enter-from,
.chart-expand-leave-to {
  opacity: 0;
}
</style>
