<template>
  <div :id="'table-' + table.name" class="mb-10" :class="{ 'animate-flash': isFlashTarget }">
    <div class="flex items-center gap-3 mb-3 group">
      <div
          class="text-lg font-bold px-3 py-2 rounded-md inline-flex items-center gap-2 transition-colors shadow-sm border"
          :class="[
          {
            'bg-purple-100 text-purple-700 border-purple-300 ring-2 ring-purple-200': highlight.actionType === 'ddl' && highlight.activeTables[0] === table.name,
            'bg-blue-100 text-primary border-blue-300 ring-2 ring-blue-200': highlight.actionType !== 'ddl' && highlight.activeTables[0] === table.name,
            'bg-card text-black border-border': highlight.activeTables[0] !== table.name,
            'animate-flash': (isAnimating && highlight.actionType === 'ddl' && highlight.activeTables[0] === table.name) || isFlashTarget
          }
        ]"
      >
        <span>&#x1F4C4;</span>
        <span>{{ table.name }}</span>

        <!-- Associated badges -->
        <span v-if="tableIndexes.length" @click.stop="navigateTo('indexes')" @mouseenter="onBadgeEnter($event, 'index')" @mouseleave="onBadgeLeave" class="text-xs px-2 py-1 rounded-full bg-blue-50 text-primary border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors font-normal">
          &#x1F4C7; {{ tableIndexes.length }}
        </span>
        <span v-if="tableTriggers.length" @click.stop="navigateTo('triggers')" @mouseenter="onBadgeEnter($event, 'trigger')" @mouseleave="onBadgeLeave" class="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors font-normal">
          &#x26A1; {{ tableTriggers.length }}
        </span>
        <span v-if="tableViews.length" @click.stop="navigateTo('views')" @mouseenter="onBadgeEnter($event, 'view')" @mouseleave="onBadgeLeave" class="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-600 border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors font-normal">
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

    <div class="overflow-x-auto shadow-lg border border-border rounded-lg bg-card relative">
      <!-- Filter bar -->
      <div class="px-3 py-2 border-b border-border bg-muted/50 flex items-center gap-2">
        <span class="text-xs text-muted-foreground/70">&#x1F50D;</span>
        <input
            v-model="filterText"
            type="text"
            placeholder="过滤..."
            class="text-sm bg-transparent outline-none flex-1 text-muted-foreground placeholder-muted-foreground/50"
        />
        <button
            v-if="filterText"
            @click="filterText = ''"
            class="text-muted-foreground/50 hover:text-muted-foreground text-xs leading-none"
        >&#x2715;</button>
      </div>

      <table class="min-w-full text-sm text-left text-muted-foreground table-auto border-collapse">
        <thead class="text-xs text-secondary-foreground uppercase bg-secondary border-b border-border">
        <tr>
          <th
              v-for="col in table.columns" :key="col"
              @click="toggleSort(col)"
              class="px-4 py-3 border-b-2 transition-colors duration-200 align-top cursor-pointer select-none hover:bg-secondary/50"
              style="min-width: 150px;"
              :class="[
                isColumnActive(col) ? 'bg-primary/10 text-primary border-primary' : (sortColumn === col ? 'bg-primary/10 text-primary border-primary/30' : 'border-transparent')
              ]"
          >
            <div class="text-sm font-bold whitespace-nowrap flex items-center gap-1">
              {{ col }}
              <span v-if="sortColumn === col && sortDir === 'asc'" class="text-primary text-xs">&#x25B2;</span>
              <span v-if="sortColumn === col && sortDir === 'desc'" class="text-primary text-xs">&#x25BC;</span>
            </div>
            <div class="text-[10px] text-muted-foreground/70 font-mono mt-1 lowercase whitespace-nowrap overflow-hidden text-ellipsis" :title="table.columnTypes[col]">
              {{ table.columnTypes[col] || 'unknown' }}
            </div>
            <div v-if="columnIndexes[col]" @click.stop="navigateTo('indexes')" @mouseenter.stop="onColumnIdxEnter($event, col)" @mouseleave="onBadgeLeave" class="mt-1 text-[10px] text-primary cursor-pointer hover:text-primary hover:underline font-normal">
              &#x1F4C7; {{ columnIndexes[col].length }}
            </div>
          </th>
          <th class="px-2 py-3 w-10 border-b-2 border-transparent"></th>
        </tr>
        </thead>
        <tbody>
        <tr v-if="paginatedData.length === 0 && filterText" class="border-b">
          <td :colspan="table.columns.length + 1" class="px-4 py-8 text-center text-muted-foreground/70 text-sm italic">
            无匹配数据
          </td>
        </tr>
        <tr
            v-for="(row, idx) in paginatedData"
            :key="row._rawSql || idx"
            class="border-b last:border-b-0 transition-colors duration-200 hover:bg-muted group"
        >
          <td
              v-for="col in table.columns"
              :key="col"
              class="px-4 py-2 border-r last:border-r-0 border-border transition-colors duration-200 relative align-top"
              :class="getCellClasses(row, col)"
          >
            <div class="grid place-items-start w-full relative">
              <div class="invisible whitespace-pre-wrap break-all border border-transparent px-1 py-1 min-h-[1.5em]" style="grid-area: 1/1/2/2;">{{ row[col] || ' ' }}</div>
              <textarea
                  :value="row[col]"
                  @input="(e) => autoResizeGhost(e)"
                  @blur="(e) => handleBlur(e, row, col)"
                  @keydown.enter.prevent="(e) => (e.target as HTMLElement).blur()"
                  class="w-full h-full bg-transparent outline-none border-b border-transparent px-1 py-1 resize-none overflow-hidden absolute inset-0 z-10 whitespace-pre-wrap break-all"
                  :class="{
                    'focus:border-primary': true,
                    'font-bold text-black': isRowHighlighted(row) && isColumnActive(col)
                  }"
                  style="grid-area: 1/1/2/2;"
                  spellcheck="false"
              ></textarea>
            </div>
          </td>
          <td class="px-2 text-center align-middle">
            <button
                @click="emit('delete-row', {row, tableName: table.name})"
                class="text-muted-foreground/50 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100"
                title="删除此行"
            >
              &#x1F5D1;&#xFE0F;
            </button>
          </td>
        </tr>
        <!-- Ghost row -->
        <tr data-testid="ghost-row" class="bg-muted/50 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 border-t border-dashed border-border group/ghost">
          <td v-for="col in table.columns" :key="'ghost-' + col" class="px-4 py-2 border-r border-border/50 align-top">
            <div class="grid place-items-start w-full relative">
              <div class="invisible whitespace-pre-wrap break-all border border-transparent px-1 py-1 min-h-[1.5em]" style="grid-area: 1/1/2/2;">{{ getGhostValue(col) || ' ' }}</div>
              <textarea
                  :value="getGhostValue(col)"
                  @input="(e) => { autoResizeGhost(e); updateGhostState(col, (e.target as HTMLTextAreaElement).value); }"
                  @keydown.enter.prevent="onGhostSubmit()"
                  placeholder="+"
                  class="w-full h-full bg-transparent outline-none border-b border-transparent focus:border-primary focus:bg-background px-1 py-1 resize-none overflow-hidden absolute inset-0 z-10 whitespace-pre-wrap break-all placeholder:text-muted-foreground/50 text-secondary-foreground"
                  style="grid-area: 1/1/2/2;"
                  spellcheck="false"
              ></textarea>
            </div>
          </td>
          <td class="px-2 text-center align-middle">
            <button v-if="hasGhostInput()" @click="onGhostSubmit()" class="text-primary hover:bg-primary/10 p-1 rounded-full transition-colors transition-transform hover:scale-110" title="确认添加">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </button>
          </td>
        </tr>
        </tbody>
      </table>

      <!-- Pagination bar -->
      <div v-if="totalPages > 1" class="px-3 py-2 border-t border-border bg-muted/50 flex items-center justify-between text-xs text-muted-foreground">
        <span>共 {{ totalRows }} 行</span>
        <div class="flex items-center gap-2">
          <select v-model="pageSize" class="text-xs border border-border rounded px-1 py-1 bg-card outline-none">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
          <button
              @click="currentPage--"
              :disabled="currentPage <= 1"
              class="px-2 py-1 rounded border border-border bg-card disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary"
          >&#x2190; 上一页</button>
          <span>{{ currentPage }} / {{ totalPages }}</span>
          <button
              @click="currentPage++"
              :disabled="currentPage >= totalPages"
              class="px-2 py-1 rounded border border-border bg-card disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary"
          >下一页 &#x2192;</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Hover Preview -->
  <HoverPreview
      :show="hoverType !== null"
      :trigger-el="hoverTriggerEl"
      :icon="previewIcon"
      :title="previewTitle"
      :subtitle="previewSubtitle"
      :category-name="previewCategoryName"
      :items="previewItems"
      @select="onPreviewSelect"
      @mouseenter="onPreviewEnter"
      @mouseleave="onBadgeLeave"
      @navigate-all="onPreviewNavigateAll"
  />
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, inject, onUnmounted } from 'vue';
import type { HighlightState, Row, TableSchema, IndexInfo, TriggerInfo, ViewInfo } from '../model/DatabaseTypes';
import { SQL_CONTEXT_KEY } from '../model/injectionKeys';
import { useTablePipeline } from '../composables/useTablePipeline';
import { useInlineEdit } from '../composables/useInlineEdit';
import { isNumericType, extractTriggerTiming } from '../utils/sql';
import HoverPreview from './HoverPreview.vue';
import type { PreviewItem } from './HoverPreview.vue';

