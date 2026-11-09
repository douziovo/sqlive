<template>
    <EmptyState
        v-if="views.length === 0"
        icon="&#x1F4ED;"
        title="暂无视图"
        subtitle="在 SQL 中使用 CREATE VIEW 语句创建视图"
    />

    <template v-else>
        <SortFilterToolbar
            v-model:filter="viewFilter"
            placeholder="搜索视图名称/SQL..."
            :fields="viewFieldDefs"
            :sort-key="viewSortKey"
            :sort-dir="viewSortDir"
            @toggle-sort="viewToggleSort"
            item-label="视图"
            :total-count="views.length"
            :filtered-count="viewFiltered.length"
        />

        <div
            v-if="viewFiltered.length === 0"
            class="flex h-24 flex-col items-center justify-center text-muted-foreground/70"
        >
            <p class="text-sm">&#x1F50D; 无匹配的视图</p>
        </div>

        <div
            v-for="v in viewFiltered"
            :key="v.name"
            :id="'view-' + v.name"
            class="mb-4 cursor-pointer rounded-lg border border-border bg-card p-4 shadow-sm hover:border-primary hover:shadow-md"
            :class="{ 'animate-flash': flashTarget === 'view-' + v.name }"
            @click="navigateToViewTable(v)"
        >
            <div class="mb-2 flex items-center gap-2">
                <span class="text-lg">&#x1F440;</span>
                <span class="font-bold text-secondary-foreground">{{ v.name }}</span>
            </div>
            <pre
                class="overflow-x-auto rounded bg-secondary p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground"
                @click.stop
                >{{ v.sql }}</pre>
        </div>
    </template>
</template>

<script setup lang="ts">
import { type SortField, useSortFilter } from '@/composables/useSortFilter'
import type { TableSchema, ViewInfo } from '@/model/DatabaseTypes'

import EmptyState from '../EmptyState.vue'
import type { SortFieldDef } from '../SortFilterToolbar.vue'
import SortFilterToolbar from '../SortFilterToolbar.vue'

const props = defineProps<{
    views: ViewInfo[]
    tables: TableSchema[]
    flashTarget: string | null
}>()

const emit = defineEmits<{
    navigate: [payload: { tab: string; targetId?: string }]
}>()

// --- View sort/filter ---
const strCmp = (a: string, b: string) => a.localeCompare(b)

const viewFieldDefs: SortFieldDef[] = [{ key: 'name', label: '名称' }]

const viewSortFields: SortField<ViewInfo>[] = [
    { key: 'name', label: '名称', compare: (a, b) => strCmp(a.name, b.name) }
]

const {
    sortKey: viewSortKey,
    sortDir: viewSortDir,
    filterText: viewFilter,
    toggleSort: viewToggleSort,
    result: viewFiltered
} = useSortFilter(
    () => props.views,
    viewSortFields,
    (v, f) => v.name.toLowerCase().includes(f) || (v.sql || '').toLowerCase().includes(f)
)

// Navigate from view to table (best effort: match table name in SQL)
function navigateToViewTable(v: ViewInfo) {
    const sql = v.sql || ''
    for (const t of props.tables) {
        if (sql.includes(t.name) || sql.includes(`"${t.name}"`) || sql.includes(`\`${t.name}\``)) {
            emit('navigate', { tab: 'tables', targetId: `table-${t.name}` })
            return
        }
    }
    emit('navigate', { tab: 'tables' })
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
