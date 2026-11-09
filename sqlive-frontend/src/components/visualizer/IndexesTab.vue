<template>
    <EmptyState
        v-if="indexes.length === 0"
        icon="&#x1F4ED;"
        title="暂无索引"
        subtitle="在 SQL 中使用 CREATE INDEX 语句创建索引"
    />

    <template v-else>
        <SortFilterToolbar
            v-model:filter="idxFilter"
            placeholder="搜索索引名称/表名/列名..."
            :fields="idxFieldDefs"
            :sort-key="idxSortKey"
            :sort-dir="idxSortDir"
            @toggle-sort="idxToggleSort"
            item-label="索引"
            :total-count="indexes.length"
            :filtered-count="idxFiltered.length"
        />

        <div
            v-if="idxFiltered.length === 0"
            class="flex h-24 flex-col items-center justify-center text-muted-foreground/70"
        >
            <p class="text-sm">&#x1F50D; 无匹配的索引</p>
        </div>

        <div
            v-for="idx in idxFiltered"
            :key="idx.name"
            :id="'index-' + idx.name"
            class="mb-4 cursor-pointer rounded-lg border border-border bg-card p-4 shadow-sm hover:border-primary hover:shadow-md"
            :class="{ 'animate-flash': flashTarget === 'index-' + idx.name }"
            @click="emit('navigate', { tab: 'tables', targetId: 'table-' + idx.tableName })"
        >
            <div class="mb-2 flex items-center gap-2">
                <span class="text-lg">&#x1F4C7;</span>
                <span class="font-bold text-secondary-foreground">{{ idx.name }}</span>
                <span
                    v-if="idx.unique"
                    class="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700"
                    >唯一</span
                >
                <span
                    v-if="idx.columns.length > 1"
                    class="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700"
                    >复合</span
                >
                <span
                    v-if="idx.sql && /lower\s*\(/i.test(idx.sql)"
                    class="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700"
                    >表达式</span
                >
                <span
                    v-if="idx.sql && /\bWHERE\b/i.test(idx.sql)"
                    class="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700"
                    >部分</span
                >
            </div>
            <div class="mb-1 text-xs text-muted-foreground">
                表：<span class="font-medium text-secondary-foreground">{{ idx.tableName }}</span>
            </div>
            <div class="mb-3 text-xs text-muted-foreground">
                列：<span class="text-secondary-foreground">{{ idx.columns.join(', ') }}</span>
            </div>
            <pre
                v-if="idx.sql"
                class="overflow-x-auto rounded bg-secondary p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground"
                @click.stop
                >{{ idx.sql }}</pre>
        </div>
    </template>
</template>

<script setup lang="ts">
import { type SortField, useSortFilter } from '@/composables/useSortFilter'
import type { IndexInfo } from '@/model/DatabaseTypes'

import EmptyState from '../EmptyState.vue'
import type { SortFieldDef } from '../SortFilterToolbar.vue'
import SortFilterToolbar from '../SortFilterToolbar.vue'

const props = defineProps<{
    indexes: IndexInfo[]
    flashTarget: string | null
}>()

const emit = defineEmits<{
    navigate: [payload: { tab: string; targetId?: string }]
}>()

// --- Index sort/filter ---
const strCmp = (a: string, b: string) => a.localeCompare(b)
const numCmp = (a: number, b: number) => a - b

const idxFieldDefs: SortFieldDef[] = [
    { key: 'name', label: '名称' },
    { key: 'table', label: '表名' },
    { key: 'cols', label: '列数' },
    { key: 'unique', label: '唯一' }
]

const idxSortFields: SortField<IndexInfo>[] = [
    { key: 'name', label: '名称', compare: (a, b) => strCmp(a.name, b.name) },
    { key: 'table', label: '表名', compare: (a, b) => strCmp(a.tableName, b.tableName) },
    { key: 'cols', label: '列数', compare: (a, b) => numCmp(a.columns.length, b.columns.length) },
    {
        key: 'unique',
        label: '唯一',
        compare: (a, b) => (a.unique === b.unique ? 0 : a.unique ? -1 : 1)
    }
]

const {
    sortKey: idxSortKey,
    sortDir: idxSortDir,
    filterText: idxFilter,
    toggleSort: idxToggleSort,
    result: idxFiltered
} = useSortFilter(
    () => props.indexes,
    idxSortFields,
    (idx, f) =>
        idx.name.toLowerCase().includes(f) ||
        idx.tableName.toLowerCase().includes(f) ||
        idx.columns.some((c) => c.toLowerCase().includes(f))
)
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
