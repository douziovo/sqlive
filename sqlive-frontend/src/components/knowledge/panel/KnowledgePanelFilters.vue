<template>
    <div class="knowledge-panel__filters">
        <button
            class="knowledge-panel__filter-btn"
            :class="{ 'knowledge-panel__filter-btn--active': !activeDifficulty && !activeCategory }"
            @click="emit('reset-filters')"
        >
            全部
        </button>
        <button
            v-for="f in difficultyChips"
            :key="f.key"
            class="knowledge-panel__filter-btn"
            :class="{ 'knowledge-panel__filter-btn--active': activeDifficulty === f.key }"
            @click="emit('toggle-difficulty', f.key)"
        >
            {{ f.label }}
        </button>
        <span class="knowledge-panel__filter-sep" />
        <button
            v-for="f in categoryChips"
            :key="f.key"
            class="knowledge-panel__filter-btn"
            :class="{ 'knowledge-panel__filter-btn--active': activeCategory === f.key }"
            @click="emit('toggle-category', f.key)"
        >
            {{ f.label }}
        </button>
    </div>
</template>

<script setup lang="ts">
interface FilterOption {
    key: string
    label: string
}

defineProps<{
    activeDifficulty: string | null
    activeCategory: string | null
}>()

const emit = defineEmits<{
    (e: 'toggle-difficulty', key: string): void
    (e: 'toggle-category', key: string): void
    (e: 'reset-filters'): void
}>()

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
</script>

<style scoped>
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
    transition:
        background 0.15s,
        color 0.15s,
        border-color 0.15s;
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
</style>
