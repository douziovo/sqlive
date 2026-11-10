<template>
    <!-- Right: task detail -->
    <div v-if="task" class="journal__detail">
        <div class="journal__detail-header">
            <h3 class="journal__detail-title">{{ task.title }}</h3>
            <span
                class="journal__detail-badge"
                :style="{ background: TASK_CATEGORY_COLORS[task.category] }"
            >
                {{ TASK_CATEGORY_LABELS[task.category] }}
            </span>
            <span v-if="topic" class="journal__detail-topic">
                {{ topic.label }} &middot; {{ DIFFICULTY_LABELS[topic.difficulty] || '入门' }}
            </span>
        </div>

        <StepProgress
            v-if="task.substeps.length > 0"
            :substeps="task.substeps"
            :editable="true"
            @toggle-step="(substepId: string) => emit('toggle-step', substepId)"
        />

        <div class="journal__detail-reward">
            首次完成此知识点任务奖励：+{{ getTaskXp(topic?.difficulty) }} XP
        </div>

        <div class="journal__detail-actions">
            <button class="journal__btn journal__btn--primary" @click="emit('navigate')">
                定位知识点
            </button>
            <button class="journal__btn journal__btn--secondary" @click="emit('pin', task.id)">
                {{ task.isPinned ? '已置顶' : '置顶追踪' }}
            </button>
            <button
                v-if="allSubstepsDone(task) && task.status !== 'done'"
                class="journal__btn journal__btn--complete"
                @click="emit('complete', task.id)"
            >
                标记完成
            </button>
        </div>
    </div>

    <!-- Right: empty state -->
    <div v-else class="journal__detail-empty">
        <!-- D-06: guided empty state when no tasks exist at all -->
        <template v-if="totalTaskCount === 0">
            <ClipboardList class="journal__detail-empty-icon" :size="56" />
            <p class="journal__detail-empty-heading">还没有学习任务</p>
            <button class="journal__detail-empty-btn" @click="showCreateForm = true">
                创建你的第一个任务
            </button>
            <TaskCreateForm
                v-if="showCreateForm"
                mode="global"
                :topics="topics"
                @create="handleCreate"
                @cancel="showCreateForm = false"
            />
        </template>
        <!-- D-08 will default-select first task in 10-03; this branch is rare post-D-08 -->
        <template v-else>
            <ClipboardList class="journal__detail-empty-icon" :size="56" />
            <p>选择一个任务查看详情</p>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ClipboardList } from '@lucide/vue'
import { ref } from 'vue'

import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'
import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'
import { TASK_CATEGORY_COLORS, TASK_CATEGORY_LABELS } from '@/data/taskCategories'

import StepProgress from '../StepProgress.vue'
import TaskCreateForm from '../TaskCreateForm.vue'
import { DIFFICULTY_LABELS, allSubstepsDone, getTaskXp } from './taskPresentation'
import type { TaskCreatePayload } from './taskPresentation'

defineProps<{
    task: KnowledgeTask | null
    topic: KnowledgeTopic | null
    topics: KnowledgeTopic[]
    totalTaskCount: number
}>()

const emit = defineEmits<{
    (e: 'navigate'): void
    (e: 'pin', taskId: string): void
    (e: 'complete', taskId: string): void
    (e: 'toggle-step', substepId: string): void
    (e: 'create', payload: TaskCreatePayload): void
}>()

// D-06: controls TaskCreateForm visibility in empty-state right panel
const showCreateForm = ref(false)

function handleCreate(payload: TaskCreatePayload): void {
    emit('create', payload)
    showCreateForm.value = false
}
</script>

<style scoped>
.journal__detail {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
}

.journal__detail-header {
    margin-bottom: 16px;
}

.journal__detail-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 12px;
}

.journal__detail-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    color: white;
    margin-right: 8px;
}

.journal__detail-topic {
    font-size: 13px;
    color: var(--muted-foreground);
}

.journal__detail-reward {
    font-size: 13px;
    color: var(--muted-foreground);
    margin-top: 12px;
    padding: 8px;
    background: var(--muted);
    border-radius: 6px;
}

.journal__detail-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
}

/* ── Detail empty state ───────────────────────────────────────── */

.journal__detail-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--muted-foreground);
    font-size: 14px;
}

.journal__detail-empty-icon {
    /* D-06: SVG icon (ClipboardList) replaces 📋 emoji */
    color: var(--muted-foreground);
    opacity: 0.25;
}

.journal__detail-empty-heading {
    font-size: 16px;
    font-weight: 600;
    color: var(--foreground);
    margin: 8px 0 0;
}

.journal__detail-empty-btn {
    margin-top: 12px;
    padding: 8px 20px;
    border-radius: 6px;
    border: none;
    background: var(--primary);
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s;
}

.journal__detail-empty-btn:hover {
    opacity: 0.9;
}

/* ── Buttons ──────────────────────────────────────────────────── */

.journal__btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: opacity 0.15s;
}

.journal__btn:hover {
    opacity: 0.9;
}

.journal__btn--primary {
    background: var(--primary);
    color: white;
}

.journal__btn--secondary {
    background: var(--muted);
    color: var(--foreground);
}

.journal__btn--complete {
    background: #52c41a;
    color: white;
}
</style>
