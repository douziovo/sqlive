<template>
    <div v-show="!isMinimized" class="px-4 py-2 border-t border-border shrink-0 bg-card">
        <div
            class="relative flex items-end bg-muted rounded-2xl border border-border focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 pl-4 pr-12 py-2 transition-colors transition-shadow"
        >
            <textarea
                v-model="inputText"
                ref="inputRef"
                class="flex-1 resize-none bg-transparent text-sm text-foreground placeholder-muted-foreground/70 outline-none min-h-[20px] max-h-[120px] py-0"
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
                class="absolute right-0 bottom-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center cursor-pointer group"
                title="停止生成"
            >
                <svg
                    class="w-3 h-3 text-muted-foreground group-hover:text-destructive transition-colors"
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
                class="absolute right-0 bottom-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                :class="
                    !inputText.trim()
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                "
            >
                <svg
                    class="w-5 h-5"
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
