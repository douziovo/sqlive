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
                            <span class="level-up-toast__text"
                                >升级了！{{ kgProgress.levelName }}</span
                            >
                        </div>
                    </Transition>
                    <!-- Top bar -->
                    <KnowledgePanelTopbar
                        :active-tab="activeTab"
                        :search-query="searchQuery"
                        :active-difficulty="activeDifficulty"
                        :active-category="activeCategory"
                        :show-task-tab-dot="showTaskTabDot"
                        :progress="kgProgress"
                        :xp-bar-percent="xpBarPercent"
                        @close="close"
                        @update:search-query="searchQuery = $event"
                        @tab-click="handleTabClick"
                        @toggle-difficulty="toggleDifficulty"
                        @toggle-category="toggleCategory"
                        @reset-filters="resetAllFilters"
                    />

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
                    <div
                        v-if="activeTab === 'tasks'"
                        class="knowledge-panel__body knowledge-panel__body--tasks"
                    >
                        <TaskJournalPanel
                            :topics="kg.graphData.value?.topics ?? []"
                            :chapter-category-filter="chapterCategoryFilter ?? undefined"
                            @complete-task="handleTaskComplete"
                            @navigate-to-topic="handleNavigateToTopic"
                        />
                    </div>

                    <!-- Body: chapters (adventurer's handbook tab) -->
                    <div
                        v-if="activeTab === 'chapters'"
                        class="knowledge-panel__body knowledge-panel__body--chapters"
                    >
                        <KnowledgePanelChapters
                            :chapters="chapterCards"
                            :level-name="kg.progress.value.levelName"
                            @open-chapter="handleOpenChapter"
                        />
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { useKnowledgeGraph } from '@/composables/useKnowledgeGraph'
import { useKnowledgeTasks } from '@/composables/useKnowledgeTasks'
import { useRedDot } from '@/composables/useRedDot'
import { CHAPTERS, getChapterById } from '@/data/learningChapters'
import { SQL_CONTEXT_KEY } from '@/model/injectionKeys'

import AchievementToast from './AchievementToast.vue'
import ConfettiOverlay from './ConfettiOverlay.vue'
import { getTaskXp } from './journal/taskPresentation'
import KnowledgeGraph from './KnowledgeGraph.vue'
import KnowledgePanelChapters from './panel/KnowledgePanelChapters.vue'
import KnowledgePanelTopbar from './panel/KnowledgePanelTopbar.vue'
import { useKnowledgePanelFilters } from './panel/useKnowledgePanelFilters'
import { usePanelCelebration } from './panel/usePanelCelebration'
import TaskJournalPanel from './TaskJournalPanel.vue'

const props = defineProps<{
    isOpen: boolean
}>()

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'ask-ai', label: string): void
}>()

const sqlContext = inject(SQL_CONTEXT_KEY)!
const searchQuery = ref('')
const activeTab = ref<'graph' | 'tasks' | 'chapters'>('graph')

// D-09: chapter → multi-category filter wiring. Non-null array triggers
// TaskJournalPanel union-list mode (displays tasks across all listed
// categories). Cleared on manual category tab click (handleTabClick).
const chapterCategoryFilter = ref<string[] | null>(null)

const kg = useKnowledgeGraph({
    sqlSource: () => {
        const tab = sqlContext.tabs.value.find((t) => t.id === sqlContext.activeTabId.value)
        return tab?.code ?? ''
    }
})

// WR-01 (D-05): chapter-progress function migrated to useKnowledgeGraph.
// Chapter progress now reflects mastered topics (not done tasks) / topicCount.
const { seedPresetTasksIfFirstRun } = useKnowledgeTasks()
const { isVisible: isRedDotVisible, clear } = useRedDot()

const showTaskTabDot = computed(() => isRedDotVisible('tab:tasks'))

const graphRef = ref<InstanceType<typeof KnowledgeGraph> | null>(null)

const kgNodes = computed(() => kg.nodes.value)
const kgEdges = computed(() => kg.edges.value)
const kgSelectedNodeData = computed(() => kg.selectedNodeData.value)
const kgProgress = computed(() => kg.progress.value)
const kgMasteredTopics = computed(() => kg.masteredTopics.value)

const {
    activeDifficulty,
    activeCategory,
    filteredNodes,
    filteredEdges,
    toggleDifficulty,
    toggleCategory,
    resetAllFilters
} = useKnowledgePanelFilters(kgNodes, kgEdges)

