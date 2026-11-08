<template>
    <!-- Inline edit mode: full width, expands to the left -->
    <div v-if="isEditing" class="flex flex-col gap-2">
        <textarea
            v-model="editText"
            ref="editTextareaRef"
            class="text-sm bg-card border border-border rounded-lg px-3 py-2 outline-none focus:border-border focus:ring-2 focus:ring-ring w-full min-h-[40px]"
            rows="1"
            @input="autoResizeEdit"
            @keydown.enter.exact.prevent="submitEdit"
            @keydown.esc="cancelEdit"
        ></textarea>
        <div class="flex items-center gap-2 justify-end">
            <button
                @click="cancelEdit"
                class="px-2 py-1 text-[11px] bg-secondary text-secondary-foreground hover:text-secondary-foreground hover:bg-secondary rounded-lg transition-colors"
            >
                取消
            </button>
            <button
                @click="submitEdit"
                class="px-2 py-1 text-[11px] font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
                更新
            </button>
        </div>
    </div>
    <!-- Display mode: right-aligned with bubble -->
    <div v-else class="flex justify-end">
        <div class="max-w-[85%]">
            <div
                class="text-foreground text-sm whitespace-pre-wrap break-words bg-secondary rounded-2xl px-3 py-2"
            >
                {{ msg.content }}
            </div>
            <div
                v-if="!msg.isStreaming"
                :class="[
                    'flex items-center gap-1 mt-1 justify-end',
                    isLast ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'
                ]"
            >
                <button
                    @click="emit('startEdit')"
                    class="p-1.5 rounded-lg text-muted-foreground/70 hover:text-muted-foreground hover:bg-secondary transition-colors"
                    title="编辑"
                >
                    <svg
                        class="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </button>
                <button
                    @click="emit('delete', msg.id)"
                    class="p-1.5 rounded-lg text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="删除"
                >
                    <svg
                        class="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <polyline points="3 6 5 6 21 6" />
                        <path
                            d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                        />
                    </svg>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { AiMessage } from '@/composables/useAiChat'

const props = defineProps<{
    msg: AiMessage
    isEditing: boolean
    isLast: boolean
}>()

const emit = defineEmits<{
    startEdit: []
    submitEdit: [newText: string]
    cancelEdit: []
    delete: [messageId: string]
}>()

const editText = ref('')
const editTextareaRef = ref<HTMLTextAreaElement | null>(null)

watch(
    () => props.isEditing,
    (val) => {
        if (!val) return
        editText.value = props.msg.content
        nextTick(() => {
            const el = editTextareaRef.value
            if (!el) return
            autoResizeEdit()
            el.focus()
            el.setSelectionRange(0, 0)
            const container = el.closest('[style*="overflow"]') as HTMLElement
            if (container) {
                let offsetTop = 0
                let cur: HTMLElement | null = el
                while (cur && cur !== container) {
                    offsetTop += cur.offsetTop
                    cur = cur.offsetParent as HTMLElement | null
                }
                // Simulate a wheel-up to unstick StickToBottom BEFORE setting scrollTop
                container.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true }))
                container.scrollTop = Math.max(0, offsetTop - 60)
            }
        })
    }
)

function submitEdit() {
    const t = editText.value.trim()
    if (t) emit('submitEdit', t)
}
function cancelEdit() {
    emit('cancelEdit')
}
function autoResizeEdit() {
    const el = editTextareaRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`
}
</script>
