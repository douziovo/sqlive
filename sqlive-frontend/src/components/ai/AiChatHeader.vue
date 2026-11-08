<template>
    <div
        class="flex items-center justify-between px-4 py-2 border-b border-border select-none shrink-0"
        :class="isMinimized ? 'cursor-pointer' : 'cursor-move'"
        @mousedown="emit('dragStart', $event)"
        @dblclick="emit('toggle')"
    >
        <span class="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span
                class="w-5 h-5 rounded-full bg-linear-to-br from-primary to-primary/60 flex items-center justify-center text-[10px] text-white"
                >AI</span
            >
            SQL 助手
        </span>
        <div class="flex items-center gap-1">
            <button
                @click="emit('clear')"
                class="text-xs text-muted-foreground/70 hover:text-muted-foreground px-2 py-1 rounded-lg hover:bg-secondary cursor-pointer transition-colors"
                title="清空对话"
            >
                <svg
                    class="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path
                        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"
                    />
                </svg>
            </button>
            <button
                data-testid="ai-chat-close"
                @click="emit('close')"
                class="text-xs text-muted-foreground/70 hover:text-muted-foreground px-2 py-1 rounded-lg hover:bg-secondary cursor-pointer transition-colors"
                title="关闭"
            >
                <svg
                    class="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path d="M18 6L6 18M6 6l12 12" />
                </svg>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    isMinimized: boolean
}>()

const emit = defineEmits<{
    clear: []
    close: []
    dragStart: [e: MouseEvent]
    toggle: []
}>()
</script>
