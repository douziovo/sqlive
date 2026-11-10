<template>
    <div
        class="flex shrink-0 items-center justify-between border-b border-border px-4 py-2 select-none"
        :class="isMinimized ? 'cursor-pointer' : 'cursor-move'"
        @mousedown="emit('dragStart', $event)"
        @dblclick="emit('toggle')"
    >
        <span class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span
                class="flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/60 text-[10px] text-white"
                >AI</span
            >
            SQL 助手
        </span>
        <div class="flex items-center gap-1">
            <button
                @click="emit('clear')"
                class="cursor-pointer rounded-lg px-2 py-1 text-xs text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-muted-foreground"
                title="清空对话"
            >
                <svg
                    class="h-4 w-4"
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
                class="cursor-pointer rounded-lg px-2 py-1 text-xs text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-muted-foreground"
                title="关闭"
            >
                <svg
                    class="h-4 w-4"
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
