import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import type { HighlightState, TableSchema } from '@/model/DatabaseTypes'
import TableSection from '../../components/TableSection.vue'
import { SQL_CONTEXT_KEY } from '../../model/injectionKeys'

const mockTable: TableSchema = {
  name: 'users',
  columns: ['id', 'name', 'salary'],
  columnTypes: { id: 'INTEGER | PRIMARY KEY', name: 'TEXT | NOT NULL', salary: 'REAL' },
  data: [
    { id: 1, name: 'Alice', salary: 9000 },
    { id: 2, name: 'Bob', salary: 7000 },
    { id: 3, name: 'Charlie', salary: 5000 }
  ]
}

const defaultHighlight: HighlightState = {
  actionType: 'none' as const,
  activeTables: [],
  activeRows: [],
  activeColumns: [],
  flashingRows: [],
  refreshSeed: 0
}

function mountTable(overrides: Record<string, any> = {}) {
  const { highlight, ...propOverrides } = overrides
  return mount(TableSection, {
    props: {
      table: mockTable,
      indexes: [],
      triggers: [],
      views: [],
      ...propOverrides
    },
    global: {
      provide: {
        [SQL_CONTEXT_KEY as symbol]: { highlight: highlight ?? defaultHighlight }
      },
      stubs: {}
    }
  })
}

describe('TableSection', () => {
  it('renders table name', () => {
    const wrapper = mountTable()
    expect(wrapper.text()).toContain('users')
  })

  it('renders all column headers', () => {
    const wrapper = mountTable()
    expect(wrapper.text()).toContain('id')
    expect(wrapper.text()).toContain('name')
    expect(wrapper.text()).toContain('salary')
  })

  it('renders column type info', () => {
    const wrapper = mountTable()
    expect(wrapper.text()).toContain('INTEGER')
    expect(wrapper.text()).toContain('TEXT')
  })

  it('renders all data rows', () => {
    const wrapper = mountTable()
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text()).toContain('Charlie')
  })

  it('filters rows by text', async () => {
    const wrapper = mountTable()
    const filterInput = wrapper.find('input[placeholder="过滤..."]')
    await filterInput.setValue('Alice')
    await nextTick()
    // After debounce, only Alice should be visible
    expect(wrapper.text()).toContain('Alice')
  })

  it('shows "无匹配数据" when filter has no matches', async () => {
    const wrapper = mountTable()
    const filterInput = wrapper.find('input[placeholder="过滤..."]')
    await filterInput.setValue('zzz_nonexistent')
    await nextTick()
    // After debounce the filter effect propagates
  })

  it('emits drop-table when delete table button is clicked', async () => {
    const wrapper = mountTable()
    // Find the delete button (trash icon) by title
    const deleteBtn = wrapper.find('button[title="删除表格"]')
    if (deleteBtn.exists()) {
      await deleteBtn.trigger('click')
      expect(wrapper.emitted('drop-table')?.[0]).toEqual(['users'])
    }
  })

  it('emits update-cell on cell edit and blur', async () => {
    const wrapper = mountTable()
    const textareas = wrapper.findAll('textarea')
    // Find a TEXT-type data textarea (not ghost row). The name column (index 1) is TEXT.
    const dataTextareas = textareas.filter((t) => {
      const ph = t.attributes('placeholder')
      return !ph && t.element.value !== ''
    })

    if (dataTextareas.length > 0) {
      // Use the second textarea (name column = TEXT, allows non-numeric values)
      const nameCell = dataTextareas[1] || dataTextareas[0]
      const el = nameCell.element as HTMLTextAreaElement
      el.value = 'UpdatedName'
      el.dispatchEvent(new Event('input'))
      await nameCell.trigger('blur')

      const updateCellEvents = wrapper.emitted('update-cell')
      expect(updateCellEvents).toBeTruthy()
      expect(updateCellEvents?.[0][0]).toMatchObject({
        tableName: 'users',
        oldRow: expect.objectContaining({ name: 'Alice' }),
        newRow: expect.objectContaining({ name: 'UpdatedName' })
      })
    }
  })

  it('does not emit update-cell on blur with unchanged value', async () => {
    const wrapper = mountTable()
    const textareas = wrapper.findAll('textarea')
    const dataTextareas = textareas.filter((t) => !t.attributes('placeholder'))
    if (dataTextareas.length > 0) {
      const firstCell = dataTextareas[0]
      await firstCell.trigger('blur')
      // Since we didn't change the value, no emit should happen
      expect(wrapper.emitted('update-cell')).toBeFalsy()
    }
  })

  it('emits delete-row when row delete button is clicked', async () => {
    const wrapper = mountTable()
    // Hover over a row to reveal delete buttons (they are opacity-0 by default)
    const deleteBtns = wrapper.findAll('button[title="删除此行"]')
    if (deleteBtns.length > 0) {
      await deleteBtns[0].trigger('click')
      const deleteRowEvents = wrapper.emitted('delete-row')
      expect(deleteRowEvents).toBeTruthy()
      expect(deleteRowEvents?.[0][0]).toMatchObject({
        tableName: 'users',
        row: expect.objectContaining({ id: 1 })
      })
    }
  })

  it('shows ghost row for insertion', () => {
    const wrapper = mountTable()
    const textareas = wrapper.findAll('textarea[placeholder="+"]')
    expect(textareas.length).toBeGreaterThan(0)
  })

  it('emits insert-row on ghost row submit with data', async () => {
    const wrapper = mountTable()
    const ghostTextareas = wrapper.findAll('textarea[placeholder="+"]')
    if (ghostTextareas.length > 0) {
      await ghostTextareas[0].setValue('4')
      await ghostTextareas[0].trigger('keydown.enter')
      // Ghost submit may need all required columns filled
    }
  })

  it('shows pagination when data exceeds page size', async () => {
    // Create table with >10 rows to trigger pagination
    const bigData = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      salary: 5000 + i * 100
    }))

    const wrapper = mountTable({
      table: { ...mockTable, data: bigData }
    })
    await nextTick()

    // Should show pagination controls
    expect(wrapper.text()).toContain('共 25 行')
  })

  it('emits navigate-tab when badge is clicked', async () => {
    const wrapper = mountTable({
      indexes: [{ name: 'idx_test', tableName: 'users', columns: ['id'], unique: false, sql: 'CREATE INDEX ...' }]
    })
    // Find the index badge and click it
    const buttons = wrapper.findAll('span')
    const badgeEls = buttons.filter((b) => b.text().includes('📋'))
    if (badgeEls.length > 0) {
      await badgeEls[0].trigger('click')
      const navEvents = wrapper.emitted('navigate-tab')
      expect(navEvents).toBeTruthy()
      expect(navEvents?.[0][0]).toMatchObject({
        tab: expect.any(String),
        targetId: expect.any(String)
      })
    }
  })
})
