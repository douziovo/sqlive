<template>
  <div class="h-full bg-muted px-3 py-6 overflow-auto custom-scrollbar flex flex-col relative">

    <!--    <h2 class="text-xl font-bold mb-4 text-foreground flex items-center gap-2">-->
    <h2 class="text-xl font-bold text-foreground flex items-center gap-2">
      &#x1F4CA; 视图展示区
    </h2>

    <!-- Tab bar -->
    <div class="flex border-b border-border mb-2">
      <button
          v-for="tab in tabs" :key="tab.key"
          :data-testid="'tab-' + tab.key"
          @click="activeTab = tab.key"
          class="px-4 py-2 text-sm font-medium transition-colors border-b-[3px]"
          :class="activeTab === tab.key
            ? 'text-primary border-primary'
            : 'text-muted-foreground border-transparent hover:text-secondary-foreground'"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Metadata bar -->
    <div v-if="db.metadata" class="text-xs text-muted-foreground/70 mb-3 px-1">
      &#x26A1; {{ db.metadata.durationMs }}ms | {{ db.metadata.statementCount }} 条语句
    </div>

    <!-- Tab: 表数据 -->
    <div v-if="activeTab === 'tables'" class="flex flex-col">
      <EmptyState v-if="db.tables.length === 0" icon="&#x1F4ED;" title="暂无数据表" />

      <TableSection
          v-for="table in db.tables"
          :key="table.name"
          :table="table"
          :highlight="highlight"
          :indexes="db.indexes"
          :triggers="db.triggers"
          :views="db.views"
          :flash-table-name="flashTableName"
          @update-cell="emit('update-cell', $event)"
          @delete-row="emit('delete-row', $event)"
          @insert-row="emit('insert-row', $event)"
          @drop-table="emit('drop-table', $event)"
          @navigate-tab="handleNavigate"
      />

      <div class="mt-4 pb-8 flex justify-center">
        <button @click="showCreateModal = true"
                class="flex items-center gap-2 px-6 py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/10 transition-colors font-semibold">
          <span>&#x2795;</span> 添加新表格
        </button>
      </div>
      <CreateTableModal :open="showCreateModal" @update:open="showCreateModal = $event" @submit="handleCreateTable"/>
    </div>

    <!-- Tab: ER 图 -->
    <div v-else-if="activeTab === 'er'" class="flex-1 min-h-0">
      <ErDiagram
          :tables="db.tables"
          :foreign-keys="db.foreignKeys"
          @navigate-tab="handleNavigate"
      />
    </div>

    <!-- Tab: 索引 -->
    <div v-else-if="activeTab === 'indexes'">
      <EmptyState v-if="db.indexes.length === 0" icon="&#x1F4ED;" title="暂无索引" subtitle="在 SQL 中使用 CREATE INDEX 语句创建索引" />

      <template v-else>
        <SortFilterToolbar
            v-model:filter="idxFilter"
            placeholder="搜索索引名称/表名/列名..."
            :fields="idxFieldDefs"
            :sort-key="idxSortKey"
            :sort-dir="idxSortDir"
            @toggle-sort="idxToggleSort"
            item-label="索引"
            :total-count="db.indexes.length"
            :filtered-count="idxFiltered.length"
        />

        <div v-if="idxFiltered.length === 0" class="flex flex-col items-center justify-center h-24 text-muted-foreground/70">
          <p class="text-sm">&#x1F50D; 无匹配的索引</p>
        </div>

        <div v-for="idx in idxFiltered" :key="idx.name" :id="'index-' + idx.name"
             class="mb-4 border border-border rounded-lg bg-card shadow-sm hover:shadow-md hover:border-primary p-4 cursor-pointer"
             :class="{ 'animate-flash': flashTarget === 'index-' + idx.name }"
             @click="handleNavigate({ tab: 'tables', targetId: 'table-' + idx.tableName })">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">&#x1F4C7;</span>
            <span class="font-bold text-secondary-foreground">{{ idx.name }}</span>
            <span v-if="idx.unique"
                  class="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">唯一</span>
            <span v-if="idx.columns.length > 1"
                  class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">复合</span>
            <span v-if="idx.sql && /lower\s*\(/i.test(idx.sql)"
                  class="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">表达式</span>
            <span v-if="idx.sql && /\bWHERE\b/i.test(idx.sql)"
                  class="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">部分</span>
          </div>
          <div class="text-xs text-muted-foreground mb-1">
            表：<span class="text-secondary-foreground font-medium">{{ idx.tableName }}</span>
          </div>
          <div class="text-xs text-muted-foreground mb-3">
            列：<span class="text-secondary-foreground">{{ idx.columns.join(', ') }}</span>
          </div>
          <pre v-if="idx.sql"
               class="text-xs font-mono bg-secondary rounded p-3 text-muted-foreground overflow-x-auto whitespace-pre-wrap"
               @click.stop>{{ idx.sql }}</pre>
        </div>
      </template>
    </div>

    <!-- Tab: 视图 -->
    <div v-else-if="activeTab === 'views'">
      <EmptyState v-if="db.views.length === 0" icon="&#x1F4ED;" title="暂无视图" subtitle="在 SQL 中使用 CREATE VIEW 语句创建视图" />

      <template v-else>
        <SortFilterToolbar
            v-model:filter="viewFilter"
            placeholder="搜索视图名称/SQL..."
            :fields="viewFieldDefs"
            :sort-key="viewSortKey"
            :sort-dir="viewSortDir"
            @toggle-sort="viewToggleSort"
            item-label="视图"
            :total-count="db.views.length"
            :filtered-count="viewFiltered.length"
        />

        <div v-if="viewFiltered.length === 0" class="flex flex-col items-center justify-center h-24 text-muted-foreground/70">
          <p class="text-sm">&#x1F50D; 无匹配的视图</p>
        </div>

        <div v-for="v in viewFiltered" :key="v.name" :id="'view-' + v.name"
             class="mb-4 border border-border rounded-lg bg-card shadow-sm hover:shadow-md hover:border-primary p-4 cursor-pointer"
             :class="{ 'animate-flash': flashTarget === 'view-' + v.name }"
             @click="navigateToViewTable(v)">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">&#x1F440;</span>
            <span class="font-bold text-secondary-foreground">{{ v.name }}</span>
          </div>
          <pre class="text-xs font-mono bg-secondary rounded p-3 text-muted-foreground overflow-x-auto whitespace-pre-wrap"
               @click.stop>{{ v.sql }}</pre>
        </div>
      </template>
    </div>

    <!-- Tab: 触发器 -->
    <div v-else-if="activeTab === 'triggers'">
      <EmptyState v-if="db.triggers.length === 0" icon="&#x1F4ED;" title="暂无触发器" subtitle="在 SQL 中使用 CREATE TRIGGER 语句创建触发器" />

      <template v-else>
        <SortFilterToolbar
            v-model:filter="trgFilter"
            placeholder="搜索触发器名称/表名/SQL..."
            :fields="trgFieldDefs"
            :sort-key="trgSortKey"
            :sort-dir="trgSortDir"
            @toggle-sort="trgToggleSort"
            item-label="触发器"
            :total-count="db.triggers.length"
            :filtered-count="trgFiltered.length"
        />

        <div v-if="trgFiltered.length === 0" class="flex flex-col items-center justify-center h-24 text-muted-foreground/70">
          <p class="text-sm">&#x1F50D; 无匹配的触发器</p>
        </div>

        <div v-for="t in trgFiltered" :key="t.name" :id="'trigger-' + t.name"
             class="mb-4 border border-border rounded-lg bg-card shadow-sm hover:shadow-md hover:border-primary p-4 cursor-pointer"
             :class="{ 'animate-flash': flashTarget === 'trigger-' + t.name }"
             @click="handleNavigate({ tab: 'tables', targetId: 'table-' + t.tableName })">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">&#x26A1;</span>
            <span class="font-bold text-secondary-foreground">{{ t.name }}</span>
          </div>
          <div class="text-xs text-muted-foreground mb-3">
            表：<span class="text-secondary-foreground font-medium">{{ t.tableName }}</span>
          </div>
          <pre class="text-xs font-mono bg-secondary rounded p-3 text-muted-foreground overflow-x-auto whitespace-pre-wrap"
               @click.stop>{{ t.sql }}</pre>
        </div>
      </template>
    </div>

    <!-- Tab: 查询结果 -->
    <div v-else>
      <EmptyState v-if="db.queryResults.length === 0" icon="&#x1F4CA;" title="暂无查询结果" subtitle="执行 SELECT 语句后结果会显示在这里" />

      <ResultTable
          v-for="(result, i) in db.queryResults"
          :key="i"
          :result="result"
          :index="i"
      />
    </div>

  </div>