const {
    showToast,
    toastStreak,
    toastXp,
    toastLabel,
    toastHighDiff,
    showTaskToast,
    taskToastLabel,
    taskToastXp,
    showConfetti,
    confettiKey,
    showLevelUpToast,
    showAchievementToast,
    showTaskToastFor,
    celebrateLevelUp
} = usePanelCelebration()

const chapterCards = computed(() =>
    CHAPTERS.map((chapter) => ({
        chapter,
        progress: kg.getChapterProgress(chapter.id),
        unlocked: kg.xpData.value.level >= chapter.rankRequired,
        currentLevel: kg.xpData.value.level
    }))
)

const xpBarPercent = computed(() => {
    const p = kgProgress.value
    if (!p || p.nextLevelXp === 0) return 0
    const currentLevelXp = p.level * p.xpForNext
    const xpInLevel = Math.max(0, p.xp - currentLevelXp)
    return Math.min(100, Math.round((xpInLevel / p.xpForNext) * 100))
})

function close(): void {
    emit('close')
}

function onToggleMastered(topicId: string): void {
    const result = kg.toggleMastered(topicId)
    if (result.action === 'master') {
        const topic = kg.graphData.value?.topics.find((t) => t.id === topicId)
        const isHighDiff = topic?.difficulty === 3
        const label = topic?.label ?? topicId

        graphRef.value?.triggerSparkBurst?.(topicId)
        graphRef.value?.triggerUnlockGlow?.(topicId)

        showAchievementToast(result, label, isHighDiff)
        if (result.leveledUp) {
            celebrateLevelUp()
        }
    }
}

function handleTaskComplete(topicId: string): void {
    const topic = kg.graphData.value?.topics.find((t) => t.id === topicId)
    if (!topic) return

    const xpGained = getTaskXp(topic.difficulty)

    // D-14: delegate XP award + level-up detection to the unified entry
    // (no longer directly mutates kg.xpData.value.totalXp / masteredLog / level)
    const result = kg.addTaskXp(topicId, xpGained)
    if (result.xpGained === 0) return

    graphRef.value?.triggerSparkBurst?.(topicId)

    showTaskToastFor(topic.label, result.xpGained)

    if (result.leveledUp) {
        celebrateLevelUp()
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
    // Clear chapter filter on manual tab switch (D-09: user takes control)
    if (tabName === 'tasks') {
        chapterCategoryFilter.value = null
        clear('tab:tasks')
    }
}

function handleOpenChapter(chapterId: string): void {
    // D-09: wire multi-category filter — look up chapter.taskCategories
    // (e.g., ['core', 'deep-dive'] for query/ddl/dml/advanced chapters).
    // TaskJournalPanel enters union-list mode showing tasks across all
    // listed categories. Cleared on manual category tab click.
    const chapter = getChapterById(chapterId)
    if (chapter) {
        chapterCategoryFilter.value = chapter.taskCategories
    }
    activeTab.value = 'tasks'
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
    background: rgb(0 0 0 / 60%);
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

.knowledge-panel__body--tasks {
    padding: 16px 20px;
    overflow-y: auto;
}

.knowledge-panel__body--chapters {
    padding: 20px;
    overflow-y: auto;
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
    box-shadow: 0 8px 32px rgb(109 40 217 / 35%);
    pointer-events: none;
}

.level-up-toast__emoji {
    font-size: 24px;
}

/* Slide transition for level-up toast */

/* <Transition name="toast-slide"> 运行时生成的过渡类，静态检查器无法识别，不可删除 */

/* noinspection CssUnusedSymbol */
.toast-slide-enter-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 同上：Transition 运行时生成的离开过渡类 */

/* noinspection CssUnusedSymbol */
.toast-slide-leave-active {
    transition: all 0.2s ease-in;
}

/* 同上：Transition 运行时生成的进入起始态 */

/* noinspection CssUnusedSymbol */
.toast-slide-enter-from {
    opacity: 0;
    transform: translateX(-50%) translateY(-16px);
}

/* 同上：Transition 运行时生成的离开结束态 */

/* noinspection CssUnusedSymbol */
.toast-slide-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(-16px);
}

.panel-expand-enter-active .knowledge-panel__content {
    transition:
        clip-path 0.35s cubic-bezier(0.4, 0, 0.2, 1),
        opacity 0.25s ease-out;
}

.panel-expand-leave-active .knowledge-panel__content {
    transition:
        clip-path 0.3s cubic-bezier(0.4, 0, 1, 1),
        opacity 0.2s ease-in;
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
