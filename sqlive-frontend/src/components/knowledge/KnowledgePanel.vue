<template>
  <Teleport to="body">
    <Transition name="panel-slide">
      <div v-if="isOpen" class="knowledge-panel" @keydown.esc="close">
        <div class="knowledge-panel__backdrop" @click="close" />

        <div class="knowledge-panel__content">
          <!-- Top bar -->
          <div class="knowledge-panel__topbar">
            <button class="knowledge-panel__back-btn" @click="close">
              &larr; 返回编码
            </button>
            <span class="knowledge-panel__title">知识图谱</span>
            <input
              v-model="searchQuery"
              class="knowledge-panel__search"
              type="text"
              placeholder="搜索知识点..."
            />
            <span class="knowledge-panel__progress">
              {{ kgProgress.count }}/{{ kgProgress.total }}  {{ kgProgress.level }}
            </span>
          </div>

          <!-- Body: graph + sidebar -->
          <div class="knowledge-panel__body">
            <KnowledgeGraph
              ref="graphRef"
              class="knowledge-panel__graph"
              :nodes="kgNodes"
              :edges="kgEdges"
              :search-query="searchQuery"
              @node-select="onNodeSelect"
            />

            <aside class="knowledge-panel__sidebar">
              <KnowledgeDetail
                v-if="kgSelectedNodeData"
                :topic="kgSelectedNodeData"
                :is-mastered="kgMasteredTopics.includes(kgSelectedNode ?? '')"
                @toggle-mastered="kg.toggleMastered"
                @ask-ai="onAskAi"
              />
              <div v-else class="knowledge-panel__sidebar-empty">
                <p class="text-sm text-muted-foreground">点击左侧节点查看详情</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch, onMounted, onUnmounted } from 'vue';
import KnowledgeGraph from './KnowledgeGraph.vue';
import KnowledgeDetail from './KnowledgeDetail.vue';
import { useKnowledgeGraph } from '@/composables/useKnowledgeGraph';
import { SQL_CONTEXT_KEY } from '@/viewmodel/injectionKeys';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'ask-ai', label: string): void;
}>();

const sqlContext = inject(SQL_CONTEXT_KEY)!;
const searchQuery = ref('');

const kg = useKnowledgeGraph({
  sqlSource: () => {
    const tab = sqlContext.tabs.value.find(t => t.id === sqlContext.activeTabId.value);
    return tab?.code ?? '';
  },
});

const graphRef = ref<InstanceType<typeof KnowledgeGraph> | null>(null);

const kgNodes = computed(() => kg.nodes.value);
const kgEdges = computed(() => kg.edges.value);
const kgSelectedNode = computed(() => kg.selectedNode.value);
const kgSelectedNodeData = computed(() => kg.selectedNodeData.value);
const kgProgress = computed(() => kg.progress.value);
const kgMasteredTopics = computed(() => kg.masteredTopics.value);

function close(): void {
  emit('close');
}

function onNodeSelect(topicId: string): void {
  kg.selectedNode.value = topicId;
}

function onAskAi(label: string): void {
  emit('ask-ai', label);
}

watch(() => props.isOpen, async (open) => {
  if (open) {
    await kg.fetchGraph();
  }
});

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close();
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped>
.knowledge-panel {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.knowledge-panel__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.knowledge-panel__content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--background);
}

.knowledge-panel__topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: white;
  flex-shrink: 0;
}

.knowledge-panel__back-btn {
  font-size: 13px;
  color: var(--muted-foreground);
  border: none;
  background: none;
  cursor: pointer;
}
.knowledge-panel__back-btn:hover {
  color: var(--foreground);
}

.knowledge-panel__title {
  font-size: 16px;
  font-weight: 700;
}

.knowledge-panel__search {
  flex: 1;
  max-width: 240px;
  padding: 5px 10px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--muted);
  color: var(--foreground);
  outline: none;
}
.knowledge-panel__search:focus {
  border-color: var(--primary);
}
.knowledge-panel__search::placeholder {
  color: var(--muted-foreground);
}

.knowledge-panel__progress {
  margin-left: auto;
  font-size: 13px;
  color: var(--muted-foreground);
}

.knowledge-panel__body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.knowledge-panel__graph {
  flex: 1;
  min-width: 0;
}

.knowledge-panel__sidebar {
  width: 300px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: white;
  overflow-y: auto;
}

.knowledge-panel__sidebar-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--muted-foreground);
}

/* Transitions */
.panel-slide-enter-active .knowledge-panel__content,
.panel-slide-leave-active .knowledge-panel__content {
  transition: transform 0.3s ease-out;
}
.panel-slide-leave-active .knowledge-panel__content {
  transition: transform 0.2s ease-in;
}
.panel-slide-enter-from .knowledge-panel__content,
.panel-slide-leave-to .knowledge-panel__content {
  transform: translateY(100%);
}
</style>
