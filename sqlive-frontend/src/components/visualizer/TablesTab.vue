<template>
    <EmptyState v-if="tables.length === 0" icon="&#x1F4ED;" title="暂无数据表" />

    <TableSection
        v-for="table in tables"
        :key="table.name"
        :table="table"
        :indexes="indexes"
        :triggers="triggers"
        :views="views"
        :flash-table-name="flashTableName"
        @update-cell="emit('update-cell', $event)"
        @delete-row="emit('delete-row', $event)"
        @insert-row="emit('insert-row', $event)"
        @drop-table="emit('drop-table', $event)"
        @navigate-tab="emit('navigate', $event)"
    />

    <div class="mt-4 pb-8 flex justify-center">
        <button
            @click="showCreateModal = true"
            class="flex items-center gap-2 px-6 py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/10 transition-colors font-semibold"
        >
            <span>&#x2795;</span> 添加新表格
        </button>
    </div>
    <CreateTableModal
        :open="showCreateModal"
        @update:open="showCreateModal = $event"
        @submit="handleCreateTable"
    />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type {
    CellUpdateEvent,
    CreateTableEvent,
    IndexInfo,
    RowDeleteEvent,
    RowInsertEvent,
    TableSchema,
    TriggerInfo,
    ViewInfo
} from '../../model/DatabaseTypes'
import CreateTableModal from '../CreateTableModal.vue'
import EmptyState from '../EmptyState.vue'
import TableSection from '../TableSection.vue'

defineProps<{
    tables: TableSchema[]
    indexes: IndexInfo[]
    triggers: TriggerInfo[]
    views: ViewInfo[]
    flashTableName?: string | null
}>()

const emit = defineEmits<{
    'update-cell': [event: CellUpdateEvent]
    'delete-row': [event: RowDeleteEvent]
    'create-table': [event: CreateTableEvent]
    'drop-table': [name: string]
    'insert-row': [event: RowInsertEvent]
    navigate: [payload: { tab: string; targetId?: string }]
}>()

const showCreateModal = ref(false)

const handleCreateTable = (payload: CreateTableEvent) => emit('create-table', payload)
</script>
