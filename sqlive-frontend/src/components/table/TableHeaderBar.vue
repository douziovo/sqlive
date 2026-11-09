<template>
    <div class="group mb-3 flex items-center gap-3">
        <div
            class="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-lg font-bold shadow-sm transition-colors"
            :class="[
                {
                    'border-purple-300 bg-purple-100 text-purple-700 ring-2 ring-purple-200':
                        highlight.actionType === 'ddl' && highlight.activeTables[0] === table.name,
                    'border-blue-300 bg-blue-100 text-primary ring-2 ring-blue-200':
                        highlight.actionType !== 'ddl' && highlight.activeTables[0] === table.name,
                    'border-border bg-card text-black': highlight.activeTables[0] !== table.name,
                    'animate-flash':
                        (isAnimating &&
                            highlight.actionType === 'ddl' &&
                            highlight.activeTables[0] === table.name) ||
                        isFlashTarget
                }
            ]"
        >
            <span>&#x1F4C4;</span>
            <span>{{ table.name }}</span>

            <!-- Associated badges -->
            <span
                v-if="tableIndexes.length"
                @click.stop="navigateTo('indexes')"
                @mouseenter="emit('badge-enter', $event, 'index')"
                @mouseleave="emit('badge-leave')"
                class="cursor-pointer rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-normal text-primary transition-colors hover:bg-blue-100"
            >
                &#x1F4C7; {{ tableIndexes.length }}
            </span>
            <span
                v-if="tableTriggers.length"
                @click.stop="navigateTo('triggers')"
                @mouseenter="emit('badge-enter', $event, 'trigger')"
                @mouseleave="emit('badge-leave')"
                class="cursor-pointer rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-normal text-amber-600 transition-colors hover:bg-amber-100"
            >
                &#x26A1; {{ tableTriggers.length }}
            </span>
            <span
                v-if="tableViews.length"
                @click.stop="navigateTo('views')"
                @mouseenter="emit('badge-enter', $event, 'view')"
                @mouseleave="emit('badge-leave')"
                class="cursor-pointer rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-normal text-purple-600 transition-colors hover:bg-purple-100"
            >
                &#x1F440; {{ tableViews.length }}
            </span>
        </div>

        <button
            @click="emit('drop-table', table.name)"
            class="rounded-full p-2 text-muted-foreground/70 opacity-0 transition-colors group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
            title="删除表格"
        >
            <span class="text-xl leading-none">&#x1F5D1;&#xFE0F;</span>
        </button>
    </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'

import type { IndexInfo, TableSchema, TriggerInfo, ViewInfo } from '@/model/DatabaseTypes'
import { SQL_CONTEXT_KEY } from '@/model/injectionKeys'

import type { HoverType } from './useTableHoverPreview'

defineProps<{
    table: TableSchema
    tableIndexes: IndexInfo[]
    tableTriggers: TriggerInfo[]
    tableViews: ViewInfo[]
    isFlashTarget: boolean
    isAnimating: boolean
}>()

const emit = defineEmits<{
    'drop-table': [name: string]
    'navigate-tab': [payload: { tab: string; targetId?: string }]
    'badge-enter': [event: MouseEvent, type: HoverType]
    'badge-leave': []
}>()

const { highlight } = inject(SQL_CONTEXT_KEY)!

function navigateTo(tab: string, targetId?: string) {
    emit('navigate-tab', { tab, targetId })
}
</script>

<style scoped>
@keyframes flash-bg {
    0% {
        background-color: rgb(250 204 21 / 60%);
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
