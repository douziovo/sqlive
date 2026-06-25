import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { Node } from '@vue-flow/core'
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph'

/**
 * useGraphSearch — Ctrl+F search bar + match navigation for the knowledge graph.
 *
 * Owns:
 *   - showSearch / searchQuery / matchIndex / previousViewport state
 *   - matchNodes / matchCount / currentIndex computeds (case-insensitive
 *     filter on label + description)
 *   - navigateMatch(dir) — cycles with wrap-around
 *   - centerOnMatch(index) — calls flowRef.setCenter to focus the match
 *   - onGlobalKeydown — handles Ctrl+F (open), Ctrl+0 (reset view via
 *     opts.onResetView), Escape (close); input/textarea guard on Ctrl+F/Ctrl+0
 *   - closeSearch — clears state + restores previous viewport
 *   - watch(searchQuery) — resets index + centers on first match
 *
 * Lifecycle: onMounted registers document.addEventListener('keydown', ..., true)
 * (capture phase — must intercept before app-level handlers); onUnmounted removes.
 *
 * Lifecycle hooks are guarded by `getCurrentInstance()` so the composable
 * can be unit-tested outside a component setup without Vue warnings.
 */
export function useGraphSearch(
  flowRef: Ref<any>,
  displayNodes: Ref<Node<KnowledgeNodeData>[]>,
  opts?: { onResetView?: () => void }
): {
  showSearch: Ref<boolean>
  searchQuery: Ref<string>
  matchNodes: ComputedRef<Node<KnowledgeNodeData>[]>
  matchCount: ComputedRef<number>
  currentIndex: ComputedRef<number>
  navigateMatch: (dir: 1 | -1) => void
  onGlobalKeydown: (e: KeyboardEvent) => void
  closeSearch: () => void
} {
  const showSearch = ref(false)
  const searchQuery = ref('')
  const matchIndex = ref(0)
  const previousViewport = ref<{ x: number; y: number; zoom: number } | null>(null)

  const matchNodes = computed(() => {
    if (!searchQuery.value) return [] as Node<KnowledgeNodeData>[]
    const q = searchQuery.value.toLowerCase()
    return displayNodes.value.filter((node) =>
      node.data.label.toLowerCase().includes(q) ||
      (node.data.description || '').toLowerCase().includes(q)
    )
  })

  const matchCount = computed(() => matchNodes.value.length)

  const currentIndex = computed(() => {
    if (!searchQuery.value || matchCount.value === 0) return -1
    return matchIndex.value
  })

  function restoreViewport(): void {
    if (previousViewport.value) {
      flowRef.value?.setViewport?.(previousViewport.value, { duration: 200 })
      previousViewport.value = null
    }
  }

  function closeSearch(): void {
    showSearch.value = false
    searchQuery.value = ''
    matchIndex.value = 0
    restoreViewport()
  }

  function centerOnMatch(index: number): void {
    if (matchNodes.value.length === 0 || index < 0 || index >= matchNodes.value.length) return
    const node = matchNodes.value[index]
    if (node) {
      flowRef.value?.setCenter?.(node.position.x + 60, node.position.y + 30, { zoom: 1.2, duration: 300 })
    }
  }

  function navigateMatch(dir: 1 | -1): void {
    const matches = matchNodes.value
    if (matches.length === 0) return
    matchIndex.value = (matchIndex.value + dir + matches.length) % matches.length
    centerOnMatch(matchIndex.value)
  }

  function onGlobalKeydown(e: KeyboardEvent): void {
    // Escape closes search regardless of focus target (keyboard-only users need this)
    if (e.key === 'Escape' && showSearch.value) {
      e.preventDefault()
      e.stopPropagation()
      closeSearch()
      return
    }

    // T-10-12 / D-12: only intercept Ctrl+F / Ctrl+0 when focus is not in input/textarea
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    // D-12: Ctrl+0 resets view (keyboard equivalent of dblclick) — same guard as Ctrl+F.
    // Decoupled from onPaneDblClick: caller injects the reset callback via opts.
    if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault()
      e.stopPropagation()
      opts?.onResetView?.()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      e.stopPropagation()
      showSearch.value = true
      const vp = flowRef.value?.getViewport?.()
      if (vp) {
        previousViewport.value = vp
      }
    }
  }

  watch(searchQuery, (val) => {
    if (val) {
      matchIndex.value = 0
      nextTick(() => centerOnMatch(0))
    } else {
      matchIndex.value = 0
    }
  })

  // ── Lifecycle (guarded so composable is unit-testable) ───────

  const instance = getCurrentInstance()
  if (instance) {
    onMounted(() => {
      document.addEventListener('keydown', onGlobalKeydown, true)
    })
    onUnmounted(() => {
      document.removeEventListener('keydown', onGlobalKeydown, true)
    })
  }

  return {
    showSearch,
    searchQuery,
    matchNodes,
    matchCount,
    currentIndex,
    navigateMatch,
    onGlobalKeydown,
    closeSearch
  }
}
