import { useDebounceFn } from '@vueuse/core'
import { computed, reactive, ref, watch } from 'vue'
import { DEFAULT_SQL } from '../assets/default-sql'
import { useBidirectionalSync } from '../composables/useBidirectionalSync'
import { useDatabaseLifecycle } from '../composables/useDatabaseLifecycle'
import { useHighlight } from '../composables/useHighlight'
import { useMultiTabs } from '../composables/useMultiTabs'
import { API_URL } from '../config'
import type { ExecuteRequest, ExecuteResponse } from '../model/ApiTypes'
import type { DatabaseModel, InsertResult, Row } from '../model/DatabaseTypes'

function hashString(s: string): number {
  let hash = 5381
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0
  }
  return hash
}

type EngineMode = 'user' | 'reconciling' | 'rollback'

const ALLOWED_TRANSITIONS: Record<EngineMode, EngineMode[]> = {
  user: ['user', 'reconciling'],
  reconciling: ['user', 'rollback'],
  rollback: ['user', 'reconciling']
}

function transition(from: EngineMode, to: EngineMode, context: string): EngineMode {
  if (import.meta.env.DEV && !ALLOWED_TRANSITIONS[from].includes(to)) {
    console.warn(`[Engine] Illegal transition: ${from} → ${to} (${context})`)
  }
  return to
}

const DEFAULT_CODE = DEFAULT_SQL

