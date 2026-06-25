<template>
  <AchievementToast
    :visible="showToast"
    :streak="toastStreak"
    :xp="toastXp"
    :label="toastLabel"
    :is-high-difficulty="toastHighDiff"
    @close="showToast = false"
  />
  <AchievementToast
    variant="task"
    :visible="showTaskToast"
    :streak="0"
    :xp="taskToastXp"
    :label="taskToastLabel"
    :is-high-difficulty="false"
    @close="showTaskToast = false"
  />
  <ConfettiOverlay :key="confettiKey" :active="showConfetti" />
  <Teleport to="body">
    <Transition name="panel-expand">
      <div v-if="isOpen" class="knowledge-panel" @keydown.esc="close">
        <div class="knowledge-panel__backdrop" @click="close" />

        <div class="knowledge-panel__content">
          <!-- Level-up celebration toast -->
          <Transition name="toast-slide">
            <div v-if="showLevelUpToast" class="level-up-toast">
              <span class="level-up-toast__emoji">🎉</span>
              <span class="level-up-toast__text">升级了！{{ kgProgress.levelName }}</span>
            </div>
          </Transition>
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
            <div class="knowledge-panel__tabs">
              <button
                class="knowledge-panel__tab"
                :class="{ 'knowledge-panel__tab--active': activeTab === 'graph' }"
                @click="handleTabClick('graph')"
              >
                图谱
              </button>
              <button
                class="knowledge-panel__tab knowledge-panel__tab--with-dot"
                :class="{ 'knowledge-panel__tab--active': activeTab === 'tasks' }"
                @click="handleTabClick('tasks')"
              >
                任务
                <RedDotBadge :show="showTaskTabDot" />
              </button>
              <button
                class="knowledge-panel__tab"
                :class="{ 'knowledge-panel__tab--active': activeTab === 'chapters' }"
                @click="handleTabClick('chapters')"
              >
                冒险之证
              </button>
            </div>
            <template v-if="activeTab === 'graph'">
            <div class="knowledge-panel__filters">
              <button
                class="knowledge-panel__filter-btn"
                :class="{ 'knowledge-panel__filter-btn--active': !activeDifficulty && !activeCategory }"
                @click="resetAllFilters"
              >
                全部
              </button>
              <button
                v-for="f in difficultyChips"
                :key="f.key"
                class="knowledge-panel__filter-btn"
                :class="{ 'knowledge-panel__filter-btn--active': activeDifficulty === f.key }"
                @click="activeDifficulty = activeDifficulty === f.key ? null : f.key"
              >
                {{ f.label }}
              </button>
              <span class="knowledge-panel__filter-sep" />
              <button
                v-for="f in categoryChips"
                :key="f.key"
                class="knowledge-panel__filter-btn"
                :class="{ 'knowledge-panel__filter-btn--active': activeCategory === f.key }"
                @click="activeCategory = activeCategory === f.key ? null : f.key"
              >
                {{ f.label }}
              </button>
            </div>
            </template>
            <div class="knowledge-panel__level-bar">
              <span class="knowledge-panel__level-badge">{{ kgProgress.levelName }}</span>
              <div class="knowledge-panel__xp-bar-track">
                <div
                  class="knowledge-panel__xp-bar-fill"
                  :style="{ width: xpBarPercent + '%' }"
                />
              </div>
              <span class="knowledge-panel__xp-text">{{ kgProgress.xp }}/{{ kgProgress.nextLevelXp }}</span>
              <span class="knowledge-panel__progress-text">{{ kgProgress.count }}/{{ kgProgress.total }}</span>
              <span v-if="kgProgress.streak > 0" class="knowledge-panel__streak">
                <span class="knowledge-panel__streak-fire">🔥</span>
                {{ kgProgress.streak }}
              </span>
            </div>
          </div>

          <!-- Body: full-width graph (graph tab) -->
          <div v-if="activeTab === 'graph'" class="knowledge-panel__body">
            <KnowledgeGraph
              ref="graphRef"
              class="knowledge-panel__graph"
              :nodes="filteredNodes"
              :edges="filteredEdges"
              :search-query="searchQuery"
              :selected-topic="kgSelectedNodeData"
              :mastered-topics="kgMasteredTopics"
              @node-select="onNodeSelect"
              @toggle-mastered="onToggleMastered"
              @ask-ai="onAskAi"
              @deselect-node="onDeselectNode"
              @view-all-tasks="activeTab = 'tasks'"
              @complete-task="handleTaskComplete"
              @navigate-to-topic="handleNavigateToTopic"
            />
          </div>

          <!-- Body: task journal (tasks tab) -->
          <div v-if="activeTab === 'tasks'" class="knowledge-panel__body knowledge-panel__body--tasks">
            <TaskJournalPanel
              :topics="kg.graphData?.topics ?? []"
              @complete-task="handleTaskComplete"
              @pin-task="handlePinTask"
              @navigate-to-topic="handleNavigateToTopic"
            />
          </div>

          <!-- Body: chapters (adventurer's handbook tab) -->
          <div v-if="activeTab === 'chapters'" class="knowledge-panel__body knowledge-panel__body--chapters">
            <div class="chapters__header">
              <h2 class="chapters__title">冒险之证</h2>
              <span class="chapters__level">当前等级：{{ kg.progress.value.levelName }}</span>
            </div>
            <div class="chapters__list">
              <ChapterCard
                v-for="chapter in CHAPTERS"
                :key="chapter.id"
                :chapter="chapter"
                :progress="kg.getChapterProgress(chapter.id)"
                :unlocked="kg.xpData.value.level >= chapter.rankRequired"
                :current-level="kg.xpData.value.level"
                @open-chapter="handleOpenChapter"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { Edge, Node } from '@vue-flow/core'
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph'
import { useKnowledgeGraph } from '@/composables/useKnowledgeGraph'
import { SQL_CONTEXT_KEY } from '@/model/injectionKeys'
import AchievementToast from './AchievementToast.vue'
import ConfettiOverlay from './ConfettiOverlay.vue'
import KnowledgeGraph from './KnowledgeGraph.vue'
import TaskJournalPanel from './TaskJournalPanel.vue'
import ChapterCard from './ChapterCard.vue'
import RedDotBadge from './RedDotBadge.vue'
import { CHAPTERS } from '@/data/learningChapters'
import { useKnowledgeTasks } from '@/composables/useKnowledgeTasks'
import { useRedDot } from '@/composables/useRedDot'

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
const activeCategory = ref<string | null>(null)
const activeTab = ref<'graph' | 'tasks' | 'chapters'>('graph')

interface FilterOption {
  key: string
  label: string
}

const difficultyChips: FilterOption[] = [
  { key: '1', label: '入门 L1' },
  { key: '2', label: '进阶 L2' },
  { key: '3', label: '高级 L3' }
]

const categoryChips: FilterOption[] = [
  { key: 'query', label: '查询类' },
  { key: 'dml', label: '增删改' },
  { key: 'advanced', label: '高级特性' }
]

const kg = useKnowledgeGraph({
  sqlSource: () => {
    const tab = sqlContext.tabs.value.find((t) => t.id === sqlContext.activeTabId.value)
    return tab?.code ?? ''
  }
})

// WR-01 (D-05): chapter-progress function migrated to useKnowledgeGraph.
// Chapter progress now reflects mastered topics (not done tasks) / topicCount.
const { tasks: _tasksForMount, seedPresetTasksIfFirstRun } = useKnowledgeTasks()
const { isVisible: isRedDotVisible, clear } = useRedDot()

const showTaskTabDot = computed(() => isRedDotVisible('tab:tasks'))

const graphRef = ref<InstanceType<typeof KnowledgeGraph> | null>(null)

const kgNodes = computed(() => kg.nodes.value)
const kgEdges = computed(() => kg.edges.value)
const kgSelectedNode = computed(() => kg.selectedNode.value)
const kgSelectedNodeData = computed(() => kg.selectedNodeData.value)
const kgProgress = computed(() => kg.progress.value)
const kgMasteredTopics = computed(() => kg.masteredTopics.value)

const xpBarPercent = computed(() => {
  const p = kgProgress.value
  if (!p || p.nextLevelXp === 0) return 0
  const currentLevelXp = p.level * p.xpForNext
  const xpInLevel = Math.max(0, p.xp - currentLevelXp)
  return Math.min(100, Math.round((xpInLevel / p.xpForNext) * 100))
})

const filteredNodes = computed<Node<KnowledgeNodeData>[]>(() => {
  return kgNodes.value.map((node) => {
    let dimmed = false
    if (activeDifficulty.value) {
      const d = parseInt(activeDifficulty.value, 10)
      if (node.data.difficulty !== d) dimmed = true
    }
    if (activeCategory.value) {
      if (node.data.category !== activeCategory.value) dimmed = true
    }
    return {
      ...node,
      style: { ...node.style, opacity: dimmed ? 0.12 : 1 }
    }
  })
})

const filteredEdges = computed<Edge[]>(() => {
  if (!activeDifficulty.value && !activeCategory.value) return kgEdges.value
  const visibleIds = new Set(
    kgNodes.value
      .filter((n) => {
        if (activeDifficulty.value && n.data.difficulty !== parseInt(activeDifficulty.value, 10)) return false
        if (activeCategory.value && n.data.category !== activeCategory.value) return false
        return true
      })
      .map((n) => n.id)
  )
  return kgEdges.value.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
})

function close(): void {
  emit('close')
}

function resetAllFilters(): void {
  activeDifficulty.value = null
  activeCategory.value = null
}

// ── Gamification state (Phase 05-03) ───────────────────────────
const showToast = ref(false)
const toastStreak = ref(0)
const toastXp = ref(0)
const toastLabel = ref('')
const toastHighDiff = ref(false)
const showConfetti = ref(false)
const confettiKey = ref(0)
const showLevelUpToast = ref(false)

// ── Task gamification state (Phase 09-03) ──────────────────────
const showTaskToast = ref(false)
const taskToastLabel = ref('')
const taskToastXp = ref(0)

function onToggleMastered(topicId: string): void {
  const result = kg.toggleMastered(topicId)
  if (result.action === 'master') {
    const topic = kg.graphData.value?.topics.find(t => t.id === topicId)
    const isHighDiff = topic?.difficulty === 3
    const label = topic?.label ?? topicId

    graphRef.value?.triggerSparkBurst?.(topicId)
    graphRef.value?.triggerUnlockGlow?.(topicId)

    showAchievementToast(result, label, isHighDiff)
    if (result.leveledUp) {
      showConfetti.value = true
      confettiKey.value++
      showLevelUpToast.value = true
      setTimeout(() => {
        showConfetti.value = false
        showLevelUpToast.value = false
      }, 5000)
    }
  }
}

function showAchievementToast(result: { xpGained: number; leveledUp: boolean; streak: number }, topicLabel: string, isHighDiff: boolean): void {
  toastStreak.value = result.streak
  toastXp.value = result.xpGained
  toastLabel.value = topicLabel
  toastHighDiff.value = isHighDiff
  showToast.value = true
  setTimeout(() => { showToast.value = false }, 2500)
}

function handleTaskComplete(topicId: string): void {
  const topic = kg.graphData.value?.topics.find(t => t.id === topicId)
  if (!topic) return

  const xpGained = (kg.xpForDifficulty(topic.difficulty) ?? 30) + 10

  // D-14: delegate XP award + level-up detection to the unified entry
  // (no longer directly mutates kg.xpData.value.totalXp / masteredLog / level)
  const result = kg.addTaskXp(topicId, xpGained)

  graphRef.value?.triggerSparkBurst?.(topicId)

  taskToastLabel.value = topic.label
  taskToastXp.value = xpGained
  showTaskToast.value = true
  setTimeout(() => { showTaskToast.value = false }, 2500)

  if (result.leveledUp) {
    showConfetti.value = true
    confettiKey.value++
    showLevelUpToast.value = true
    setTimeout(() => {
      showConfetti.value = false
      showLevelUpToast.value = false
    }, 5000)
  }
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

function handleTabClick(tabName: 'graph' | 'tasks' | 'chapters'): void {
  activeTab.value = tabName
  // Clear tab-level red dot when entering tasks tab
  if (tabName === 'tasks') {
    clear('tab:tasks')
  }
}

function handleOpenChapter(chapterId: string): void {
  activeTab.value = 'tasks'
  // categoryFilter set by chapter.id mapping will be wired in Task 3 (TaskJournalPanel integration)
}

function handlePinTask(taskId: string): void {
  // pinTask is called within TaskJournalPanel; no additional action needed here
}

function handleNavigateToTopic(topicId: string): void {
  activeTab.value = 'graph'
  nextTick(() => {
    graphRef.value?.flyToNode?.(topicId)
  })
}

watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      searchQuery.value = ''
      activeDifficulty.value = null
      activeCategory.value = null
      kg.selectedNode.value = null
      await kg.fetchGraph()
    }
  },
  { immediate: true }
)

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  seedPresetTasksIfFirstRun()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})

