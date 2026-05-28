export interface Row {
  id?: number
  _highlightId?: number
  _rawSql?: string
  [key: string]: any
}

export interface TableSchema {
  name: string
  columns: string[]
  columnTypes: Record<string, string>
  data: Row[]
}

export interface IndexInfo {
  name: string
  tableName: string
  unique: boolean
  columns: string[]
  sql: string
}

export interface ViewInfo {
  name: string
  sql: string
}

export interface TriggerInfo {
  name: string
  tableName: string
  sql: string
}

export interface ExecutionMetadata {
  durationMs: number
  statementCount: number
}

export interface ForeignKeyInfo {
  name: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
}

export interface DatabaseModel {
  tables: TableSchema[]
  queryResults: TableSchema[]
  indexes: IndexInfo[]
  views: ViewInfo[]
  triggers: TriggerInfo[]
  foreignKeys: ForeignKeyInfo[]
  metadata: ExecutionMetadata | null
}

export interface HighlightState {
  activeTables: string[]
  activeColumns: string[]
  activeRows: string[]
  flashingRows: string[]
  actionType: 'insert' | 'select' | 'ddl' | 'none'
  refreshSeed: number
}

export interface ColumnMeta {
  name: string
  type: string
  isPrimaryKey: boolean
  isForeignKey: boolean
  isUnique: boolean
  referencedTable?: string
  referencedColumn?: string
}

export interface ErTableNodeData {
  tableName: string
  columns: ColumnMeta[]
  isFiltered: boolean
  isMatchHighlight?: boolean
  isActiveMatch?: boolean
  table: TableSchema
}

// 事件类型定义
export interface CellUpdateEvent {
  tableName: string
  oldRow: Row
  newRow: Row
}

export interface RowDeleteEvent {
  tableName?: string
  row: Row
}

export interface RowInsertEvent {
  tableName: string
  newRow: Row
}

export interface CreateTableEvent {
  name: string
  columns: string[]
  data: Record<string, unknown>[]
}
