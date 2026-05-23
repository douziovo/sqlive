import { ref, computed, provide } from 'vue';
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
  /** Time when first content token arrived (ms since epoch) */
  firstTokenTime?: number;
  /** Time when streaming completed (ms since epoch) */
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
 * Receives the sqlEngine return so it can watch execution errors.
 */
export function useAiChat(sqlEngine: {
  executionError: { value: { line: number; message: string } | null };
  code: { value: string };
  db: DatabaseModel;
}) {

  const messages = ref<AiMessage[]>([]);
  const isLoading = ref(false);
  const showPanel = ref(false);
  const showInlineResult = ref(false);
  const inlineContent = ref('');
  const inlineMode = ref<AiPanelMode>('chat');
  const inlineActions = ref<{ label: string; action: string }[]>([]);
  const suggestions = ref<SuggestionItem[]>([]);
  const masteredTopicsRaw = useLocalStorage<string[]>('ai-mastered-topics', []);
  const masteredTopics = computed({
    get: () => new Set(masteredTopicsRaw.value),
    set: (v: Set<string>) => { masteredTopicsRaw.value = [...v]; },
  });
  const autoAnalysisEnabled = ref(true);
  const { streamCall, cancelStream } = useAiStreaming(API_BASE, isLoading);

  const currentSchema = computed(() => {
    return (sqlEngine.db?.tables ?? []).map(t => ({
      table: t.name,
      columns: t.columns || [],
      columnTypes: t.columnTypes || {},
    }));
  });

  // ── Auto-analyze errors ──────────────────────────────────────
  watchDebounced(
    () => sqlEngine.executionError.value,
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
    () => sqlEngine.code.value,
    (newCode) => {
      if (!newCode || !newCode.trim()) return;
      void fetchSuggestions(newCode);
    },
    { debounce: 2000 },
  );

  // ── Core API call ────────────────────────────────────────────
  async function apiCall<T>(endpoint: string, body: unknown): Promise<T> {
    const resp = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return resp.json();
  }

// ── Streaming SSE ─────────────────────────────────────────────

  // ── actions ───────────────────────────────────────────────────

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
        currentSql: sqlEngine.code.value,
        schema: currentSchema.value,
      }, (chunk) => {
        let parsed: { type?: string; content?: string; prompt?: number; completion?: number; total?: number };
        try {
          parsed = JSON.parse(chunk);
        } catch {
          return; // skip unparseable chunks
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
      // Reasoning models (e.g. deepseek-v4-flash) may output only reasoning_content
      if (!aiMsg.content && aiMsg.reasoning) {
        aiMsg.content = aiMsg.reasoning;
      }
      isLoading.value = false;
    }
  }

  interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
  }

  async function withInlineAction<T>(
    mode: AiPanelMode,
    loadingText: string,
    errorPrefix: string,
    call: () => Promise<ApiResponse<T>>,
    onData: (data: T) => void,
  ): Promise<void> {
    isLoading.value = true;
    showInlineResult.value = true;
    inlineMode.value = mode;
    inlineContent.value = loadingText;

    try {
      const resp = await call();
      if (resp.success && resp.data) {
        onData(resp.data);
      } else {
        inlineContent.value = `${errorPrefix}：${resp.error || '未知错误'}`;
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '未知错误';
      inlineContent.value = `调用 AI 失败：${errMsg}`;
    } finally {
      isLoading.value = false;
    }
  }

  async function analyzeError(error: { line: number; message: string }): Promise<void> {
    await withInlineAction('error-analysis', 'AI 正在分析...', 'AI 分析失败', () =>
      apiCall<{
        success: boolean;
        data?: { content?: string; summary?: string; fixedCode?: string; tips?: string[]; relatedTopics?: { id: string; label: string; difficulty: number }[] };
        error?: string;
      }>('/analyze-error', {
        error: { message: error.message, line: error.line },
        currentSql: sqlEngine.code.value,
        schema: currentSchema.value,
      }),
    (d) => {
      let content = '';
      if (d.summary) content += `## 🔍 错误原因\n${d.summary}\n\n`;
      if (d.content) content += `## 📝 详细分析\n${d.content}\n\n`;
      if (d.fixedCode) content += `## ✅ 修复方案\n\`\`\`sql\n${d.fixedCode}\n\`\`\`\n\n`;
      if (d.tips?.length) content += `## 🛡️ 如何避免\n${d.tips.map((t: string) => '- ' + t).join('\n')}\n`;
      inlineContent.value = content;
      inlineActions.value = [
        ...(d.fixedCode ? [{ label: '✏️ 应用修复', action: 'apply-fix' }] : []),
        { label: '💬 追问', action: 'follow-up' },
      ];
      messages.value.push({
        id: `ai-err-${++msgCounter}`,
        role: 'assistant',
        content: `## SQL 错误分析\n\n${d.summary ?? d.content}`,
        timestamp: Date.now(),
        metadata: { type: 'error-analysis', context: { sql: sqlEngine.code.value, error } },
      });
    });
  }

  async function fixCode(): Promise<string | null> {
    let result: string | null = null;
    const error = sqlEngine.executionError.value;
    await withInlineAction('fix-code', 'AI 正在生成修复代码...', 'AI 修复失败', () =>
      apiCall<{
        success: boolean;
        data?: { content?: string; fixedCode?: string; summary?: string; explanation?: string };
        error?: string;
      }>('/fix-code', {
        error: error ? { message: error.message, line: error.line } : undefined,
        currentSql: sqlEngine.code.value,
        schema: currentSchema.value,
      }),
    (d) => {
      let content = `## 🔧 修复方案\n\n`;
      if (d.summary) content += `${d.summary}\n\n`;
      content += '### 原始代码\n```sql\n' + sqlEngine.code.value + '\n```\n\n';
      content += '### 修复后\n```sql\n' + d.fixedCode + '\n```\n';
      if (d.explanation) content += `\n${d.explanation}`;
      inlineContent.value = content;
      inlineActions.value = [
        { label: '✅ 确认应用', action: 'apply-fix' },
        { label: '📋 复制', action: 'copy' },
      ];
      result = d.fixedCode ?? null;
    });
    return result;
  }

  async function explain(selectedCode: string): Promise<void> {
    await withInlineAction('explain', 'AI 正在解释...', '解释失败', () =>
      apiCall<{
        success: boolean;
        data?: { content?: string; summary?: string; stepByStep?: { step: number; what: string; why: string }[]; tips?: string[] };
        error?: string;
      }>('/explain', { selectedCode, schema: currentSchema.value }),
    (d) => {
      let content = '';
      if (d.summary) content += `**概述**\n${d.summary}\n\n`;
      if (d.stepByStep?.length) {
        content += '**逐句拆解**\n\n';
        d.stepByStep.forEach((s) => { content += `**${s.step}. ${s.what}**\n${s.why}\n\n`; });
      }
      if (d.tips?.length) {
        content += '**💡 使用提示**\n';
        d.tips.forEach((t: string) => { content += `- ${t}\n`; });
      }
      if (d.content) content += '\n' + d.content;
      inlineContent.value = content;
      inlineActions.value = [{ label: '💬 追问', action: 'follow-up' }];
      messages.value.push({
        id: `ai-exp-${++msgCounter}`,
        role: 'assistant',
        content: d.summary || content,
        timestamp: Date.now(),
        metadata: { type: 'explain', context: { sql: selectedCode } },
      });
    });
  }

  async function optimize(selectedCode: string): Promise<void> {
    await withInlineAction('optimize', 'AI 正在优化...', '优化失败', () =>
      apiCall<{
        success: boolean;
        data?: { content?: string; summary?: string; optimizedCode?: string; explanation?: string; fixedCode?: string };
        error?: string;
      }>('/optimize', { selectedCode, schema: currentSchema.value }),
    (d) => {
      const optimizedCode = d.optimizedCode || d.fixedCode || '';
      let content = '';
      if (d.summary) content += `## ⚡ 优化建议\n${d.summary}\n\n`;
      if (optimizedCode) {
        content += '### 原始代码\n```sql\n' + selectedCode + '\n```\n\n';
        content += '### 优化后\n```sql\n' + optimizedCode + '\n```\n';
      }
      if (d.explanation) content += `\n${d.explanation}`;
      if (d.content) content += '\n' + d.content;
      inlineContent.value = content;
      inlineActions.value = [
        ...(optimizedCode ? [{ label: '✏️ 替换', action: 'apply-fix' }] : []),
        { label: '💬 追问', action: 'follow-up' },
      ];
    });
  }

  async function generateSql(description: string): Promise<string | null> {
    let result: string | null = null;
    await withInlineAction('generate-sql', 'AI 正在生成 SQL...', '无法生成 SQL', () =>
      apiCall<{
        success: boolean;
        data?: { content?: string; fixedCode?: string; summary?: string };
        error?: string;
      }>('/chat', {
        mode: 'chat',
        message: `请根据以下需求生成 SQLite SQL 代码：\n${description}\n\n当前数据库表：${currentSchema.value.map(t => `${t.table}(${t.columns.join(', ')})`).join(', ')}`,
        currentSql: sqlEngine.code.value,
        schema: currentSchema.value,
        stream: false,
      }),
    (d) => {
      const generatedCode = d.content?.match(/```sql\n([\s\S]*?)\n```/)?.[1]
        || d.fixedCode
        || d.content
        || undefined;
      if (generatedCode) {
        const finalCode = generatedCode.trim();
        inlineContent.value = `## ✨ 生成的 SQL\n\n\`\`\`sql\n${finalCode}\n\`\`\``;
        inlineActions.value = [
          { label: '✏️ 插入编辑器', action: 'insert-code' },
          { label: '📋 复制', action: 'copy' },
          { label: '🔄 重新生成', action: 'retry' },
        ];
        result = finalCode;
      } else {
        inlineContent.value = '无法生成 SQL，请重试。';
      }
    });
    return result;
  }

  // ── Suggestions ───────────────────────────────────────────────
  async function fetchSuggestions(sql: string): Promise<void> {
    try {
      const resp = await apiCall<{
        success: boolean;
        data?: { suggestions?: SuggestionItem[] };
      }>('/suggest-next', {
        currentSql: sql,
        masteredTopics: [...masteredTopics.value],
      });
      if (resp.success && resp.data?.suggestions) {
        suggestions.value = resp.data.suggestions;
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

  function closeInline(): void {
    showInlineResult.value = false;
    inlineContent.value = '';
    inlineActions.value = [];
  }

  function clearMessages(): void {
    messages.value = [];
  }

  // Provide AI actions for child components (CodeEditor, etc.)
  provide('aiActions', {
    isLoading,
    inlineVisible: showInlineResult,
    inlineContent,
    inlineMode,
    inlineActions,
    onAnalyzeError: analyzeError,
    onFixCode: fixCode,
    onExplain: explain,
    onOptimize: optimize,
    onOpenChat: (context?: string) => { openPanel(); if (context) void sendMessage(context); },
    onGenerateSql: generateSql,
    onTogglePanel: togglePanel,
    onInlineClose: closeInline,
    onInlineAction: (_action: string) => { /* handled by AiInlineResult component */ },
  });

  return {
    messages, isLoading, showPanel, showInlineResult,
    inlineContent, inlineMode, inlineActions,
    suggestions, masteredTopics, autoAnalysisEnabled,
    sendMessage, analyzeError, fixCode, explain, optimize, generateSql,
    markMastered,
    togglePanel, openPanel, closeInline, clearMessages, cancelStream,
  };
}