</template>

<script setup lang="ts">
import {ref, watch, nextTick, provide, inject, onUnmounted} from 'vue';
import type {DatabaseModel, HighlightState, IndexInfo, ViewInfo, TriggerInfo, CellUpdateEvent, RowDeleteEvent, CreateTableEvent, RowInsertEvent} from '../model/DatabaseTypes';
import { SQL_CONTEXT_KEY } from '../model/injectionKeys';
import {useSortFilter, type SortField} from '../composables/useSortFilter';
import TableSection from './TableSection.vue';
import ResultTable from './ResultTable.vue';
import CreateTableModal from './CreateTableModal.vue';
import SortFilterToolbar from './SortFilterToolbar.vue';
import ErDiagram from './er/ErDiagram.vue';
import EmptyState from './EmptyState.vue';
import type {SortFieldDef} from './SortFilterToolbar.vue';

  const { db, highlight } = inject(SQL_CONTEXT_KEY)!;

const emit = defineEmits<{
  'update-cell': [event: CellUpdateEvent];
  'delete-row': [event: RowDeleteEvent];
  'create-table': [event: CreateTableEvent];
  'drop-table': [name: string];
  'insert-row': [event: RowInsertEvent];
}>();

const showCreateModal = ref(false);
const activeTab = ref('tables');

