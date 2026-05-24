import { ref, computed, type Ref } from 'vue';
import { watchDebounced, useLocalStorage } from '@vueuse/core';
import type { DatabaseModel } from '../model/DatabaseTypes';
import { useAiStreaming } from '../composables/useAiStreaming';
import { API_BASE } from '../config';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  timestamp: number;
  isStreaming?: boolean;
  isReasoning?: boolean;
  firstTokenTime?: number;
  endTime?: number;
  metadata?: {
    type?: 'error-analysis' | 'fix-code' | 'explain' | 'optimize' | 'generate-sql' | 'general-chat' | 'chat';
    context?: {
      sql?: string;
      error?: { line: number; message: string };
    };
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  };
}

export interface SuggestionItem {
  id: string;
  label: string;
  reason: string;
  difficulty: number;
  prerequisites?: string[];
}

export interface AiActions {
  isLoading: Ref<boolean>;
  inlineVisible: Ref<boolean>;
  inlineContent: Ref<string>;
  inlineMode: Ref<AiPanelMode>;
  inlineActions: Ref<{ label: string; action: string }[]>;
  onAnalyzeError: (error: { line: number; message: string }) => void;
  onFixCode: () => void;
  onExplain: (code: string) => void;
  onOptimize: (code: string) => void;
  onOpenChat: (context?: string) => void;
  onGenerateSql: (description: string) => void;
  onTogglePanel: () => void;
  onInlineClose: () => void;
  onInlineAction: (action: string) => void;
}

export type AiPanelMode = 'chat' | 'error-analysis' | 'fix-code' | 'explain' | 'optimize' | 'generate-sql' | 'general-chat';

export const AI_MODE_LABELS: Record<AiPanelMode, string> = {
  'chat': '🤖 AI 助手',
  'error-analysis': '🤖 AI 错误分析',
  'fix-code': '🔧 代码修复',
  'explain': '📖 SQL 解释',
  'optimize': '⚡ SQL 优化',
  'generate-sql': '✨ AI 生成 SQL',
  'general-chat': '🤖 AI 助手',
};

let msgCounter = 0;

/**
 * Core AI chat composable. Must be instantiated once in App.vue.
 * Handles SSE streaming chat, error auto-analysis, and learning suggestions.
 */
export function useAiChat(ctx: {
  executionError: Ref<{ line: number; message: string } | null>;
  code: Ref<string>;
  db: DatabaseModel;
}) {
  const messages = ref<AiMessage[]>([]);
  const isLoading = ref(false);
  const showPanel = ref(false);
  const suggestions = ref<SuggestionItem[]>([]);
  const masteredTopicsRaw = useLocalStorage<string[]>('ai-mastered-topics', []);
  const masteredTopics = computed({
    get: () => new Set(masteredTopicsRaw.value),
    set: (v: Set<string>) => { masteredTopicsRaw.value = [...v]; },
  });
  const autoAnalysisEnabled = ref(true);
  const { streamCall, cancelStream } = useAiStreaming(API_BASE, isLoading);

  const currentSchema = computed(() => {
    return (ctx.db?.tables ?? []).map(t => ({
      table: t.name,
      columns: t.columns || [],
      columnTypes: t.columnTypes || {},
    }));
  });

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
          metadata: { type: 'error-analysis', context: { error: { line: err.line, message: err.message } } },
        });
      }
    },
    { debounce: 500 },
  );

  // ── Fetch learning suggestions on code change ─────────────────
  watchDebounced(
    () => ctx.code.value,
    (newCode) => {
      if (!newCode || !newCode.trim()) return;
      void fetchSuggestions(newCode);
    },
    { debounce: 2000 },
  );

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
      metadata: { type },
    };
    messages.value.push(msg);
    return messages.value[messages.value.length - 1];
  }

  async function sendMessage(text: string): Promise<void> {
    if (!text.trim()) return;
    if (isLoading.value) return;

    const userMsg: AiMessage = {
      id: `user-${++msgCounter}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      metadata: { type: 'general-chat' },
    };
    messages.value.push(userMsg);

    const aiMsg = addAssistantMessage('general-chat');
    isLoading.value = true;

    try {
      await streamCall('/chat', {
        mode: 'chat',
        message: text,
        history: messages.value.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        currentSql: ctx.code.value,
        schema: currentSchema.value,
      }, (chunk) => {
        let parsed: { type?: string; content?: string; prompt?: number; completion?: number; total?: number };
        try {
          parsed = JSON.parse(chunk);
        } catch {
          return;
        }
        switch (parsed.type) {
          case 'done':
            return;
          case 'usage':
            aiMsg.metadata = { ...aiMsg.metadata, usage: {
              promptTokens: parsed.prompt ?? 0,
              completionTokens: parsed.completion ?? 0,
              totalTokens: parsed.total ?? 0,
            }};
            break;
          case 'reasoning':
            aiMsg.isReasoning = true;
            aiMsg.reasoning = (aiMsg.reasoning || '') + (parsed.content || '');
            if (!aiMsg.firstTokenTime) aiMsg.firstTokenTime = Date.now();
            break;
          case 'error':
            aiMsg.content = parsed.content || '';
            break;
          default:
            aiMsg.isReasoning = false;
            aiMsg.content += parsed.content || '';
            if (!aiMsg.firstTokenTime && (parsed.content || '').trim()) aiMsg.firstTokenTime = Date.now();
        }
      });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '未知错误';
      aiMsg.content = `调用 AI 失败：${errMsg}`;
    } finally {
      aiMsg.isStreaming = false;
      aiMsg.isReasoning = false;
      aiMsg.endTime = Date.now();
      if (!aiMsg.content && aiMsg.reasoning) {
        aiMsg.content = aiMsg.reasoning;
      }
      isLoading.value = false;
    }
  }

  // ── Suggestions ───────────────────────────────────────────────
  async function fetchSuggestions(sql: string): Promise<void> {
    try {
      const resp = await fetch(`${API_BASE}/suggest-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentSql: sql,
          masteredTopics: [...masteredTopics.value],
        }),
      });
      if (!resp.ok) return;
      const json: { success: boolean; data?: { suggestions?: SuggestionItem[] } } = await resp.json();
      if (json.success && json.data?.suggestions) {
        suggestions.value = json.data.suggestions;
      }
    } catch {
      // Silently ignore - suggestions are non-critical
    }
  }

  function markMastered(topicId: string): void {
    const s = new Set(masteredTopics.value);
    s.add(topicId);
    masteredTopics.value = s;
  }

  // ── Panel control ─────────────────────────────────────────────
  function togglePanel(): void {
    showPanel.value = !showPanel.value;
  }

  function openPanel(): void {
    showPanel.value = true;
  }

  function clearMessages(): void {
    messages.value = [];
  }

  return {
    messages, isLoading, showPanel,
    suggestions, masteredTopics, autoAnalysisEnabled,
    sendMessage, cancelStream, clearMessages,
    togglePanel, openPanel,
    markMastered,
  };
}
