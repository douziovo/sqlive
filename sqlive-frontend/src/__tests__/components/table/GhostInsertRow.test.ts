import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { InsertResult, TableSchema, TruncationInfo } from '@/model/DatabaseTypes'
import GhostInsertRow from '@/components/table/GhostInsertRow.vue'
import { SQL_CONTEXT_KEY } from '@/model/injectionKeys'

const table: TableSchema = {
    name: 'users',
    columns: ['id', 'name'],
    columnTypes: { id: 'INTEGER', name: 'TEXT' },
    data: []
}

function mountRow(insertResult = ref<InsertResult | null>(null)) {
    const wrapper = mount(GhostInsertRow, {
        props: { table },
        global: {
            provide: {
                [SQL_CONTEXT_KEY as symbol]: {
                    insertResult,
                    lastTruncations: ref<TruncationInfo[]>([]),
                    highlight: {
                        actionType: 'none',
                        activeTables: [],
                        activeRows: [],
                        activeColumns: [],
                        flashingRows: [],
                        refreshSeed: 0
                    }
                }
            }
        }
    })
    return { wrapper, insertResult }
}

describe('GhostInsertRow', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('emits nothing on submit when every ghost cell is empty', async () => {
        const { wrapper } = mountRow()
        // The confirm button only renders once something is typed (hasGhostInput)
        expect(wrapper.find('button[title="确认添加"]').exists()).toBe(false)
        await wrapper.find('textarea[placeholder="+"]').trigger('keydown.enter')
        expect(wrapper.emitted('insert-row')).toBeUndefined()
    })

    it('emits insert-row with the typed values and keeps them until the result arrives', async () => {
        const { wrapper } = mountRow()
        const idCell = wrapper.find('textarea[placeholder="+"]')
        await idCell.setValue('42')
        await wrapper.find('button[title="确认添加"]').trigger('click')
        expect(wrapper.emitted('insert-row')).toEqual([
            [{ tableName: 'users', newRow: { id: '42' } }]
        ])
        // Values are NOT cleared optimistically — the ghost row waits for insertResult
        expect((idCell.element as HTMLTextAreaElement).value).toBe('42')
    })

    it('clears the ghost row when the insert succeeds', async () => {
        const { wrapper, insertResult } = mountRow()
        await wrapper.find('textarea[placeholder="+"]').setValue('7')
        insertResult.value = { tableName: 'users', success: true }
        await nextTick()
        expect(wrapper.find<HTMLTextAreaElement>('textarea[placeholder="+"]').element.value).toBe(
            ''
        )
        // The result is consumed so sibling ghost rows do not react to it twice
        expect(insertResult.value).toBeNull()
    })

    it('ignores results that belong to another table', async () => {
        const { wrapper, insertResult } = mountRow()
        await wrapper.find('textarea[placeholder="+"]').setValue('7')
        insertResult.value = { tableName: 'orders', success: true }
        await nextTick()
        expect(wrapper.find<HTMLTextAreaElement>('textarea[placeholder="+"]').element.value).toBe(
            '7'
        )
    })

    it('shows the failure message with the error and auto-dismisses after 3s', async () => {
        const { wrapper, insertResult } = mountRow()
        await wrapper.find('textarea[placeholder="+"]').setValue('x')
        insertResult.value = { tableName: 'users', success: false, error: 'UNIQUE constraint' }
        await nextTick()
        expect(wrapper.text()).toContain('插入失败: UNIQUE constraint')

        await vi.advanceTimersByTimeAsync(3100)
        expect(wrapper.text()).not.toContain('插入失败')
    })

    it('falls back to the generic failure text when no error is provided', async () => {
        const { wrapper, insertResult } = mountRow()
        insertResult.value = { tableName: 'users', success: false }
        await nextTick()
        expect(wrapper.text()).toContain('插入失败，请修正数据后重试')
        // Typing again dismisses the failure notice immediately
        await wrapper.find('textarea[placeholder="+"]').setValue('1')
        expect(wrapper.text()).not.toContain('插入失败')
    })

    it('replaces an existing failure banner when a second result arrives', async () => {
        const { wrapper, insertResult } = mountRow()
        insertResult.value = { tableName: 'users', success: false, error: 'first' }
        await nextTick()
        insertResult.value = { tableName: 'users', success: false, error: 'second' }
        await nextTick()
        expect(wrapper.text()).toContain('插入失败: second')
        expect(wrapper.text()).not.toContain('插入失败: first')
    })
})
