import type { Ref, WritableComputedRef } from 'vue'
import { ref } from 'vue'
import type { CanonicalStatement, Row, TableSchema, TruncationInfo } from '../model/DatabaseTypes'
import { parsePrimaryType, toSqlLiteral } from '../utils/sql'
import {
    parseColumnDefinition,
    parseInsertTarget,
    quoteSqlIdentifier,
    sameSqlIdentifier,
    maskSqlComments
} from '../utils/sqlIdentifiers'
import {
    enforceTypeConstraints,
    extractSqlStatements,
    normalizeAndCompare
} from '../utils/sqlStatements'
import { extractTuplesWithDepth, splitTupleContent } from '../utils/tupleParser'

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
    canonicalStatements?: Ref<CanonicalStatement[] | undefined>,
    onError?: (message: string) => void
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
                truncations.push({ ...constraintResult, column: colName })
            }
            val = constraintResult.value
            const type = parsePrimaryType(rawType)
            return toSqlLiteral(val, type)
        })
        return { sql: `(${values.join(', ')})`, truncations }
    }

    const findTuplesInBatch = (stmtText: string, tableName: string, rowData: Row) => {
        const target = parseInsertTarget(stmtText)
        if (
            !target ||
            !sameSqlIdentifier(target.tableName, tableName) ||
            target.valuesStart === null
        )
            return []

        const table = tablesSource().find((t) => sameSqlIdentifier(t.name, tableName))
        let compareCols: string[] = []
        const explicitCols = target.columns
        if (explicitCols) {
            compareCols = explicitCols.map(
                (column) => table?.columns.find((name) => sameSqlIdentifier(name, column)) ?? column
            )
        } else {
            if (!table) return []
            compareCols = table.columns.filter((c) => !table.columnTypes[c]?.includes('VIRTUAL'))
        }

        const tuples = extractTuplesWithDepth(stmtText, target.valuesStart)
        const matches = []

        for (const tuple of tuples) {
            const sqlValues = splitTupleContent(tuple.content)

            if (sqlValues.length !== compareCols.length) continue

            const isMatch = compareCols.every((col, index) => {
                const rowVal = rowData[col]
                const sqlVal = sqlValues[index]
                return normalizeAndCompare(rowVal, sqlVal)
            })

            if (isMatch) {
                matches.push({
                    start: tuple.start,
                    end: tuple.end,
                    explicitCols: compareCols
                })
            }
        }
        return matches
    }

    const rowTarget = (tableName: string, row: Row) => {
        const table = tablesSource().find((t) => sameSqlIdentifier(t.name, tableName))
        const matches = getStatements().flatMap((stmt) =>
            findTuplesInBatch(stmt.text, tableName, row).map((match) => ({ stmt, match }))
        )
        const keys =
            table?.columns.filter((col) => /\bPRIMARY\s+KEY\b/i.test(table.columnTypes[col])) ?? []
        const candidate = matches.length === 1 ? matches[0] : undefined
        // An omitted/generated key cannot identify a VALUES tuple. Preserve the source
        // and append a database operation addressed to the actual, unique primary key.
        const hasAllKeys =
            candidate && keys.every((key) => candidate.match.explicitCols.includes(key))
        if (candidate && hasAllKeys) return { ...candidate, table, where: null }
        if (
            table &&
            keys.length > 0 &&
            keys.every((key) => row[key] != null) &&
            table.data.filter((item) => keys.every((key) => item[key] === row[key])).length === 1
        ) {
            const where = keys
                .map(
                    (key) =>
                        `${quoteSqlIdentifier(key)} = ${toSqlLiteral(row[key], parsePrimaryType(table.columnTypes[key]))}`
                )
                .join(' AND ')
            return { table, where }
        }
        const message =
            matches.length > 1
                ? '多条源记录匹配此行，且没有可用的唯一主键。请在 SQL 编辑器中修改。'
                : '无法定位原始代码行，且没有可用的唯一主键。请在 SQL 编辑器中修改。'
        console.warn(message)
        onError?.(message)
        return null
    }

    const updateRow = (tableName: string, oldRow: Row, newRowData: Row) => {
        const target = rowTarget(tableName, oldRow)
        if (!target) return
        if (target.where) {
            const columns = target.table.columns.filter(
                (col) => !target.table.columnTypes[col]?.includes('VIRTUAL')
            )
            const { sql, truncations } = generateValuesTuple(tableName, newRowData, columns)
            beginReconcile()
            lastTruncations.value = truncations
            const update = `UPDATE ${quoteSqlIdentifier(tableName)} SET (${columns.map(quoteSqlIdentifier).join(', ')}) = ${sql} WHERE ${target.where};`
            appendSql(update)
            flashCode(update)
            return
        }
        if ('stmt' in target && target.stmt && target.match) {
            const { stmt, match } = target
            beginReconcile()
            const absoluteStart = stmt.start + match.start
            const absoluteEnd = stmt.start + match.end
            const { sql: newTupleSql, truncations } = generateValuesTuple(
                tableName,
                newRowData,
                match.explicitCols
            )
            if (truncations.length > 0) lastTruncations.value = truncations
            code.value =
                code.value.substring(0, absoluteStart) +
                newTupleSql +
                code.value.substring(absoluteEnd)
            flashCode(newTupleSql)
            return
        }
    }

    const deleteRow = (row: Row, tableName?: string) => {
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

        const target = rowTarget(targetTableName, row)
        if (!target) return
        if (target.where) {
            beginReconcile()
            appendSql(`DELETE FROM ${quoteSqlIdentifier(targetTableName)} WHERE ${target.where};`)
            return
        }
        if ('stmt' in target && target.stmt && target.match) {
            const { stmt, match } = target
            beginReconcile()
            const absoluteStart = stmt.start + match.start
            const absoluteEnd = stmt.start + match.end
            let deleteStart = absoluteStart
            let deleteEnd = absoluteEnd
            const masked = maskSqlComments(stmt.text)
            const charAfter = masked.substring(match.end).match(/^\s*,/)
            const charBefore = masked.substring(0, match.start).match(/,\s*$/)
            if (charAfter) deleteEnd += charAfter[0].length
            else if (charBefore) deleteStart -= charBefore[0].length
            else {
                code.value = (
                    code.value.substring(0, stmt.start) + code.value.substring(stmt.end)
                ).replace(/\n{3,}/g, '\n\n')
                return
            }
            code.value = code.value.substring(0, deleteStart) + code.value.substring(deleteEnd)
            return
        }
    }

    const insertRowUI = (tableName: string, newRowData: Row) => {
        const table = tablesSource().find((t) => t.name === tableName)
        if (!table) return
        beginReconcile()
        const physicalColumns = table.columns.filter(
            (c) => !table.columnTypes[c].includes('VIRTUAL')
        )
        const { sql: valuesSql, truncations } = generateValuesTuple(
            tableName,
            newRowData,
            physicalColumns
        )
        if (truncations.length > 0) lastTruncations.value = truncations
        const newSql = `INSERT INTO ${quoteSqlIdentifier(tableName)} (${physicalColumns.map(quoteSqlIdentifier).join(', ')}) VALUES ${valuesSql};`
        appendSql(newSql)
        flashCode(newSql)
    }

    const addNewTable = (name: string, columns: string[], data: Record<string, unknown>[]) => {
        const definitions = columns.map(parseColumnDefinition)
        beginReconcile()
        const colDefs = definitions
            .map(
                (column) =>
                    `${quoteSqlIdentifier(column.name)}${column.type ? ` ${column.type}` : ''}`
            )
            .join(',\n  ')
        let sql = `CREATE TABLE ${quoteSqlIdentifier(name)} (\n  ${colDefs}\n);`
        if (data && data.length > 0) {
            for (const row of data) {
                const vals = definitions.map((column, index) => {
                    const value = Object.hasOwn(row, column.name)
                        ? row[column.name]
                        : row[columns[index]]
                    return toSqlLiteral(value, column.type)
                })
                sql += `\nINSERT INTO ${quoteSqlIdentifier(name)} VALUES (${vals.join(', ')});`
            }
        }
        appendSql(sql)
        flashCode(sql)
    }

    const dropTableUI = (tableName: string) => {
        beginReconcile()
        // Preserve the script's statements and dependencies; SQLite owns DROP semantics.
        // A table name in a string, comment, column or CTE is not a safe deletion signal.
        const sql = `DROP TABLE ${quoteSqlIdentifier(tableName)};`
        appendSql(sql)
        flashCode(sql)
    }

    const appendSql = (sql: string) => {
        const current = code.value.trimEnd()
        const separator = current && !maskSqlComments(current).trimEnd().endsWith(';') ? '\n;' : ''
        code.value = `${current}${separator}${current ? '\n' : ''}${sql}`
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
