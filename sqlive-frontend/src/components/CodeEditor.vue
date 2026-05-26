<template>
  <div class="h-full flex flex-col bg-muted pt-6 px-3 pb-3 relative"
       @dragover.prevent="dragOver = true"
       @dragleave="dragOver = false"
       @drop.prevent="onDrop">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-xl font-bold text-foreground flex items-center gap-2">
        <span>&#x1F4BB;</span> SQL 编辑器
      </h2>
      <div class="flex items-center gap-2">
        <!-- DB selector -->
        <div class="flex items-center gap-1">
          <span class="text-xs text-muted-foreground">数据库</span>
          <select
            :value="activeDbName"
            @change="emit('set-db-name', activeTabId, ($event.target as HTMLSelectElement).value)"
            class="text-xs font-medium border border-border rounded px-2 py-1 bg-card text-black outline-none cursor-pointer hover:border-primary/60"
          >
            <option value="">（实时模式）</option>
            <option v-for="name in dbList" :key="name" :value="name">{{ name }}</option>
          </select>
          <button
            v-if="activeDbName"
            @click="confirmDeleteDb"
            class="text-muted-foreground/70 hover:text-destructive text-sm px-1 transition-colors"
            title="删除数据库"
          >&#x1F5D1;</button>
        </div>
        <!-- Submit button -->
        <button
          @click="handleSubmit"
          class="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-primary text-white rounded hover:bg-primary/90 transition-colors shadow-sm"
          title="提交到数据库 (Ctrl+Shift+T)"
        >
          提交
        </button>
        <!-- AI toggle button -->
        <button
          v-if="ai"
          data-testid="ai-toggle-btn"
          @click="ai.onTogglePanel()"
          class="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors shadow-sm"
          :class="ai.isLoading.value ? 'bg-primary text-primary-foreground animate-pulse' : 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary border border-primary/20 hover:bg-primary/10'"
          title="AI 助手 (Alt+Enter QuickFix)"
        >
          <span v-if="ai.isLoading.value" class="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          <span v-else>🤖</span>
          AI
        </button>
      </div>
    </div>

    <!-- Hidden file input for import (triggered via context menu) -->
    <input ref="fileInput" type="file" accept=".sql,.txt" class="hidden" @change="onFileInput" />

    <!-- Tab bar -->
    <div class="flex items-center gap-1 mb-1">
      <!-- Tab search button -->
      <div class="relative flex-shrink-0">
        <button
          @click.stop="showTabSearch = !showTabSearch"
          class="px-2 py-2 text-xs text-muted-foreground/70 hover:text-primary hover:bg-secondary rounded transition-colors"
          title="搜索标签页"
        >&#x25BC;</button>
        <!-- Search dropdown -->
        <div v-if="showTabSearch" class="absolute left-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg z-40 w-64">
          <div class="p-2 border-b border-border">
            <input
              ref="tabSearchInput"
              v-model="tabSearchText"
              type="text"
              placeholder="搜索标签页..."
              class="w-full text-xs border border-border rounded-lg px-2 py-1 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              @keydown.escape="showTabSearch = false"
              @keydown.enter="switchToFirstMatch"
            />
          </div>
          <div class="max-h-48 overflow-y-auto">
            <div
              v-for="tab in filteredTabs"
              :key="tab.id"
              @click="switchToTab(tab.id)"
              class="flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-primary/10 transition-colors"
              :class="{ 'bg-primary/10 text-primary': tab.id === activeTabId }"
            >
              <span class="truncate">
                <span v-html="highlightTabName(tab.name)"></span>
                <span v-if="tab.dbName" class="text-[10px] text-muted-foreground/70 ml-1">· {{ tab.dbName }}</span>
              </span>
              <button
                v-if="tabs.length > 1"
                @click.stop="emit('close-tab', tab.id)"
                class="text-muted-foreground/50 hover:text-muted-foreground text-sm leading-none ml-2 flex-shrink-0"
              >&#x2715;</button>
            </div>
            <div v-if="filteredTabs.length === 0" class="px-3 py-3 text-xs text-muted-foreground/70 text-center">
              无匹配标签页
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
        <div v-for="tab in tabs" :key="tab.id"
             @click.stop="emit('switch-tab', tab.id)"
             class="group flex items-center gap-1 px-2 py-2 text-xs rounded-t-md cursor-pointer transition-colors border-b-[3px] flex-shrink"
             style="min-width: 52px; max-width: 180px;"
             :class="tab.id === activeTabId
               ? 'bg-card text-primary border-primary font-medium flex-shrink-0'
               : 'text-muted-foreground border-transparent hover:bg-secondary hover:text-secondary-foreground'"
             :title="tab.name + (tab.dbName ? ' · ' + tab.dbName : '')">
          <span class="truncate leading-none min-w-[1ch]">{{ tab.name }}</span>
          <span
            v-if="tab.dbName"
            class="text-[9px] text-muted-foreground/50 bg-secondary rounded-full px-1 flex-shrink-0 hidden sm:inline"
          >{{ tab.dbName }}</span>
          <button
            v-if="tabs.length > 1"
            data-testid="tab-close-btn"
            @click.stop="emit('close-tab', tab.id)"
            :class="tab.id === activeTabId
              ? 'text-muted-foreground hover:text-secondary-foreground'
              : 'text-muted-foreground/70 hover:text-muted-foreground opacity-0 group-hover:opacity-100'"
            class="transition-opacity text-sm leading-none px-1 font-bold flex-shrink-0">
            &#x2715;
          </button>
        </div>
        <button @click="emit('add-tab')"
                class="px-2 py-1 text-xs text-muted-foreground/70 hover:text-primary hover:bg-secondary rounded transition-colors flex-shrink-0" title="新建标签页">
          &#x2795;
        </button>
      </div>
    </div>

    <!-- Click-outside overlay for tab search -->
    <div v-if="showTabSearch" class="fixed inset-0 z-30" @click="showTabSearch = false"></div>

    <div class="flex-1 relative w-full flex flex-col">
      <div ref="editorContainer" class="flex-1 min-h-0"></div>
    </div>

    <!-- Drop overlay -->
    <div v-if="dragOver"
         class="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary/60 rounded-lg z-20 flex items-center justify-center pointer-events-none">
      <div class="bg-card rounded-lg shadow-lg px-6 py-4 text-center">
        <div class="text-3xl mb-2">&#x1F4E5;</div>
        <p class="text-sm text-muted-foreground">释放以导入 .sql 文件</p>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed, inject } from 'vue';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { format } from 'sql-formatter';
