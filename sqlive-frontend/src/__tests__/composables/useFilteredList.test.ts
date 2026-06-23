import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { type PreviewItem, useFilteredList } from '@/composables/useFilteredList'

function makeItems(): PreviewItem[] {
  return [
    { id: '1', icon: 'table', label: 'Users', meta: ['id', 'name', 'email'], sqlPreview: 'SELECT * FROM users', tag: 'table' },
    { id: '2', icon: 'table', label: 'Orders', meta: ['id', 'user_id', 'total'], sqlPreview: 'SELECT * FROM orders', tag: 'table' },
    { id: '3', icon: 'view', label: 'UserStats', meta: ['user_id', 'login_count'], sqlPreview: 'SELECT * FROM user_stats', tag: 'view' }
  ]
}

describe('useFilteredList', () => {
  it('returns all items when filter text is empty', () => {
    const items = ref(makeItems())
    const filterText = ref('')
    const { filteredItems } = useFilteredList(items, filterText)
    expect(filteredItems.value).toHaveLength(3)
  })

  it('returns all items when filter text is whitespace only', () => {
    const items = ref(makeItems())
    const filterText = ref('   ')
    const { filteredItems } = useFilteredList(items, filterText)
    expect(filteredItems.value).toHaveLength(3)
  })

  it('filters items by label', () => {
    const items = ref(makeItems())
    const filterText = ref('users')
    const { filteredItems } = useFilteredList(items, filterText)
    // 'users' matches 'Users' (label) and 'UserStats' (meta has 'user_id' + sqlPreview has 'user_stats')
    expect(filteredItems.value).toHaveLength(2)
    expect(filteredItems.value[0].label).toBe('Users')
    expect(filteredItems.value[1].label).toBe('UserStats')
  })

  it('filters items by meta field', () => {
    const items = ref(makeItems())
    const filterText = ref('email')
    const { filteredItems } = useFilteredList(items, filterText)
    expect(filteredItems.value).toHaveLength(1)
    expect(filteredItems.value[0].label).toBe('Users')
  })

  it('filters items by sqlPreview', () => {
    const items = ref(makeItems())
    const filterText = ref('user_stats')
    const { filteredItems } = useFilteredList(items, filterText)
    expect(filteredItems.value).toHaveLength(1)
    expect(filteredItems.value[0].label).toBe('UserStats')
  })

  it('filters items by tag', () => {
    const items = ref(makeItems())
    const filterText = ref('view')
    const { filteredItems } = useFilteredList(items, filterText)
    expect(filteredItems.value).toHaveLength(1)
    expect(filteredItems.value[0].label).toBe('UserStats')
  })

  it('filters case-insensitively', () => {
    const items = ref(makeItems())
    const filterText = ref('USERS')
    const { filteredItems } = useFilteredList(items, filterText)
    // 'users' matches Users (label) and UserStats (label 'userstats' contains 'user')
    expect(filteredItems.value).toHaveLength(2)
    expect(filteredItems.value[0].label).toBe('Users')
  })

  it('returns empty array when no items match', () => {
    const items = ref(makeItems())
    const filterText = ref('nonexistent')
    const { filteredItems } = useFilteredList(items, filterText)
    expect(filteredItems.value).toHaveLength(0)
  })

  it('matches multiple items with shared substring', () => {
    const items = ref(makeItems())
    const filterText = ref('user')
    const { filteredItems } = useFilteredList(items, filterText)
    // Users (label), Orders (meta has user_id), UserStats (label, meta, sqlPreview)
    expect(filteredItems.value).toHaveLength(3)
  })

  it('handles special characters in search query', () => {
    const items = ref<PreviewItem[]>([
      { id: '1', icon: 'table', label: 'Table (v2)', meta: ['col*1'], sqlPreview: 'SELECT * FROM t WHERE x = 1' },
      { id: '2', icon: 'table', label: 'Other', meta: ['col2'] }
    ])
    const filterText = ref('(v2)')
    const { filteredItems } = useFilteredList(items, filterText)
    expect(filteredItems.value).toHaveLength(1)
    expect(filteredItems.value[0].label).toBe('Table (v2)')
  })

  it('updates reactively when filter text changes', () => {
    const items = ref(makeItems())
    const filterText = ref('')
    const { filteredItems } = useFilteredList(items, filterText)

    expect(filteredItems.value).toHaveLength(3)

    filterText.value = 'orders'
    expect(filteredItems.value).toHaveLength(1)
    expect(filteredItems.value[0].label).toBe('Orders')

    filterText.value = ''
    expect(filteredItems.value).toHaveLength(3)
  })

  it('updates reactively when items change', () => {
    const items = ref(makeItems())
    const filterText = ref('newtable')
    const { filteredItems } = useFilteredList(items, filterText)
    expect(filteredItems.value).toHaveLength(0)

    items.value = [...items.value, { id: '4', icon: 'table', label: 'NewTable', meta: [] }]
    expect(filteredItems.value).toHaveLength(1)
    expect(filteredItems.value[0].label).toBe('NewTable')
  })

  it('selectedItem is undefined initially', () => {
    const items = ref(makeItems())
    const filterText = ref('')
    const { selectedItem } = useFilteredList(items, filterText)
    expect(selectedItem.value).toBeUndefined()
  })

  it('navigateDown selects first item, then next', () => {
    const items = ref(makeItems())
    const filterText = ref('')
    const { selectedItem, navigateDown, keyboardIndex } = useFilteredList(items, filterText)

    navigateDown()
    expect(keyboardIndex.value).toBe(0)
    expect(selectedItem.value?.label).toBe('Users')

    navigateDown()
    expect(keyboardIndex.value).toBe(1)
    expect(selectedItem.value?.label).toBe('Orders')
  })

  it('navigateUp selects last item when starting from null', () => {
    const items = ref(makeItems())
    const filterText = ref('')
    const { selectedItem, navigateUp, keyboardIndex } = useFilteredList(items, filterText)

    navigateUp()
    expect(keyboardIndex.value).toBe(2)
    expect(selectedItem.value?.label).toBe('UserStats')
  })

  it('navigateDown stops at last item', () => {
    const items = ref(makeItems())
    const filterText = ref('')
    const { navigateDown, keyboardIndex } = useFilteredList(items, filterText)

    navigateDown()
    navigateDown()
    navigateDown()
    expect(keyboardIndex.value).toBe(2)

    // Try to go past end
    navigateDown()
    expect(keyboardIndex.value).toBe(2)
  })

  it('navigateUp stops at first item', () => {
    const items = ref(makeItems())
    const filterText = ref('')
    const { navigateDown, navigateUp, keyboardIndex } = useFilteredList(items, filterText)

    navigateDown()
    expect(keyboardIndex.value).toBe(0)

    navigateUp()
    expect(keyboardIndex.value).toBe(0)
  })

  it('resetSelection clears keyboard and hovered index', () => {
    const items = ref(makeItems())
    const filterText = ref('')
    const { navigateDown, resetSelection, keyboardIndex, hoveredIndex } = useFilteredList(items, filterText)

    navigateDown()
    expect(keyboardIndex.value).toBe(0)
    expect(hoveredIndex.value).toBe(0)

    resetSelection()
    expect(keyboardIndex.value).toBeNull()
    expect(hoveredIndex.value).toBeNull()
  })

  it('filterText change resets selection', async () => {
    const items = ref(makeItems())
    const filterText = ref('')
    const { navigateDown, keyboardIndex } = useFilteredList(items, filterText)

    navigateDown()
    expect(keyboardIndex.value).toBe(0)

    filterText.value = 'orders'
    await nextTick()
    expect(keyboardIndex.value).toBeNull()
  })

  it('items change resets selection', async () => {
    const items = ref(makeItems())
    const filterText = ref('')
    const { navigateDown, keyboardIndex } = useFilteredList(items, filterText)

    navigateDown()
    expect(keyboardIndex.value).toBe(0)

    items.value = [...items.value]
    await nextTick()
    expect(keyboardIndex.value).toBeNull()
  })

  it('navigateDown on filtered list navigates within filtered results', () => {
    const items = ref(makeItems())
    const filterText = ref('user')
    const { filteredItems, navigateDown, selectedItem } = useFilteredList(items, filterText)

    // 3 items match 'user' (Users label, Orders meta user_id, UserStats label+meta+sql)
    expect(filteredItems.value).toHaveLength(3)

    navigateDown()
    expect(selectedItem.value?.label).toBe('Users')
  })
})
