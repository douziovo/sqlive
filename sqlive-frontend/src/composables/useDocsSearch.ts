import { ref } from 'vue'

/**
 * Stub — Plan 04 fills in (MiniSearch lazy index + search + error fallback).
 *
 * Returns the same shape as the real composable so callers can destructure
 * without type errors.
 */
export function useDocsSearch() {
  const indexReady = ref(false)
  const indexError = ref(false)

  async function ensureIndex(): Promise<void> {
    // no-op stub
  }

  function search(_query: string): Array<{ slug: string; title: string; category: string; score: number }> {
    return []
  }

  return { ensureIndex, search, indexReady, indexError }
}
