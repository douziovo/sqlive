import type { Row } from '../model/DatabaseTypes'
import { isNumericType } from '../utils/sql'
import { enforceTypeConstraints } from '../utils/sqlStatements'

export function useInlineEdit(
  tableName: string,
  columnTypes: Record<string, string>,
  emit: (e: 'update-cell', payload: { tableName: string; oldRow: Row; newRow: Row }) => void,
  onTruncation?: (row: Row, col: string, originalLength: number, maxLength: number) => void
) {
  function autoResizeGhost(e: Event) {
    const target = e.target as HTMLTextAreaElement
    const ghost = target.previousElementSibling
    if (ghost) ghost.textContent = `${target.value} `
  }

  function handleBlur(e: FocusEvent, row: Row, col: string) {
    const target = e.target as HTMLTextAreaElement
    const newVal = target.value
    const oldVal = row[col]

    if (String(newVal) === String(oldVal)) return

    const typeInfo = columnTypes[col] || ''
    const typeUpper = typeInfo.toUpperCase()

    if (isNumericType(typeUpper) && newVal !== '') {
      if (Number.isNaN(Number(newVal))) return
    }

    if (typeUpper.includes('NOT NULL')) {
      if (newVal === '' || newVal.trim() === '') return
    }

    const { value: constrainedVal, truncated } = enforceTypeConstraints(newVal, typeInfo)
    if (truncated) {
      onTruncation?.(row, col, truncated.originalLength, truncated.maxLength)
    }
    emit('update-cell', { tableName, oldRow: row, newRow: { ...row, [col]: constrainedVal } })
  }

  return { autoResizeGhost, handleBlur }
}