import { highlightMatch } from '../utils/html';
import { SQL_CONTEXT_KEY, AI_ACTIONS_KEY } from '../viewmodel/injectionKeys';

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};


const props = defineProps<{
  code: string;
}>();

const emit = defineEmits<{
  'update:code': [value: string];
  'switch-tab': [id: string];
  'add-tab': [];
  'close-tab': [id: string];
  'set-db-name': [id: string, dbName: string];
  'delete-db': [dbName: string];
  'submit': [];
  'import-file': [file: File];
  'export-tab': [];
  'export-all': [];
}>();

const ctx = inject(SQL_CONTEXT_KEY)!;
const { tabs, activeTabId, activeDbName, dbList, highlightChunk, error } = ctx;
const ai = inject(AI_ACTIONS_KEY)!;

const editorContainer = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);
const showTabSearch = ref(false);
const tabSearchText = ref('');
const tabSearchInput = ref<HTMLInputElement | null>(null);

const state = {
  editor: null as monaco.editor.IStandaloneCodeEditor | null,
  ignoreChanges: false,
  highlightDeco: null as monaco.editor.IEditorDecorationsCollection | null,
};
const disposables: monaco.IDisposable[] = [];

function formatSql() {
  if (!state.editor) return;
  try {
    const formatted = format(state.editor.getValue(), { language: 'sqlite', tabWidth: 4 });
    state.editor.setValue(formatted);
  } catch {
    // Silently ignore format errors
  }
}

