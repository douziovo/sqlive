import type {Ref, WritableComputedRef} from 'vue'
import {ref} from 'vue'
import type {CanonicalStatement, Row, TableSchema, TruncationInfo} from '../model/DatabaseTypes'
import {parsePrimaryType, toSqlLiteral} from '../utils/sql'
import {
    enforceTypeConstraints,
    extractSqlStatements,
    normalizeAndCompare,
    parseExplicitColumns
} from '../utils/sqlStatements'
import {extractTuplesWithDepth, splitTupleContent} from '../utils/tupleParser'

type EngineMode = 'user' | 'reconciling' | 'rollback'

// D-R2-004: previously received the whole DatabaseModel but only read db.tables.
// Narrowed to a `tablesSource: () => TableSchema[]` getter (matches the
// useErDiagram L92 范式) so this composable no longer couples to the whole DatabaseModel shape.
export function useBidirectionalSync(
    code: WritableComputedRef<string>,
    tablesSource: () => TableSchema[],
    mode: Ref<EngineMode>,
    flashCode: (sql: string) => void,
    transitionFn: (from: EngineMode, to: EngineMode, ctx: string) => EngineMode,
    canonicalStatements?: Ref<CanonicalStatement[] | undefined>
) {
    let lastValidCode = code.value
    const lastTruncations = ref<TruncationInfo[]>([])

    // D-03c: prefer backend canonicalStatements (single source of truth per Phase 2 CORE-01).
    // Falls back to extractSqlStatements(code.value) per D-03d when canonical list is absent
    // (backward compat for responses without canonicalStatements).
    const getStatements = () => {
        const canonical = canonicalStatements?.value
        if (canonical && canonical.length > 0) {
            return canonical.map((cs) => ({
                start: cs.start,
                end: cs.end,
                text: code.value.substring(cs.start, cs.end)
            }))
        }
        return extractSqlStatements(code.value)
    }

    const beginReconcile = () => {
        lastValidCode = code.value
        mode.value = transitionFn(mode.value, 'reconciling', 'beginReconcile')
    }

    const generateValuesTuple = (tableName: string, row: Row, columns: string[]) => {
        const tableInfo = tablesSource().find((t) => t.name === tableName)
        const truncations: TruncationInfo[] = []
        const values = columns.map((colName) => {
            let val = row[colName]
            const rawType = tableInfo?.columnTypes[colName] || ''
            const constraintResult = enforceTypeConstraints(val, rawType)
            if (constraintResult.wasTruncated) {
                truncations.push({...constraintResult, column: colName})
            }
            val = constraintResult.value
            const type = parsePrimaryType(rawType)
            return toSqlLiteral(val, type)
        })
        return {sql: `(${values.join(', ')})`, truncations}
    }

    const findTupleInBatch = (stmtText: string, tableName: string, rowData: Row) => {
        const cleanStmt = stmtText.replace(/--.*$/gm, '')
        const insertRegex = new RegExp(`INSERT\\s+INTO\\s+(?:[\`"']?)${tableName}(?:[\`"']?)\\b`, 'i')
        if (!insertRegex.test(cleanStmt)) return null

        let compareCols: string[] = []
        const explicitCols = parseExplicitColumns(cleanStmt)
        if (explicitCols) {
            compareCols = explicitCols
        } else {
            const table = tablesSource().find((t) => t.name === tableName)
            if (!table) return null
            compareCols = table.columns.filter((c) => !table.columnTypes[c]?.includes('VIRTUAL'))
        }

        const tuples = extractTuplesWithDepth(cleanStmt)

        for (const tuple of tuples) {
            const sqlValues = splitTupleContent(tuple.content)

            if (sqlValues.length !== compareCols.length) continue

            const isMatch = compareCols.every((col, index) => {
                const rowVal = rowData[col]
                const sqlVal = sqlValues[index]
                return normalizeAndCompare(rowVal, sqlVal)
            })

            if (isMatch) {
                const realStart = stmtText.indexOf(`(${tuple.content})`)
                if (realStart !== -1) {
                    const originalTupleStr = `(${tuple.content})`
                    return {start: realStart, end: realStart + originalTupleStr.length, explicitCols: compareCols}
                }
            }
        }
        return null
    }

    const updateRow = (tableName: string, oldRow: Row, newRowData: Row) => {
        beginReconcile()

        const statements = getStatements()
        for (const stmt of statements) {
            const match = findTupleInBatch(stmt.text, tableName, oldRow)
            if (match) {
                const absoluteStart = stmt.start + match.start
                const absoluteEnd = stmt.start + match.end
                const {sql: newTupleSql, truncations} = generateValuesTuple(tableName, newRowData, match.explicitCols)
                if (truncations.length > 0) lastTruncations.value = truncations
                code.value = code.value.substring(0, absoluteStart) + newTupleSql + code.value.substring(absoluteEnd)
                flashCode(newTupleSql)
                return
            }
        }
        console.warn('无法定位原始代码行 (Batch Mode)')
    }

    const deleteRow = (row: Row, tableName?: string) => {
        beginReconcile()
        let targetTableName = tableName || ''
        if (!targetTableName) {
            for (const t of tablesSource()) {
                if (t.data.includes(row)) {
                    targetTableName = t.name
                    break
                }
            }
        }
        if (!targetTableName) return

        const statements = getStatements()
        for (const stmt of statements) {
            const match = findTupleInBatch(stmt.text, targetTableName, row)
            if (match) {
                const absoluteStart = stmt.start + match.start
                const absoluteEnd = stmt.start + match.end
                let deleteStart = absoluteStart
                let deleteEnd = absoluteEnd
                const charAfter = code.value.substring(absoluteEnd).match(/^\s*,/)
                const charBefore = code.value.substring(0, absoluteStart).match(/,\s*$/)
                if (charAfter) deleteEnd += charAfter[0].length
                else if (charBefore) deleteStart -= charBefore[0].length
                else {
                    const contentAfter = stmt.text.substring(match.end).trim()
                    if (contentAfter === ';' || contentAfter === '') {
                        code.value = (code.value.substring(0, stmt.start) + code.value.substring(stmt.end)).replace(
                            /\n{3,}/g,
                            '\n\n'
                        )
                        return
                    }
                }
                code.value = code.value.substring(0, deleteStart) + code.value.substring(deleteEnd)
                return
            }
        }
    }

    const insertRowUI = (tableName: string, newRowData: Row) => {
        beginReconcile()
        const table = tablesSource().find((t) => t.name === tableName)
        if (!table) return
        const physicalColumns = table.columns.filter((c) => !table.columnTypes[c].includes('VIRTUAL'))
        const {sql: valuesSql, truncations} = generateValuesTuple(tableName, newRowData, physicalColumns)
        if (truncations.length > 0) lastTruncations.value = truncations
        const newSql = `INSERT INTO ${tableName} (${physicalColumns.join(', ')}) VALUES ${valuesSql};`
        let currentCode = code.value.trimEnd()
        if (!currentCode.endsWith(';')) currentCode += ';'
        code.value = `${currentCode}\n${newSql}`
        flashCode(newSql)
    }

    const addNewTable = (name: string, columns: string[], data: Record<string, unknown>[]) => {
        beginReconcile()
        const colDefs = columns.join(',\n  ')
        let sql = `CREATE TABLE ${name} (\n  ${colDefs}\n);`
        if (data && data.length > 0) {
            for (const row of data) {
                const vals = columns.map((col) => {
                    const rawType = col.split(/\s+/).slice(1).join(' ')
                    return toSqlLiteral(row[col], rawType)
                })
                sql += `\nINSERT INTO ${name} VALUES (${vals.join(', ')});`
            }
        }
        const trimmed = code.value.trimEnd()
        code.value = `${trimmed.endsWith(';') ? trimmed : `${trimmed};`}\n${sql}`
        flashCode(sql)
    }

    const dropTableUI = (tableName: string) => {
        beginReconcile()

        const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const tableRefRe = new RegExp(`\\b${escaped}\\b`, 'i')

        const statements = getStatements()
        let newCode = code.value
        for (let i = statements.length - 1; i >= 0; i--) {
            if (tableRefRe.test(statements[i].text)) {
                const s = statements[i]
                newCode = newCode.substring(0, s.start) + newCode.substring(s.end)
            }
        }
        code.value = `${newCode
            .replace(/\n{2,}/g, '\n')
            .replace(/^\n+/, '')
            .trimEnd()}\n`
    }

    return {
        beginReconcile,
        getLastValidCode: () => lastValidCode,
        updateRow,
        deleteRow,
        insertRowUI,
        addNewTable,
        dropTableUI,
        lastTruncations
    }
}
