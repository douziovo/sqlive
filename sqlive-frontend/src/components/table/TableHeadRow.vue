<template>
    <thead class="text-xs text-secondary-foreground uppercase bg-secondary border-b border-border">
        <tr>
            <th
                v-for="col in table.columns"
                :key="col"
                @click="emit('toggle-sort', col)"
                class="px-4 py-3 border-b-2 transition-colors duration-200 align-top cursor-pointer select-none hover:bg-secondary/50"
                style="min-width: 150px"
                :class="[
                    isColumnActive(col)
                        ? 'bg-primary/10 text-primary border-primary'
                        : sortColumn === col
                          ? 'bg-primary/10 text-primary border-primary/30'
                          : 'border-transparent'
                ]"
            >
                <div class="text-sm font-bold whitespace-nowrap flex items-center gap-1">
                    {{ col }}
                    <span v-if="sortColumn === col && sortDir === 'asc'" class="text-primary text-xs"
                        >&#x25B2;</span
                    >
                    <span
                        v-if="sortColumn === col && sortDir === 'desc'"
                        class="text-primary text-xs"
                        >&#x25BC;</span
                    >
                </div>
                <div
                    class="text-[10px] text-muted-foreground/70 font-mono mt-1 lowercase whitespace-nowrap overflow-hidden text-ellipsis"
                    :title="table.columnTypes[col]"
                >
                    {{ table.columnTypes[col] || 'unknown' }}
                </div>
                <div
                    v-if="columnIndexes[col]"
                    @click.stop="navigateTo('indexes')"
                    @mouseenter.stop="emit('column-idx-enter', $event, col)"
                    @mouseleave="emit('badge-leave')"
                    class="mt-1 text-[10px] text-primary cursor-pointer hover:text-primary hover:underline font-normal"
                >
                    &#x1F4C7; {{ columnIndexes[col].length }}
                </div>
            </th>
            <th class="px-2 py-3 w-10 border-b-2 border-transparent"></th>
        </tr>
    </thead>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { TableSchema } from '../../model/DatabaseTypes'
import { SQL_CONTEXT_KEY } from '../../model/injectionKeys'

defineProps<{
    table: TableSchema
    columnIndexes: Record<string, string[]>
    sortColumn: string | null
    sortDir: 'asc' | 'desc' | null
}>()

const emit = defineEmits<{
    'toggle-sort': [col: string]
    'navigate-tab': [payload: { tab: string; targetId?: string }]
    'column-idx-enter': [event: MouseEvent, col: string]
    'badge-leave': []
}>()

const { highlight } = inject(SQL_CONTEXT_KEY)!

const activeColumnSet = computed(() => new Set(highlight.activeColumns))
const isColumnActive = (colName: string) => activeColumnSet.value.has(colName)

function navigateTo(tab: string, targetId?: string) {
    emit('navigate-tab', { tab, targetId })
}
</script>