defineExpose({
  filteredNodes,
  filteredEdges,
  activeDifficulty,
  activeCategory,
  resetAllFilters,
  handleNavigateToTopic,
  xpBarPercent
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

/* ── Tab bar (Phase 09-03) ──────────────────── */

.knowledge-panel__tabs {
  display: flex;
  gap: 0;
  margin-right: 12px;
}

.knowledge-panel__tab {
  padding: 6px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted-foreground);
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.knowledge-panel__tab--with-dot {
  position: relative;
}

.knowledge-panel__tab--active {
  color: var(--foreground);
  border-bottom-color: var(--primary);
}

.knowledge-panel__tab:hover:not(.knowledge-panel__tab--active) {
  color: var(--foreground);
}

.knowledge-panel__body--tasks {
  padding: 16px 20px;
  overflow-y: auto;
}

.knowledge-panel__body--chapters {
  padding: 20px;
  overflow-y: auto;
}

.chapters__header {
  margin-bottom: 20px;
}

.chapters__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0;
}

.chapters__level {
  font-size: 13px;
  color: var(--muted-foreground);
  margin-top: 4px;
  display: block;
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

.knowledge-panel__level-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.knowledge-panel__level-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  color: white;
  white-space: nowrap;
}

.knowledge-panel__xp-bar-track {
  width: 80px;
  height: 6px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.knowledge-panel__xp-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #16a34a);
  border-radius: 999px;
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.knowledge-panel__streak {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: #fef2f2;
  color: #991b1b;
  white-space: nowrap;
}

.knowledge-panel__streak-fire {
  font-size: 14px;
  animation: fireFlicker 0.3s ease-in-out infinite alternate;
}

@keyframes fireFlicker {
  from { transform: scale(1) rotate(-2deg); }
  to { transform: scale(1.15) rotate(2deg); }
}

.knowledge-panel__xp-text {
  font-size: 11px;
  color: var(--muted-foreground);
  white-space: nowrap;
  min-width: 60px;
  text-align: right;
}

.knowledge-panel__progress-text {
  font-size: 12px;
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
/* Level-up celebration toast */
.level-up-toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 110;
  padding: 16px 32px;
  border-radius: 16px;
  background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  color: white;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 32px rgba(109, 40, 217, 0.35);
  pointer-events: none;
}

.level-up-toast__emoji {
  font-size: 24px;
}

/* Slide transition for level-up toast */
.toast-slide-enter-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-slide-leave-active { transition: all 0.2s ease-in; }
.toast-slide-enter-from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
.toast-slide-leave-to { opacity: 0; transform: translateX(-50%) translateY(-16px); }

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
