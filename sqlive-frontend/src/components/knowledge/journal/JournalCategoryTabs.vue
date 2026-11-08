<template>
    <div class="journal__tabs">
        <button
            v-for="cat in CATEGORY_TABS"
            :key="cat"
            class="journal__tab"
            :class="{
                'journal__tab--active': !chapterCategoryFilter?.length && activeCategory === cat
            }"
            :style="activeCategory === cat ? { '--tab-accent': TASK_CATEGORY_COLORS[cat] } : {}"
            @click="emit('select', cat)"
        >
            {{ TASK_CATEGORY_LABELS[cat] }}
            <RedDotBadge :show="hasDot(cat)" />
        </button>
    </div>
</template>

<script setup lang="ts">
import { TASK_CATEGORY_COLORS, TASK_CATEGORY_LABELS } from '@/data/taskCategories'
import RedDotBadge from '../RedDotBadge.vue'
import type { JournalCategory } from './taskPresentation'

const CATEGORY_TABS = ['core', 'deep-dive', 'daily'] as const

defineProps<{
    activeCategory: JournalCategory
    chapterCategoryFilter?: string[]
    hasDot: (cat: string) => boolean
}>()

const emit = defineEmits<{
    (e: 'select', cat: JournalCategory): void
}>()
</script>

<style scoped>
.journal__tabs {
    display: flex;
    gap: 0;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
    padding: 0 16px;
}

.journal__tab {
    position: relative;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted-foreground);
    border: none;
    background: none;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
}

.journal__tab--active {
    color: var(--foreground);
    border-bottom-color: var(--tab-accent);
}

.journal__tab:hover:not(.journal__tab--active) {
    color: var(--foreground);
}
</style>
