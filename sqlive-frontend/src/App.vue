<template>
  <Splitpanes class="default-theme h-screen">
    <Pane :size="28" :min-size="20">
      <!-- CodeEditor container -->
      <div class="h-full flex flex-col relative">
        <div class="flex-1 min-h-0">
          <CodeEditor
            v-model:code="code"
            :tabs="tabs"
            :active-tab-id="activeTabId"
            :active-db-name="tabs.find(t => t.id === activeTabId)?.dbName || ''"
            :db-list="dbList"
            :highlight-chunk="highlightedCodeChunk"
            :error="executionError"
            :schema-tables="schemaTables"
            @switch-tab="switchTab"
            @add-tab="addTab('')"
            @close-tab="closeTab"
            @set-db-name="(id: string, name: string) => setTabDbName(id, name)"
            @delete-db="(name: string) => deleteDb(name)"
            @submit="submitNow"
            @import-file="(file: File) => importFile(file)"
            @export-tab="() => exportTab()"
            @export-all="exportAllTabs"
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
      @cancel-stream="cancelStream"
    />

    <Pane :min-size="20">
      <div class="h-full relative">
        <div v-if="isLoading" class="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold shadow-lg z-50 animate-pulse pointer-events-none">
          正在执行...
        </div>

        <DataVisualizer
          :db="db"
          :highlight="highlight"
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
import { computed, onMounted } from 'vue';
import { Splitpanes, Pane } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import CodeEditor from './components/CodeEditor.vue';
import DataVisualizer from './components/DataVisualizer.vue';
import AiChatPanel from './components/AiChatPanel.vue';
import { useSqlEngine } from './viewmodel/useSqlEngine';
import { useAiChat } from './viewmodel/useAiChat';
import type { SchemaTableInfo } from './utils/aiQuickFix';
import type { CellUpdateEvent, RowDeleteEvent, CreateTableEvent, RowInsertEvent } from './model/DatabaseTypes';

const {
  db, code, highlight, highlightedCodeChunk, executionError, isLoading,
  updateRow, deleteRow, addNewTable, dropTableUI, insertRowUI,
  tabs, activeTabId, switchTab, addTab, closeTab, setTabDbName, dbList,
  submitNow, deleteDb, importFile, exportTab, exportAllTabs,
} = useSqlEngine();

// ── AI composable ───────────────────────────────────────────────
const {
  messages: aiMessages,
  isLoading: aiLoading,
  suggestions: aiSuggestions,
  showPanel: aiPanelVisible,
  sendMessage, cancelStream,
  clearMessages,
} = useAiChat({
  executionError,
  code,
  db,
});

// Computed: schema tables for QuickFix scene 3
const schemaTables = computed<SchemaTableInfo[]>(() => {
  return (db?.tables ?? []).map(t => ({
    name: t.name,
    type: 'table' as const,
    columns: t.columns || [],
  }));
});

// ── AI event handlers ───────────────────────────────────────────

function handleAiSend(text: string) {
  sendMessage(text);
}

function handleAiClear() {
  clearMessages();
}

function handleAiRegenerate(messageId: string) {
  const idx = aiMessages.value.findIndex(m => m.id === messageId);
  if (idx > 0) {
    const userMsg = aiMessages.value[idx - 1];
    if (userMsg?.role === 'user') {
      // Remove the assistant message and re-send
      aiMessages.value.splice(idx, 1);
      sendMessage(userMsg.content);
    }
  }
}

function handleAiEdit(messageId: string, newText: string) {
  const idx = aiMessages.value.findIndex(m => m.id === messageId);
  if (idx >= 0) {
    // Remove the user message and the subsequent assistant message
    const nextMsg = aiMessages.value[idx + 1];
    if (nextMsg?.role === 'assistant') {
      aiMessages.value.splice(idx, 2);
    } else {
      aiMessages.value.splice(idx, 1);
    }
    sendMessage(newText);
  }
}

function handleAiDelete(messageId: string) {
  const idx = aiMessages.value.findIndex(m => m.id === messageId);
  if (idx < 0) return;
  const msg = aiMessages.value[idx];
  if (msg.role === 'assistant') {
    // Delete assistant + preceding user message
    const prevMsg = aiMessages.value[idx - 1];
    if (prevMsg?.role === 'user') {
      aiMessages.value.splice(idx - 1, 2);
    } else {
      aiMessages.value.splice(idx, 1);
    }
  } else if (msg.role === 'user') {
    // Delete user + following assistant message
    const nextMsg = aiMessages.value[idx + 1];
    if (nextMsg?.role === 'assistant') {
      aiMessages.value.splice(idx, 2);
    } else {
      aiMessages.value.splice(idx, 1);
    }
  }
}


const handleUpdateCell = ({ tableName, oldRow, newRow }: CellUpdateEvent) => {
  updateRow(tableName, oldRow, newRow);
};

const handleDeleteRow = (payload: RowDeleteEvent) => {
  if (payload.tableName) {
    deleteRow(payload.row, payload.tableName);
  } else {
    deleteRow(payload.row);
  }
};

const handleCreateTable = ({ name, columns, data }: CreateTableEvent) => {
  addNewTable(name, columns, data);
};

const handleDropTable = (tableName: string) => {
  if (confirm(`确定要删除表格 "${tableName}" 吗？`)) {
    dropTableUI(tableName);
  }
};

const handleInsertRow = ({ tableName, newRow }: RowInsertEvent) => {
  insertRowUI(tableName, newRow);
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
