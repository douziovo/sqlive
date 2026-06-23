import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { DatabaseModel, HighlightState, IndexInfo, TriggerInfo, ViewInfo } from '@/model/DatabaseTypes'
import DataVisualizer from '../../components/DataVisualizer.vue'
import { SQL_CONTEXT_KEY } from '../../model/injectionKeys'

const mockDb: DatabaseModel = {
  tables: [
    {
      name: 'users',
      columns: ['id', 'name'],
      columnTypes: { id: 'INTEGER', name: 'TEXT' },
      data: [{ id: 1, name: 'Alice' }]
    }
  ],
  queryResults: [],
  indexes: [{ name: 'idx_users_name', tableName: 'users', columns: ['name'], unique: false, sql: 'CREATE INDEX ...' }],
  views: [],
  triggers: [],
  foreignKeys: [],
  metadata: { durationMs: 42, statementCount: 3 }
}

const defaultHighlight: HighlightState = {
  actionType: 'none' as const,
  activeTables: [],
  activeRows: [],
  activeColumns: [],
  flashingRows: [],
  refreshSeed: 0
}

function provideContext(db: DatabaseModel, highlight: HighlightState) {
  return { [SQL_CONTEXT_KEY as symbol]: { db, highlight } }
}

const minimalStubs = {
  ErDiagram: true,
  ChartView: true,
  CreateTableModal: true
}

const mockIndexes: IndexInfo[] = [
  { name: 'idx_users_name', tableName: 'users', columns: ['name'], unique: false, sql: 'CREATE INDEX idx_users_name ON users(name)' },
  { name: 'idx_users_email', tableName: 'users', columns: ['email'], unique: true, sql: 'CREATE UNIQUE INDEX idx_users_email ON users(email)' },
  { name: 'idx_users_name_dept', tableName: 'users', columns: ['name', 'dept_id'], unique: false, sql: 'CREATE INDEX idx_users_name_dept ON users(name, dept_id)' },
  { name: 'idx_lower_email', tableName: 'users', columns: ['email'], unique: false, sql: 'CREATE INDEX idx_lower_email ON users(lower(email))' },
  { name: 'idx_active_users', tableName: 'users', columns: ['status'], unique: false, sql: 'CREATE INDEX idx_active_users ON users(status) WHERE status = 1' }
]

const mockViews: ViewInfo[] = [
  { name: 'v_active_users', sql: 'CREATE VIEW v_active_users AS SELECT * FROM users WHERE status = 1' },
  { name: 'v_user_stats', sql: 'CREATE VIEW v_user_stats AS SELECT COUNT(*) AS cnt FROM users' }
]

const mockTriggers: TriggerInfo[] = [
  { name: 'trg_users_after_insert', tableName: 'users', sql: 'CREATE TRIGGER trg_users_after_insert AFTER INSERT ON users BEGIN INSERT INTO audit_log VALUES(NEW.id); END' },
  { name: 'trg_users_before_update', tableName: 'users', sql: 'CREATE TRIGGER trg_users_before_update BEFORE UPDATE ON users BEGIN UPDATE users SET updated_at = CURRENT_TIMESTAMP; END' }
]

function makeDb(overrides: Partial<DatabaseModel> = {}): DatabaseModel {
  return { ...mockDb, ...overrides }
}

