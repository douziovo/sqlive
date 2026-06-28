import {computed, ref} from 'vue'
import type {Row} from '../model/DatabaseTypes'
import {isNumericType} from '../utils/sql'
import {useSortFilter} from './useSortFilter'

export function useTablePipeline(data: () => Row[], columnTypes: () => Record<string, string>) {
    const filterColumns = ref<string[]>([])
    const pageSize = ref(10)

    // Build dynamic sort fields from current data columns
    const sortFields = computed(() => {
        const cols = filterColumns.value.length > 0 ? filterColumns.value : Object.keys(data()[0] || {})
        const types = columnTypes()
        return cols.map((col) => ({
            key: col,
            label: col,
            compare: (a: Row, b: Row): number => {
                const av = a[col],
                    bv = b[col]
                if (av === null || av === undefined) return 1
                if (bv === null || bv === undefined) return -1
                if (isNumericType(types[col] || '') && !Number.isNaN(Number(av)) && !Number.isNaN(Number(bv))) {
                    return Number(av) - Number(bv)
                }
                return String(av).localeCompare(String(bv))
            }
        }))
    })

    const filterFn = (row: Row, filter: string) => {
        const cols = filterColumns.value.length > 0 ? filterColumns.value : Object.keys(row)
        return cols.some((col) => {
            const val = row[col]
            return val !== null && val !== undefined && String(val).toLowerCase().includes(filter)
        })
    }

    const pipeline = useSortFilter(data, sortFields, filterFn, {pageSize})

    return {
        sortColumn: pipeline.sortKey,
        sortDir: pipeline.sortDir,
        filterText: pipeline.filterText,
        toggleSort: pipeline.toggleSort,
        filterColumns,
        currentPage: pipeline.currentPage,
        pageSize,
        paginatedData: pipeline.result,
        totalRows: pipeline.filteredCount,
        totalPages: pipeline.totalPages
    }
}
