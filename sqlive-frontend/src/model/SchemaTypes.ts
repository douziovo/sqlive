export interface SchemaTableInfo {
  name: string
  type: 'table' | 'view'
  columns: string[]
}
