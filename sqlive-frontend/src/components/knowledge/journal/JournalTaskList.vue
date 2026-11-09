<template>
    <div class="journal__list">
        <div v-if="tasks.length === 0" class="journal__list-empty">
            <ClipboardList class="journal__list-empty-icon" :size="36" />
            <p>暂无{{ TASK_CATEGORY_LABELS[activeCategory] }}任务</p>
        </div>
        <button
            v-for="task in tasks"
            :key="task.id"
            class="journal__list-item"
            :class="{ 'journal__list-item--selected': task.id === selectedTaskId }"
            :style="{ '--item-accent': TASK_CATEGORY_COLORS[task.category] }"
            @click="emit('select', task.id)"
        >
            <span class="journal__list-item-title" :class="{ 'text-red-500': isOverdue(task) }">
                {{ task.title }}
            </span>
            <span class="journal__list-item-meta">
                <span v-if="task.substeps.length > 0" class="journal__list-item-steps">
                    {{ task.substeps.filter((s) => s.status === 'done').length }}/{{
                        task.substeps.length
                    }}
                </span>
                <span
                    class="journal__list-item-priority"
                    :class="priorityDotClass(task.priority)"
                />
                <RedDotBadge :show="hasDot(task.id)" />
            </span>
        </button>
    </div>
</template>

<script setup lang="ts">
import { ClipboardList } from '@lucide/vue'

import type { KnowledgeTask } from '@/composables/useKnowledgeTasks'
import { TASK_CATEGORY_COLORS, TASK_CATEGORY_LABELS } from '@/data/taskCategories'

import RedDotBadge from '../RedDotBadge.vue'
import { priorityDotClass } from './taskPresentation'
import type { JournalCategory } from './taskPresentation'

defineProps<{
    tasks: KnowledgeTask[]
    selectedTaskId: string | null
    activeCategory: JournalCategory
    isOverdue: (task: KnowledgeTask) => boolean
    hasDot: (taskId: string) => boolean
}>()

const emit = defineEmits<{
    (e: 'select', taskId: string): void
}>()
</script>

<style scoped>
.journal__list {
    width: 280px;
    min-width: 200px;
    border-right: 1px solid var(--border);
    overflow-y: auto;
}

.journal__list-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    gap: 8px;
    color: var(--muted-foreground);
    font-size: 14px;
}

.journal__list-empty-icon {
    /* D-06: SVG icon (ClipboardList) replaces 📋 emoji */
    color: var(--muted-foreground);
    opacity: 0.4;
}

.journal__list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    border-left: 3px solid var(--item-accent);
    border-radius: 0;
    background: transparent;
    cursor: pointer;
    transition: background 0.15s;
    text-align: left;
    font-size: 13px;
    position: relative;
}

.journal__list-item--selected {
    background: var(--secondary);
}

.journal__list-item:hover {
    background: var(--muted);
}

.journal__list-item-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journal__list-item-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.journal__list-item-steps {
    font-size: 11px;
    color: var(--muted-foreground);
    white-space: nowrap;
}

.journal__list-item-priority {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}

/* priorityDotClass() 在运行时拼接这些类名（taskPresentation.ts），静态检查器无法识别，不可删除 */
/*noinspection CssUnusedSymbol*/
.journal__dot--low {
    background: #9ca3af;
}

/* 同上：由 priorityDotClass() 动态返回 */
/*noinspection CssUnusedSymbol*/
.journal__dot--medium {
    background: #eab308;
}

/* 同上：由 priorityDotClass() 动态返回 */
/*noinspection CssUnusedSymbol*/
.journal__dot--high {
    background: #ef4444;
}
</style>
