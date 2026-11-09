import type { CellUpdateEvent, Row } from '../model/DatabaseTypes'
import { isNumericType } from '../utils/sql'

export function useInlineEdit(
    tableName: string,
    columnTypes: Record<string, string>,
    emit: (event: 'update-cell', payload: CellUpdateEvent) => void
) {
    function autoResizeGhost(e: Event) {
        const target = e.target
        if (!(target instanceof HTMLTextAreaElement)) return
        const ghost = target.parentElement?.querySelector<HTMLElement>('[data-ghost]')
        if (ghost) ghost.textContent = `${target.value} `
    }

    function handleBlur(e: FocusEvent, row: Row, col: string) {
        const target = e.target
        if (!(target instanceof HTMLTextAreaElement)) return
        const newVal = target.value
        const oldVal = row[col]

        if (newVal === String(oldVal)) return

        const typeInfo = columnTypes[col] || ''
        const typeUpper = typeInfo.toUpperCase()

        if (isNumericType(typeUpper) && newVal !== '' && Number.isNaN(Number(newVal))) return

        if (typeUpper.includes('NOT NULL') && newVal.trim() === '') return

        emit('update-cell', { tableName, oldRow: row, newRow: { ...row, [col]: newVal } })
    }

    return { autoResizeGhost, handleBlur }
}