onMounted(() => {
  if (!editorContainer.value) return;

  state.editor = monaco.editor.create(editorContainer.value, {

    value: props.code,
    language: 'sql',
    theme: 'vs',
    fontSize: 14,
    fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    lineNumbers: 'on',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    hover: { above: false },
    automaticLayout: true,
    tabSize: 4,
    renderWhitespace: 'selection',
    wordWrap: 'bounded',
    wordWrapColumn: 160,
    wrappingIndent: 'indent',
    wrappingStrategy: 'advanced',
    padding: { top: 16, bottom: 16 },
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    scrollbar: {
      verticalScrollbarSize: 6,
      horizontalScrollbarSize: 6,
      verticalSliderSize: 6,
      horizontalSliderSize: 6,
      alwaysConsumeMouseWheel: false,
    },
  });

  state.highlightDeco = state.editor.createDecorationsCollection();

  state.editor.onDidChangeModelContent(() => {
    if (state.ignoreChanges) return;
    emit('update:code', state.editor!.getValue());
  });

  // --- Context menu & keyboard shortcuts ---
  // Submit: Ctrl+Shift+T
  state.editor.addAction({
    id: 'submit-sql',
    label: '提交到数据库',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyT],
    contextMenuGroupId: '9_sql',
    contextMenuOrder: 0,
    run: () => emit('submit'),
  });

  // Format: Ctrl+Shift+L
  state.editor.addAction({
    id: 'format-sql',
    label: '格式化 SQL',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyL],
    contextMenuGroupId: '9_sql',
    contextMenuOrder: 1,
    run: () => formatSql(),
  });

  // Import
  state.editor.addAction({
    id: 'import-sql',
    label: '导入 .sql 文件',
    contextMenuGroupId: '9_sql',
    contextMenuOrder: 2,
    run: () => fileInput.value?.click(),
  });

  // Export current tab
  state.editor.addAction({
    id: 'export-tab',
    label: '导出当前标签页',
    contextMenuGroupId: '9_sql',
    contextMenuOrder: 3,
    run: () => emit('export-tab'),
  });

  // Export all tabs
  state.editor.addAction({
    id: 'export-all',
    label: '导出全部标签页',
    contextMenuGroupId: '9_sql',
    contextMenuOrder: 4,
    run: () => emit('export-all'),
  });

  // ── AI: right-click context menu ──
  if (ai) {
    state.editor.addAction({
      id: 'ai-send-selection',
      label: '💬 发送选中代码到 AI 对话',
      contextMenuGroupId: '9_sql',
      contextMenuOrder: 10,
      run: () => {
        const sel = state.editor?.getModel()?.getValueInRange(state.editor.getSelection()!);
        if (sel?.trim()) {
          ai.sendToAi(`请帮我看看这段 SQL：\n\n\`\`\`sql\n${sel.trim()}\n\`\`\``);
        }
      },
    });

    state.editor.addAction({
      id: 'ai-generate-sql',
      label: '✨ AI 帮我写 SQL',
      contextMenuGroupId: '9_sql',
      contextMenuOrder: 11,
      run: () => ai.sendToAi('请帮我写一段 SQL 查询。'),
    });

    state.editor.addAction({
      id: 'ai-open-chat',
      label: '🤖 打开 AI 对话',
      contextMenuGroupId: '9_sql',
      contextMenuOrder: 12,
      run: () => ai.onOpenChat(),
    });
  }

  applyHighlight();
  applyErrorMarkers();
});

onBeforeUnmount(() => {
  disposables.forEach(d => d.dispose());
  if (state.editor) {
    state.highlightDeco?.clear();
    state.editor.dispose();
    state.editor = null;
    state.highlightDeco = null;
  }
});

watch(() => props.code, (newVal) => {
  if (state.editor) {
    const currentVal = state.editor.getValue();
    if (currentVal !== newVal) {
      state.ignoreChanges = true;
      const selections = state.editor.getSelections();
      state.editor.setValue(newVal);
      if (selections) {
        const model = state.editor.getModel()!;
        const lineCount = model.getLineCount();
        const restored = selections.map(s => {
          const line = Math.min(s.selectionStartLineNumber, lineCount);
          const col = Math.min(s.selectionStartColumn, model.getLineMaxColumn(line));
          return new monaco.Selection(line, col, line, col);
        });
        state.editor.setSelections(restored);
      }
      state.ignoreChanges = false;
    }
  }
});

