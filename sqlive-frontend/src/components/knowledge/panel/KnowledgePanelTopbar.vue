<template>
    <div class="knowledge-panel__topbar">
        <button class="knowledge-panel__back-btn" @click="emit('close')">&larr; 返回编码</button>
        <span class="knowledge-panel__title">知识图谱</span>
        <input
            v-model="searchQueryModel"
            class="knowledge-panel__search"
            type="text"
            placeholder="搜索知识点..."
        />
        <div class="knowledge-panel__tabs">
            <button
                class="knowledge-panel__tab"
                :class="{ 'knowledge-panel__tab--active': activeTab === 'graph' }"
                @click="emit('tab-click', 'graph')"
            >
                图谱
            </button>
            <button
                class="knowledge-panel__tab knowledge-panel__tab--with-dot"
                :class="{ 'knowledge-panel__tab--active': activeTab === 'tasks' }"
                @click="emit('tab-click', 'tasks')"
            >
                任务
                <RedDotBadge :show="showTaskTabDot" />
            </button>
            <button
                class="knowledge-panel__tab"
                :class="{
                    'knowledge-panel__tab--active': activeTab === 'chapters'
                }"
                @click="emit('tab-click', 'chapters')"
            >
                冒险之证
            </button>
        </div>
        <template v-if="activeTab === 'graph'">
            <KnowledgePanelFilters
                :active-difficulty="activeDifficulty"
                :active-category="activeCategory"
                @toggle-difficulty="emit('toggle-difficulty', $event)"
                @toggle-category="emit('toggle-category', $event)"
                @reset-filters="emit('reset-filters')"
            />
        </template>
        <div class="knowledge-panel__level-bar">
            <span class="knowledge-panel__level-badge">{{ progress.levelName }}</span>
            <div class="knowledge-panel__xp-bar-track">
                <div class="knowledge-panel__xp-bar-fill" :style="{ width: xpBarPercent + '%' }" />
            </div>
            <span class="knowledge-panel__xp-text"
                >{{ progress.xp }}/{{ progress.nextLevelXp }}</span
            >
            <span class="knowledge-panel__progress-text"
                >{{ progress.count }}/{{ progress.total }}</span
            >
            <span v-if="progress.streak > 0" class="knowledge-panel__streak">
                <span class="knowledge-panel__streak-fire">🔥</span>
                {{ progress.streak }}
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RedDotBadge from '../RedDotBadge.vue'
import KnowledgePanelFilters from './KnowledgePanelFilters.vue'

// Subset of useKnowledgeGraph's progress summary consumed by the topbar.
interface KnowledgeProgressSummary {
    count: number
    total: number
    levelName: string
    xp: number
    nextLevelXp: number
    streak: number
}

type PanelTab = 'graph' | 'tasks' | 'chapters'

const props = defineProps<{
    activeTab: PanelTab
    searchQuery: string
    activeDifficulty: string | null
    activeCategory: string | null
    showTaskTabDot: boolean
    progress: KnowledgeProgressSummary
    xpBarPercent: number
}>()

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'update:searchQuery', value: string): void
    (e: 'tab-click', tab: PanelTab): void
    (e: 'toggle-difficulty', key: string): void
    (e: 'toggle-category', key: string): void
    (e: 'reset-filters'): void
}>()

const searchQueryModel = computed({
    get: (): string => props.searchQuery,
    set: (value: string) => emit('update:searchQuery', value)
})
</script>

<style scoped>
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

/* ── Tab bar (-03) ──────────────────── */

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
    from {
        transform: scale(1) rotate(-2deg);
    }
    to {
        transform: scale(1.15) rotate(2deg);
    }
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
</style>
