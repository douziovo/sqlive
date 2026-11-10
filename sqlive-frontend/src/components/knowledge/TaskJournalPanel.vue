<template>
    <div class="journal">
        <!-- Category tabs -->
        <JournalCategoryTabs
            :active-category="activeCategory"
            :chapter-category-filter="chapterCategoryFilter"
            :has-dot="hasCategoryDot"
            @select="handleCategoryChange"
        />

        <!-- Dual panel body -->
        <div class="journal__body">
            <!-- Left: task list -->
            <JournalTaskList
                :tasks="filteredTasksByCategory"
                :selected-task-id="selectedTaskId"
                :active-category="activeCategory"
                :is-overdue="isOverdue"
                :has-dot="hasTaskDot"
                @select="handleSelectTask"
            />

            <!-- Right: task detail / empty state -->
            <JournalTaskDetail
                :task="selectedTask"
                :topic="topicForSelectedTask"
                :topics="topics"
                :total-task-count="allTasks.length"
                @navigate="handleNavigate"
                @pin="handlePinTaskClick"
                @complete="handleTaskComplete"
                @toggle-step="handleSubstepToggle"
                @create="handleGlobalCreate"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'
import type { TaskSubstep } from '@/composables/useKnowledgeTasks'
import { useKnowledgeTasks } from '@/composables/useKnowledgeTasks'
import { useRedDot } from '@/composables/useRedDot'

import JournalCategoryTabs from './journal/JournalCategoryTabs.vue'
import JournalTaskDetail from './journal/JournalTaskDetail.vue'
import JournalTaskList from './journal/JournalTaskList.vue'
import type { JournalCategory, TaskCreatePayload } from './journal/taskPresentation'

// ── Props / Emits ───────────────────────────────────────────────

const props = withDefaults(
    defineProps<{
        topics: KnowledgeTopic[]
        getTopicLabel?: (topicId: string) => string
        chapterCategoryFilter?: string[] // union-list mode trigger
    }>(),
    {
        getTopicLabel: undefined,
        chapterCategoryFilter: undefined
    }
)

const emit = defineEmits<{
    (e: 'completeTask', topicId: string): void
    (e: 'pinTask', taskId: string): void
    (e: 'navigateToTopic', topicId: string): void
}>()

// ── Composables ─────────────────────────────────────────────────

const { tasks, addTask, completeTask, updateSubstep, pinTask, isOverdue } = useKnowledgeTasks()
const { isVisible: isRedDotVisible, clear: clearRedDot } = useRedDot()

// ── Internal state ──────────────────────────────────────────────

const selectedTaskId = ref<string | null>(null)
const activeCategory = ref<JournalCategory>('core')

// ── Computed ────────────────────────────────────────────────────

const allTasks = computed(() => tasks.value)

const filteredTasksByCategory = computed(() => {
    // union-list mode — when chapterCategoryFilter is non-empty,
    // return tasks across all listed categories (e.g., chapter 'query'
    // has taskCategories=['core','deep-dive'] → show both).
    const source = props.chapterCategoryFilter?.length
        ? allTasks.value.filter((t) => props.chapterCategoryFilter!.includes(t.category))
        : allTasks.value.filter((t) => t.category === activeCategory.value)
    // Pinned tasks always appear first
    return [...source].toSorted((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
})

// auto-select the first task. Watches filteredTasksByCategory
// (not raw tasks) so that union-list mode (chapterCategoryFilter set)
// selects the first task in the filtered union, not tasks[0]. Also covers
// "tasks arrive later" (preset seeding fires after child setup because
// Vue 3 fires child onMounted before parent onMounted).
watch(
    filteredTasksByCategory,
    (filtered) => {
        if (selectedTaskId.value === null && filtered.length > 0) {
            selectedTaskId.value = filtered[0].id
        }
    },
    { immediate: true }
)

const selectedTask = computed(() => {
    if (!selectedTaskId.value) return null
    return allTasks.value.find((t) => t.id === selectedTaskId.value) ?? null
})

const topicForSelectedTask = computed(() => {
    if (!selectedTask.value) return null
    return props.topics.find((t) => t.id === selectedTask.value!.topicId) ?? null
})

// ── Helpers ─────────────────────────────────────────────────────

function hasTaskDot(taskId: string): boolean {
    return isRedDotVisible('task:' + taskId)
}

function hasCategoryDot(cat: string): boolean {
    return isRedDotVisible('category:' + cat)
}

// ── Handlers ────────────────────────────────────────────────────

function handleSelectTask(taskId: string): void {
    selectedTaskId.value = taskId
    clearRedDot('task:' + taskId)
}

function handleCategoryChange(cat: JournalCategory): void {
    activeCategory.value = cat
    selectedTaskId.value = null
    clearRedDot('category:' + cat)
}

function handleSubstepToggle(substepId: string): void {
    if (!selectedTask.value) return
    const substep = selectedTask.value.substeps.find((s) => s.id === substepId)
    if (!substep) return

    let nextStatus: TaskSubstep['status']
    if (substep.status === 'active') {
        nextStatus = 'done'
    } else if (substep.status === 'done') {
        nextStatus = 'active'
    } else {
        nextStatus = 'active'
    }

    updateSubstep(selectedTask.value.id, substepId, nextStatus)
}

function handleTaskComplete(taskId: string): void {
    const result = completeTask(taskId)
    if (result) {
        emit('completeTask', result.task.topicId)
    }
}

function handlePinTaskClick(taskId: string): void {
    pinTask(taskId)
    emit('pinTask', taskId)
}

function handleNavigate(): void {
    if (selectedTask.value) {
        emit('navigateToTopic', selectedTask.value.topicId)
    }
}

// handle TaskCreateForm submit from empty-state right panel
function handleGlobalCreate(payload: TaskCreatePayload): void {
    addTask(payload)
}
</script>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────── */

.journal {
    display: flex;
    flex-direction: column;
    height: 100%;
}

/* ── Body (dual panel) ────────────────────────────────────────── */

.journal__body {
    display: flex;
    flex: 1;
    min-height: 0;
}
</style>