const props = defineProps<{
  table: TableSchema;
  indexes: IndexInfo[];
  triggers: TriggerInfo[];
  views: ViewInfo[];
  flashTableName?: string | null;
}>();

const emit = defineEmits(['update-cell', 'delete-row', 'drop-table', 'insert-row', 'navigate-tab']);
const { highlight } = inject(SQL_CONTEXT_KEY)!;

const isFlashTarget = computed(() => props.flashTableName === props.table.name);

// --- Associated indexes / triggers / views ---
const tableIndexes = computed(() => props.indexes.filter(i => i.tableName === props.table.name));
const tableTriggers = computed(() => props.triggers.filter(t => t.tableName === props.table.name));
const tableViews = computed(() =>
  props.views.filter(v => {
    const sql = v.sql || '';
    return sql.includes(props.table.name) || sql.includes(`"${props.table.name}"`) || sql.includes(`\`${props.table.name}\``);
  })
);
const columnIndexes = computed(() => {
  const map: Record<string, string[]> = {};
  for (const idx of tableIndexes.value) {
    for (const col of idx.columns) {
      if (!map[col]) map[col] = [];
      map[col].push(idx.name);
    }
  }
  return map;
});

function navigateTo(tab: string, targetId?: string) {
  emit('navigate-tab', { tab, targetId });
}

