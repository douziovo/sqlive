<template>
  <div ref="wrapperRef" class="er-diagram-wrapper" tabindex="-1">
    <div
      v-if="tables.length === 0"
      class="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/70 z-10 pointer-events-none"
    >
      <div class="text-3xl mb-2">&#x1F4ED;</div>
      <p class="text-sm">暂无数据表，无法生成 ER 图</p>
    </div>

    <div v-if="tables.length > 0" class="er-flow-container">
      <VueFlow
        ref="flowRef"
        :nodes="displayNodes"
        :edges="edges"
        :node-types="nodeTypes"
        :default-viewport="{ x: 0, y: 0, zoom: 1 }"
        :fit-view-on-init="true"
        :min-zoom="0.1"
        :max-zoom="2"
        :nodes-draggable="true"
        :edges-updatable="false"
        @node-double-click="onNodeDoubleClick"
        @pane-ready="onPaneReady"
      >
        <Background :gap="20" :size="1" pattern-color="#e2e8f0" />
        <MiniMap
          v-if="showMinimap"
          position="bottom-right"
          :node-color="miniMapNodeColor"
          :width="180"
          :height="120"
          style="margin: 0 12px 12px 0;"
        />
      </VueFlow>
    </div>

    <ErToolbar
      :show-minimap="showMinimap"
      @auto-layout="handleAutoLayout"
      @fit-view="handleFitView"
      @toggle-minimap="showMinimap = !showMinimap"
    />
    <ErSearchBar
      v-model="searchQuery"
      :visible="showSearch"
      :total-count="totalTableCount"
      :match-count="matchCount"
      :current-index="currentIndex"
      @close="closeSearch"
      @prev="navigateMatch(-1)"
      @next="navigateMatch(1)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw, nextTick, watch, onMounted, onUnmounted } from 'vue';
import { VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/minimap/dist/style.css';

import type { TableSchema, ForeignKeyInfo } from '@/model/DatabaseTypes';
import { useErDiagram } from '@/viewmodel/useErDiagram';
import ErTableNode from './ErTableNode.vue';
import ErToolbar from './ErToolbar.vue';
import ErSearchBar from './ErSearchBar.vue';

const props = defineProps<{
  tables: TableSchema[];
  foreignKeys: ForeignKeyInfo[];
}>();

const emit = defineEmits<{
  (e: 'navigate-tab', payload: { tab: string; targetId?: string }): void;
}>();

const nodeTypes = markRaw({ table: ErTableNode }) as any;

const {
  filteredNodes,
  edges,
  searchQuery,
  showMinimap,
  autoLayout,
  setContainerRef,
} = useErDiagram(
  () => props.tables,
  () => props.foreignKeys,
);

const wrapperRef = ref<HTMLElement | null>(null);
const flowRef = ref<any>(null);

const showSearch = ref(false);
const matchIndex = ref(0);

const totalTableCount = computed(() => props.tables.length);

const matchCount = computed(() => {
  if (!searchQuery.value) return 0;
  return (filteredNodes.value as any[]).filter((n: any) => !n.data?.isFiltered).length;
});

const currentIndex = computed(() => {
  if (!searchQuery.value || matchCount.value === 0) return -1;
  return matchIndex.value;
});

const activeMatchNodeId = computed(() => {
  if (currentIndex.value < 0) return null;
  const matches = getMatchNodes();
  return matches[currentIndex.value]?.id ?? null;
});

const matchNodeIds = computed(() => {
  if (!searchQuery.value) return new Set<string>();
  return new Set(
    (filteredNodes.value as any[])
      .filter((n: any) => !n.data?.isFiltered)
      .map((n: any) => n.id)
  );
});

const displayNodes = computed(() => {
  if (!searchQuery.value) return filteredNodes.value;
  return (filteredNodes.value as any[]).map((n: any) => ({
    ...n,
    data: {
      ...n.data,
      isMatchHighlight: matchNodeIds.value.has(n.id),
      isActiveMatch: n.id === activeMatchNodeId.value,
    },
  }));
});

function miniMapNodeColor(_node: any) {
  return '#3b82f6';
}

function onNodeDoubleClick(event: any) {
  const tableName = event.node?.data?.tableName;
  if (tableName) {
    emit('navigate-tab', { tab: 'tables', targetId: 'table-' + tableName });
  }
}

async function handleAutoLayout() {
  await autoLayout();
  fitToView();
}

function handleFitView() {
  fitToView();
}

function fitToView() {
  if (flowRef.value) {
    flowRef.value.fitView({ duration: 300 });
  }
}

function isWrapperVisible(): boolean {
  const el = wrapperRef.value;
  if (!el) return false;
  return el.offsetParent !== null;
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (!isWrapperVisible()) return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    e.stopPropagation();
    showSearch.value = true;
  }
  if (e.key === 'Escape' && showSearch.value) {
    e.preventDefault();
    closeSearch();
  }
}

function closeSearch() {
  showSearch.value = false;
  searchQuery.value = '';
  matchIndex.value = 0;
}

function getMatchNodes(): any[] {
  return (filteredNodes.value as any[]).filter((n: any) => !n.data?.isFiltered);
}

function centerOnMatch(index: number) {
  const matches = getMatchNodes();
  if (matches.length === 0 || index < 0 || index >= matches.length) return;
  const node = matches[index];
  if (flowRef.value && node) {
    flowRef.value.setCenter(
      node.position.x + 100,
      node.position.y + 60,
      { zoom: 1, duration: 300 }
    );
  }
}

function navigateMatch(dir: 1 | -1) {
  const matches = getMatchNodes();
  if (matches.length === 0) return;
  matchIndex.value = (matchIndex.value + dir + matches.length) % matches.length;
  centerOnMatch(matchIndex.value);
}

async function onPaneReady() {
  // Set container now that VueFlow DOM is fully rendered
  if (wrapperRef.value) setContainerRef(wrapperRef.value);
  await nextTick();
  if (props.tables.length > 0) {
    await autoLayout();
    fitToView();
  }
}

watch(searchQuery, async () => {
  matchIndex.value = 0;
  await nextTick();
  centerOnMatch(0);
});

watch(() => props.tables.length, (len) => {
  if (len > 0) {
    nextTick(() => {
      autoLayout().then(() => fitToView());
    });
  }
});

onMounted(() => {
  document.addEventListener('keydown', onGlobalKeydown, true);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onGlobalKeydown, true);
});
</script>

<style scoped>
.er-diagram-wrapper {
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  outline: none;
}

.er-flow-container {
  position: absolute;
  inset: 0;
}
</style>
