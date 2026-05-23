import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { useTablePipeline } from '@/composables/useTablePipeline';
import type { Row } from '@/model/DatabaseTypes';

function makeData(): Row[] {
  return [
    { id: 3, name: 'Charlie', salary: 5000 },
    { id: 1, name: 'Alice', salary: 9000 },
    { id: 2, name: 'Bob', salary: 7000 },
    { id: 4, name: null, salary: null },
  ];
}

function makeColumnTypes(): Record<string, string> {
  return { id: 'INTEGER', name: 'TEXT', salary: 'REAL' };
}

describe('useTablePipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function advanceDebounce(ms = 250) {
    await vi.advanceTimersByTimeAsync(ms);
  }

  it('returns all data initially in original order', () => {
    const { paginatedData } = useTablePipeline(makeData, makeColumnTypes);
    expect(paginatedData.value).toHaveLength(4);
    expect(paginatedData.value[0].name).toBe('Charlie');
  });

  it('toggleSort cycles: asc → desc → none', () => {
    const { sortColumn, sortDir, paginatedData, toggleSort } = useTablePipeline(makeData, makeColumnTypes);

    toggleSort('id');
    expect(sortColumn.value).toBe('id');
    expect(sortDir.value).toBe('asc');

    toggleSort('id');
    expect(sortDir.value).toBe('desc');

    toggleSort('id');
    expect(sortColumn.value).toBeNull();
    expect(sortDir.value).toBeNull();
    // Back to original order (paginatedData is internal, paginatedData reflects it)
    expect(paginatedData.value[0].name).toBe('Charlie');
  });

  it('switches sort column', () => {
    const { sortColumn, toggleSort } = useTablePipeline(makeData, makeColumnTypes);
    toggleSort('id');
    toggleSort('salary');
    expect(sortColumn.value).toBe('salary');
  });

  it('sorts numeric column numerically', () => {
    const { paginatedData, toggleSort } = useTablePipeline(makeData, makeColumnTypes);
    toggleSort('salary');
    const salaries = paginatedData.value.map(r => r.salary).filter(s => s !== null);
    expect(salaries).toEqual([5000, 7000, 9000]);
  });

  it('sorts text column lexicographically', () => {
    const { paginatedData, toggleSort } = useTablePipeline(makeData, makeColumnTypes);
    toggleSort('name');
    const names = paginatedData.value.map(r => r.name).filter(n => n !== null);
    expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('pushes null values to the end on sort', () => {
    const { paginatedData, toggleSort } = useTablePipeline(makeData, makeColumnTypes);
    toggleSort('salary');
    const last = paginatedData.value[paginatedData.value.length - 1];
    expect(last.salary).toBeNull();
  });

  it('filters by text column', async () => {
    const { paginatedData, filterText } = useTablePipeline(makeData, makeColumnTypes);
    filterText.value = 'ali';
    await advanceDebounce();
    expect(paginatedData.value).toHaveLength(1);
    expect(paginatedData.value[0].name).toBe('Alice');
  });

  it('filters by numeric column', async () => {
    const { paginatedData, filterText } = useTablePipeline(makeData, makeColumnTypes);
    filterText.value = '7000';
    await advanceDebounce();
    expect(paginatedData.value).toHaveLength(1);
    expect(paginatedData.value[0].name).toBe('Bob');
  });

  it('returns empty when filter matches nothing', async () => {
    const { paginatedData, filterText } = useTablePipeline(makeData, makeColumnTypes);
    filterText.value = 'xyz';
    await advanceDebounce();
    expect(paginatedData.value).toHaveLength(0);
  });

  it('paginates: first page with pageSize=2', () => {
    const { paginatedData, pageSize } = useTablePipeline(makeData, makeColumnTypes);
    pageSize.value = 2;
    expect(paginatedData.value).toHaveLength(2);
    expect(paginatedData.value[0].name).toBe('Charlie');
  });

  it('paginates: second page', () => {
    const { paginatedData, pageSize, currentPage } = useTablePipeline(makeData, makeColumnTypes);
    pageSize.value = 2;
    currentPage.value = 2;
    expect(paginatedData.value).toHaveLength(2);
  });

  it('calculates totalPages correctly', () => {
    const { totalPages, pageSize } = useTablePipeline(makeData, makeColumnTypes);
    pageSize.value = 2;
    expect(totalPages.value).toBe(2);

    pageSize.value = 3;
    expect(totalPages.value).toBe(2);

    pageSize.value = 5;
    expect(totalPages.value).toBe(1);
  });

  it('resets to page 1 when filter changes', async () => {
    const { currentPage, filterText } = useTablePipeline(makeData, makeColumnTypes);
    currentPage.value = 2;
    filterText.value = 'ali';
    await advanceDebounce();
    expect(currentPage.value).toBe(1);
  });

  it('resets to page 1 when sort changes', async () => {
    const { currentPage, toggleSort } = useTablePipeline(makeData, makeColumnTypes);
    currentPage.value = 2;
    toggleSort('id');
    await nextTick();
    expect(currentPage.value).toBe(1);
  });

  it('debounces filter by 200ms', async () => {
    const { paginatedData, filterText } = useTablePipeline(makeData, makeColumnTypes);
    filterText.value = 'ali';
    await vi.advanceTimersByTimeAsync(100);
    expect(paginatedData.value).toHaveLength(4); // not yet filtered

    await vi.advanceTimersByTimeAsync(150);
    expect(paginatedData.value).toHaveLength(1);
  });

  it('handles empty data gracefully', () => {
    const { paginatedData, totalRows, totalPages } = useTablePipeline(() => [], makeColumnTypes);
    expect(paginatedData.value).toHaveLength(0);
    expect(totalRows.value).toBe(0);
    expect(totalPages.value).toBe(1);
  });

  it('sorts all-null column without crashing', () => {
    const allNullData = () => [
      { id: 1, name: 'Alice', salary: null },
      { id: 2, name: 'Bob', salary: null },
    ];
    const { paginatedData, toggleSort } = useTablePipeline(allNullData, makeColumnTypes);
    toggleSort('salary');
    // All null values should just be pushed to end, no crash
    expect(paginatedData.value).toHaveLength(2);
  });
});