const tabs = [
  {key: 'tables', label: '表数据'},
  {key: 'er', label: 'ER 图'},
  {key: 'indexes', label: '索引'},
  {key: 'views', label: '视图'},
  {key: 'triggers', label: '触发器'},
  {key: 'results', label: '查询结果'},
];

const handleCreateTable = (payload: CreateTableEvent) => emit('create-table', payload);

// --- Bidirectional navigation ---
const navigateTarget = ref<string | null>(null);
const flashTarget = ref<string | null>(null);

// Store timeout IDs for cleanup on unmount
let flashTableTimeout: ReturnType<typeof setTimeout> | null = null;
let flashTargetTimeout: ReturnType<typeof setTimeout> | null = null;
const flashTableName = ref<string | null>(null);

function handleNavigate(payload: { tab: string; targetId?: string }) {
  activeTab.value = payload.tab;
  if (payload.targetId) {
    navigateTarget.value = payload.targetId;
  }
}

provide('navigate', handleNavigate);

watch(activeTab, () => {
  if (navigateTarget.value) {
    const targetId = navigateTarget.value;
    navigateTarget.value = null;
    nextTick().then(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({behavior: 'smooth', block: 'center'});
        if (targetId.startsWith('table-')) {
          flashTableName.value = targetId.replace('table-', '');
          if (flashTableTimeout) clearTimeout(flashTableTimeout);
          flashTableTimeout = setTimeout(() => {
            flashTableName.value = null;
          }, 1000);
        } else {
          flashTarget.value = targetId;
          if (flashTargetTimeout) clearTimeout(flashTargetTimeout);
          flashTargetTimeout = setTimeout(() => {
            flashTarget.value = null;
          }, 1000);
        }
      }
    });
  }
});

// --- Index sort/filter ---
const strCmp = (a: string, b: string) => a.localeCompare(b);
const numCmp = (a: number, b: number) => a - b;

const idxFieldDefs: SortFieldDef[] = [
  {key: 'name', label: '名称'},
  {key: 'table', label: '表名'},
  {key: 'cols', label: '列数'},
  {key: 'unique', label: '唯一'},
];

const idxSortFields: SortField<IndexInfo>[] = [
  {key: 'name', label: '名称', compare: (a, b) => strCmp(a.name, b.name)},
  {key: 'table', label: '表名', compare: (a, b) => strCmp(a.tableName, b.tableName)},
  {key: 'cols', label: '列数', compare: (a, b) => numCmp(a.columns.length, b.columns.length)},
  {key: 'unique', label: '唯一', compare: (a, b) => (a.unique === b.unique ? 0 : a.unique ? -1 : 1)},
];

const {
  sortKey: idxSortKey, sortDir: idxSortDir,
  filterText: idxFilter, toggleSort: idxToggleSort,
  result: idxFiltered,
} = useSortFilter(
    () => db.indexes,
    idxSortFields,
    (idx, f) => idx.name.toLowerCase().includes(f)
        || idx.tableName.toLowerCase().includes(f)
        || idx.columns.some(c => c.toLowerCase().includes(f)),
);

// --- View sort/filter ---
const viewFieldDefs: SortFieldDef[] = [
  {key: 'name', label: '名称'},
];

const viewSortFields: SortField<ViewInfo>[] = [
  {key: 'name', label: '名称', compare: (a, b) => strCmp(a.name, b.name)},
];

const {
  sortKey: viewSortKey, sortDir: viewSortDir,
  filterText: viewFilter, toggleSort: viewToggleSort,
  result: viewFiltered,
} = useSortFilter(
    () => db.views,
    viewSortFields,
    (v, f) => v.name.toLowerCase().includes(f) || (v.sql || '').toLowerCase().includes(f),
);

// Navigate from view to table (best effort: match table name in SQL)
function navigateToViewTable(v: ViewInfo) {
  const sql = v.sql || '';
  for (const t of db.tables) {
    if (sql.includes(t.name) || sql.includes(`"${t.name}"`) || sql.includes(`\`${t.name}\``)) {
      handleNavigate({tab: 'tables', targetId: 'table-' + t.name});
      return;
    }
  }
  handleNavigate({tab: 'tables'});
}

// --- Trigger sort/filter ---
const trgFieldDefs: SortFieldDef[] = [
  {key: 'name', label: '名称'},
  {key: 'table', label: '表名'},
];

const trgSortFields: SortField<TriggerInfo>[] = [
  {key: 'name', label: '名称', compare: (a, b) => strCmp(a.name, b.name)},
  {key: 'table', label: '表名', compare: (a, b) => strCmp(a.tableName, b.tableName)},
];

const {
  sortKey: trgSortKey, sortDir: trgSortDir,
  filterText: trgFilter, toggleSort: trgToggleSort,
  result: trgFiltered,
} = useSortFilter(
    () => db.triggers,
    trgSortFields,
    (t, f) => t.name.toLowerCase().includes(f)
        || t.tableName.toLowerCase().includes(f)
        || (t.sql || '').toLowerCase().includes(f),
);

onUnmounted(() => {
  if (flashTableTimeout) clearTimeout(flashTableTimeout);
  if (flashTargetTimeout) clearTimeout(flashTargetTimeout);
});
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
