<template>
    <thead class="border-b border-border bg-secondary text-xs text-secondary-foreground uppercase">
        <tr>
            <th
                v-for="col in table.columns"
                :key="col"
                @click="emit('toggle-sort', col)"
                class="cursor-pointer border-b-2 px-4 py-3 align-top transition-colors duration-200 select-none hover:bg-secondary/50"
                style="min-width: 150px"
                :class="[
                    isColumnActive(col)
                        ? 'border-primary bg-primary/10 text-primary'
                        : sortColumn === col
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-transparent'
                ]"
            >
                <div class="flex items-center gap-1 text-sm font-bold whitespace-nowrap">
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
                    :title="table.columnTypes[col]"
                >
                    {{ table.columnTypes[col] || 'unknown' }}
                </div>
                <div
                    v-if="columnIndexes[col]"
                    @click.stop="navigateTo('indexes')"
                    @mouseenter.stop="emit('column-idx-enter', $event, col)"
                    @mouseleave="emit('badge-leave')"
                    class="mt-1 cursor-pointer text-[10px] font-normal text-primary hover:text-primary hover:underline"
                >
                    &#x1F4C7; {{ columnIndexes[col].length }}
                </div>
            </th>
            <th class="w-10 border-b-2 border-transparent px-2 py-3"></th>
        </tr>
    </thead>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'

import type { TableSchema } from '@/model/DatabaseTypes'
import { SQL_CONTEXT_KEY } from '@/model/injectionKeys'

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
