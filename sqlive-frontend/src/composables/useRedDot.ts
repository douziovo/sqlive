import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

export function useRedDot() {
  const redDots = useLocalStorage<Record<string, boolean>>('ai-knowledge-reddot', {})
  // D-03: keyParents stores key → parent chain so clear() can propagate upward
  // when the last child of a parent is cleared.
  const keyParents = useLocalStorage<Record<string, string[]>>(
    'ai-knowledge-reddot-parents',
    {}
  )

  function show(key: string, parents?: string[]): void {
    redDots.value = { ...redDots.value, [key]: true }
    if (parents && parents.length > 0) {
      keyParents.value = { ...keyParents.value, [key]: parents }
      // Mark each parent visible so callers that read parent state directly
      // see the dot immediately (backward compatible with the old "explicit
      // show parent" call pattern).
      const updated = { ...redDots.value }
      for (const p of parents) {
        updated[p] = true
      }
      redDots.value = updated
    }
  }

  function clear(key: string): void {
    redDots.value = { ...redDots.value, [key]: false }
    const parents = keyParents.value[key]
    if (!parents || parents.length === 0) return

    // Remove this key's parent registration so future clear() calls don't
    // treat it as an active child.
    const updatedParents = { ...keyParents.value }
    delete updatedParents[key]
    keyParents.value = updatedParents

    // For each parent: check if any other key still has it as a parent and
    // is still visible. If no other child is visible, recursively clear.
    for (const p of parents) {
      const hasOtherChild = Object.entries(keyParents.value).some(
        ([childKey, childParents]) =>
          Array.isArray(childParents) &&
          childParents.includes(p) &&
          redDots.value[childKey] === true
      )
      if (!hasOtherChild) {
        clear(p)
      }
    }
  }

  function isVisible(key: string): boolean {
    return redDots.value[key] === true
  }

  function clearAll(prefix: string): void {
    // D-06: implement clearAll as a loop over clear(key) for each matching
    // visible key. Reuses clear's parent-cascade logic (hasOtherChild check +
    // recursive clear(p)) so removing the last child of a parent auto-clears
    // the parent. Previously clearAll dropped parent registrations but left
    // parent dots visible (asymmetric with clear).
    const matchingKeys = Object.keys(redDots.value).filter(
      (k) => k.startsWith(prefix) && redDots.value[k] === true
    )
    for (const key of matchingKeys) {
      clear(key)
    }
  }

  // Hierarchical red dot: any child visible → parent also visible
  const hasAnyDot = computed(() =>
    Object.values(redDots.value).some(v => v === true)
  )

  // D-03: prefix query for parent-level visibility checks
  function hasDotInPrefix(prefix: string): boolean {
    return Object.entries(redDots.value).some(
      ([k, v]) => v === true && k.startsWith(prefix)
    )
  }

  return { redDots, keyParents, show, clear, isVisible, clearAll, hasAnyDot, hasDotInPrefix }
}