// --- Hover preview state ---
type HoverType = 'index' | 'trigger' | 'view' | 'column-index';
const hoverType = ref<HoverType | null>(null);
const hoverTriggerEl = ref<HTMLElement | null>(null);
const hoverColumn = ref<string>('');
let hoverLeaveTimer: ReturnType<typeof setTimeout> | null = null;
let animationTimer: ReturnType<typeof setTimeout> | null = null;

function onBadgeEnter(e: MouseEvent, type: HoverType) {
  if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
  hoverTriggerEl.value = e.currentTarget as HTMLElement;
  hoverType.value = type;
  hoverColumn.value = '';
}

function onColumnIdxEnter(e: MouseEvent, col: string) {
  if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
  hoverTriggerEl.value = e.currentTarget as HTMLElement;
  hoverType.value = 'column-index';
  hoverColumn.value = col;
}

function onBadgeLeave() {
  if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
  hoverLeaveTimer = setTimeout(() => {
    hoverType.value = null;
    hoverTriggerEl.value = null;
    hoverColumn.value = '';
  }, 200);
}

function onPreviewEnter() {
  if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
}

function onPreviewSelect(targetId: string) {
  const tabMap: Record<string, string> = { index: 'indexes', trigger: 'triggers', view: 'views', 'column-index': 'indexes' };
  const tab = tabMap[hoverType.value || 'index'] || 'indexes';
  hoverType.value = null;
  emit('navigate-tab', { tab, targetId });
}

