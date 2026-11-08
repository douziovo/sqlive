<template>
    <div class="chapters__header">
        <h2 class="chapters__title">冒险之证</h2>
        <span class="chapters__level">当前等级：{{ levelName }}</span>
    </div>
    <div class="chapters__list">
        <ChapterCard
            v-for="entry in chapters"
            :key="entry.chapter.id"
            :chapter="entry.chapter"
            :progress="entry.progress"
            :unlocked="entry.unlocked"
            :current-level="entry.currentLevel"
            @open-chapter="(chapterId: string) => emit('open-chapter', chapterId)"
        />
    </div>
</template>

<script setup lang="ts">
import type { LearningChapter } from '@/data/learningChapters'
import ChapterCard from '../ChapterCard.vue'

// One ChapterCard's worth of precomputed props (built by KnowledgePanel so
// reactivity to xp/mastered state stays in the parent).
interface ChapterCardEntry {
    chapter: LearningChapter
    progress: { completed: number; total: number }
    unlocked: boolean
    currentLevel: number
}

defineProps<{
    chapters: ChapterCardEntry[]
    levelName: string
}>()

const emit = defineEmits<{
    (e: 'open-chapter', chapterId: string): void
}>()
</script>

<style scoped>
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
</style>
