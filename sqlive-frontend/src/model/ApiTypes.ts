import type { CanonicalStatement, ExecutionMetadata, ForeignKeyInfo, IndexInfo, TableSchema, TriggerInfo, ViewInfo } from './DatabaseTypes'

// ── Execute (SQL) ──────────────────────────────────────────

export interface ExecuteRequest {
  sql: string
  dbName?: string
  reset?: boolean
}

export interface ExecuteResponse {
  success: boolean
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
