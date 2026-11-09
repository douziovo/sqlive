<template>
    <div class="flex">
        <div class="min-w-0 flex-1">
            <Reasoning
                v-if="msg.reasoning || msg.isReasoning"
                :is-streaming="msg.isReasoning || false"
                :default-open="false"
                class="mb-2"
            >
                <ReasoningTrigger :reasoning="msg.reasoning || ''" />
                <ReasoningContent :content="msg.reasoning || ''" />
            </Reasoning>
            <div
                v-if="msg.isStreaming && !msg.content && !msg.isReasoning"
                class="flex items-center gap-2 py-1 text-muted-foreground/70"
            >
                <Loader class="size-3.5" /><span class="text-sm">Thinking...</span>
            </div>
            <!-- Markdown rendered with marked -->
            <div
                v-if="msg.content"
                class="md-body w-full overflow-hidden text-sm leading-relaxed text-foreground"
                v-html="renderMd(msg.content)"
            />
            <div
                v-if="msg.content && !msg.isStreaming"
                :class="[
                    'mt-1 -ml-1 flex items-center gap-1 transition-opacity duration-150',
                    isLast ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'
                ]"
            >
                <button
                    @click="emit('regenerate', msg.id)"
                    class="rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-muted-foreground"
                    title="重新回答"
                >
                    <svg
                        class="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path d="M1 4v6h6M23 20v-6h-6" />
                        <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                    </svg>
                </button>
                <button
                    @click="emit('copy', msg.content)"
                    class="rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-muted-foreground"
                    :title="copied ? '已复制' : '复制'"
                >
                    <svg
                        v-if="!copied"
                        class="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    <svg
                        v-else
                        class="h-3.5 w-3.5 text-green-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </button>
                <button
                    @click="emit('delete', msg.id)"
                    class="rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="删除"
                >
                    <svg
                        class="h-3.5 w-3.5"
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
            <AiMessageFooter
                v-if="isLast && !msg.isStreaming && msg.content"
                :start-time="msg.timestamp"
                :first-token-time="msg.firstTokenTime"
                :end-time="msg.endTime"
                :usage="msg.metadata?.usage"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'

import { Loader } from '@/components/ai-elements/loader'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning'
import AiMessageFooter from '@/components/AiMessageFooter.vue'
import type { AiMessage } from '@/composables/useAiChat'
import { sanitizeConfig } from '@/utils/sanitize'

defineProps<{
    msg: AiMessage
    isLast: boolean
    copied: boolean
}>()

const emit = defineEmits<{
    regenerate: [messageId: string]
    copy: [content: string]
    delete: [messageId: string]
}>()

function renderMd(text: string): string {
    if (!text) return ''
    try {
        const raw = marked.parse(text, { breaks: true, gfm: true }) as string
        return DOMPurify.sanitize(raw, sanitizeConfig)
    } catch {
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        return `<pre>${escaped}</pre>`
    }
}
</script>

<style>
/* Markdown body — marked output (global styles, moved verbatim from AiChatPanel.vue) */
.md-body {
    word-break: break-word;
}
.md-body h1 {
    font-size: 0.95rem;
    font-weight: 700;
    margin: 0.8em 0 0.4em;
}
.md-body h2 {
    font-size: 0.88rem;
    font-weight: 600;
    margin: 0.7em 0 0.3em;
}
.md-body h3 {
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0.6em 0 0.25em;
}
.md-body h4 {
    font-size: 0.8rem;
    font-weight: 600;
    margin: 0.5em 0 0.2em;
}
.md-body p {
    margin: 0.5em 0;
}
.md-body p:first-child {
    margin-top: 0;
}
.md-body p:last-child {
    margin-bottom: 0;
}
.md-body ul,
.md-body ol {
    padding-left: 1.5em;
    margin: 0.5em 0;
}
.md-body li {
    margin: 0.15em 0;
}
.md-body pre {
    background: #f8fafc;
    color: #334155;
    border: 1px solid #e2e8f0;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    max-width: 100%;
    margin: 0.6em 0;
    font-size: 0.8rem;
    line-height: 1.5;
    white-space: pre-wrap;
}
.md-body code {
    font-family: var(--font-mono), monospace;
    font-size: 0.8em;
}
.md-body :not(pre) > code {
    background: var(--muted);
    color: var(--foreground);
    padding: 0.1em 0.35em;
    border-radius: 0.25rem;
}
.md-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.6em 0;
    display: block;
    overflow-x: auto;
    max-width: 100%;
}
.md-body th,
.md-body td {
    border: 1px solid #d1d5db;
    padding: 0.4rem 0.6rem;
    text-align: left;
    font-size: 0.75rem;
}
.md-body th {
    background: #f3f4f6;
    font-weight: 600;
}
.md-body blockquote {
    border-left: 3px solid #d1d5db;
    padding-left: 1em;
    margin: 0.5em 0;
    color: #6b7280;
}
.md-body hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 1em 0;
}
.md-body img {
    max-width: 100%;
    border-radius: 0.5rem;
}
.md-body a {
    color: #2563eb;
    text-decoration: underline;
}
.md-body strong {
    font-weight: 600;
}
</style>