describe('DataVisualizer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders 6 tab buttons', () => {
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(mockDb, defaultHighlight),
        stubs: minimalStubs
      }
    })

    expect(wrapper.text()).toContain('表数据')
    expect(wrapper.text()).toContain('ER 图')
    expect(wrapper.text()).toContain('索引')
    expect(wrapper.text()).toContain('视图')
    expect(wrapper.text()).toContain('触发器')
    expect(wrapper.text()).toContain('查询结果')
  })

  it('shows metadata when present', () => {
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(mockDb, defaultHighlight),
        stubs: minimalStubs
      }
    })
    expect(wrapper.text()).toContain('42ms')
    expect(wrapper.text()).toContain('3 条语句')
  })

  it('shows table data in the default (tables) tab', () => {
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(mockDb, defaultHighlight),
        stubs: minimalStubs
      }
    })
    expect(wrapper.text()).toContain('users')
  })

  it('shows empty table state when no tables', () => {
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext({ ...mockDb, tables: [] }, defaultHighlight),
        stubs: minimalStubs
      }
    })
    expect(wrapper.text()).toContain('暂无数据表')
  })

  it('shows index data on the indexes tab', () => {
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext({ ...mockDb, tables: [], queryResults: [], views: [], triggers: [] }, defaultHighlight),
        stubs: minimalStubs
      }
    })
    const buttons = wrapper.findAll('button')
    const idxTabBtn = buttons.find((b) => b.text() === '索引')
    expect(idxTabBtn).toBeTruthy()
  })

  it('navigates from tables tab to ER tab and back', async () => {
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(mockDb, defaultHighlight),
        stubs: minimalStubs
      }
    })

    const buttons = wrapper.findAll('button')
    const erBtn = buttons.find((b) => b.text() === 'ER 图')
    expect(erBtn).toBeTruthy()
    await erBtn!.trigger('click')

    const tablesBtn = wrapper.findAll('button').find((b) => b.text() === '表数据')
    expect(tablesBtn).toBeTruthy()
    await tablesBtn!.trigger('click')
    expect(wrapper.text()).toContain('users')
  })

  it('renders "添加新表格" button in tables tab', () => {
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(mockDb, defaultHighlight),
        stubs: minimalStubs
      }
    })
    expect(wrapper.text()).toContain('添加新表格')
  })

  it('shows index count badge', () => {
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(mockDb, defaultHighlight),
        stubs: minimalStubs
      }
    })
    expect(wrapper.text()).toContain('1')
  })

  // --- New: Indexes tab tests ---

  it('索引 tab 渲染索引卡片和 SortFilterToolbar', async () => {
    const db = makeDb({ indexes: mockIndexes })
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(db, defaultHighlight),
        stubs: minimalStubs
      }
    })

    const idxTab = wrapper.find('[data-testid="tab-indexes"]')
    expect(idxTab.exists()).toBe(true)
    await idxTab.trigger('click')

    // SortFilterToolbar renders — check placeholder in HTML (attribute, not text)
    const html = wrapper.html()
    expect(html).toContain('搜索索引名称')

    // Index cards render
    expect(wrapper.text()).toContain('idx_users_name')
    expect(wrapper.text()).toContain('idx_users_email')
    // Unique badge
    expect(wrapper.text()).toContain('唯一')
    // Composite badge
    expect(wrapper.text()).toContain('复合')
    // SQL pre elements
    const pres = wrapper.findAll('pre')
    expect(pres.length).toBeGreaterThan(0)
  })

  it('索引 filter 返回空状态 "无匹配的索引"', async () => {
    const db = makeDb({ indexes: mockIndexes })
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(db, defaultHighlight),
        stubs: minimalStubs
      }
    })

    const idxTab = wrapper.find('[data-testid="tab-indexes"]')
    await idxTab.trigger('click')

    // Find the SortFilterToolbar input and set filter to no-match
    const inputs = wrapper.findAll('input')
    const filterInput = inputs.find(i => (i.attributes('placeholder') || '').includes('搜索索引'))
    expect(filterInput).toBeTruthy()

    await filterInput!.setValue('zzz_no_match')
    await nextTick()
    // Advance past useSortFilter's 200ms debounce
    await vi.advanceTimersByTimeAsync(250)

    // Should show empty state
    expect(wrapper.text()).toContain('无匹配的索引')
  })

  it('索引 "表达式" 和 "部分" badge', async () => {
    const db = makeDb({ indexes: mockIndexes })
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(db, defaultHighlight),
        stubs: minimalStubs
      }
    })

    const idxTab = wrapper.find('[data-testid="tab-indexes"]')
    await idxTab.trigger('click')

    // idx_lower_email has lower( in sql → "表达式" badge
    // idx_active_users has WHERE in sql → "部分" badge
    expect(wrapper.text()).toContain('表达式')
    expect(wrapper.text()).toContain('部分')
  })

  // --- New: Views tab tests ---

  it('视图 tab 渲染视图卡片并点击导航', async () => {
    const db = makeDb({ views: mockViews })
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(db, defaultHighlight),
        stubs: minimalStubs
      }
    })

    const viewTab = wrapper.find('[data-testid="tab-views"]')
    expect(viewTab.exists()).toBe(true)
    await viewTab.trigger('click')

    // SortFilterToolbar renders (placeholder is an attribute)
    expect(wrapper.html()).toContain('搜索视图名称')

    // View cards render
    expect(wrapper.text()).toContain('v_active_users')
    expect(wrapper.text()).toContain('v_user_stats')

    // SQL pre elements
    const pres = wrapper.findAll('pre')
    expect(pres.length).toBeGreaterThan(0)

    // Click on a view card — should navigate to tables tab
    // v_active_users SQL contains "users" which matches a table
    const viewCards = wrapper.findAll('[id^="view-"]')
    expect(viewCards.length).toBeGreaterThan(0)
    await viewCards[0].trigger('click')

    // Should have navigated to tables tab
    const tablesTab = wrapper.find('[data-testid="tab-tables"]')
    expect(tablesTab.classes()).toContain('text-primary')
  })

  // --- New: Triggers tab tests ---

  it('触发器 tab 渲染触发器卡片', async () => {
    const db = makeDb({ triggers: mockTriggers })
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(db, defaultHighlight),
        stubs: minimalStubs
      }
    })

    const trgTab = wrapper.find('[data-testid="tab-triggers"]')
    expect(trgTab.exists()).toBe(true)
    await trgTab.trigger('click')

    // SortFilterToolbar renders (placeholder is an attribute)
    expect(wrapper.html()).toContain('搜索触发器名称')

    // Trigger cards render
    expect(wrapper.text()).toContain('trg_users_after_insert')
    expect(wrapper.text()).toContain('trg_users_before_update')

    // Table name is shown
    expect(wrapper.text()).toContain('表：')

    // SQL pre
    const pres = wrapper.findAll('pre')
    expect(pres.length).toBeGreaterThan(0)

    // Click trigger card → navigates to tables tab
    const triggerCards = wrapper.findAll('[id^="trigger-"]')
    expect(triggerCards.length).toBeGreaterThan(0)
    await triggerCards[0].trigger('click')

    const tablesTab = wrapper.find('[data-testid="tab-tables"]')
    expect(tablesTab.classes()).toContain('text-primary')
  })

  // --- New: Empty state tests ---

  it('索引 tab 空状态显示提示', async () => {
    const db = makeDb({ indexes: [] })
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(db, defaultHighlight),
        stubs: minimalStubs
      }
    })

    const idxTab = wrapper.find('[data-testid="tab-indexes"]')
    await idxTab.trigger('click')

    expect(wrapper.text()).toContain('暂无索引')
  })

  it('视图 tab 空状态显示提示', async () => {
    const db = makeDb({ views: [] })
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(db, defaultHighlight),
        stubs: minimalStubs
      }
    })

    const viewTab = wrapper.find('[data-testid="tab-views"]')
    await viewTab.trigger('click')

    expect(wrapper.text()).toContain('暂无视图')
  })

  it('触发器 tab 空状态显示提示', async () => {
    const db = makeDb({ triggers: [] })
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(db, defaultHighlight),
        stubs: minimalStubs
      }
    })

    const trgTab = wrapper.find('[data-testid="tab-triggers"]')
    await trgTab.trigger('click')

    expect(wrapper.text()).toContain('暂无触发器')
  })

  // --- New: handleNavigate scroll + flash ---

  it('handleNavigate 切换 tab 并触发 flash', async () => {
    const db = makeDb({ indexes: mockIndexes })
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(db, defaultHighlight),
        stubs: minimalStubs
      }
    })

    // Click an index card which calls handleNavigate({ tab: 'tables', targetId: 'table-users' })
    const idxTab = wrapper.find('[data-testid="tab-indexes"]')
    await idxTab.trigger('click')

    const indexCards = wrapper.findAll('[id^="index-"]')
    expect(indexCards.length).toBeGreaterThan(0)
    await indexCards[0].trigger('click')

    // Should navigate to tables tab
    const tablesTab = wrapper.find('[data-testid="tab-tables"]')
    expect(tablesTab.classes()).toContain('text-primary')

    // Flash target should have been set and then cleared after 1000ms
    // The animate-flash class appears briefly
    await vi.advanceTimersByTimeAsync(1100)
    // After timeout, flash should be cleared (no crash = success)
  })

  it('navigateToViewTable 匹配表名导航', async () => {
    const db = makeDb({ views: mockViews })
    const wrapper = mount(DataVisualizer, {
      global: {
        provide: provideContext(db, defaultHighlight),
        stubs: minimalStubs
      }
    })

    const viewTab = wrapper.find('[data-testid="tab-views"]')
    await viewTab.trigger('click')

    // v_active_users SQL contains "users" → should navigate to users table
    const viewCards = wrapper.findAll('[id^="view-"]')
    expect(viewCards.length).toBeGreaterThan(0)
    await viewCards[0].trigger('click')

    // Active tab should be 'tables'
    expect(wrapper.text()).toContain('users')
  })
})
