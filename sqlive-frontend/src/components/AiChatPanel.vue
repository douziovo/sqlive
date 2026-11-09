<template>
    <div
        class="ai-chat-panel fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        :class="{ 'ai-chat-panel--minimized': isMinimized }"
        :style="panelStyle"
    >
        <!-- Header -->
        <AiChatHeader
            :is-minimized="isMinimized"
            @clear="emit('clear')"
            @close="emit('close')"
            @drag-start="onDragStart"
            @toggle="onHeaderDblClick"
        />

        <!-- Messages -->
        <AiChatMessages
            :messages="messages"
            :is-minimized="isMinimized"
            @send="(text: string) => emit('send', text)"
            @regenerate="(messageId: string) => emit('regenerate', messageId)"
            @edit="(messageId: string, newText: string) => emit('edit', messageId, newText)"
            @delete="(messageId: string) => emit('delete', messageId)"
        />

        <!-- Input -->
        <AiChatInput
            :is-loading="isLoading"
            :is-minimized="isMinimized"
            @send="(text: string) => emit('send', text)"
            @close="emit('close')"
            @cancel-stream="emit('cancelStream')"
        />

        <div
            class="absolute right-0 bottom-0 z-10 h-4 w-4 cursor-nwse-resize"
            @mousedown.stop="onResizeStart"
        >
            <svg
                class="absolute right-1 bottom-1 h-3 w-3 text-muted-foreground/50"
                viewBox="0 0 12 12"
            >
                <path
                    d="M11 1L1 11M11 5L5 11M11 9L9 11"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                />
            </svg>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import AiChatHeader from '@/components/ai/AiChatHeader.vue'
import AiChatInput from '@/components/ai/AiChatInput.vue'
import AiChatMessages from '@/components/ai/AiChatMessages.vue'
import { useAiPanelGeometry } from '@/components/ai/useAiPanelGeometry'

import type { AiMessage } from '../composables/useAiChat'

defineProps<{
    messages: AiMessage[]
    isLoading: boolean
    minimized: boolean
}>()

const emit = defineEmits<{
    send: [text: string]
    close: []
    clear: []
    cancelStream: []
    regenerate: [messageId: string]
    edit: [messageId: string, newText: string]
    delete: [messageId: string]
}>()

const { isMinimized, panelStyle, initPosition, onHeaderDblClick, onDragStart, onResizeStart } =
    useAiPanelGeometry()

function onDocumentKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || isMinimized.value) return
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'TEXTAREA' || tag === 'INPUT') return
    emit('close')
}

onMounted(() => {
    initPosition()
    document.addEventListener('keydown', onDocumentKeyDown)
})
onUnmounted(() => {
    document.removeEventListener('keydown', onDocumentKeyDown)
})
</script>
