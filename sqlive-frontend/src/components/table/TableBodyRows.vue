<template>
    <tr v-if="paginatedData.length === 0 && filterText" class="border-b">
        <td
            :colspan="table.columns.length + 1"
            class="px-4 py-8 text-center text-muted-foreground/70 text-sm italic"
        >
            无匹配数据
        </td>
    </tr>
    <tr
        v-for="(row, idx) in paginatedData"
        :key="row._rawSql || idx"
        class="border-b last:border-b-0 transition-colors duration-200 hover:bg-muted group"
    >
        <td
            v-for="col in table.columns"
            :key="col"
            class="px-4 py-2 border-r last:border-r-0 border-border transition-colors duration-200 relative align-top"
            :class="getCellClasses(row, col)"
        >
            <div class="grid place-items-start w-full relative">
                <div
                    data-ghost
                    class="invisible whitespace-pre-wrap break-all border border-transparent px-1 py-1 min-h-[1.5em]"
                    style="grid-area: 1/1/2/2"
                >
                    {{ row[col] || ' ' }}
                </div>
                <textarea
                    :value="String(row[col] ?? '')"
                    @input="(e) => autoResizeGhost(e)"
                    @blur="(e) => handleBlur(e, row, col)"
                    @keydown.enter.prevent="(e) => (e.target as HTMLElement).blur()"
                    class="w-full h-full bg-transparent outline-none border-b border-transparent px-1 py-1 resize-none overflow-hidden absolute inset-0 z-10 whitespace-pre-wrap break-all"
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
                class="text-muted-foreground/50 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100"
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
const getRowId = (row: any) => (row.id !== undefined ? row.id : row._highlightId)
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
    background-color: #ff6600;
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
