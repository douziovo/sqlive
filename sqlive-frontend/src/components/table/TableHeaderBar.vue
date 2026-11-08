<template>
    <div class="flex items-center gap-3 mb-3 group">
        <div
            class="text-lg font-bold px-3 py-2 rounded-md inline-flex items-center gap-2 transition-colors shadow-sm border"
            :class="[
                {
                    'bg-purple-100 text-purple-700 border-purple-300 ring-2 ring-purple-200':
                        highlight.actionType === 'ddl' &&
                        highlight.activeTables[0] === table.name,
                    'bg-blue-100 text-primary border-blue-300 ring-2 ring-blue-200':
                        highlight.actionType !== 'ddl' &&
                        highlight.activeTables[0] === table.name,
                    'bg-card text-black border-border':
                        highlight.activeTables[0] !== table.name,
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
                class="text-xs px-2 py-1 rounded-full bg-blue-50 text-primary border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors font-normal"
            >
                &#x1F4C7; {{ tableIndexes.length }}
            </span>
            <span
                v-if="tableTriggers.length"
                @click.stop="navigateTo('triggers')"
                @mouseenter="emit('badge-enter', $event, 'trigger')"
                @mouseleave="emit('badge-leave')"
                class="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors font-normal"
            >
                &#x26A1; {{ tableTriggers.length }}
            </span>
            <span
                v-if="tableViews.length"
                @click.stop="navigateTo('views')"
                @mouseenter="emit('badge-enter', $event, 'view')"
                @mouseleave="emit('badge-leave')"
                class="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-600 border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors font-normal"
            >
                &#x1F440; {{ tableViews.length }}
            </span>
        </div>

        <button
            @click="emit('drop-table', table.name)"
            class="p-2 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
            title="删除表格"
        >
            <span class="text-xl leading-none">&#x1F5D1;&#xFE0F;</span>
        </button>
    </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import type { IndexInfo, TableSchema, TriggerInfo, ViewInfo } from '../../model/DatabaseTypes'
import { SQL_CONTEXT_KEY } from '../../model/injectionKeys'
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