let flashTimeout: ReturnType<typeof setTimeout> | null = null;
watch(() => highlightChunk.value, (chunk) => {
  if (flashTimeout) { clearTimeout(flashTimeout); flashTimeout = null; }
  applyHighlight();
  if (chunk) {
    flashTimeout = setTimeout(() => {
      state.highlightDeco?.clear();
      flashTimeout = null;
    }, 1000);
  }
});

function applyHighlight() {
  if (!state.editor) return;
  const chunk = highlightChunk.value;
  if (!chunk) {
    state.highlightDeco?.clear();
    return;
  }
  const model = state.editor.getModel();
  if (!model) return;
  const fullText = model.getValue();
  const idx = fullText.indexOf(chunk);
  if (idx === -1) return;
  const startPos = model.getPositionAt(idx);
  const endPos = model.getPositionAt(idx + chunk.length);
  state.highlightDeco?.set([{
    range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
    options: { inlineClassName: 'flash-highlight' }
  }]);
}

watch(() => error.value, () => { applyErrorMarkers(); });

function applyErrorMarkers() {
  if (!state.editor) return;
  const model = state.editor.getModel();
  if (!model) return;
  if (error.value) {
    monaco.editor.setModelMarkers(model, 'sql-error', [{
      severity: monaco.MarkerSeverity.Error,
      message: error.value.message,
      startLineNumber: error.value.line,
      startColumn: 1,
      endLineNumber: error.value.line,
      endColumn: Number.MAX_SAFE_INTEGER,
    }]);
    state.editor.revealLineInCenter(error.value.line);
  } else {
    monaco.editor.setModelMarkers(model, 'sql-error', []);
  }
}

// --- File import ---
function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit('import-file', file);
  input.value = '';
}

function onDrop(e: DragEvent) {
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file && (file.name.endsWith('.sql') || file.name.endsWith('.txt'))) {
    emit('import-file', file);
  }
}

// --- Tab search ---
const filteredTabs = computed(() => {
  const q = tabSearchText.value.trim().toLowerCase();
  if (!q) return tabs.value;
  return tabs.value.filter(t => t.name.toLowerCase().includes(q));
});

function switchToTab(id: string) {
  emit('switch-tab', id);
  showTabSearch.value = false;
  tabSearchText.value = '';
}

function switchToFirstMatch() {
  if (filteredTabs.value.length > 0) {
    switchToTab(filteredTabs.value[0].id);
  }
}

function highlightTabName(name: string): string {
  return highlightMatch(name, tabSearchText.value.trim());
}

watch(showTabSearch, (val) => {
  if (val) {
    tabSearchText.value = '';
    nextTick(() => tabSearchInput.value?.focus());
  }
});

// --- Rename ---

function handleSubmit() {
  let dbName: string | null = activeDbName.value;
  if (!dbName) {
    dbName = prompt('输入数据库名称以保存当前状态:');
    if (!dbName || !dbName.trim()) return;
    dbName = dbName.trim();
    if (!/^[^?&=#;/\\:]{1,64}$/.test(dbName)) {
      alert('数据库名称不能包含特殊字符 (? & = # ; / \\ :)，且长度不能超过 64 个字符');
      return;
    }
    emit('set-db-name', activeTabId.value, dbName);
  }
  emit('submit');
}

function confirmDeleteDb() {
  const name = activeDbName.value;
  if (!name) return;
  if (confirm(`确定删除数据库 "${name}"？\n所有关联标签页将切换回实时模式。`)) {
    emit('delete-db', name);
  }
}

</script>

<style scoped>
:deep(.flash-highlight) {
  background-color: rgba(202, 138, 4, 0.6);
  border-radius: 2px;
}
</style>
