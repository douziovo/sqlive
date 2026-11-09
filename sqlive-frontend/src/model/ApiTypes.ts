import type {
    CanonicalStatement,
    ExecutionMetadata,
    ForeignKeyInfo,
    IndexInfo,
    TableSchema,
    TriggerInfo,
    ViewInfo
} from './DatabaseTypes'

// ── Execute (SQL) ──────────────────────────────────────────

export interface ExecuteRequest {
    sql: string
    dbName?: string
    reset?: boolean
}

// Backend SqlResponse: success is implied — `error` is non-null iff execution failed.
export interface ExecuteResponse {
    data?: ExecuteDataPayload
    error?: ExecuteErrorPayload
}

export interface ExecuteDataPayload {
    tables: TableSchema[]
    queryResults: TableSchema[]
    indexes: IndexInfo[]
    views: ViewInfo[]
    triggers: TriggerInfo[]
    foreignKeys: ForeignKeyInfo[]
    canonicalStatements?: CanonicalStatement[]
    metadata: ExecutionMetadata | null
}

export interface ExecuteErrorPayload {
    message: string
    line: number
}

// ── AI Chat (schema sent to AI API) ────────────────────────────

/** Matches backend AiChatRequest.SchemaInfo contract */
export interface AiSchemaInfo {
    table: string
    columns: string[]
    columnTypes: Record<string, string>
}

export interface AiResponse<T> {
    success: boolean
    data?: T
    error?: { message: string; line?: number } | string
}
