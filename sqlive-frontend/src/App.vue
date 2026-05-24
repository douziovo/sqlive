<template>
  <Splitpanes class="default-theme h-screen">
    <Pane :size="28" :min-size="20">
      <!-- CodeEditor container -->
      <div class="h-full flex flex-col relative">
        <div class="flex-1 min-h-0">
          <CodeEditor
            v-model:code="engine.code"
            @switch-tab="engine.switchTab"
            @add-tab="engine.addTab('')"
            @close-tab="engine.closeTab"
            @set-db-name="(id: string, name: string) => engine.setTabDbName(id, name)"
            @delete-db="(name: string) => engine.deleteDb(name)"
            @submit="engine.submitNow"
            @import-file="(file: File) => engine.importFile(file)"
            @export-tab="() => engine.exportTab()"
            @export-all="engine.exportAllTabs"
          />
        </div>
      </div>
    </Pane>

    <!-- Floating AI chat panel — at root level so it moves freely across the page -->
    <AiChatPanel
      v-if="aiPanelVisible"
      :messages="aiMessages"
      :suggestions="aiSuggestions"
      :is-loading="aiLoading"
      @send="handleAiSend"
      @close="aiPanelVisible = false"
      @clear="handleAiClear"
      @regenerate="handleAiRegenerate"
      @edit="handleAiEdit"
      @delete="handleAiDelete"
      @cancel-stream="aiChat.cancelStream"
    />

    <Pane :min-size="20">
      <div class="h-full relative">
        <div v-if="isLoading" class="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold shadow-lg z-50 animate-pulse pointer-events-none">
          正在执行...
        </div>

        <DataVisualizer
          @update-cell="handleUpdateCell"
          @delete-row="handleDeleteRow"
          @create-table="handleCreateTable"
          @drop-table="handleDropTable"
          @insert-row="handleInsertRow"
        />
      </div>
    </Pane>
  </Splitpanes>
</template>

<script setup lang="ts">
import { computed, onMounted, provide } from 'vue';
import { Splitpanes, Pane } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import CodeEditor from './components/CodeEditor.vue';
import DataVisualizer from './components/DataVisualizer.vue';
import AiChatPanel from './components/AiChatPanel.vue';
import { useSqlEngine } from './viewmodel/useSqlEngine';
import { useAiChat } from './viewmodel/useAiChat';
import { useInlineActions } from './viewmodel/useInlineActions';
import { SQL_CONTEXT_KEY, AI_ACTIONS_KEY } from './viewmodel/injectionKeys';
import type { SchemaTableInfo } from './utils/aiQuickFix';
import type { CellUpdateEvent, RowDeleteEvent, CreateTableEvent, RowInsertEvent } from './model/DatabaseTypes';

const engine = useSqlEngine();

// ── AI composables (split) ─────────────────────────────────────
const aiChat = useAiChat({
  executionError: engine.executionError,
  code: engine.code,
  db: engine.db,
});

const inlineActions = useInlineActions({
  isLoading: aiChat.isLoading,
  messages: aiChat.messages,
  code: engine.code,
  db: engine.db,
  error: engine.executionError,
});

// ── Derived ─────────────────────────────────────────────────────
const schemaTables = computed<SchemaTableInfo[]>(() => {
  return (engine.db?.tables ?? []).map(t => ({
    name: t.name,
    type: 'table' as const,
    columns: t.columns || [],
  }));
});

const activeDbName = computed(() =>
  engine.tabs.value.find(t => t.id === engine.activeTabId.value)?.dbName || '',
);

// Template aliases — used by v-if="isLoading" and AiChatPanel props
const isLoading = engine.isLoading;
const aiMessages = aiChat.messages;
const aiLoading = aiChat.isLoading;
const aiSuggestions = aiChat.suggestions;
const aiPanelVisible = aiChat.showPanel;

// ── Provide SQL context (replaces 9 props across 3 components) ──
provide(SQL_CONTEXT_KEY, {
  tabs: engine.tabs,
  activeTabId: engine.activeTabId,
  activeDbName,
  dbList: engine.dbList,
  highlightChunk: engine.highlightedCodeChunk,
  error: engine.executionError,
  schemaTables,
  db: engine.db,
  highlight: engine.highlight,
});

