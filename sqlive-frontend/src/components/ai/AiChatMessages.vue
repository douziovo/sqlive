<template>
    <Conversation v-show="!isMinimized" class="min-h-0 flex-1 bg-muted/50" :anchor="'none'">
        <ConversationContent>
            <ConversationEmptyState
                v-if="messages.length === 0"
                title="SQL 学习助手"
                description="我可以帮你解释、优化和生成 SQL"
            >
                <template #icon>
                    <div
                        class="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary/60 text-2xl shadow-lg shadow-primary/20"
                    >
                        🤖
                    </div>
                </template>
                <template #default>
                    <div class="mt-4 w-full max-w-xs space-y-2">
                        <Suggestion
                            v-for="p in prompts"
                            :key="p"
                            :suggestion="p"
                            variant="outline"
                            class="w-full justify-start rounded-xl border-border text-sm font-normal text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                            @click="emit('send', p)"
                            >{{ p }}</Suggestion
                        >
                    </div>
                </template>
            </ConversationEmptyState>

            <div v-for="(msg, idx) in messages" :key="msg.id">
                <div
                    v-if="msg.role === 'system'"
                    class="w-full rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive"
                >
                    ⚠️ {{ msg.content }}
                </div>

                <div v-else class="group/row mb-5">
                    <!-- User message -->
                    <AiChatUserMessage
                        v-if="msg.role === 'user'"
                        :msg="msg"
                        :is-editing="editingId === msg.id"
                        :is-last="idx === messages.length - 1"
                        @start-edit="startEdit(msg)"
                        @submit-edit="submitEdit"
                        @cancel-edit="cancelEdit"
                        @delete="emit('delete', msg.id)"
                    />

                    <!-- Assistant message -->
                    <AiChatAssistantMessage
                        v-else
                        :msg="msg"
                        :is-last="idx === messages.length - 1"
                        :copied="copiedId === msg.id"
                        @regenerate="emit('regenerate', msg.id)"
                        @copy="copyMessage"
                        @delete="emit('delete', msg.id)"
                    />
                </div>
            </div>
            <div v-if="messages.length > 0" />
        </ConversationContent>
    </Conversation>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'

import {
    Conversation,
    ConversationContent,
    ConversationEmptyState
} from '@/components/ai-elements/conversation'
import { Suggestion } from '@/components/ai-elements/suggestion'
import type { AiMessage } from '@/composables/useAiChat'

import AiChatAssistantMessage from './AiChatAssistantMessage.vue'
import AiChatUserMessage from './AiChatUserMessage.vue'

const props = defineProps<{
    messages: AiMessage[]
    isMinimized: boolean
}>()

const emit = defineEmits<{
    send: [text: string]
    regenerate: [messageId: string]
    edit: [messageId: string, newText: string]
    delete: [messageId: string]
}>()

const prompts = [
    '解释当前代码',
    '如何优化我的查询？',
    'LEFT JOIN 和 INNER JOIN 的区别',
    '什么是子查询？'
]

// ── Copy feedback ──────────────────────────────────────────────
const copiedId = ref<string | null>(null)
const copyTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

async function copyMessage(text: string) {
    try {
        await navigator.clipboard.writeText(text)
    } catch {
        /* fallback */
    }
    const msg = props.messages.find((m) => m.content === text)
    if (msg) {
        copiedId.value = msg.id
        copyTimeout.value = setTimeout(() => {
            copiedId.value = null
        }, 2000)
    }
}

// ── Inline edit coordination ───────────────────────────────────
const editingId = ref<string | null>(null)

function startEdit(msg: AiMessage) {
    editingId.value = msg.id
}

function submitEdit(newText: string) {
    if (editingId.value) {
        emit('edit', editingId.value, newText)
        editingId.value = null
    }
}
function cancelEdit() {
    editingId.value = null
}

// Auto-scroll to bottom when messages change (except when editing)
watch(
    () => props.messages.length,
    () => {
        if (editingId.value) return
        nextTick(() => {
            const container = document.querySelector(
                '.fixed.z-50 [style*="overflow"]'
            ) as HTMLElement
            if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
        })
    }
)

onUnmounted(() => {
    if (copyTimeout.value) clearTimeout(copyTimeout.value)
})
</script>
