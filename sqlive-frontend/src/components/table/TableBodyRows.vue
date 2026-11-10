<template>
    <tr v-if="paginatedData.length === 0 && filterText" class="border-b">
        <td
            :colspan="table.columns.length + 1"
            class="px-4 py-8 text-center text-sm text-muted-foreground/70 italic"
        >
            无匹配数据
        </td>
    </tr>
    <tr
        v-for="(row, idx) in paginatedData"
        :key="row._rawSql || idx"
        class="group border-b transition-colors duration-200 last:border-b-0 hover:bg-muted"
    >
        <td
            v-for="col in table.columns"
            :key="col"
            class="relative border-r border-border px-4 py-2 align-top transition-colors duration-200 last:border-r-0"
            :class="getCellClasses(row, col)"
        >
            <div class="relative grid w-full place-items-start">
                <div
                    data-ghost
                    class="invisible min-h-[1.5em] border border-transparent px-1 py-1 break-all whitespace-pre-wrap"
                    style="grid-area: 1/1/2/2"
                >
                    {{ row[col] || ' ' }}
                </div>
                <textarea
                    :value="String(row[col] ?? '')"
                    @input="(e) => autoResizeGhost(e)"
                    @blur="(e) => handleBlur(e, row, col)"
                    @keydown.enter.prevent="(e) => (e.target as HTMLElement).blur()"
                    class="absolute inset-0 z-10 h-full w-full resize-none overflow-hidden border-b border-transparent bg-transparent px-1 py-1 break-all whitespace-pre-wrap outline-none"
                    :class="{
                        'focus:border-primary': true,
                        'font-bold text-black': isRowHighlighted(row) && isColumnActive(col)
                    }"
                    style="grid-area: 1/1/2/2"
                    spellcheck="false"
                ></textarea>
            </div>
        </td>
        <td class="px-2 text-center align-middle">
            <button
                @click="emit('delete-row', { row, tableName: table.name })"
                class="scale-90 transform text-muted-foreground/50 opacity-0 transition-colors group-hover:scale-100 group-hover:opacity-100 hover:text-destructive"
                title="删除此行"
            >
                &#x1F5D1;&#xFE0F;
            </button>
        </td>
    </tr>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'

import { useInlineEdit } from '@/composables/useInlineEdit'
import type { CellUpdateEvent, Row, RowDeleteEvent, TableSchema } from '@/model/DatabaseTypes'
import { SQL_CONTEXT_KEY } from '@/model/injectionKeys'

const props = defineProps<{
    table: TableSchema
    paginatedData: Row[]
    filterText: string
    isAnimating: boolean
}>()

const emit = defineEmits<{
    'update-cell': [event: CellUpdateEvent]
    'delete-row': [event: RowDeleteEvent]
}>()

const { highlight } = inject(SQL_CONTEXT_KEY)!

const { autoResizeGhost, handleBlur } = useInlineEdit(
    props.table.name,
    props.table.columnTypes,
    emit
)

// --- Highlight helpers ---
const getRowId = (row: any) => (row.id === undefined ? row._highlightId : row.id)
const rowKey = (row: any) => `${props.table.name}:${getRowId(row)}`

const activeRowSet = computed(() => new Set(highlight.activeRows))
const activeColumnSet = computed(() => new Set(highlight.activeColumns))

const isRowHighlighted = (row: any) => activeRowSet.value.has(rowKey(row))
const isColumnActive = (colName: string) => activeColumnSet.value.has(colName)
const flashingRowSet = computed(() => new Set(highlight.flashingRows))

const getCellClasses = (row: any, col: string) => {
    const classes: string[] = []
    if (props.isAnimating && flashingRowSet.value.has(rowKey(row))) {
        classes.push('flash-overlay')
    }
    const typeStr = props.table.columnTypes[col] || ''
    const isVirtual = typeStr.includes('VIRTUAL')
    const isHighlighted = isRowHighlighted(row) && isColumnActive(col)

    if (isVirtual) {
        classes.push('bg-primary/10 text-primary font-bold border-l-2 border-primary/20')
    } else if (isHighlighted) {
        classes.push('bg-yellow-100 text-gray-900 font-bold')
    } else {
        classes.push('text-muted-foreground')
    }
    return classes.join(' ')
}
</script>

<style scoped>
/* noinspection CssUnusedSymbol */

/* .flash-overlay 由 script 中 classes.push('flash-overlay') 动态添加（闪烁高亮行），并非未使用 */
.flash-overlay {
    position: relative;
    overflow: hidden;
}

/* noinspection CssUnusedSymbol */
.flash-overlay::after {
    content: '';
    position: absolute;
    inset: 0;
    background-color: #f60;
    z-index: 5;
    animation: fade-out 1.2s ease-out forwards;
    pointer-events: none;
}

@keyframes fade-out {
    0% {
        opacity: 0.8;
    }

    100% {
        opacity: 0;
    }
}
</style>
