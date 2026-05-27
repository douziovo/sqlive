<template>
  <Teleport to="body">
    <Transition name="panel-expand">
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
            <div class="knowledge-panel__filters">
              <button
                v-for="f in difficultyOptions"
                :key="f.key"
                class="knowledge-panel__filter-btn"
                :class="{ 'knowledge-panel__filter-btn--active': activeDifficulty === f.key }"
                @click="activeDifficulty = activeDifficulty === f.key ? null : f.key"
              >
                {{ f.label }}
              </button>
              <span class="knowledge-panel__filter-sep" />
              <button
                v-for="f in statusOptions"
                :key="f.key"
                class="knowledge-panel__filter-btn"
                :class="{ 'knowledge-panel__filter-btn--active': activeStatus === f.key }"
                @click="activeStatus = activeStatus === f.key ? null : f.key"
              >
                {{ f.label }}
              </button>
            </div>
            <span class="knowledge-panel__progress">
              {{ kgProgress.count }}/{{ kgProgress.total }}  {{ kgProgress.level }}
            </span>
          </div>

          <!-- Body: full-width graph -->
          <div class="knowledge-panel__body">
            <KnowledgeGraph
              ref="graphRef"
              class="knowledge-panel__graph"
              :nodes="filteredNodes"
              :edges="filteredEdges"
              :search-query="searchQuery"
              :selected-topic="kgSelectedNodeData"
              :mastered-topics="kgMasteredTopics"
              @node-select="onNodeSelect"
              @toggle-mastered="kg.toggleMastered"
              @ask-ai="onAskAi"
              @deselect-node="onDeselectNode"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch, onMounted, onUnmounted } from 'vue'
import KnowledgeGraph from './KnowledgeGraph.vue'
import { useKnowledgeGraph } from '@/composables/useKnowledgeGraph'
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph'
import type { Node, Edge } from '@vue-flow/core'
import { SQL_CONTEXT_KEY } from '@/viewmodel/injectionKeys'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'ask-ai', label: string): void
}>()

const sqlContext = inject(SQL_CONTEXT_KEY)!
const searchQuery = ref('')
const activeDifficulty = ref<string | null>(null)
const activeStatus = ref<string | null>(null)

interface FilterOption {
  key: string
  label: string
}

const difficultyOptions: FilterOption[] = [
  { key: '1', label: '入门' },
  { key: '2', label: '进阶' },
  { key: '3', label: '高级' },
]

const statusOptions: FilterOption[] = [
  { key: 'mastered', label: '已掌握' },
  { key: 'in-progress', label: '学习中' },
  { key: 'unlearned', label: '未学习' },
]

const kg = useKnowledgeGraph({
  sqlSource: () => {
    const tab = sqlContext.tabs.value.find(t => t.id === sqlContext.activeTabId.value)
    return tab?.code ?? ''
  },
})

const graphRef = ref<InstanceType<typeof KnowledgeGraph> | null>(null)

const kgNodes = computed(() => kg.nodes.value)
const kgEdges = computed(() => kg.edges.value)
const kgSelectedNode = computed(() => kg.selectedNode.value)
const kgSelectedNodeData = computed(() => kg.selectedNodeData.value)
const kgProgress = computed(() => kg.progress.value)
const kgMasteredTopics = computed(() => kg.masteredTopics.value)

const filteredNodes = computed(() => {
  let nodes: Node<KnowledgeNodeData>[] = kgNodes.value

  if (activeDifficulty.value) {
    const d = parseInt(activeDifficulty.value)
    nodes = nodes.filter(n => n.data.difficulty === d)
  }
  if (activeStatus.value) {
    nodes = nodes.filter(n => n.data.status === activeStatus.value)
  }

  return nodes
})

const filteredEdges = computed(() => {
  if (!activeDifficulty.value && !activeStatus.value) return kgEdges.value
  const visibleIds = new Set(filteredNodes.value.map(n => n.id))
  return kgEdges.value.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
})

function close(): void {
  emit('close')
}

function onNodeSelect(topicId: string): void {
  kg.selectedNode.value = topicId
}

function onAskAi(label: string): void {
  emit('ask-ai', label)
}

function onDeselectNode(): void {
  kg.selectedNode.value = null
}

watch(() => props.isOpen, async (open) => {
  if (open) {
    searchQuery.value = ''
    activeDifficulty.value = null
    activeStatus.value = null
    kg.selectedNode.value = null
    await kg.fetchGraph()
  }
})

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
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
  clip-path: circle(150% at calc(100% - 52px) calc(100% - 52px));
}

.knowledge-panel__topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: white;
  flex-shrink: 0;
  flex-wrap: wrap;
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
  max-width: 200px;
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

.knowledge-panel__filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.knowledge-panel__filter-sep {
  width: 1px;
  background: var(--border);
  margin: 0 4px;
}

.knowledge-panel__filter-btn {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--muted);
  color: var(--muted-foreground);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.knowledge-panel__filter-btn:hover {
  background: var(--secondary);
  color: var(--foreground);
}
.knowledge-panel__filter-btn--active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.knowledge-panel__progress {
  margin-left: auto;
  font-size: 13px;
  color: var(--muted-foreground);
  white-space: nowrap;
}

.knowledge-panel__body {
  flex: 1;
  min-height: 0;
}

.knowledge-panel__graph {
  width: 100%;
  height: 100%;
}

/* Transitions — expand from / collapse to companion button (bottom-right) */
.panel-expand-enter-active .knowledge-panel__content {
  transition: clip-path 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease-out;
}
.panel-expand-leave-active .knowledge-panel__content {
  transition: clip-path 0.3s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease-in;
}
.panel-expand-enter-from .knowledge-panel__content {
  clip-path: circle(28px at calc(100% - 52px) calc(100% - 52px));
  opacity: 0;
}
.panel-expand-leave-to .knowledge-panel__content {
  clip-path: circle(28px at calc(100% - 52px) calc(100% - 52px));
  opacity: 0;
}
</style>
