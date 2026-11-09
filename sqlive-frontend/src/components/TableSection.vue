<template>
    <div :id="'table-' + table.name" class="mb-10" :class="{ 'animate-flash': isFlashTarget }">
        <TableHeaderBar
            :table="table"
            :table-indexes="tableIndexes"
            :table-triggers="tableTriggers"
            :table-views="tableViews"
            :is-flash-target="isFlashTarget"
            :is-animating="isAnimating"
            @drop-table="emit('drop-table', $event)"
            @navigate-tab="emit('navigate-tab', $event)"
            @badge-enter="onBadgeEnter"
            @badge-leave="onBadgeLeave"
        />

        <div class="relative overflow-x-auto rounded-lg border border-border bg-card shadow-lg">
            <TableFilterBar v-model="filterText" />

            <table
                class="min-w-full table-auto border-collapse text-left text-sm text-muted-foreground"
            >
                <TableHeadRow
                    :table="table"
                    :column-indexes="columnIndexes"
                    :sort-column="sortColumn"
                    :sort-dir="sortDir"
                    @toggle-sort="toggleSort"
                    @navigate-tab="emit('navigate-tab', $event)"
                    @column-idx-enter="onColumnIdxEnter"
                    @badge-leave="onBadgeLeave"
                />
                <tbody>
                    <TableBodyRows
                        :table="table"
                        :paginated-data="paginatedData"
                        :filter-text="filterText"
                        :is-animating="isAnimating"
                        @update-cell="emit('update-cell', $event)"
                        @delete-row="emit('delete-row', $event)"
                    />
                    <GhostInsertRow :table="table" @insert-row="emit('insert-row', $event)" />
                </tbody>
            </table>

            <TablePagination
                v-if="totalPages > 1"
                v-model:current-page="currentPage"
                v-model:page-size="pageSize"
                :total-rows="totalRows"
                :total-pages="totalPages"
            />
        </div>
    </div>

    <!-- Hover Preview -->
    <HoverPreview
        :show="hoverType !== null"
        :trigger-el="hoverTriggerEl"
        :icon="previewIcon"
        :title="previewTitle"
        :subtitle="previewSubtitle"
        :category-name="previewCategoryName"
        :items="previewItems"
        @select="onPreviewSelect"
        @mouseenter="onPreviewEnter"
        @mouseleave="onBadgeLeave"
        @navigate-all="onPreviewNavigateAll"
    />

    <!-- Truncation tooltip -->
    <TruncationTooltip />
</template>

<script setup lang="ts">
import { computed, inject, onUnmounted, ref, watch } from 'vue'

import { useTablePipeline } from '../composables/useTablePipeline'
import type { IndexInfo, TableSchema, TriggerInfo, ViewInfo } from '../model/DatabaseTypes'
import { SQL_CONTEXT_KEY } from '../model/injectionKeys'
import HoverPreview from './HoverPreview.vue'
import GhostInsertRow from './table/GhostInsertRow.vue'
import TableBodyRows from './table/TableBodyRows.vue'
import TableFilterBar from './table/TableFilterBar.vue'
import TableHeaderBar from './table/TableHeaderBar.vue'
import TableHeadRow from './table/TableHeadRow.vue'
import TablePagination from './table/TablePagination.vue'
import TruncationTooltip from './table/TruncationTooltip.vue'
import { useTableHoverPreview } from './table/useTableHoverPreview'

const props = defineProps<{
    table: TableSchema
    indexes: IndexInfo[]
    triggers: TriggerInfo[]
    views: ViewInfo[]
    flashTableName?: string | null
}>()

const emit = defineEmits(['update-cell', 'delete-row', 'drop-table', 'insert-row', 'navigate-tab'])
const { highlight } = inject(SQL_CONTEXT_KEY)!

const isFlashTarget = computed(() => props.flashTableName === props.table.name)

// --- Associated indexes / triggers / views ---
const tableIndexes = computed(() => props.indexes.filter((i) => i.tableName === props.table.name))
const tableTriggers = computed(() => props.triggers.filter((t) => t.tableName === props.table.name))
const tableViews = computed(() =>
    props.views.filter((v) => {
        const sql = v.sql || ''
        return (
            sql.includes(props.table.name) ||
            sql.includes(`"${props.table.name}"`) ||
            sql.includes(`\`${props.table.name}\``)
        )
    })
)
const columnIndexes = computed(() => {
    const map: Record<string, string[]> = {}
    for (const idx of tableIndexes.value) {
        for (const col of idx.columns) {
            if (!map[col]) map[col] = []
            map[col].push(idx.name)
        }
    }
    return map
})

// --- Hover preview ---
const {
    hoverType,
    hoverTriggerEl,
    onBadgeEnter,
    onColumnIdxEnter,
    onBadgeLeave,
    onPreviewEnter,
    onPreviewSelect,
    onPreviewNavigateAll,
    previewIcon,
    previewTitle,
    previewSubtitle,
    previewCategoryName,
    previewItems
} = useTableHoverPreview(
    {
        tableName: () => props.table.name,
        tableIndexes: () => tableIndexes.value,
        tableTriggers: () => tableTriggers.value,
        tableViews: () => tableViews.value,
        columnIndexes: () => columnIndexes.value
    },
    emit
)

// --- Animation ---
const isAnimating = ref(false)
let animationTimer: ReturnType<typeof setTimeout> | null = null

watch(
    () => highlight.refreshSeed,
    () => {
        isAnimating.value = true
        if (animationTimer) clearTimeout(animationTimer)
        animationTimer = setTimeout(() => {
            isAnimating.value = false
        }, 1000)
    }
)

// Sort/filter/page pipeline — extracted into composable
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
    () => props.table.data,
    () => props.table.columnTypes
)
// Initialize filter columns to the table's columns
filterColumns.value = props.table.columns

onUnmounted(() => {
    if (animationTimer) clearTimeout(animationTimer)
})
</script>

<style scoped>
@keyframes flash-bg {
    0% {
        background-color: rgba(250, 204, 21, 0.6);
        transform: scale(1.02);
    }
    100% {
        background-color: transparent;
        transform: scale(1);
    }
}
.animate-flash {
    animation: flash-bg 0.8s ease-out;
}
</style>
