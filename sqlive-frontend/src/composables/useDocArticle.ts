import { ref } from 'vue'

/**
 * Stub — Plan 03 fills in (slug → markdown raw → marked → DOMPurify).
 *
 * Returns reactive refs so callers can destructure without type errors.
 */
export function useDocArticle(_slug: { value: string }) {
  const raw = ref<string | null>(null)
  const html = ref<string | null>(null)
  return { raw, html }
}
