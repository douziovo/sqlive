import {useLocalStorage, watchDebounced} from '@vueuse/core'
import {computed, type Ref, ref} from 'vue'
import {useAiStreaming} from '../composables/useAiStreaming'
import {API_BASE} from '../config'
import type {TableSchema} from '../model/DatabaseTypes'
import type {DisplayHandler} from './useInlineActions'

export interface AiMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    reasoning?: string
    timestamp: number
    isStreaming?: boolean
    isReasoning?: boolean
    firstTokenTime?: number
    endTime?: number
    metadata?: {
        type?: 'error-analysis' | 'fix-code' | 'explain' | 'optimize' | 'generate-sql' | 'general-chat' | 'chat'
        context?: {
            sql?: string
            error?: { line: number; message: string }
        }
        usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
    }
}

export interface AiActions {
    isLoading: Ref<boolean>
    analyzeError: (error: { line: number; message: string }, display: DisplayHandler) => Promise<void>
    fixCode: (display: DisplayHandler) => Promise<string | null>
    explain: (code: string, display: DisplayHandler) => Promise<void>
    optimize: (code: string, display: DisplayHandler) => Promise<string | null>
    generateSql: (description: string, display: DisplayHandler) => Promise<string | null>
    onOpenChat: (context?: string) => void
    sendToAi: (text: string) => void
    onTogglePanel: () => void
}

export type AiPanelMode =
    | 'chat'
    | 'error-analysis'
    | 'fix-code'
    | 'explain'
    | 'optimize'
    | 'generate-sql'
    | 'general-chat'

export const AI_MODE_LABELS: Record<AiPanelMode, string> = {
    chat: '🤖 AI 助手',
    'error-analysis': '🤖 AI 错误分析',
    'fix-code': '🔧 代码修复',
    explain: '📖 SQL 解释',
    optimize: '⚡ SQL 优化',
    'generate-sql': '✨ AI 生成 SQL',
    'general-chat': '🤖 AI 助手'
}

let msgCounter = 0

/**
 * Core AI chat composable. Must be instantiated once in App.vue.
 * Handles SSE streaming chat, error auto-analysis, and learning suggestions.
 */
