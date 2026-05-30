import type { Row } from '../model/DatabaseTypes'
import { isNumericType } from '../utils/sql'

export function useInlineEdit<EmitFn extends (e: string, ...args: any[]) => void>(
  tableName: string,
  columnTypes: Record<string, string>,
  emit: EmitFn
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

    emit('update-cell', { tableName, oldRow: row, newRow: { ...row, [col]: newVal } })
  }

  return { autoResizeGhost, handleBlur }
}
