import { triggerRef } from 'vue'
import type { Ref } from 'vue'
import type { KnowledgeNode as KnowledgeFlowNode } from '@/composables/useKnowledgeGraph'

/**
 * useNodeCelebrationEffects — Spark particles / Unlock glow (-03),
 * extracted from KnowledgeGraph.vue. Mutates node data flags on the shared
 * displayNodes ref and force-triggers reactivity via triggerRef.
 */
export function useNodeCelebrationEffects(displayNodes: Ref<KnowledgeFlowNode[]>): {
    triggerSparkBurst: (topicId: string) => void
    triggerUnlockGlow: (topicId: string) => void
} {
    function triggerSparkBurst(topicId: string): void {
        const node = displayNodes.value.find((n) => n.id === `topic-${topicId}`)
        if (!node) return
        node.data = { ...node.data, triggerSparkBurst: true }
        triggerRef(displayNodes)
        setTimeout(() => {
            node.data = { ...node.data, triggerSparkBurst: false }
            triggerRef(displayNodes)
        }, 700)
    }

    function triggerUnlockGlow(topicId: string): void {
        const topic = displayNodes.value.find((n) => n.data.topicId === topicId)
        if (!topic) return
        for (const nextId of topic.data.nextTopics || []) {
            const nextNode = displayNodes.value.find((n) => n.data.topicId === nextId)
            if (!nextNode) continue
            nextNode.data = { ...nextNode.data, triggerUnlockGlow: true }
            triggerRef(displayNodes)
            setTimeout(() => {
                nextNode.data = { ...nextNode.data, triggerUnlockGlow: false }
                triggerRef(displayNodes)
            }, 800)
        }
    }

    return { triggerSparkBurst, triggerUnlockGlow }
}
