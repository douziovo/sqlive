import type { Edge } from '@vue-flow/core'
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { KnowledgeNode } from '@/composables/useKnowledgeGraph'

/**
 * useKnowledgePanelFilters — difficulty/category chip state + dimming logic
 * for the knowledge panel topbar (extracted from KnowledgePanel.vue).
 *
 * Non-matching nodes are dimmed (opacity 0.12), not removed; edges whose
 * endpoints are not both matching are hidden.
 */
export function useKnowledgePanelFilters(
    nodes: ComputedRef<KnowledgeNode[]>,
    edges: ComputedRef<Edge[]>
): {
    activeDifficulty: Ref<string | null>
    activeCategory: Ref<string | null>
    filteredNodes: ComputedRef<KnowledgeNode[]>
    filteredEdges: ComputedRef<Edge[]>
    toggleDifficulty: (key: string) => void
    toggleCategory: (key: string) => void
    resetAllFilters: () => void
} {
    const activeDifficulty = ref<string | null>(null)
    const activeCategory = ref<string | null>(null)

    const filteredNodes = computed<KnowledgeNode[]>(() => {
        return nodes.value.map((node) => {
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
        if (!activeDifficulty.value && !activeCategory.value) return edges.value
        const visibleIds = new Set(
            nodes.value
                .filter((n) => {
                    // 直接用真值表达式替代 `if (cond) return false; return true`（TrivialIfJS）
                    const difficultyMatch =
                        !activeDifficulty.value ||
                        n.data.difficulty === parseInt(activeDifficulty.value, 10)
                    const categoryMatch =
                        !activeCategory.value || n.data.category === activeCategory.value
                    return difficultyMatch && categoryMatch
                })
                .map((n) => n.id)
        )
        return edges.value.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
    })

    function toggleDifficulty(key: string): void {
        activeDifficulty.value = activeDifficulty.value === key ? null : key
    }

    function toggleCategory(key: string): void {
        activeCategory.value = activeCategory.value === key ? null : key
    }

    function resetAllFilters(): void {
        activeDifficulty.value = null
        activeCategory.value = null
    }

    return {
        activeDifficulty,
        activeCategory,
        filteredNodes,
        filteredEdges,
        toggleDifficulty,
        toggleCategory,
        resetAllFilters
    }
}