export function useSqlEngine() {
  const db = reactive<DatabaseModel>({
    tables: [],
    queryResults: [],
    indexes: [],
    views: [],
    triggers: [],
    foreignKeys: [],
    metadata: null
  })
  const isLoading = ref(false)
  const executionError = ref<{ line: number; message: string } | null>(null)
  const mode = ref<EngineMode>('user')
  const sessionRecreated = ref(false)

  // Multi-tab system
  const {
    tabs,
    activeTabId,
    activeTab,
    switchTab,
    addTab,
    closeTab,
    setTabDbName,
    updateCode,
    markClean,
    importFile,
    exportTab,
    exportAllTabs
  } = useMultiTabs(DEFAULT_CODE)

  // code is derived from active tab — writable computed
  const code = computed({
    get: () => activeTab.value.code,
    set: (val: string) => updateCode(val)
  })

  let previousDataState = new Map<string, string>()

  const { highlight, highlightedCodeChunk, flashCode, recalculateStaticHighlight } = useHighlight(code, db)
  const { getLastValidCode, updateRow, deleteRow, insertRowUI, addNewTable, dropTableUI, lastTruncations } = useBidirectionalSync(
    code,
    db,
    mode,
    flashCode,
    transition
  )

  const insertResult = ref<InsertResult | null>(null)
  let pendingInsertTable: string | null = null

  const trackedInsertRowUI = (tableName: string, newRowData: Row) => {
    pendingInsertTable = tableName
    insertRowUI(tableName, newRowData)
  }

  let abortController: AbortController | null = null
  let currentRequestId = 0

  const executeSqlRemote = async (forceReset = false) => {
    if (mode.value === 'rollback') {
      mode.value = transition(mode.value, 'user', 'execute rollback skip')
      return
    }

    abortController?.abort()
    abortController = new AbortController()

    // 捕获当前请求 ID，用于防止竞态条件
    const requestId = ++currentRequestId

    // When code is empty, clear db state locally and skip the API call.
    // Sending empty SQL to the backend always fails validation (400), and the
    // old error path only set executionError without clearing db — leaving stale
    // data in the chart/visualizer.
    if (!code.value || code.value.trim() === '') {
      db.tables = []
      db.queryResults = []
      db.indexes = []
      db.views = []
      db.triggers = []
      db.foreignKeys = []
      db.metadata = null
      executionError.value = null
      isLoading.value = false
      previousDataState = new Map()
      highlight.flashingRows = []
      return
    }

    isLoading.value = true
    executionError.value = null

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: code.value,
          dbName: activeTab.value.dbName || '',
          reset: forceReset || shouldReset(code.value, activeTab.value.dbName)
        } satisfies ExecuteRequest),
        signal: abortController.signal
      })
      // D-07: Detect session recreation signaled by backend
      if (response.headers.get('X-Session-Recreated') === 'true') {
        sessionRecreated.value = true
      }
      const result: ExecuteResponse = await response.json()

      // 检查是否仍是当前请求
      if (requestId !== currentRequestId) return

      if (!result.success) {
        const errMsg = result.error?.message || '未知错误'
        executionError.value = { line: result.error?.line || 1, message: errMsg }

        if (pendingInsertTable) {
          insertResult.value = { success: false, tableName: pendingInsertTable, error: errMsg }
          pendingInsertTable = null
        }

        if (mode.value === 'reconciling') {
          mode.value = transition(mode.value, 'rollback', 'reconcile error')
          code.value = getLastValidCode()
        }
        return
      }

      if (!result.data) return
      const data = result.data
      const newTables = data.tables || []
      const newQueryResults = data.queryResults || []

      // Assign _highlightId to rows in physical tables
      const nextDataState = new Map<string, string>()
      const newFlashingRows: string[] = []
      newTables.forEach((table) => {
        table.data.forEach((row: Row, rowIdx: number) => {
          if (row.id === undefined && !row._highlightId) {
            row._highlightId = table.columns.reduce((hash: number, col: string) => {
              const v = row[col]
              return ((hash << 5) - hash + (v === null || v === undefined ? 0 : hashString(String(v)))) | 0
            }, rowIdx)
          }
          const key = `${table.name}:${row.id !== undefined ? row.id : row._highlightId}`
          const sig = JSON.stringify({ ...row, _highlightId: undefined })
          nextDataState.set(key, sig)
          if (mode.value !== 'reconciling' && previousDataState.get(key) !== sig) {
            newFlashingRows.push(key)
          }
        })
      })

      db.tables = newTables
      db.queryResults = newQueryResults
      db.indexes = data.indexes || []
      db.views = data.views || []
      db.triggers = data.triggers || []
      db.foreignKeys = data.foreignKeys || []
      db.metadata = data.metadata || null
      highlight.flashingRows = newFlashingRows
      previousDataState = nextDataState

      if (mode.value !== 'reconciling') {
        recalculateStaticHighlight()
      }
      mode.value = transition(mode.value, 'user', 'execute success')

      if (pendingInsertTable) {
        insertResult.value = { success: true, tableName: pendingInsertTable }
        pendingInsertTable = null
      }

      markClean()
    } catch (e) {
      // 检查是否仍是当前请求
      if (requestId !== currentRequestId) return

      console.error('执行 SQL 请求失败:', e instanceof Error ? e.message : e)
      executionError.value = { line: 0, message: '无法连接到后端服务' }
    } finally {
      // 仅在仍是当前请求时更新状态
      if (requestId === currentRequestId) {
        isLoading.value = false
        if (mode.value === 'reconciling') {
          mode.value = transition(mode.value, 'user', 'execute catch')
        }
      }
    }
  }

  const { shouldReset, submitNow, deleteDb, dbList } = useDatabaseLifecycle(
    activeTab,
    tabs,
    setTabDbName,
    mode,
    executeSqlRemote,
    transition
  )

  const isE2E = typeof window !== 'undefined' && window.location.search.includes('e2e=1')
  const debouncedExecuteSql = useDebounceFn(() => executeSqlRemote(), isE2E ? 50 : 100)

  watch(
    code,
    () => {
      if (mode.value === 'rollback') return
      if (mode.value === 'reconciling') {
        void executeSqlRemote()
        return
      }
      debouncedExecuteSql()
    },
    { immediate: true }
  )

  return {
    db,
    code,
    highlight,
    highlightedCodeChunk,
    executionError,
    isLoading,
    sessionRecreated,
    updateRow,
    deleteRow,
    addNewTable,
    dropTableUI,
    insertRowUI: trackedInsertRowUI,
    lastTruncations,
    insertResult,
    tabs,
    activeTabId,
    switchTab,
    addTab,
    closeTab,
    setTabDbName,
    dbList,
    submitNow,
    deleteDb,
    importFile,
    exportTab,
    exportAllTabs,
    markClean
  }
}
