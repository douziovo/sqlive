import { tryOnScopeDispose, useDebounceFn } from '@vueuse/core'
import { computed, reactive, ref, watch } from 'vue'

import { DEFAULT_SQL } from '../assets/default-sql'
import { useBidirectionalSync } from '../composables/useBidirectionalSync'
import { useDatabaseLifecycle } from '../composables/useDatabaseLifecycle'
import { useHighlight } from '../composables/useHighlight'
import { useMultiTabs } from '../composables/useMultiTabs'
import { API_URL, DEBOUNCE_MS } from '../config'
import { http } from '../lib/http'
import type { ExecuteRequest, ExecuteResponse } from '../model/ApiTypes'
import type { CanonicalStatement, DatabaseModel, InsertResult, Row } from '../model/DatabaseTypes'

function hashString(s: string): number {
    let hash = 5381
    for (let i = 0; i < s.length; i++) {
        // oxlint-disable-next-line unicorn/prefer-math-trunc, unicorn/prefer-code-point -- Stable IDs require signed int32 overflow and UTF-16 code units.
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

// DEV=false in prod build → Rollup folds the dead branch, default-sql.ts gets tree-shaken.
const DEFAULT_CODE = import.meta.env.DEV ? DEFAULT_SQL : ''

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
    // D-03c: backend canonical statement boundaries — single source of truth for
    // useBidirectionalSync + useHighlight (Phase 2 CORE-01). Updated on execute success.
    const canonicalStatements = ref<CanonicalStatement[] | undefined>(undefined)

    // D-R2-002: centralize db mutations so adding a new DatabaseModel field only
    // requires updating DatabaseTypes + this single pair (previously 3 call sites:
    // init + clear + assign). The reactive literal init above stays — reactive()
    // requires an object literal and cannot be replaced by a function call.
    function setDb(data: NonNullable<ExecuteResponse['data']>) {
        db.tables = data.tables || []
        db.queryResults = data.queryResults || []
        db.indexes = data.indexes || []
        db.views = data.views || []
        db.triggers = data.triggers || []
        db.foreignKeys = data.foreignKeys || []
        db.metadata = data.metadata ?? null
    }

    function clearDb() {
        db.tables = []
        db.queryResults = []
        db.indexes = []
        db.views = []
        db.triggers = []
        db.foreignKeys = []
        db.metadata = null
        canonicalStatements.value = undefined
    }

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
        set: (val: string) => {
            updateCode(val)
        }
    })

    let previousDataState = new Map<string, string>()

    const { highlight, highlightedCodeChunk, flashCode, recalculateStaticHighlight } = useHighlight(
        code,
        () => db.tables,
        canonicalStatements
    )
    const {
        getLastValidCode,
        updateRow,
        deleteRow,
        insertRowUI,
        addNewTable,
        dropTableUI,
        lastTruncations
    } = useBidirectionalSync(
        code,
        () => db.tables,
        mode,
        flashCode,
        transition,
        canonicalStatements,
        (message) => {
            executionError.value = { message, line: 0 }
        }
    )

    const insertResult = ref<InsertResult | null>(null)
    let pendingInsertTable: string | null = null
    let applyingReconciliation = false

    // The synchronous source watcher must distinguish a visual edit from later typing.
    function reconcile<Args extends unknown[]>(operation: (...args: Args) => void) {
        return (...args: Args) => {
            applyingReconciliation = true
            try {
                operation(...args)
            } finally {
                applyingReconciliation = false
            }
        }
    }

    const trackedInsertRowUI = (tableName: string, newRowData: Row) => {
        pendingInsertTable = tableName
        insertRowUI(tableName, newRowData)
    }

    let abortController: AbortController | null = null
    let currentRequestId = 0

    function invalidateExecution() {
        currentRequestId++
        abortController?.abort()
        abortController = null
        isLoading.value = false
    }

    function failExecution(message: string, line: number) {
        executionError.value = { message, line }
        if (pendingInsertTable) {
            insertResult.value = { success: false, tableName: pendingInsertTable, error: message }
            pendingInsertTable = null
        }
        if (mode.value === 'reconciling') {
            mode.value = transition(mode.value, 'rollback', 'execution failed')
            code.value = getLastValidCode()
        }
    }

    const executeSqlRemote = async (forceReset = false) => {
        debouncedExecuteSql.cancel()
        abortController?.abort()
        abortController = new AbortController()

        // 捕获当前请求 ID，用于防止竞态条件
        const requestId = ++currentRequestId
        const tabId = activeTabId.value
        const source = code.value
        const dbName = activeTab.value.dbName || activeTab.value.id
        const isCurrent = () =>
            requestId === currentRequestId &&
            tabId === activeTabId.value &&
            source === code.value &&
            dbName === (activeTab.value.dbName || activeTab.value.id)

        // When code is empty, clear db state locally and skip the API call.
        // Sending empty SQL to the backend always fails validation (400), and the
        // old error path only set executionError without clearing db — leaving stale
        // data in the chart/visualizer.
        if (!code.value || code.value.trim() === '') {
            clearDb()
            executionError.value = null
            isLoading.value = false
            previousDataState = new Map()
            highlight.flashingRows = []
            return
        }

        isLoading.value = true
        executionError.value = null

        try {
            const response = await http.raw<ExecuteResponse>(API_URL, {
                method: 'POST',
                body: {
                    sql: source,
                    dbName,
                    reset: forceReset || shouldReset(source, activeTab.value.dbName)
                } satisfies ExecuteRequest,
                // SQL error envelopes carry the editor line even on HTTP 4xx/5xx.
                ignoreResponseError: true,
                signal: abortController.signal
            })
            if (!isCurrent()) return
            // Session metadata belongs to the same tab/source version as the payload.
            if (response.headers.get('X-Session-Recreated') === 'true') {
                sessionRecreated.value = true
            }
            const result = response._data
            if (!result || (!result.error && !result.data) || (!response.ok && !result.error)) {
                throw new Error(`SQL API error: ${response.status}`)
            }

            if (result.error) {
                failExecution(result.error.message || '未知错误', result.error.line || 1)
                return
            }

            if (!result.data) return
            const data = result.data
            const newTables = data.tables || []

            // Assign _highlightId to rows in physical tables
            const nextDataState = new Map<string, string>()
            const newFlashingRows: string[] = []
            newTables.forEach((table) => {
                table.data.forEach((row: Row, rowIdx: number) => {
                    if (row.id === undefined && !row._highlightId) {
                        row._highlightId = table.columns.reduce((hash: number, col: string) => {
                            const v = row[col]
                            const valueHash =
                                // oxlint-disable-next-line typescript/no-base-to-string -- SQL cell values retain their existing JavaScript string representation.
                                v === null || v === undefined ? 0 : hashString(String(v))
                            // oxlint-disable-next-line unicorn/prefer-math-trunc -- Preserve signed int32 overflow in stable row IDs.
                            return ((hash << 5) - hash + valueHash) | 0
                        }, rowIdx)
                    }
                    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- A present SQL NULL ID retains its previous identity.
                    const rowId = row.id === undefined ? row._highlightId : row.id
                    const key = `${table.name}:${rowId}`
                    const sig = JSON.stringify({ ...row, _highlightId: undefined })
                    nextDataState.set(key, sig)
                    if (mode.value !== 'reconciling' && previousDataState.get(key) !== sig) {
                        newFlashingRows.push(key)
                    }
                })
            })

            setDb(data)
            // D-03c: capture canonical statement boundaries from backend (single source of truth).
            // Forwarded to useBidirectionalSync.getStatements() + useHighlight.recalculateStaticHighlight()
            // so frontend slicing of code.value uses backend-provided offsets, not a second parser.
            canonicalStatements.value = data.canonicalStatements
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
            if (!isCurrent()) return

            console.error('执行 SQL 请求失败:', e instanceof Error ? e.message : e)
            failExecution('无法连接到后端服务', 0)
        } finally {
            // 仅在仍是当前请求时更新状态
            if (isCurrent()) {
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
    const debouncedExecuteSql = useDebounceFn(() => executeSqlRemote(), isE2E ? 50 : DEBOUNCE_MS)

    watch(
        [code, activeTabId, () => activeTab.value.dbName],
        ([, tabId, dbName], previous) => {
            invalidateExecution()
            canonicalStatements.value = undefined
            if (previous && (tabId !== previous[1] || dbName !== previous[2])) {
                clearDb()
                previousDataState = new Map()
                highlight.flashingRows = []
                executionError.value = null
                sessionRecreated.value = false
                insertResult.value = null
                pendingInsertTable = null
                lastTruncations.value = []
                mode.value = 'user'
            }
            if (mode.value === 'rollback') {
                mode.value = transition(mode.value, 'user', 'rollback applied')
                return
            }
            if (mode.value === 'reconciling' && !applyingReconciliation) {
                mode.value = transition(mode.value, 'user', 'manual source superseded visual edit')
                if (pendingInsertTable) {
                    insertResult.value = {
                        success: false,
                        tableName: pendingInsertTable,
                        error: 'SQL 已修改，插入请求已取消'
                    }
                    pendingInsertTable = null
                }
                lastTruncations.value = []
            }
            if (mode.value === 'reconciling') {
                void executeSqlRemote()
                return
            }
            void debouncedExecuteSql()
        },
        { immediate: true, flush: 'sync' }
    )

    tryOnScopeDispose(() => {
        debouncedExecuteSql.cancel()
        invalidateExecution()
    })

    return {
        db,
        code,
        highlight,
        highlightedCodeChunk,
        executionError,
        isLoading,
        sessionRecreated,
        updateRow: reconcile(updateRow),
        deleteRow: reconcile(deleteRow),
        addNewTable: reconcile(addNewTable),
        dropTableUI: reconcile(dropTableUI),
        insertRowUI: reconcile(trackedInsertRowUI),
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
