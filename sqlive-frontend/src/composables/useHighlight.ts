import {reactive, ref} from 'vue'
import type {CanonicalStatement, HighlightState, TableSchema} from '../model/DatabaseTypes'
import {compareValuesForHighlight, extractSqlStatements} from '../utils/sqlStatements'

// D-R2-004: previously received the whole DatabaseModel but only read db.tables.
// Narrowed to a `tablesSource: () => TableSchema[]` getter (matches the
// useErDiagram L92 范式) so this composable no longer couples to the whole DatabaseModel shape.
export function useHighlight(
    code: { value: string },
    tablesSource: () => TableSchema[],
    canonicalStatements?: { value: CanonicalStatement[] | undefined }
) {
    const highlightedCodeChunk = ref<string | null>(null)
    let refreshSeedCounter = 0

    const highlight = reactive<HighlightState>({
        activeTables: [],
        activeColumns: [],
        activeRows: [],
        flashingRows: [],
        actionType: 'none',
        refreshSeed: 0
    })

    function flashCode(sql: string) {
        highlightedCodeChunk.value = sql
        setTimeout(() => {
            highlightedCodeChunk.value = null
        }, 1500)
    }

    const recalculateStaticHighlight = () => {
        highlight.activeRows = []
        highlight.activeColumns = []
        highlight.activeTables = []
        highlight.actionType = 'none'
        highlight.refreshSeed = ++refreshSeedCounter

        // D-03c (Pitfall 7): prefer backend canonicalStatements for consistency with
        // useBidirectionalSync — single source of truth per Phase 2 CORE-01.
        const canonical = canonicalStatements?.value
        const statements = (canonical && canonical.length > 0)
            ? canonical.map((cs) => ({
                text: code.value.substring(cs.start, cs.end),
                start: cs.start,
                end: cs.end
            }))
            : extractSqlStatements(code.value)
        for (const stmt of statements) {
            const sqlClean = stmt.text.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim()
            if (!sqlClean) continue
            if (/CREATE\s+TABLE/i.test(sqlClean)) {
                highlightCreateTable(sqlClean)
            } else if (/INSERT\s+INTO/i.test(sqlClean)) {
                highlightInsert(sqlClean)
            } else if (sqlClean.toUpperCase().startsWith('SELECT')) {
                highlightSelect(sqlClean)
            }
        }
    }

    function highlightCreateTable(sqlClean: string) {
        highlight.actionType = 'ddl'
        const tableName = sqlClean.match(/CREATE\s+TABLE\s+(\w+)/i)?.[1] || null
        if (tableName) highlight.activeTables = [tableName]
    }

    function highlightInsert(sqlClean: string) {
        highlight.actionType = 'insert'
        const tableName = sqlClean.match(/INSERT\s+INTO\s+(\w+)/i)?.[1] || null
        if (tableName) highlight.activeTables = [tableName]
    }

    function highlightSelect(sqlClean: string) {
        highlight.actionType = 'select'
        const involvedTables = new Set<string>()
        const tableAliasMap = new Map<string, string>()

        const fromMatch = sqlClean.match(/FROM\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/i)
        if (fromMatch) {
            involvedTables.add(fromMatch[1])
            tableAliasMap.set(fromMatch[2] || fromMatch[1], fromMatch[1])
        }

        const joinRegex = /JOIN\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi
        let jMatch
        while ((jMatch = joinRegex.exec(sqlClean)) !== null) {
            involvedTables.add(jMatch[1])
            tableAliasMap.set(jMatch[2] || jMatch[1], jMatch[1])
        }

        highlight.activeTables = Array.from(involvedTables)

        const conditions = parseWhereConditions(sqlClean, tableAliasMap)
        matchRowsToConditions(involvedTables, conditions)
        collectSelectColumns(sqlClean, involvedTables)
    }

    function parseWhereConditions(sqlClean: string, tableAliasMap: Map<string, string>) {
        const whereRegex = /(?:WHERE|AND)\s+(?:(\w+)\.)?(\w+)\s*(=|!=|<>|>=|<=|>|<|LIKE)\s*((?:'[^']*')|[^\s;]+)/gi
        const conditions: { table: string | null; col: string; op: string; val: string }[] = []
        let wMatch
        while ((wMatch = whereRegex.exec(sqlClean)) !== null) {
            const tName = wMatch[1] ? (tableAliasMap.get(wMatch[1]) ?? null) : null
            conditions.push({table: tName, col: wMatch[2].toLowerCase(), op: wMatch[3], val: wMatch[4]})
        }
        return conditions
    }

    function matchRowsToConditions(
        involvedTables: Set<string>,
        conditions: { table: string | null; col: string; op: string; val: string }[]
    ) {
        involvedTables.forEach((tName) => {
            const table = tablesSource().find((t) => t.name === tName)
            if (!table?.data[0]) return
            const colIndex = new Map(Object.keys(table.data[0]).map((k) => [k.toLowerCase(), k]))
            const relevantConds = conditions.filter((c) => !c.table || c.table === tName)
            const matchedRows = table.data.filter((row) =>
                relevantConds.every((cond) => {
                    const colKey = colIndex.get(cond.col)
                    if (!colKey) return false
                    return compareValuesForHighlight(row[colKey], cond.op, cond.val)
                })
            )
            matchedRows.forEach((r) => highlight.activeRows.push(`${tName}:${r.id !== undefined ? r.id : r._highlightId}`))
        })
    }

    function collectSelectColumns(sqlClean: string, involvedTables: Set<string>) {
        const selectPart = sqlClean.match(/SELECT\s+([\s\S]+?)\s+FROM/i)?.[1] || ''
        const selectCols = selectPart.split(',').map((s) => s.trim())
        selectCols.forEach((colDef) => {
            if (colDef === '*') {
                involvedTables.forEach((t) =>
                    tablesSource().find((tt) => tt.name === t)?.columns.forEach((c) => highlight.activeColumns.push(c))
                )
            } else {
                const colName = colDef.split('.').pop() || ''
                involvedTables.forEach((t) => {
                    const realCol = tablesSource()
                        .find((tt) => tt.name === t)
                        ?.columns.find((c) => c.toLowerCase() === colName.toLowerCase())
                    if (realCol) highlight.activeColumns.push(realCol)
                })
            }
        })
    }

    return {highlight, highlightedCodeChunk, flashCode, recalculateStaticHighlight}
}
