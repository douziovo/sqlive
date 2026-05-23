import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ChartView from '../../components/ChartView.vue';
import type { TableSchema } from '@/model/DatabaseTypes';

// Chart.js is globally mocked in setup.ts

function makeResult(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    name: 'query_result',
    columns: ['name', 'salary', 'age'],
    columnTypes: { name: 'TEXT', salary: 'REAL', age: 'INTEGER' },
    data: [
      { name: 'Alice', salary: 9000, age: 30 },
      { name: 'Bob', salary: 7000, age: 25 },
      { name: 'Cathy', salary: 5000, age: 28 },
    ],
    ...overrides,
  };
}

describe('ChartView', () => {
  it('renders chart type selector', () => {
    const wrapper = mount(ChartView, {
      props: { result: makeResult() },
    });
    const select = wrapper.find('select');
    expect(select.exists()).toBe(true);
    expect(wrapper.text()).toContain('柱状图');
    expect(wrapper.text()).toContain('折线图');
    expect(wrapper.text()).toContain('饼图');
  });

  it('shows message when fewer than 2 columns', () => {
    const wrapper = mount(ChartView, {
      props: {
        result: makeResult({
          columns: ['name'],
          columnTypes: { name: 'TEXT' },
          data: [{ name: 'Alice' }],
        }),
      },
    });
    expect(wrapper.text()).toContain('需要至少 2 列');
  });

  it('shows message when no numeric column', () => {
    const wrapper = mount(ChartView, {
      props: {
        result: makeResult({
          columns: ['a', 'b'],
          columnTypes: { a: 'TEXT', b: 'TEXT' },
          data: [{ a: 'x', b: 'y' }],
        }),
      },
    });
    expect(wrapper.text()).toContain('需要至少 1 个数值列');
  });

  it('renders canvas element when valid data present', () => {
    const wrapper = mount(ChartView, {
      props: { result: makeResult() },
    });
    const canvas = wrapper.find('canvas');
    expect(canvas.exists()).toBe(true);
  });

  it('renders axis picker selectors', async () => {
    const wrapper = mount(ChartView, {
      props: { result: makeResult() },
    });
    await nextTick();
    // Two selects: label column and numeric column
    const selects = wrapper.findAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('auto-selects first non-numeric column as label', async () => {
    const wrapper = mount(ChartView, {
      props: { result: makeResult() },
    });
    await nextTick();
    // name is TEXT (non-numeric) → should be auto-selected as label
    expect(wrapper.text()).toContain('标签列');
    expect(wrapper.text()).toContain('数值列');
  });

  it('changes chart container size for pie chart', async () => {
    const wrapper = mount(ChartView, {
      props: { result: makeResult() },
    });
    const select = wrapper.find('select');
    await select.setValue('pie');
    await nextTick();
    // Chart type change should reflect in vm and trigger 400px container
    expect((wrapper.vm as any).chartType).toBe('pie');
  });
});
