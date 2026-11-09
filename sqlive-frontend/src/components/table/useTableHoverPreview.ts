import { computed, onUnmounted, ref } from 'vue'
import type { PreviewItem } from '@/composables/useFilteredList'
import type { IndexInfo, TriggerInfo, ViewInfo } from '@/model/DatabaseTypes'
import { extractTriggerTiming } from '@/utils/sql'

export type HoverType = 'index' | 'trigger' | 'view' | 'column-index'

type NavigateEmit = (event: 'navigate-tab', payload: { tab: string; targetId?: string }) => void

interface TableHoverPreviewOptions {
    tableName: () => string
    tableIndexes: () => IndexInfo[]
    tableTriggers: () => TriggerInfo[]
    tableViews: () => ViewInfo[]
    columnIndexes: () => Record<string, string[]>
}

export function useTableHoverPreview(options: TableHoverPreviewOptions, emit: NavigateEmit) {
    const { tableName, tableIndexes, tableTriggers, tableViews, columnIndexes } = options

    const hoverType = ref<HoverType | null>(null)
    const hoverTriggerEl = ref<HTMLElement | null>(null)
    const hoverColumn = ref<string>('')
    let hoverLeaveTimer: ReturnType<typeof setTimeout> | null = null

    function onBadgeEnter(e: MouseEvent, type: HoverType) {
        if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer)
        hoverTriggerEl.value = e.currentTarget as HTMLElement
        hoverType.value = type
        hoverColumn.value = ''
    }

    function onColumnIdxEnter(e: MouseEvent, col: string) {
        if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer)
        hoverTriggerEl.value = e.currentTarget as HTMLElement
        hoverType.value = 'column-index'
        hoverColumn.value = col
    }

    function onBadgeLeave() {
        if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer)
        hoverLeaveTimer = setTimeout(() => {
            hoverType.value = null
            hoverTriggerEl.value = null
            hoverColumn.value = ''
        }, 200)
    }

    function onPreviewEnter() {
        if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer)
    }

    function onPreviewSelect(targetId: string) {
        const tabMap: Record<string, string> = {
            index: 'indexes',
            trigger: 'triggers',
            view: 'views',
            'column-index': 'indexes'
        }
        const tab = tabMap[hoverType.value || 'index'] || 'indexes'
        hoverType.value = null
        emit('navigate-tab', { tab, targetId })
    }

    function onPreviewNavigateAll() {
        const currentType = hoverType.value
        hoverType.value = null
        if (!currentType) return
        const tabMap: Record<string, string> = {
            index: 'indexes',
            trigger: 'triggers',
            view: 'views',
            'column-index': 'indexes'
        }
        emit('navigate-tab', { tab: tabMap[currentType] || 'indexes' })
    }

    const previewIcon = computed(() => {
        if (hoverType.value === 'index' || hoverType.value === 'column-index') return '\u{1F4C7}'
        if (hoverType.value === 'trigger') return '\u{26A1}'
        if (hoverType.value === 'view') return '\u{1F440}'
        return ''
    })

    const previewTitle = computed(() => {
        if (hoverType.value === 'index') return `索引 · ${tableName()} 表`
        if (hoverType.value === 'column-index') return `索引 · ${hoverColumn.value} 列`
        if (hoverType.value === 'trigger') return `触发器 · ${tableName()} 表`
        if (hoverType.value === 'view') return `视图 · 引用 ${tableName()} 表`
        return ''
    })

    const previewSubtitle = computed(() => {
        if (hoverType.value === 'index') return `共 ${tableIndexes().length} 个索引`
        if (hoverType.value === 'column-index')
            return `此列被 ${columnIndexes()[hoverColumn.value]?.length || 0} 个索引使用`
        if (hoverType.value === 'trigger') return `共 ${tableTriggers().length} 个触发器`
        if (hoverType.value === 'view') return `共 ${tableViews().length} 个视图`
        return ''
    })

    const previewCategoryName = computed(() => {
        if (hoverType.value === 'index' || hoverType.value === 'column-index') return '索引'
        if (hoverType.value === 'trigger') return '触发器'
        if (hoverType.value === 'view') return '视图'
        return ''
    })

    const previewItems = computed((): PreviewItem[] => {
        if (hoverType.value === 'index') {
            return tableIndexes().map((idx) => ({
                id: `index-${idx.name}`,
                icon: idx.unique ? '\u{1F48E}' : '\u{1F4CB}',
                label: idx.name,
                meta: [`列: ${idx.columns.join(', ')}  ·  ${idx.unique ? 'UNIQUE' : '普通'}`],
                sqlPreview: idx.sql
                    ? idx.sql.substring(0, 80) + (idx.sql.length > 80 ? '...' : '')
                    : undefined,
                accent: (idx.unique ? 'blue' : 'none') as 'blue' | 'none'
            }))
        }
        if (hoverType.value === 'column-index') {
            const col = hoverColumn.value
            const colIdxNames = columnIndexes()[col] || []
            return colIdxNames.map((name) => {
                const idx = tableIndexes().find((i) => i.name === name)
                const colPos = idx ? idx.columns.indexOf(col) + 1 : 0
                const otherCols = idx ? idx.columns.filter((c) => c !== col) : []
                const meta = [`第 ${colPos} 列 (共 ${idx?.columns.length || 0} 列)`]
                if (otherCols.length > 0) meta.push(`其他列: ${otherCols.join(', ')}`)
                return {
                    id: `index-${name}`,
                    icon: idx?.unique ? '\u{1F48E}' : '\u{1F4CB}',
                    label: name,
                    meta,
                    accent: (idx?.unique ? 'blue' : 'none') as 'blue' | 'none'
                }
            })
        }
        if (hoverType.value === 'trigger') {
            return tableTriggers().map((t) => {
                const timing = extractTriggerTiming(t.sql)
                return {
                    id: `trigger-${t.name}`,
                    icon: '\u{26A1}',
                    label: t.name,
                    meta: timing ? [timing] : [],
                    tag: timing || undefined,
                    sqlPreview: t.sql
                        ? t.sql.substring(0, 80) + (t.sql.length > 80 ? '...' : '')
                        : undefined
                }
            })
        }
        if (hoverType.value === 'view') {
            return tableViews().map((v) => ({
                id: `view-${v.name}`,
                icon: '\u{1F440}',
                label: v.name,
                meta: v.sql ? [v.sql.split('\n')[0]?.substring(0, 60) || ''] : [],
                sqlPreview: v.sql
                    ? v.sql.substring(0, 80) + (v.sql.length > 80 ? '...' : '')
                    : undefined
            }))
        }
        return []
    })

    onUnmounted(() => {
        if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer)
    })

    return {
        hoverType,
        hoverTriggerEl,
        onBadgeEnter,
        onColumnIdxEnter,
        onBadgeLeave,
        onPreviewEnter,
        onPreviewSelect,
        onPreviewNavigateAll,
        previewIcon,
        previewTitle,
        previewSubtitle,
        previewCategoryName,
        previewItems
    }
}
