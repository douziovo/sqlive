import { ref, computed, type Ref } from 'vue';
import type { DatabaseModel } from '../model/DatabaseTypes';
import type { AiSchemaInfo } from '../model/ApiTypes';
import type { AiMessage, AiPanelMode } from './useAiChat';
import {
  formatErrorAnalysis,
  formatFixCode,
  formatExplain,
  formatOptimize,
  formatGenerateSql,
} from './aiFormatter';
import { API_BASE } from '../config';

let msgCounter = 0;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function useInlineActions(state: {
  isLoading: Ref<boolean>;
  messages: Ref<AiMessage[]>;
  code: Ref<string>;
  db: DatabaseModel;
  error: Ref<{ line: number; message: string } | null>;
}) {
  const showInlineResult = ref(false);
  const inlineContent = ref('');
  const inlineMode = ref<AiPanelMode>('chat');
  const inlineActions = ref<{ label: string; action: string }[]>([]);

  const currentSchema = computed<AiSchemaInfo[]>(() =>
    (state.db?.tables ?? []).map(t => ({
      table: t.name,
      columns: t.columns || [],
      columnTypes: t.columnTypes || {},
    })),
  );

  async function apiCall<T>(endpoint: string, body: unknown): Promise<T> {
    const resp = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return resp.json();
  }

  async function withInlineAction<T>(
    mode: AiPanelMode,
    loadingText: string,
    errorPrefix: string,
    call: () => Promise<ApiResponse<T>>,
    onData: (data: T) => void,
  ): Promise<void> {
    state.isLoading.value = true;
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
      state.isLoading.value = false;
    }
  }

  async function analyzeError(error: { line: number; message: string }): Promise<void> {
    await withInlineAction('error-analysis', 'AI 正在分析...', 'AI 分析失败',
      () =>
        apiCall<{
          success: boolean;
          data?: { content?: string; summary?: string; fixedCode?: string; tips?: string[]; relatedTopics?: { id: string; label: string; difficulty: number }[] };
          error?: string;
        }>('/analyze-error', {
          error: { message: error.message, line: error.line },
          currentSql: state.code.value,
          schema: currentSchema.value,
        }),
      (d) => {
        inlineContent.value = formatErrorAnalysis(d);
        inlineActions.value = [
          ...(d.fixedCode ? [{ label: '✏️ 应用修复', action: 'apply-fix' }] : []),
          { label: '💬 追问', action: 'follow-up' },
        ];
        state.messages.value.push({
          id: `ai-err-${++msgCounter}`,
          role: 'assistant',
          content: `## SQL 错误分析\n\n${d.summary ?? d.content}`,
          timestamp: Date.now(),
          metadata: { type: 'error-analysis', context: { sql: state.code.value, error } },
        });
      },
    );
  }

  async function fixCode(): Promise<string | null> {
    let result: string | null = null;
    const error = state.error.value;
    await withInlineAction('fix-code', 'AI 正在生成修复代码...', 'AI 修复失败',
      () =>
        apiCall<{
          success: boolean;
          data?: { content?: string; fixedCode?: string; summary?: string; explanation?: string };
          error?: string;
        }>('/fix-code', {
          error: error ? { message: error.message, line: error.line } : undefined,
          currentSql: state.code.value,
          schema: currentSchema.value,
        }),
      (d) => {
        inlineContent.value = formatFixCode(d, { originalCode: state.code.value });
        inlineActions.value = [
          { label: '✅ 确认应用', action: 'apply-fix' },
          { label: '📋 复制', action: 'copy' },
        ];
        result = d.fixedCode ?? null;
      },
    );
    return result;
  }

  async function explain(selectedCode: string): Promise<void> {
    await withInlineAction('explain', 'AI 正在解释...', '解释失败',
      () =>
        apiCall<{
          success: boolean;
          data?: { content?: string; summary?: string; stepByStep?: { step: number; what: string; why: string }[]; tips?: string[] };
          error?: string;
        }>('/explain', { selectedCode, schema: currentSchema.value }),
      (d) => {
        inlineContent.value = formatExplain(d);
        inlineActions.value = [{ label: '💬 追问', action: 'follow-up' }];
        state.messages.value.push({
          id: `ai-exp-${++msgCounter}`,
          role: 'assistant',
          content: d.summary || inlineContent.value,
          timestamp: Date.now(),
          metadata: { type: 'explain', context: { sql: selectedCode } },
        });
      },
    );
  }

  async function optimize(selectedCode: string): Promise<void> {
    await withInlineAction('optimize', 'AI 正在优化...', '优化失败',
      () =>
        apiCall<{
          success: boolean;
          data?: { content?: string; summary?: string; optimizedCode?: string; explanation?: string; fixedCode?: string };
          error?: string;
        }>('/optimize', { selectedCode, schema: currentSchema.value }),
      (d) => {
        const optimizedCode = d.optimizedCode || d.fixedCode || '';
        inlineContent.value = formatOptimize(d, { selectedCode });
        inlineActions.value = [
          ...(optimizedCode ? [{ label: '✏️ 替换', action: 'apply-fix' }] : []),
          { label: '💬 追问', action: 'follow-up' },
        ];
      },
    );
  }

  async function generateSql(description: string): Promise<string | null> {
    let result: string | null = null;
    await withInlineAction('generate-sql', 'AI 正在生成 SQL...', '无法生成 SQL',
      () =>
        apiCall<{
          success: boolean;
          data?: { content?: string; fixedCode?: string; summary?: string };
          error?: string;
        }>('/chat', {
          mode: 'chat',
          message: `请根据以下需求生成 SQLite SQL 代码：\n${description}\n\n当前数据库表：${currentSchema.value.map(t => `${t.table}(${t.columns.join(', ')})`).join(', ')}`,
          currentSql: state.code.value,
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
          inlineContent.value = formatGenerateSql(finalCode);
          inlineActions.value = [
            { label: '✏️ 插入编辑器', action: 'insert-code' },
            { label: '📋 复制', action: 'copy' },
            { label: '🔄 重新生成', action: 'retry' },
          ];
          result = finalCode;
        } else {
          inlineContent.value = '无法生成 SQL，请重试。';
        }
      },
    );
    return result;
  }

  function closeInline(): void {
    showInlineResult.value = false;
    inlineContent.value = '';
    inlineActions.value = [];
  }

  return {
    showInlineResult, inlineContent, inlineMode, inlineActions,
    analyzeError, fixCode, explain, optimize, generateSql,
    closeInline,
  };
}
