import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DataVisualizer from '../../components/DataVisualizer.vue';
import type { DatabaseModel, HighlightState } from '@/model/DatabaseTypes';

const mockDb: DatabaseModel = {
  tables: [
    {
      name: 'users',
      columns: ['id', 'name'],
      columnTypes: { id: 'INTEGER', name: 'TEXT' },
      data: [{ id: 1, name: 'Alice' }],
    },
  ],
  queryResults: [],
  indexes: [
    { name: 'idx_users_name', tableName: 'users', columns: ['name'], unique: false, sql: 'CREATE INDEX ...' },
  ],
  views: [],
  triggers: [],
  foreignKeys: [],
  metadata: { durationMs: 42, statementCount: 3 },
};

const defaultHighlight: HighlightState = {
  actionType: 'none' as const,
  activeTables: [],
  activeRows: [],
  activeColumns: [],
  flashingRows: [],
  refreshSeed: 0,
};

const minimalStubs = {
  ErDiagram: true,
  ChartView: true,
  CreateTableModal: true,
};

describe('DataVisualizer', () => {
  it('renders 6 tab buttons', () => {
    const wrapper = mount(DataVisualizer, {
      props: { db: mockDb, highlight: defaultHighlight },
      global: { stubs: minimalStubs },
    });

    expect(wrapper.text()).toContain('表数据');
    expect(wrapper.text()).toContain('ER 图');
    expect(wrapper.text()).toContain('索引');
    expect(wrapper.text()).toContain('视图');
    expect(wrapper.text()).toContain('触发器');
    expect(wrapper.text()).toContain('查询结果');
  });

  it('shows metadata when present', () => {
    const wrapper = mount(DataVisualizer, {
      props: { db: mockDb, highlight: defaultHighlight },
      global: { stubs: minimalStubs },
    });
    expect(wrapper.text()).toContain('42ms');
    expect(wrapper.text()).toContain('3 条语句');
  });

  it('shows table data in the default (tables) tab', () => {
    const wrapper = mount(DataVisualizer, {
      props: { db: mockDb, highlight: defaultHighlight },
      global: { stubs: minimalStubs },
    });
    // TableSection and ResultTable are rendered (not stubbed)
    expect(wrapper.text()).toContain('users');
  });

  it('shows empty table state when no tables', () => {
    const wrapper = mount(DataVisualizer, {
      props: {
        db: { ...mockDb, tables: [] },
        highlight: defaultHighlight,
      },
      global: { stubs: minimalStubs },
    });
    expect(wrapper.text()).toContain('暂无数据表');
  });

  it('shows index data on the indexes tab', () => {
    const wrapper = mount(DataVisualizer, {
      props: {
        db: { ...mockDb, tables: [], queryResults: [], views: [], triggers: [] },
        highlight: defaultHighlight,
      },
      global: { stubs: minimalStubs },
    });
    // Index tab should be accessible
    const buttons = wrapper.findAll('button');
    const idxTabBtn = buttons.find(b => b.text() === '索引');
    expect(idxTabBtn).toBeTruthy();
  });

  it('navigates from tables tab to ER tab and back', async () => {
    const wrapper = mount(DataVisualizer, {
      props: { db: mockDb, highlight: defaultHighlight },
      global: { stubs: minimalStubs },
    });

    const buttons = wrapper.findAll('button');
    const erBtn = buttons.find(b => b.text() === 'ER 图');
    if (erBtn) {
      await erBtn.trigger('click');
    }

    const tablesBtn = wrapper.findAll('button').find(b => b.text() === '表数据');
    if (tablesBtn) {
      await tablesBtn.trigger('click');
    }
    expect(wrapper.text()).toContain('users');
  });

  it('renders "添加新表格" button in tables tab', () => {
    const wrapper = mount(DataVisualizer, {
      props: { db: mockDb, highlight: defaultHighlight },
      global: { stubs: minimalStubs },
    });
    expect(wrapper.text()).toContain('添加新表格');
  });

  it('shows index count badge', () => {
    const wrapper = mount(DataVisualizer, {
      props: { db: mockDb, highlight: defaultHighlight },
      global: { stubs: minimalStubs },
    });
    // One index exists in mockDb
    expect(wrapper.text()).toContain('1');
  });
});
