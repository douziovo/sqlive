<template>
    <div class="h-full bg-muted px-3 py-6 overflow-auto custom-scrollbar flex flex-col relative">
        <!--    <h2 class="text-xl font-bold mb-4 text-foreground flex items-center gap-2">-->
        <h2 class="text-xl font-bold text-foreground flex items-center gap-2">
            &#x1F4CA; 视图展示区
        </h2>

        <!-- Tab bar -->
        <div class="flex border-b border-border mb-2">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                :data-testid="'tab-' + tab.key"
                @click="activeTab = tab.key"
                class="px-4 py-2 text-sm font-medium transition-colors border-b-[3px]"
                :class="
                    activeTab === tab.key
                        ? 'text-primary border-primary'
                        : 'text-muted-foreground border-transparent hover:text-secondary-foreground'
                "
            >
                {{ tab.label }}
            </button>
        </div>

        <!-- Metadata bar -->
        <div v-if="metadata" class="text-xs text-muted-foreground/70 mb-3 px-1">
            &#x26A1; {{ metadata.durationMs }}ms | {{ metadata.statementCount }} 条语句
        </div>

        <!-- Tab: 表数据 -->
        <div v-show="activeTab === 'tables'" class="flex flex-col">
            <TablesTab
                :tables="tables"
                :indexes="indexes"
                :triggers="triggers"
                :views="views"
                :flash-table-name="flashTableName"
                @update-cell="emit('update-cell', $event)"
                @delete-row="emit('delete-row', $event)"
                @insert-row="emit('insert-row', $event)"
                @drop-table="emit('drop-table', $event)"
                @create-table="emit('create-table', $event)"
                @navigate="handleNavigate"
            />
        </div>

        <!-- Tab: ER 图 -->
        <div v-show="activeTab === 'er'" class="flex-1 min-h-0">
            <ErDiagram :tables="tables" :foreign-keys="foreignKeys" @navigate-tab="handleNavigate" />
        </div>

        <!-- Tab: 索引 -->
        <div v-show="activeTab === 'indexes'">
            <IndexesTab
                :indexes="indexes"
                :flash-target="flashTarget"
                @navigate="handleNavigate"
            />
        </div>

        <!-- Tab: 视图 -->
        <div v-show="activeTab === 'views'">
            <ViewsTab
                :views="views"
                :tables="tables"
                :flash-target="flashTarget"
                @navigate="handleNavigate"
            />
        </div>

        <!-- Tab: 触发器 -->
        <div v-show="activeTab === 'triggers'">
            <TriggersTab :triggers="triggers" :flash-target="flashTarget" @navigate="handleNavigate" />
        </div>

        <!-- Tab: 查询结果 -->
        <div v-show="activeTab === 'results'">
            <EmptyState
                v-if="queryResults.length === 0"
                icon="&#x1F4CA;"
                title="暂无查询结果"
                subtitle="执行 SELECT 语句后结果会显示在这里"
            />

            <ResultTable v-for="(result, i) in queryResults" :key="i" :result="result" :index="i" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onUnmounted, provide, ref, watch } from 'vue'
import type {
    CellUpdateEvent,
    CreateTableEvent,
    RowDeleteEvent,
    RowInsertEvent
} from '../model/DatabaseTypes'
import { SQL_CONTEXT_KEY } from '../model/injectionKeys'
import EmptyState from './EmptyState.vue'
import ErDiagram from './er/ErDiagram.vue'
import ResultTable from './ResultTable.vue'
import IndexesTab from './visualizer/IndexesTab.vue'
import TablesTab from './visualizer/TablesTab.vue'
import TriggersTab from './visualizer/TriggersTab.vue'
import ViewsTab from './visualizer/ViewsTab.vue'

const { db } = inject(SQL_CONTEXT_KEY)!

// wrap each db field in computed so dropping a DatabaseModel field
// becomes a compile-time error (template references the computed, which fails
// tsc if the underlying db field is removed) instead of a silent template fail.
const tables = computed(() => db.tables)
const indexes = computed(() => db.indexes)
const views = computed(() => db.views)
const triggers = computed(() => db.triggers)
const foreignKeys = computed(() => db.foreignKeys)
const metadata = computed(() => db.metadata)
const queryResults = computed(() => db.queryResults)

const emit = defineEmits<{
    'update-cell': [event: CellUpdateEvent]
    'delete-row': [event: RowDeleteEvent]
    'create-table': [event: CreateTableEvent]
    'drop-table': [name: string]
    'insert-row': [event: RowInsertEvent]
}>()

const activeTab = ref('tables')

const tabs = [
    { key: 'tables', label: '表数据' },
    { key: 'er', label: 'ER 图' },
    { key: 'indexes', label: '索引' },
    { key: 'views', label: '视图' },
    { key: 'triggers', label: '触发器' },
    { key: 'results', label: '查询结果' }
]

// --- Bidirectional navigation ---
const navigateTarget = ref<string | null>(null)
const flashTarget = ref<string | null>(null)

// Store timeout IDs for cleanup on unmount
let flashTableTimeout: ReturnType<typeof setTimeout> | null = null
let flashTargetTimeout: ReturnType<typeof setTimeout> | null = null
const flashTableName = ref<string | null>(null)

function handleNavigate(payload: { tab: string; targetId?: string }) {
    activeTab.value = payload.tab
    if (payload.targetId) {
        navigateTarget.value = payload.targetId
    }
}

provide('navigate', handleNavigate)

watch(activeTab, () => {
    if (navigateTarget.value) {
        const targetId = navigateTarget.value
        navigateTarget.value = null
        nextTick().then(() => {
            const el = document.getElementById(targetId)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                if (targetId.startsWith('table-')) {
                    flashTableName.value = targetId.replace('table-', '')
                    if (flashTableTimeout) clearTimeout(flashTableTimeout)
                    flashTableTimeout = setTimeout(() => {
                        flashTableName.value = null
                    }, 1000)
                } else {
                    flashTarget.value = targetId
                    if (flashTargetTimeout) clearTimeout(flashTargetTimeout)
                    flashTargetTimeout = setTimeout(() => {
                        flashTarget.value = null
                    }, 1000)
                }
            }
        })
    }
})

onUnmounted(() => {
    if (flashTableTimeout) clearTimeout(flashTableTimeout)
    if (flashTargetTimeout) clearTimeout(flashTargetTimeout)
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: #94a3b8;
}
</style>
