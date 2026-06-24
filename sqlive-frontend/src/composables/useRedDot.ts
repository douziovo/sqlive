import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

export function useRedDot() {
  const redDots = useLocalStorage<Record<string, boolean>>('ai-knowledge-reddot', {})

  function show(key: string): void {
    redDots.value = { ...redDots.value, [key]: true }
  }

  function clear(key: string): void {
    redDots.value = { ...redDots.value, [key]: false }
  }

  function isVisible(key: string): boolean {
    return redDots.value[key] === true
  }

  function clearAll(prefix: string): void {
    const newDots: Record<string, boolean> = {}
    for (const key of Object.keys(redDots.value)) {
      if (!key.startsWith(prefix)) {
        newDots[key] = redDots.value[key]
      }
    }
    redDots.value = newDots
  }

  // Hierarchical red dot: any child visible → parent also visible
  const hasAnyDot = computed(() =>
    Object.values(redDots.value).some(v => v === true)
  )

  return { redDots, show, clear, isVisible, clearAll, hasAnyDot }
}
