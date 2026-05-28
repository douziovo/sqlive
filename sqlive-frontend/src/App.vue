<template>
  <Splitpanes class="default-theme h-screen" :class="{ 'no-animate': noAnimate }">
    <Pane :size="28" :min-size="20">
      <div class="h-full flex flex-col relative">
        <div class="flex-1 min-h-0">
          <CodeEditor
            v-model:code="code"
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

  <!-- Floating panels — outside Splitpanes so they don't get removed -->
  <AiChatPanel
    v-if="aiPanelVisible"
    :messages="aiMessages"
    :is-loading="aiLoading"
    @send="(text: string) => aiChat.sendMessage(text)"
    @close="aiPanelVisible = false"
    @clear="aiChat.clearMessages"
    @regenerate="aiChat.regenerateMessage"
    @edit="aiChat.editMessage"
    @delete="aiChat.deleteMessage"
    @cancel-stream="aiChat.cancelStream"
  />

  <KnowledgePanel
    :is-open="isKnowledgePanelOpen"
    @close="isKnowledgePanelOpen = false"
    @ask-ai="handleKnowledgeAskAi"
  />

  <LearningCompanion
    v-if="!isKnowledgePanelOpen"
    @open="isKnowledgePanelOpen = true"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref } from 'vue';
import { Splitpanes, Pane } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import CodeEditor from './components/CodeEditor.vue';
import DataVisualizer from './components/DataVisualizer.vue';
import AiChatPanel from './components/AiChatPanel.vue';
import KnowledgePanel from './components/knowledge/KnowledgePanel.vue';
import LearningCompanion from './components/knowledge/LearningCompanion.vue';
import { useSqlEngine } from './composables/useSqlEngine';
import { useAiChat } from './composables/useAiChat';
import { useInlineActions } from './composables/useInlineActions';

import { SQL_CONTEXT_KEY, AI_ACTIONS_KEY } from './model/injectionKeys';
import type { SchemaTableInfo } from './utils/aiQuickFix';
import type { CellUpdateEvent, RowDeleteEvent, CreateTableEvent, RowInsertEvent } from './model/DatabaseTypes';

const engine = useSqlEngine();
const { code } = engine;

// ── AI composables (split) ─────────────────────────────────────
const aiChat = useAiChat({
  executionError: engine.executionError,
  code: engine.code,
  db: engine.db,
});

const { analyzeError, fixCode, explain, optimize, generateSql } = useInlineActions({
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

// ── Provide AI actions ─────
provide(AI_ACTIONS_KEY, {
  isLoading: aiChat.isLoading,
  analyzeError,
  fixCode,
  explain,
  optimize,
  generateSql,
  onOpenChat: (context?: string) => { aiChat.openPanel(); if (context) void aiChat.sendMessage(context); },
  sendToAi: (text: string) => { void aiChat.sendMessage(text); },
  onTogglePanel: aiChat.togglePanel,
});

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

const noAnimate = ref(true);

// ── Knowledge graph ───────────────────────────────────────────────
const isKnowledgePanelOpen = ref(false);

function handleKnowledgeAskAi(label: string) {
  isKnowledgePanelOpen.value = false;
  aiChat.openPanel();
  void aiChat.sendMessage('教我学习：' + label);
}

// Enable splitpanes transitions after initial layout (prevents slide-in animation on load)
onMounted(() => {
  requestAnimationFrame(() => {
    noAnimate.value = false;
  });
});
</script>
