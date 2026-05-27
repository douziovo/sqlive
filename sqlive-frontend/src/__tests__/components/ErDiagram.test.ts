import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ErDiagram from '../../components/er/ErDiagram.vue';
import type { TableSchema } from '@/model/DatabaseTypes';

const mockTables: TableSchema[] = [
  {
    name: 'users',
    columns: ['id', 'name', 'dept_id'],
    columnTypes: { id: 'INTEGER | PRIMARY KEY', name: 'TEXT | NOT NULL', dept_id: 'INTEGER' },
    data: [],
  },
  {
    name: 'departments',
    columns: ['id', 'name'],
    columnTypes: { id: 'INTEGER | PRIMARY KEY', name: 'TEXT | UNIQUE' },
    data: [],
  },
];

const stubs = {
  VueFlow: true,
  Background: true,
  MiniMap: true,
  ErTableNode: true,
};

describe('ErDiagram', () => {
  it('shows empty state when no tables', () => {
    const wrapper = mount(ErDiagram, {
      props: { tables: [], foreignKeys: [] },
      global: { stubs },
    });

    expect(wrapper.text()).toContain('暂无数据表');
  });

  it('renders VueFlow area when tables exists', () => {
    const wrapper = mount(ErDiagram, {
      props: { tables: mockTables, foreignKeys: [] },
      global: { stubs },
    });

    // Should NOT show empty state
    expect(wrapper.text()).not.toContain('暂无数据表');
  });

  it('renders ErToolbar', () => {
    const wrapper = mount(ErDiagram, {
      props: { tables: mockTables, foreignKeys: [] },
      global: { stubs },
    });

    // Verifies the component mounts and includes ErToolbar stub
    expect(wrapper.findComponent({ name: 'ErToolbar' }).exists()).toBe(true);
  });

  it('renders ErSearchBar', () => {
    const wrapper = mount(ErDiagram, {
      props: { tables: mockTables, foreignKeys: [] },
      global: { stubs },
    });

    expect(wrapper.findComponent({ name: 'ErSearchBar' }).exists()).toBe(true);
  });

  it('handles empty foreignKeys gracefully', () => {
    const wrapper = mount(ErDiagram, {
      props: { tables: mockTables, foreignKeys: [] },
      global: { stubs },
    });

    // Should render without errors
    expect(wrapper.exists()).toBe(true);
  });

  it('handles foreignKeys with tables', () => {
    const wrapper = mount(ErDiagram, {
      props: {
        tables: mockTables,
        foreignKeys: [
          { name: 'fk_dept', fromTable: 'users', fromColumn: 'dept_id', toTable: 'departments', toColumn: 'id' },
        ],
      },
      global: { stubs },
    });

    expect(wrapper.exists()).toBe(true);
  });
});