// D-R2-004: previously received the whole DatabaseModel but only read db.tables.
// Narrowed to a `tablesSource: () => TableSchema[]` getter (matches the
// useErDiagram L92 范式) so this composable no longer couples to the whole DatabaseModel shape.
export function useAiChat(ctx: {
    executionError: Ref<{ line: number; message: string } | null>
    code: Ref<string>
    tablesSource: () => TableSchema[]
}) {
    const messages = ref<AiMessage[]>([])
    const isLoading = ref(false)
    const showPanel = ref(false)
    const masteredTopicsRaw = useLocalStorage<string[]>('ai-mastered-topics', [])
    const masteredTopics = computed({
        get: () => new Set(masteredTopicsRaw.value),
        set: (v: Set<string>) => {
            masteredTopicsRaw.value = [...v]
        }
    })
    const autoAnalysisEnabled = ref(true)
    const {streamCall, cancelStream} = useAiStreaming(API_BASE, isLoading)

    const currentSchema = computed(() => {
        return (ctx.tablesSource() ?? []).map((t) => ({
            table: t.name,
            columns: t.columns || [],
            columnTypes: t.columnTypes || {}
        }))
    })

    // ── Auto-analyze errors ──────────────────────────────────────
    watchDebounced(
        () => ctx.executionError.value,
        (err) => {
            if (err && autoAnalysisEnabled.value && err.line > 0) {
                messages.value.push({
                    id: `sys-err-${++msgCounter}`,
                    role: 'system',
                    content: `SQL 执行出错（第 ${err.line} 行）：${err.message}`,
                    timestamp: Date.now(),
                    metadata: {type: 'error-analysis', context: {error: {line: err.line, message: err.message}}}
                })
            }
        },
        {debounce: 500}
    )

    // ── Streaming SSE ─────────────────────────────────────────────

    function addAssistantMessage(type: AiPanelMode): AiMessage {
        const msg: AiMessage = {
            id: `ai-${++msgCounter}`,
            role: 'assistant',
            content: '',
            reasoning: '',
            timestamp: Date.now(),
            isStreaming: true,
            isReasoning: false,
            metadata: {type}
        }
        messages.value.push(msg)
        return messages.value[messages.value.length - 1]
    }

    async function sendMessage(text: string): Promise<void> {
        if (!text.trim()) return
        if (isLoading.value) return

        const userMsg: AiMessage = {
            id: `user-${++msgCounter}`,
            role: 'user',
            content: text,
            timestamp: Date.now(),
            metadata: {type: 'general-chat'}
        }
        messages.value.push(userMsg)

        const aiMsg = addAssistantMessage('general-chat')
        isLoading.value = true

        try {
            await streamCall(
                '/chat',
                {
                    mode: 'chat',
                    message: text,
                    history: messages.value.slice(0, -1).map((m) => ({role: m.role, content: m.content})),
                    currentSql: ctx.code.value,
                    schema: currentSchema.value
                },
                (chunk) => {
                    let parsed: {
                        type?: string;
                        content?: string;
                        prompt?: number;
                        completion?: number;
                        total?: number
                    }
                    try {
                        parsed = JSON.parse(chunk)
                    } catch {
                        return
                    }
                    switch (parsed.type) {
                        case 'done':
                            return
                        case 'usage':
                            aiMsg.metadata = {
                                ...aiMsg.metadata,
                                usage: {
                                    promptTokens: parsed.prompt ?? 0,
                                    completionTokens: parsed.completion ?? 0,
                                    totalTokens: parsed.total ?? 0
                                }
                            }
                            break
                        case 'reasoning':
                            aiMsg.isReasoning = true
                            aiMsg.reasoning = (aiMsg.reasoning || '') + (parsed.content || '')
                            if (!aiMsg.firstTokenTime) aiMsg.firstTokenTime = Date.now()
                            break
                        case 'error':
                            aiMsg.content = parsed.content || ''
                            break
                        default:
                            aiMsg.isReasoning = false
                            aiMsg.content += parsed.content || ''
                            if (!aiMsg.firstTokenTime && (parsed.content || '').trim()) aiMsg.firstTokenTime = Date.now()
                    }
                }
            )
        } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : '未知错误'
            aiMsg.content = `调用 AI 失败：${errMsg}`
        } finally {
            aiMsg.isStreaming = false
            aiMsg.isReasoning = false
            aiMsg.endTime = Date.now()
            if (!aiMsg.content && aiMsg.reasoning) {
                aiMsg.content = aiMsg.reasoning
            }
            isLoading.value = false
        }
    }

    // ── Panel control ─────────────────────────────────────────────
    function togglePanel(): void {
        showPanel.value = !showPanel.value
    }

    function openPanel(): void {
        showPanel.value = true
    }

    function clearMessages(): void {
        messages.value = []
    }

    function regenerateMessage(messageId: string): void {
        const idx = messages.value.findIndex((m) => m.id === messageId)
        if (idx <= 0) return
        const msg = messages.value[idx]
        if (msg.role !== 'assistant') return
        const userMsg = messages.value[idx - 1]
        messages.value.splice(idx, 1)
        sendMessage(userMsg.content)
    }

    function editMessage(messageId: string, newText: string): void {
        const idx = messages.value.findIndex((m) => m.id === messageId)
        if (idx < 0) return
        const nextMsg = messages.value[idx + 1]
        if (nextMsg?.role === 'assistant') {
            messages.value.splice(idx, 2)
        } else {
            messages.value.splice(idx, 1)
        }
        sendMessage(newText)
    }

    function deleteMessage(messageId: string): void {
        const idx = messages.value.findIndex((m) => m.id === messageId)
        if (idx < 0) return
        const msg = messages.value[idx]
        if (msg.role === 'assistant') {
            const prevMsg = messages.value[idx - 1]
            if (prevMsg?.role === 'user') {
                messages.value.splice(idx - 1, 2)
            } else {
                messages.value.splice(idx, 1)
            }
        } else if (msg.role === 'user') {
            const nextMsg = messages.value[idx + 1]
            if (nextMsg?.role === 'assistant') {
                messages.value.splice(idx, 2)
            } else {
                messages.value.splice(idx, 1)
            }
        }
    }

    return {
        messages,
        isLoading,
        showPanel,
        masteredTopics,
        autoAnalysisEnabled,
        sendMessage,
        cancelStream,
        clearMessages,
        togglePanel,
        openPanel,
        regenerateMessage,
        editMessage,
        deleteMessage
    }
}
