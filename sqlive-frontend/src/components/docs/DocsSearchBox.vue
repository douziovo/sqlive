<template>
  <!-- D-13: Ctrl+K global + `/` docs-scoped + Esc closes dropdown -->
  <div class="relative">
    <Search
      class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
    />
    <input
      data-testid="docs-search-input"
      type="text"
      v-model="query"
      ref="inputRef"
      :disabled="indexError"
      @input="onInput"
      :placeholder="indexError ? '搜索暂不可用' : '搜索文档... (Ctrl+K)'"
      :aria-label="'搜索文档'"
      class="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-md outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
    />
    <!-- Dropdown results: shown when query produces matches -->
    <div
      v-if="results.length > 0"
      data-testid="search-results"
      class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-80 overflow-y-auto z-40"
    >
      <button
        v-for="result in results"
        :key="result.slug"
        @click="handleOpen(result.slug)"
        class="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors flex items-center justify-between gap-2"
      >
        <span>{{ result.title }}</span>
        <span class="text-xs text-muted-foreground">{{ result.category }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {Search} from 'lucide-vue-next'
import {useDocsSearch} from '@/composables/useDocsSearch'

const route = useRoute()
const router = useRouter()
const {ensureIndex, search, indexReady, indexError} = useDocsSearch()

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

// Reactive results — no manual debounce needed for ~6 articles (per plan Step 2).
const results = computed(() => (query.value.trim() ? search(query.value) : []))

function onInput() {
  // results is computed reactively; no-op handler for clarity (CLAUDE.md gotcha —
  // use handler functions, not inline ref assignment in template).
}

// Click result → navigate. NavigationFailure silenced per Pitfall 6.
function handleOpen(slug: string) {
  router.push('/docs/' + slug).catch(() => {
    // NavigationFailure (aborted/duplicated/cancelled) — silent per spec §4.6
  })
  query.value = ''
  inputRef.value?.blur()
}

/**
 * Global keydown handler (D-13).
 *
 * Ctrl+K / Cmd+K: focus search input on any route (global).
 * `/`: focus search input only when route.path.startsWith('/docs') AND
 *      target is not INPUT/TEXTAREA/contenteditable (Pitfall 10 — avoids
 *      conflict with editor input).
 * Escape: blur input (closes dropdown).
 */
function handleKeydown(e: KeyboardEvent) {
  // Ctrl+K / Cmd+K — global
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    void ensureIndex()
    inputRef.value?.focus()
    return
  }

  // `/` — docs subtree only, not in inputs (Pitfall 10, T-14-12)
  if (e.key === '/' && route.path.startsWith('/docs')) {
    const target = e.target as HTMLElement
    if (
      !['INPUT', 'TEXTAREA'].includes(target.tagName) &&
      !target.isContentEditable
    ) {
      e.preventDefault()
      void ensureIndex()
      inputRef.value?.focus()
    }
    return
  }

  // Escape — blur (closes dropdown)
  if (e.key === 'Escape') {
    inputRef.value?.blur()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
