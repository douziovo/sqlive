<template>
    <div class="mb-10">
        <div
            class="mb-3 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-lg font-bold text-black shadow-sm"
        >
            <span>&#x1F4CA;</span>
            <span>{{ resultName }}</span>
            <span class="text-xs font-normal text-muted-foreground/70"
                >{{ result.columns.length }} 列 | {{ totalRows }} 行</span
            >
            <button
                @click="showChart = !showChart"
                class="rounded border border-border px-2 py-1 text-xs font-normal transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
                {{ showChart ? '隐藏图表' : '查看图表' }}
            </button>
        </div>

        <Transition name="chart-expand">
            <ChartView v-if="showChart" :result="result" class="mb-4" />
        </Transition>

        <div class="relative overflow-x-auto rounded-lg border border-border bg-card shadow-lg">
            <!-- Filter bar -->
            <div class="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2">
                <span class="text-xs text-muted-foreground/70">&#x1F50D;</span>
                <input
                    v-model="filterText"
                    type="text"
                    placeholder="过滤..."
                    class="flex-1 bg-transparent text-sm text-muted-foreground placeholder-muted-foreground/50 outline-none"
                />
                <button
                    v-if="filterText"
                    @click="filterText = ''"
                    class="text-xs leading-none text-muted-foreground/50 hover:text-muted-foreground"
                >
                    &#x2715;
                </button>
            </div>

            <table
                class="min-w-full table-auto border-collapse text-left text-sm text-muted-foreground"
            >
                <thead
                    class="border-b border-border bg-secondary text-xs text-secondary-foreground uppercase"
                >
                    <tr>
                        <th
                            v-for="col in result.columns"
                            :key="col"
                            @click="toggleSort(col)"
                            class="cursor-pointer border-b-2 px-4 py-3 align-top transition-colors duration-200 select-none hover:bg-secondary/50"
                            style="min-width: 150px"
                            :class="[
                                sortColumn === col
                                    ? 'border-primary/40 bg-primary/10 text-primary'
                                    : 'border-transparent'
                            ]"
                        >
                            <div
                                class="flex items-center gap-1 text-sm font-bold whitespace-nowrap"
                            >
                                {{ col }}
                                <span
                                    v-if="sortColumn === col && sortDir === 'asc'"
                                    class="text-xs text-primary"
                                    >&#x25B2;</span
                                >
                                <span
                                    v-if="sortColumn === col && sortDir === 'desc'"
                                    class="text-xs text-primary"
                                    >&#x25BC;</span
                                >
                            </div>
                            <div
                                class="mt-1 overflow-hidden font-mono text-[10px] text-ellipsis whitespace-nowrap text-muted-foreground/70 lowercase"
                                :title="result.columnTypes[col]"
                            >
                                {{ result.columnTypes[col] || 'unknown' }}
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="paginatedData.length === 0 && filterText" class="border-b">
                        <td
                            :colspan="result.columns.length"
                            class="px-4 py-8 text-center text-sm text-muted-foreground/70 italic"
                        >
                            无匹配数据
                        </td>
                    </tr>
                    <tr
                        v-for="(row, idx) in paginatedData"
                        :key="idx"
                        class="border-b transition-colors duration-200 last:border-b-0 hover:bg-muted"
                    >
                        <td
                            v-for="col in result.columns"
                            :key="col"
                            class="border-r border-border px-4 py-2 align-top text-muted-foreground last:border-r-0"
                        >
                            <div class="min-h-[1.5em] px-1 py-1 break-all whitespace-pre-wrap">
                                {{ row[col] !== null && row[col] !== undefined ? row[col] : '' }}
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- Pagination bar -->
            <div
                v-if="totalPages > 1"
                class="flex items-center justify-between border-t border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
            >
                <span>共 {{ totalRows }} 行</span>
                <div class="flex items-center gap-2">
                    <select
                        v-model="pageSize"
                        class="rounded border border-border bg-card px-1 py-1 text-xs outline-none"
                    >
                        <option :value="10">10</option>
                        <option :value="25">25</option>
                        <option :value="50">50</option>
                        <option :value="100">100</option>
                    </select>
                    <button
                        @click="currentPage--"
                        :disabled="currentPage <= 1"
                        class="rounded border border-border bg-card px-2 py-1 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        &#x2190; 上一页
                    </button>
                    <span>{{ currentPage }} / {{ totalPages }}</span>
                    <button
                        @click="currentPage++"
                        :disabled="currentPage >= totalPages"
                        class="rounded border border-border bg-card px-2 py-1 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        下一页 &#x2192;
                    </button>
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
/* <Transition name="chart-expand"> 运行时生成的进入过渡类，静态检查器无法识别，不可删除 */
/*noinspection CssUnusedSymbol*/
.chart-expand-enter-active {
    transition: opacity 0.3s ease-out;
}
/* 同上：Transition 运行时生成的离开过渡类 */
/*noinspection CssUnusedSymbol*/
.chart-expand-leave-active {
    transition: opacity 0.2s ease-in;
}
/* 同上：Transition 运行时生成的进入起始态与离开结束态 */
/*noinspection CssUnusedSymbol*/
.chart-expand-enter-from,
.chart-expand-leave-to {
    opacity: 0;
}
</style>
