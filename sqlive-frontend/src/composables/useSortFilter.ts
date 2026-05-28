import { watchDebounced } from '@vueuse/core'
import type { ComputedRef, Ref } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

export interface SortField<T> {
  key: string
  label: string
  compare: (a: T, b: T) => number
}

export interface PaginationOptions {
  pageSize?: number | Ref<number>
}

export function useSortFilter<T>(
  items: () => T[],
  sortFields: SortField<T>[] | ComputedRef<SortField<T>[]>,
  filterFn: (item: T, filter: string) => boolean,
  pagination?: PaginationOptions
) {
  const resolvedSortFields = computed(() => toValue(sortFields))
  const sortKey = ref<string | null>(null)
  const sortDir = ref<'asc' | 'desc' | null>(null)
  const filterText = ref('')

  const pageSize = computed({
    get: () => toValue(pagination?.pageSize) ?? 10,
    set: () => {} // readonly from our side — synced via watch
  })
  const currentPage = ref(1)

  const debouncedFilter = ref('')

  watchDebounced(
    filterText,
    (val) => {
      debouncedFilter.value = val
    },
    { debounce: 200 }
  )

  // Reset page when filter or sort changes
  watch([debouncedFilter, sortKey, sortDir], () => {
    currentPage.value = 1
  })

  function toggleSort(key: string) {
    if (sortKey.value !== key) {
      sortKey.value = key
      sortDir.value = 'asc'
    } else if (sortDir.value === 'asc') {
      sortDir.value = 'desc'
    } else {
      sortKey.value = null
      sortDir.value = null
    }
  }

  const filtered = computed(() => {
    let data = items()

    const f = debouncedFilter.value.trim().toLowerCase()
    if (f) {
      data = data.filter((item) => filterFn(item, f))
    }

    if (sortKey.value && sortDir.value) {
      const field = resolvedSortFields.value.find((sf) => sf.key === sortKey.value)
      if (field) {
        const dir = sortDir.value
        data = [...data].sort((a, b) => {
          const cmp = field.compare(a, b)
          return dir === 'asc' ? cmp : -cmp
        })
      }
    }

    return data
  })

  const result = computed(() => {
    if (!pagination) return filtered.value
    const ps = pageSize.value
    const start = (currentPage.value - 1) * ps
    return filtered.value.slice(start, start + ps)
  })

  const totalCount = computed(() => items().length)
  const filteredCount = computed(() => filtered.value.length)
  const totalPages = computed(() => (pagination ? Math.max(1, Math.ceil(filteredCount.value / pageSize.value)) : 1))

  return {
    sortKey,
    sortDir,
    filterText,
    toggleSort,
    result,
    totalCount,
    filteredCount,
    currentPage,
    pageSize,
    totalPages
  }
}
