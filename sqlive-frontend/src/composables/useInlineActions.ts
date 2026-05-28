import { computed, type Ref, ref } from 'vue'
import { API_BASE } from '../config'
import type { AiSchemaInfo } from '../model/ApiTypes'
import type { DatabaseModel } from '../model/DatabaseTypes'
import {
  formatErrorAnalysis,
  formatExplain,
  formatFixCode,
  formatGenerateSql,
  formatOptimize
} from '../utils/aiFormatter'
import type { AiMessage, AiPanelMode } from './useAiChat'

let msgCounter = 0

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface DisplayHandler {
  onLoading: (mode: AiPanelMode) => void
  onResult: (content: string, actions: { label: string; action: string }[]) => void
  onError: (message: string) => void
}

export function useInlineActions(state: {
  isLoading: Ref<boolean>
  messages: Ref<AiMessage[]>
  code: Ref<string>
  db: DatabaseModel
  error: Ref<{ line: number; message: string } | null>
}) {
  const currentSchema = computed<AiSchemaInfo[]>(() =>
    (state.db?.tables ?? []).map((t) => ({
      table: t.name,
      columns: t.columns || [],
      columnTypes: t.columnTypes || {}
    }))
  )

  async function apiCall<T>(endpoint: string, body: unknown): Promise<T> {
    const resp = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!resp.ok) throw new Error(`API error: ${resp.status}`)
    return resp.json()
  }

  async function analyzeError(error: { line: number; message: string }, display: DisplayHandler): Promise<void> {
    state.isLoading.value = true
    display.onLoading('error-analysis')

    try {
      const resp = await apiCall<{
        success: boolean
        data?: {
          content?: string
          summary?: string
          fixedCode?: string
          tips?: string[]
          relatedTopics?: { id: string; label: string; difficulty: number }[]
        }
        error?: string
      }>('/analyze-error', {
        error: { message: error.message, line: error.line },
        currentSql: state.code.value,
        schema: currentSchema.value
      })

      if (resp.success && resp.data) {
        const content = formatErrorAnalysis(resp.data)
        const actions = [
          ...(resp.data.fixedCode ? [{ label: '✏️ 应用修复', action: 'apply-fix' }] : []),
          { label: '💬 追问', action: 'follow-up' }
        ]
        display.onResult(content, actions)

        state.messages.value.push({
          id: `ai-err-${++msgCounter}`,
          role: 'assistant',
          content: `## SQL 错误分析\n\n${resp.data.summary ?? resp.data.content}`,
          timestamp: Date.now(),
          metadata: { type: 'error-analysis', context: { sql: state.code.value, error } }
        })
      } else {
        display.onError(`AI 分析失败：${resp.error || '未知错误'}`)
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '未知错误'
      display.onError(`调用 AI 失败：${errMsg}`)
    } finally {
      state.isLoading.value = false
    }
  }

  async function fixCode(display: DisplayHandler): Promise<string | null> {
    let result: string | null = null
    const error = state.error.value
    state.isLoading.value = true
    display.onLoading('fix-code')

    try {
      const resp = await apiCall<{
        success: boolean
        data?: { content?: string; fixedCode?: string; summary?: string; explanation?: string }
        error?: string
      }>('/fix-code', {
        error: error ? { message: error.message, line: error.line } : undefined,
        currentSql: state.code.value,
        schema: currentSchema.value
      })

      if (resp.success && resp.data) {
        const content = formatFixCode(resp.data, { originalCode: state.code.value })
        const actions = [
          { label: '✅ 确认应用', action: 'apply-fix' },
          { label: '📋 复制', action: 'copy' }
        ]
        display.onResult(content, actions)
        result = resp.data.fixedCode ?? null
      } else {
        display.onError(`AI 修复失败：${resp.error || '未知错误'}`)
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '未知错误'
      display.onError(`调用 AI 失败：${errMsg}`)
    } finally {
      state.isLoading.value = false
    }
    return result
  }

  async function explain(selectedCode: string, display: DisplayHandler): Promise<void> {
    state.isLoading.value = true
    display.onLoading('explain')

    try {
      const resp = await apiCall<{
        success: boolean
        data?: {
          content?: string
          summary?: string
          stepByStep?: { step: number; what: string; why: string }[]
          tips?: string[]
        }
        error?: string
      }>('/explain', { selectedCode, schema: currentSchema.value })

      if (resp.success && resp.data) {
        const content = formatExplain(resp.data)
        const actions = [{ label: '💬 追问', action: 'follow-up' }]
        display.onResult(content, actions)

        state.messages.value.push({
          id: `ai-exp-${++msgCounter}`,
          role: 'assistant',
          content: resp.data.summary || content,
          timestamp: Date.now(),
          metadata: { type: 'explain', context: { sql: selectedCode } }
        })
      } else {
        display.onError(`解释失败：${resp.error || '未知错误'}`)
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '未知错误'
      display.onError(`调用 AI 失败：${errMsg}`)
    } finally {
      state.isLoading.value = false
    }
  }

  async function optimize(selectedCode: string, display: DisplayHandler): Promise<string | null> {
    let result: string | null = null
    state.isLoading.value = true
    display.onLoading('optimize')

    try {
      const resp = await apiCall<{
        success: boolean
        data?: { content?: string; summary?: string; optimizedCode?: string; explanation?: string; fixedCode?: string }
        error?: string
      }>('/optimize', { selectedCode, schema: currentSchema.value })

      if (resp.success && resp.data) {
        const optimizedCode = resp.data.optimizedCode || resp.data.fixedCode || ''
        const content = formatOptimize(resp.data, { selectedCode })
        const actions = [
          ...(optimizedCode ? [{ label: '✏️ 替换', action: 'apply-fix' }] : []),
          { label: '💬 追问', action: 'follow-up' }
        ]
        display.onResult(content, actions)
        result = optimizedCode || null
      } else {
        display.onError(`优化失败：${resp.error || '未知错误'}`)
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '未知错误'
      display.onError(`调用 AI 失败：${errMsg}`)
    } finally {
      state.isLoading.value = false
    }
    return result
  }

  async function generateSql(description: string, display: DisplayHandler): Promise<string | null> {
    let result: string | null = null
    state.isLoading.value = true
    display.onLoading('generate-sql')

    try {
      const resp = await apiCall<{
        success: boolean
        data?: { content?: string; fixedCode?: string; summary?: string }
        error?: string
      }>('/chat', {
        mode: 'chat',
        message: `请根据以下需求生成 SQLite SQL 代码：\n${description}\n\n当前数据库表：${currentSchema.value.map((t) => `${t.table}(${t.columns.join(', ')})`).join(', ')}`,
        currentSql: state.code.value,
        schema: currentSchema.value,
        stream: false
      })

      if (resp.success && resp.data) {
        const generatedCode =
          resp.data.content?.match(/```sql\n([\s\S]*?)\n```/)?.[1] ||
          resp.data.fixedCode ||
          resp.data.content ||
          undefined
        if (generatedCode) {
          const finalCode = generatedCode.trim()
          const content = formatGenerateSql(finalCode)
          const actions = [
            { label: '✏️ 插入编辑器', action: 'apply-fix' },
            { label: '📋 复制', action: 'copy' },
            { label: '🔄 重新生成', action: 'retry' }
          ]
          display.onResult(content, actions)
          result = finalCode
        } else {
          display.onError('无法生成 SQL，请重试。')
        }
      } else {
        display.onError(`无法生成 SQL：${resp.error || '未知错误'}`)
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : '未知错误'
      display.onError(`调用 AI 失败：${errMsg}`)
    } finally {
      state.isLoading.value = false
    }
    return result
  }

  return { analyzeError, fixCode, explain, optimize, generateSql }
}
