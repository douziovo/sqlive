<template>
    <Transition name="card-pop">
        <KnowledgeDetail
            v-if="topic"
            class="knowledge-graph__detail-card"
            :topic="topic"
            :is-mastered="masteredTopics.includes(topic!.id)"
            @toggle-mastered="(topicId: string) => emit('toggle-mastered', topicId)"
            @ask-ai="(label: string) => emit('ask-ai', label)"
            @close="emit('close')"
            @view-all-tasks="emit('view-all-tasks')"
            @complete-task="(topicId: string) => emit('complete-task', topicId)"
            @navigate-to-topic="(topicId: string) => emit('navigate-to-topic', topicId)"
        />
    </Transition>
</template>

<script setup lang="ts">
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph'
import KnowledgeDetail from '../KnowledgeDetail.vue'

defineProps<{
    topic: KnowledgeTopic | null
    masteredTopics: string[]
}>()

const emit = defineEmits<{
    (e: 'toggle-mastered', topicId: string): void
    (e: 'ask-ai', label: string): void
    (e: 'close'): void
    (e: 'view-all-tasks'): void
    (e: 'complete-task', topicId: string): void
    (e: 'navigate-to-topic', topicId: string): void
}>()
</script>

<style scoped>
.knowledge-graph__detail-card {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 320px;
    max-height: 60vh;
    z-index: 10;
}

.card-pop-enter-active {
    transition:
        opacity 0.2s ease-out,
        transform 0.2s ease-out;
}
.card-pop-leave-active {
    transition:
        opacity 0.15s ease-in,
        transform 0.15s ease-in;
}
.card-pop-enter-from {
    opacity: 0;
    transform: translateY(12px) scale(0.95);
}
.card-pop-leave-to {
    opacity: 0;
    transform: translateY(12px) scale(0.95);
}
</style>
