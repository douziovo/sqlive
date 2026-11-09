<template>
    <EmptyState
        v-if="triggers.length === 0"
        icon="&#x1F4ED;"
        title="暂无触发器"
        subtitle="在 SQL 中使用 CREATE TRIGGER 语句创建触发器"
    />

    <template v-else>
        <SortFilterToolbar
            v-model:filter="trgFilter"
            placeholder="搜索触发器名称/表名/SQL..."
            :fields="trgFieldDefs"
            :sort-key="trgSortKey"
            :sort-dir="trgSortDir"
            @toggle-sort="trgToggleSort"
            item-label="触发器"
            :total-count="triggers.length"
            :filtered-count="trgFiltered.length"
        />

        <div
            v-if="trgFiltered.length === 0"
            class="flex h-24 flex-col items-center justify-center text-muted-foreground/70"
        >
            <p class="text-sm">&#x1F50D; 无匹配的触发器</p>
        </div>

        <div
            v-for="t in trgFiltered"
            :key="t.name"
            :id="'trigger-' + t.name"
            class="mb-4 cursor-pointer rounded-lg border border-border bg-card p-4 shadow-sm hover:border-primary hover:shadow-md"
            :class="{ 'animate-flash': flashTarget === 'trigger-' + t.name }"
            @click="emit('navigate', { tab: 'tables', targetId: 'table-' + t.tableName })"
        >
            <div class="mb-2 flex items-center gap-2">
                <span class="text-lg">&#x26A1;</span>
                <span class="font-bold text-secondary-foreground">{{ t.name }}</span>
            </div>
            <div class="mb-3 text-xs text-muted-foreground">
                表：<span class="font-medium text-secondary-foreground">{{ t.tableName }}</span>
            </div>
            <pre
                class="overflow-x-auto rounded bg-secondary p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground"
                @click.stop
                >{{ t.sql }}</pre>
        </div>
    </template>
</template>

<script setup lang="ts">
import { type SortField, useSortFilter } from '@/composables/useSortFilter'
import type { TriggerInfo } from '@/model/DatabaseTypes'

import EmptyState from '../EmptyState.vue'
import type { SortFieldDef } from '../SortFilterToolbar.vue'
import SortFilterToolbar from '../SortFilterToolbar.vue'

const props = defineProps<{
    triggers: TriggerInfo[]
    flashTarget: string | null
}>()

const emit = defineEmits<{
    navigate: [payload: { tab: string; targetId?: string }]
}>()

// --- Trigger sort/filter ---
const strCmp = (a: string, b: string) => a.localeCompare(b)

const trgFieldDefs: SortFieldDef[] = [
    { key: 'name', label: '名称' },
    { key: 'table', label: '表名' }
]

const trgSortFields: SortField<TriggerInfo>[] = [
    { key: 'name', label: '名称', compare: (a, b) => strCmp(a.name, b.name) },
    { key: 'table', label: '表名', compare: (a, b) => strCmp(a.tableName, b.tableName) }
]

const {
    sortKey: trgSortKey,
    sortDir: trgSortDir,
    filterText: trgFilter,
    toggleSort: trgToggleSort,
    result: trgFiltered
} = useSortFilter(
    () => props.triggers,
    trgSortFields,
    (t, f) =>
        t.name.toLowerCase().includes(f) ||
        t.tableName.toLowerCase().includes(f) ||
        (t.sql || '').toLowerCase().includes(f)
)
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
