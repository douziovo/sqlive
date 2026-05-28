<template>
  <Teleport to="body">
    <div
        v-show="visible"
        ref="popupRef"
        class="fixed z-50 bg-card border border-border rounded-lg shadow-xl text-sm overflow-hidden"
        :style="popupStyle"
        @mouseenter="emit('mouseenter')"
        @mouseleave="emit('mouseleave')"
        @keydown="onKeydown"
    >
      <!-- Title bar -->
      <div class="px-3 py-2 border-b border-border flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg">{{ displayIcon }}</span>
          <span class="font-semibold text-secondary-foreground">{{ displayTitle }}</span>
        </div>
        <span class="text-xs text-muted-foreground/70">{{ displaySubtitle }}</span>
      </div>

      <!-- Filter input (JetBrains-style: type to filter) -->
      <div class="px-2 py-2 border-b border-border bg-muted/30">
        <div class="flex items-center gap-2 bg-card border border-border rounded px-2 py-1">
          <span class="text-xs text-muted-foreground/70">&#x1F50D;</span>
          <input
              ref="filterInputRef"
              v-model="filterText"
              type="text"
              placeholder="输入以过滤..."
              class="text-xs bg-transparent outline-none flex-1 text-muted-foreground placeholder-muted-foreground/50"
              @keydown.stop="onKeydown"
          />
          <span v-if="filterText" class="text-xs text-muted-foreground/70">{{ filteredItems.length }}/{{ displayItems.length }}</span>
          <button v-if="filterText" @click="filterText = ''; $nextTick(() => filterInputRef?.focus())"
                  class="text-muted-foreground/50 hover:text-muted-foreground text-xs leading-none">&#x2715;</button>
        </div>
      </div>

      <!-- Item list -->
      <div ref="listRef" class="max-h-[320px] overflow-y-auto custom-scrollbar">
        <div v-if="filteredItems.length === 0" class="px-3 py-6 text-center text-muted-foreground/70 text-xs">
          无匹配项
        </div>
        <div
            v-for="(item, fi) in filteredItems"
            :key="item.id"
            class="px-3 py-2 cursor-pointer transition-colors border-l-2"
            :class="[
              item.accent === 'blue' ? 'border-primary/60' : 'border-transparent',
              (hoveredIndex === fi || keyboardIndex === fi)
                ? (item.accent === 'blue' ? 'bg-primary/10' : 'bg-muted')
                : ''
            ]"
            @mouseenter="hoveredIndex = fi; keyboardIndex = fi"
            @mouseleave="hoveredIndex = null"
            @click="onItemClick(item)"
        >
          <div class="flex items-center gap-2 mb-1">
            <span class="text-sm">{{ item.icon }}</span>
            <span class="font-semibold text-foreground"
                  v-html="highlightLabel(item.label)"></span>
          </div>
          <div v-for="(meta, mi) in item.meta" :key="mi" class="text-xs text-muted-foreground/70 ml-5">
            {{ meta }}
          </div>
          <div v-if="item.sqlPreview" class="text-xs text-muted-foreground/70 font-mono truncate mt-1 ml-5">
            {{ item.sqlPreview }}
          </div>
          <div v-if="item.tag" class="mt-1 ml-5">
            <span class="text-xs px-2 py-1 rounded bg-amber-50 text-amber-600 font-medium">{{ item.tag }}</span>
          </div>
        </div>
      </div>

      <!-- Bottom action bar -->
      <div class="px-3 py-2 border-t border-border bg-muted/50 flex items-center justify-between">
        <button @click="emit('navigate-all')" class="text-xs text-primary hover:text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors">
          查看全部{{ displayCategoryName }}
        </button>
        <button
            v-if="selectedItem"
            @click="onItemClick(selectedItem)"
            class="text-xs text-primary hover:text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
        >
          查看 {{ selectedItem.label }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { type PreviewItem, useFilteredList } from '../composables/useFilteredList'
import { highlightMatch } from '../utils/html'

const props = defineProps<{
  show: boolean
  triggerEl: HTMLElement | null
  icon: string
  title: string
  subtitle: string
  categoryName: string
  items: PreviewItem[]
}>()

const emit = defineEmits(['select', 'close', 'mouseenter', 'mouseleave', 'navigate-all'])

const popupRef = ref<HTMLElement | null>(null)
const filterInputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const visible = ref(false)
const popupStyle = ref<Record<string, string>>({})

// Filter state — instant, no debounce (JetBrains style)
const filterText = ref('')

// Highlight matching text in label
function highlightLabel(label: string): string {
  return highlightMatch(label, filterText.value.trim(), 'bg-yellow-200 text-foreground rounded-sm px-1')
}

let hideTimer: ReturnType<typeof setTimeout> | null = null
let showTimer: ReturnType<typeof setTimeout> | null = null

// Cache last non-empty display data to prevent empty-list flicker during hide delay.
// When show becomes false, props.items/title/subtitle reset to empty immediately,
// but visible stays true for 200ms (hide delay). Cache preserves the last good state.
const cachedIcon = ref('')
const cachedTitle = ref('')
const cachedSubtitle = ref('')
const cachedCategoryName = ref('')
const cachedItems = ref<PreviewItem[]>([])

const displayIcon = computed(() => cachedIcon.value || props.icon)
const displayTitle = computed(() => cachedTitle.value || props.title)
const displaySubtitle = computed(() => cachedSubtitle.value || props.subtitle)
const displayCategoryName = computed(() => cachedCategoryName.value || props.categoryName)
const displayItems = computed(() => (props.items.length > 0 ? props.items : cachedItems.value))

const { filteredItems, hoveredIndex, keyboardIndex, selectedItem, navigateUp, navigateDown, resetSelection } =
  useFilteredList(displayItems, filterText)

// When popup is already visible and the user slides to a different badge,
// show stays true so the watcher below doesn't re-fire. Update cache immediately.
watch([() => props.title, () => props.items], () => {
  if (visible.value && props.items.length > 0) {
    cachedItems.value = [...props.items]
    cachedIcon.value = props.icon
    cachedTitle.value = props.title
    cachedSubtitle.value = props.subtitle
    cachedCategoryName.value = props.categoryName
    filterText.value = ''
    resetSelection()
    nextTick(() => {
      positionPopup()
      filterInputRef.value?.focus()
    })
  }
})

watch(
  () => props.show,
  (val) => {
    if (showTimer) clearTimeout(showTimer)
    if (hideTimer) clearTimeout(hideTimer)
    if (val) {
      showTimer = setTimeout(async () => {
        // Snapshot current props before they reset on hide
        if (props.items.length > 0) cachedItems.value = [...props.items]
        cachedIcon.value = props.icon
        cachedTitle.value = props.title
        cachedSubtitle.value = props.subtitle
        cachedCategoryName.value = props.categoryName
        visible.value = true
        filterText.value = ''
        resetSelection()
        await nextTick()
        positionPopup()
        await nextTick()
        filterInputRef.value?.focus()
      }, 300)
    } else {
      hideTimer = setTimeout(() => {
        visible.value = false
        // Clear cache after popup is fully hidden
        cachedItems.value = []
        cachedIcon.value = ''
        cachedTitle.value = ''
        cachedSubtitle.value = ''
        cachedCategoryName.value = ''
      }, 200)
    }
  }
)

function positionPopup() {
  if (!props.triggerEl || !popupRef.value) return
  const rect = props.triggerEl.getBoundingClientRect()
  const popupEl = popupRef.value
  const popupHeight = popupEl.offsetHeight || 200
  const popupWidth = Math.min(340, popupEl.offsetWidth || 260)
  const viewportH = window.innerHeight
  const viewportW = window.innerWidth
  const gap = 4

  let top: number
  const below = rect.bottom + gap
  const above = rect.top - popupHeight - gap

  if (below + popupHeight <= viewportH - 16 || above < 0) {
    top = below
  } else {
    top = above
  }

  let left = rect.left + rect.width / 2 - popupWidth / 2
  left = Math.max(8, Math.min(left, viewportW - popupWidth - 8))

  popupStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    minWidth: '280px',
    maxWidth: '340px'
  }
}

function onItemClick(item: PreviewItem) {
  if (hideTimer) clearTimeout(hideTimer)
  visible.value = false
  emit('select', item.id)
}

// Keyboard navigation (JetBrains style)
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    if (filterText.value) {
      filterText.value = ''
      resetSelection()
    } else {
      if (hideTimer) clearTimeout(hideTimer)
      visible.value = false
    }
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    navigateDown()
    scrollToKeyboardItem()
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    navigateUp()
    scrollToKeyboardItem()
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    const item = selectedItem.value
    if (item) onItemClick(item)
    return
  }
}

function scrollToKeyboardItem() {
  if (!listRef.value || keyboardIndex.value === null) return
  const items = listRef.value.children
  if (items[keyboardIndex.value]) {
    ;(items[keyboardIndex.value] as HTMLElement).scrollIntoView({ block: 'nearest' })
  }
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #d1d5db; border-radius: 3px; }
</style>
