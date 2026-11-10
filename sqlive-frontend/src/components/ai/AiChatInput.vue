<template>
    <div v-show="!isMinimized" class="shrink-0 border-t border-border bg-card px-4 py-2">
        <div
            class="relative flex items-end rounded-2xl border border-border bg-muted py-2 pr-12 pl-4 transition-colors transition-shadow focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20"
        >
            <textarea
                v-model="inputText"
                ref="inputRef"
                class="max-h-[120px] min-h-[20px] flex-1 resize-none bg-transparent py-0 text-sm text-foreground placeholder-muted-foreground/70 outline-none"
                placeholder="输入消息..."
                rows="1"
                :disabled="isLoading"
                @keydown.enter.exact.prevent="send"
                @keydown.esc="emit('close')"
                @input="autoResize"
            ></textarea>
            <!-- Stop button -->
            <button
                v-if="isLoading"
                @click="emit('cancelStream')"
                class="group absolute right-0 bottom-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-secondary"
                title="停止生成"
            >
                <svg
                    class="h-3 w-3 text-muted-foreground transition-colors group-hover:text-destructive"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
            </button>
            <!-- Send button -->
            <button
                v-else
                @click="send()"
                :disabled="!inputText.trim()"
                class="absolute right-0 bottom-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors"
                :class="
                    !inputText.trim()
                        ? 'cursor-not-allowed bg-muted text-muted-foreground'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                "
            >
                <svg
                    class="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'

const props = defineProps<{
    isLoading: boolean
    isMinimized: boolean
}>()

const emit = defineEmits<{
    send: [text: string]
    close: []
    cancelStream: []
}>()

const inputText = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)

function send(e?: KeyboardEvent) {
    if (e?.isComposing) return
    const t = inputText.value.trim()
    if (!t || props.isLoading) return
    emit('send', t)
    inputText.value = ''
    nextTick(() => {
        if (inputRef.value) inputRef.value.style.height = 'auto'
    })
}
function autoResize() {
    const el = inputRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}
</script>