function onPreviewNavigateAll() {
  const currentType = hoverType.value;
  hoverType.value = null;
  if (!currentType) return;
  const tabMap: Record<string, string> = { index: 'indexes', trigger: 'triggers', view: 'views', 'column-index': 'indexes' };
  emit('navigate-tab', { tab: tabMap[currentType] || 'indexes' });
}

// --- Hover preview content ---
const previewIcon = computed(() => {
  if (hoverType.value === 'index' || hoverType.value === 'column-index') return '\u{1F4C7}';
  if (hoverType.value === 'trigger') return '\u{26A1}';
  if (hoverType.value === 'view') return '\u{1F440}';
  return '';
});

const previewTitle = computed(() => {
  if (hoverType.value === 'index') return `索引 · ${props.table.name} 表`;
  if (hoverType.value === 'column-index') return `索引 · ${hoverColumn.value} 列`;
  if (hoverType.value === 'trigger') return `触发器 · ${props.table.name} 表`;
  if (hoverType.value === 'view') return `视图 · 引用 ${props.table.name} 表`;
  return '';
});

const previewSubtitle = computed(() => {
  if (hoverType.value === 'index') return `共 ${tableIndexes.value.length} 个索引`;
  if (hoverType.value === 'column-index') return `此列被 ${columnIndexes.value[hoverColumn.value]?.length || 0} 个索引使用`;
  if (hoverType.value === 'trigger') return `共 ${tableTriggers.value.length} 个触发器`;
  if (hoverType.value === 'view') return `共 ${tableViews.value.length} 个视图`;
  return '';
});

const previewCategoryName = computed(() => {
  if (hoverType.value === 'index' || hoverType.value === 'column-index') return '索引';
  if (hoverType.value === 'trigger') return '触发器';
  if (hoverType.value === 'view') return '视图';
  return '';
});

const previewItems = computed((): PreviewItem[] => {
  if (hoverType.value === 'index') {
    return tableIndexes.value.map(idx => ({
      id: 'index-' + idx.name,
      icon: idx.unique ? '\u{1F48E}' : '\u{1F4CB}',
      label: idx.name,
      meta: [`列: ${idx.columns.join(', ')}  ·  ${idx.unique ? 'UNIQUE' : '普通'}`],
      sqlPreview: idx.sql ? idx.sql.substring(0, 80) + (idx.sql.length > 80 ? '...' : '') : undefined,
      accent: (idx.unique ? 'blue' : 'none') as 'blue' | 'none',
    }));
  }
  if (hoverType.value === 'column-index') {
    const col = hoverColumn.value;
    const colIdxNames = columnIndexes.value[col] || [];
    return colIdxNames.map(name => {
      const idx = tableIndexes.value.find(i => i.name === name);
      const colPos = idx ? idx.columns.indexOf(col) + 1 : 0;
      const otherCols = idx ? idx.columns.filter(c => c !== col) : [];
      const meta = [`第 ${colPos} 列 (共 ${idx?.columns.length || 0} 列)`];
      if (otherCols.length > 0) meta.push(`其他列: ${otherCols.join(', ')}`);
      return {
        id: 'index-' + name,
        icon: idx?.unique ? '\u{1F48E}' : '\u{1F4CB}',
        label: name,
        meta,
        accent: (idx?.unique ? 'blue' : 'none') as 'blue' | 'none',
      };
    });
  }
  if (hoverType.value === 'trigger') {
    return tableTriggers.value.map(t => {
      const timing = extractTriggerTiming(t.sql);
      return {
        id: 'trigger-' + t.name,
        icon: '\u{26A1}',
        label: t.name,
        meta: timing ? [timing] : [],
        tag: timing || undefined,
        sqlPreview: t.sql ? t.sql.substring(0, 80) + (t.sql.length > 80 ? '...' : '') : undefined,
      };
    });
  }
  if (hoverType.value === 'view') {
    return tableViews.value.map(v => ({
      id: 'view-' + v.name,
      icon: '\u{1F440}',
      label: v.name,
      meta: v.sql ? [v.sql.split('\n')[0]?.substring(0, 60) || ''] : [],
      sqlPreview: v.sql ? v.sql.substring(0, 80) + (v.sql.length > 80 ? '...' : '') : undefined,
    }));
  }
  return [];
});