// ── Provide AI actions (explicit, not hidden in composable) ─────
provide(AI_ACTIONS_KEY, {
  isLoading: aiChat.isLoading,
  inlineVisible: inlineActions.showInlineResult,
  inlineContent: inlineActions.inlineContent,
  inlineMode: inlineActions.inlineMode,
  inlineActions: inlineActions.inlineActions,
  onAnalyzeError: inlineActions.analyzeError,
  onFixCode: inlineActions.fixCode,
  onExplain: inlineActions.explain,
  onOptimize: inlineActions.optimize,
  onGenerateSql: inlineActions.generateSql,
  onOpenChat: (context?: string) => { aiChat.openPanel(); if (context) void aiChat.sendMessage(context); },
  onTogglePanel: aiChat.togglePanel,
  onInlineClose: inlineActions.closeInline,
  onInlineAction: (_action: string) => { /* handled by AiInlineResult */ },
});

// ── AI event handlers ───────────────────────────────────────────
function handleAiSend(text: string) {
  aiChat.sendMessage(text);
}

function handleAiClear() {
  aiChat.clearMessages();
}

function handleAiRegenerate(messageId: string) {
  const idx = aiChat.messages.value.findIndex(m => m.id === messageId);
  if (idx > 0) {
    const userMsg = aiChat.messages.value[idx - 1];
    if (userMsg?.role === 'user') {
      aiChat.messages.value.splice(idx, 1);
      aiChat.sendMessage(userMsg.content);
    }
  }
}

function handleAiEdit(messageId: string, newText: string) {
  const idx = aiChat.messages.value.findIndex(m => m.id === messageId);
  if (idx >= 0) {
    const nextMsg = aiChat.messages.value[idx + 1];
    if (nextMsg?.role === 'assistant') {
      aiChat.messages.value.splice(idx, 2);
    } else {
      aiChat.messages.value.splice(idx, 1);
    }
    aiChat.sendMessage(newText);
  }
}

function handleAiDelete(messageId: string) {
  const idx = aiChat.messages.value.findIndex(m => m.id === messageId);
  if (idx < 0) return;
  const msg = aiChat.messages.value[idx];
  if (msg.role === 'assistant') {
    const prevMsg = aiChat.messages.value[idx - 1];
    if (prevMsg?.role === 'user') {
      aiChat.messages.value.splice(idx - 1, 2);
    } else {
      aiChat.messages.value.splice(idx, 1);
    }
  } else if (msg.role === 'user') {
    const nextMsg = aiChat.messages.value[idx + 1];
    if (nextMsg?.role === 'assistant') {
      aiChat.messages.value.splice(idx, 2);
    } else {
      aiChat.messages.value.splice(idx, 1);
    }
  }
}

// ── SQL event handlers ──────────────────────────────────────────
const handleUpdateCell = ({ tableName, oldRow, newRow }: CellUpdateEvent) => {
  engine.updateRow(tableName, oldRow, newRow);
};

const handleDeleteRow = (payload: RowDeleteEvent) => {
  if (payload.tableName) {
    engine.deleteRow(payload.row, payload.tableName);
  } else {
    engine.deleteRow(payload.row);
  }
};

const handleCreateTable = ({ name, columns, data }: CreateTableEvent) => {
  engine.addNewTable(name, columns, data);
};

const handleDropTable = (tableName: string) => {
  if (confirm(`确定要删除表格 "${tableName}" 吗？`)) {
    engine.dropTableUI(tableName);
  }
};

const handleInsertRow = ({ tableName, newRow }: RowInsertEvent) => {
  engine.insertRowUI(tableName, newRow);
};

// Prevent splitpanes from animating on initial page load
onMounted(() => {
  const panes = document.querySelectorAll('.splitpanes__pane');
  panes.forEach(p => ((p as HTMLElement).style.transition = 'none'));
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panes.forEach(p => ((p as HTMLElement).style.transition = ''));
    });
  });
});
</script>
