import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';

export interface PreviewItem {
  id: string;
  icon: string;
  label: string;
  meta: string[];
  sqlPreview?: string;
  tag?: string;
  accent?: 'blue' | 'none';
}

export function useFilteredList(
  items: Ref<PreviewItem[]>,
  filterText: Ref<string>,
) {
  const hoveredIndex = ref<number | null>(null);
  const keyboardIndex = ref<number | null>(null);

  const filteredItems = computed(() => {
    const f = filterText.value.trim().toLowerCase();
    const source = items.value;
    if (!f) return source;
    return source.filter(item =>
      item.label.toLowerCase().includes(f)
      || item.meta.some(m => m.toLowerCase().includes(f))
      || (item.sqlPreview || '').toLowerCase().includes(f)
      || (item.tag || '').toLowerCase().includes(f)
    );
  });

  const selectedItem = computed(() => {
    if (hoveredIndex.value !== null && filteredItems.value[hoveredIndex.value]) {
      return filteredItems.value[hoveredIndex.value];
    }
    if (keyboardIndex.value !== null && filteredItems.value[keyboardIndex.value]) {
      return filteredItems.value[keyboardIndex.value];
    }
    return undefined;
  });

  function navigateDown() {
    keyboardIndex.value = keyboardIndex.value === null
      ? 0
      : Math.min(keyboardIndex.value + 1, filteredItems.value.length - 1);
    hoveredIndex.value = keyboardIndex.value;
  }

  function navigateUp() {
    keyboardIndex.value = keyboardIndex.value === null
      ? filteredItems.value.length - 1
      : Math.max(keyboardIndex.value - 1, 0);
    hoveredIndex.value = keyboardIndex.value;
  }

  function resetSelection() {
    hoveredIndex.value = null;
    keyboardIndex.value = null;
  }

  watch(filterText, resetSelection);
  watch(items, resetSelection);

  return {
    filteredItems,
    hoveredIndex,
    keyboardIndex,
    selectedItem,
    navigateUp,
    navigateDown,
    resetSelection,
  };
}