const isAnimating = ref(false);
const ghostRow = reactive<Row>({});

// Sort/filter/page pipeline — extracted into composable
const {
  sortColumn, sortDir, toggleSort,
  filterText, filterColumns,
  currentPage, pageSize,
  paginatedData, totalRows, totalPages,
} = useTablePipeline(
  () => props.table.data,
  () => props.table.columnTypes,
);
// Initialize filter columns to the table's columns
filterColumns.value = props.table.columns;

// --- Animation ---
watch(() => highlight.refreshSeed, () => {
  isAnimating.value = true;
  if (animationTimer) clearTimeout(animationTimer);
  animationTimer = setTimeout(() => { isAnimating.value = false; }, 1000);
});

// --- Ghost row ---
const { autoResizeGhost, handleBlur } = useInlineEdit(
  props.table.name,
  props.table.columnTypes,
  emit,
);

const getGhostValue = (col: string) => ghostRow[col] || '';
const updateGhostState = (col: string, val: string) => {
  ghostRow[col] = val;
};
const hasGhostInput = () => {
  return Object.values(ghostRow).some(v => v && String(v).trim() !== '');
};
const onGhostSubmit = () => {
  if (hasGhostInput()) {
    emit('insert-row', { tableName: props.table.name, newRow: { ...ghostRow } });
    Object.keys(ghostRow).forEach(k => delete ghostRow[k]);
  }
};

// --- Highlight helpers ---
const getRowId = (row: any) => row.id !== undefined ? row.id : row._highlightId;
const rowKey = (row: any) => `${props.table.name}:${getRowId(row)}`;

const activeRowSet = computed(() => new Set(highlight.activeRows));
const activeColumnSet = computed(() => new Set(highlight.activeColumns));

const isRowHighlighted = (row: any) => activeRowSet.value.has(rowKey(row));
const isColumnActive = (colName: string) => activeColumnSet.value.has(colName);
const flashingRowSet = computed(() => new Set(highlight.flashingRows));

const getCellClasses = (row: any, col: string) => {
  const classes: string[] = [];
  if (isAnimating.value && flashingRowSet.value.has(rowKey(row))) {
    classes.push('flash-overlay');
  }
  const typeStr = props.table.columnTypes[col] || '';
  const isVirtual = typeStr.includes('VIRTUAL');
  const isHighlighted = isRowHighlighted(row) && isColumnActive(col);

  if (isVirtual) {
    classes.push('bg-primary/10 text-primary font-bold border-l-2 border-primary/20');
  } else if (isHighlighted) {
    classes.push('bg-yellow-100 text-gray-900 font-bold');
  } else {
    classes.push('text-muted-foreground');
  }
  return classes.join(' ');
};

onUnmounted(() => {
  if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
  if (animationTimer) clearTimeout(animationTimer);
});
</script>

<style scoped>
.flash-overlay { position: relative; overflow: hidden; }
.flash-overlay::after {
  content: ""; position: absolute; inset: 0; background-color: #ff6600; z-index: 5;
  animation: fade-out 1.2s ease-out forwards; pointer-events: none;
}
@keyframes fade-out { 0% { opacity: 0.8; } 100% { opacity: 0; } }
@keyframes flash-bg { 0% { background-color: rgba(250, 204, 21, 0.6); transform: scale(1.02); } 100% { background-color: transparent; transform: scale(1); } }
.animate-flash { animation: flash-bg 0.8s ease-out; }
</style>
