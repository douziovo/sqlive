import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSortFilter, type SortField } from '@/composables/useSortFilter';

interface Item {
  id: number;
  name: string;
  count: number;
}

function makeItems(): Item[] {
  return [
    { id: 1, name: 'Alice', count: 10 },
    { id: 2, name: 'Bob', count: 30 },
    { id: 3, name: 'Cathy', count: 20 },
  ];
}

function makeFields(): SortField<Item>[] {
  return [
    { key: 'name', label: '名称', compare: (a, b) => a.name.localeCompare(b.name) },
    { key: 'count', label: '数量', compare: (a, b) => a.count - b.count },
  ];
}

function nameFilter(item: Item, f: string): boolean {
  return item.name.toLowerCase().includes(f) || String(item.count).includes(f);
}

describe('useSortFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function advanceDebounce(ms = 250) {
    await vi.advanceTimersByTimeAsync(ms);
  }

  it('returns all items initially with no filter or sort', () => {
    const items = vi.fn(makeItems);
    const { result } = useSortFilter(items, makeFields(), nameFilter);
    expect(result.value).toHaveLength(3);
  });

  it('filters items by name', async () => {
    const { result, filterText } = useSortFilter(() => makeItems(), makeFields(), nameFilter);
    filterText.value = 'ali';
    await advanceDebounce();
    expect(result.value).toHaveLength(1);
    expect(result.value[0].name).toBe('Alice');
  });

  it('filters items by numeric field', async () => {
    const { result, filterText } = useSortFilter(() => makeItems(), makeFields(), nameFilter);
    filterText.value = '20';
    await advanceDebounce();
    expect(result.value).toHaveLength(1);
    expect(result.value[0].name).toBe('Cathy');
  });

  it('returns all items when filter is empty', async () => {
    const { result, filterText } = useSortFilter(() => makeItems(), makeFields(), nameFilter);
    filterText.value = '';
    await advanceDebounce();
    expect(result.value).toHaveLength(3);
  });

  it('filters case-insensitively', async () => {
    const { result, filterText } = useSortFilter(() => makeItems(), makeFields(), nameFilter);
    filterText.value = 'BOB';
    await advanceDebounce();
    expect(result.value).toHaveLength(1);
    expect(result.value[0].name).toBe('Bob');
  });

  it('returns empty when no items match filter', async () => {
    const { result, filterText } = useSortFilter(() => makeItems(), makeFields(), nameFilter);
    filterText.value = 'zzz';
    await advanceDebounce();
    expect(result.value).toHaveLength(0);
  });

  it('sorts by name ascending', () => {
    const { result, toggleSort } = useSortFilter(() => makeItems(), makeFields(), nameFilter);
    toggleSort('name');
    expect(result.value.map(i => i.name)).toEqual(['Alice', 'Bob', 'Cathy']);
  });

  it('sorts by name descending on second toggle', () => {
    const { result, toggleSort } = useSortFilter(() => makeItems(), makeFields(), nameFilter);
    toggleSort('name');
    toggleSort('name');
    expect(result.value.map(i => i.name)).toEqual(['Cathy', 'Bob', 'Alice']);
  });

  it('cancels sort on third toggle', () => {
    const { result, toggleSort } = useSortFilter(() => makeItems(), makeFields(), nameFilter);
    toggleSort('name');
    toggleSort('name');
    toggleSort('name');
    expect(result.value.map(i => i.name)).toEqual(['Alice', 'Bob', 'Cathy']);
  });

  it('switches sort column on different key', () => {
    const { result, toggleSort } = useSortFilter(() => makeItems(), makeFields(), nameFilter);
    toggleSort('name');
    toggleSort('count');
    expect(result.value.map(i => i.count)).toEqual([10, 20, 30]);
  });

  it('chains filter then sort', async () => {
    const { result, filterText, toggleSort } = useSortFilter(
      () => makeItems(), makeFields(), nameFilter,
    );
    filterText.value = '1';
    await advanceDebounce();
    // Alice count=10 includes '1', Bob count=30 (no '1'), Cathy count=20 (no '1')
    expect(result.value).toHaveLength(1);

    // Clear filter, sort by count desc
    filterText.value = '';
    await advanceDebounce();
    toggleSort('count');
    toggleSort('count');
    expect(result.value.map(i => i.count)).toEqual([30, 20, 10]);
  });

  it('debounces filter by 200ms', async () => {
    const { result, filterText } = useSortFilter(() => makeItems(), makeFields(), nameFilter);

    filterText.value = 'ali';
    // Immediately after setting, debounce hasn't fired yet
    await vi.advanceTimersByTimeAsync(100);
    expect(result.value).toHaveLength(3);

    await vi.advanceTimersByTimeAsync(150);
    expect(result.value).toHaveLength(1);
  });

  it('totalCount reflects all items, filteredCount reflects current result', async () => {
    const { totalCount, filteredCount, filterText } = useSortFilter(
      () => makeItems(), makeFields(), nameFilter,
    );
    expect(totalCount.value).toBe(3);
    expect(filteredCount.value).toBe(3);

    filterText.value = 'ali';
    await advanceDebounce();
    expect(totalCount.value).toBe(3);
    expect(filteredCount.value).toBe(1);
  });

  it('handles empty items array', () => {
    const { result, totalCount, filteredCount } = useSortFilter(
      () => [], makeFields(), nameFilter,
    );
    expect(result.value).toHaveLength(0);
    expect(totalCount.value).toBe(0);
    expect(filteredCount.value).toBe(0);
  });
});
