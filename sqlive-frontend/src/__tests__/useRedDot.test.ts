import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useRedDot } from '@/composables/useRedDot'

beforeEach(() => {
  localStorage.clear()
})

// ── show / clear / isVisible ─────────────────────────────────────

describe('show / clear / isVisible', () => {
  it('show sets red dot visible for a key', () => {
    const { show, isVisible } = useRedDot()
    show('chapter:basics')
    expect(isVisible('chapter:basics')).toBe(true)
  })

  it('clear hides red dot for a key', () => {
    const { show, clear, isVisible } = useRedDot()
    show('chapter:basics')
    clear('chapter:basics')
    expect(isVisible('chapter:basics')).toBe(false)
  })

  it('isVisible returns false for unknown keys', () => {
    const { isVisible } = useRedDot()
    expect(isVisible('never-set')).toBe(false)
  })

  it('isVisible returns correct state after multiple operations', () => {
    const { show, clear, isVisible } = useRedDot()
    show('a')
    show('b')
    clear('a')
    expect(isVisible('a')).toBe(false)
    expect(isVisible('b')).toBe(true)
    expect(isVisible('c')).toBe(false)
  })
})

// ── clearAll ─────────────────────────────────────────────────────

describe('clearAll', () => {
  it('clearAll removes all dots with matching prefix', () => {
    const { show, clearAll, isVisible } = useRedDot()
    show('chapter:basics')
    show('chapter:query')
    show('nav:settings')

    clearAll('chapter:')

    expect(isVisible('chapter:basics')).toBe(false)
    expect(isVisible('chapter:query')).toBe(false)
    expect(isVisible('nav:settings')).toBe(true)
  })

  it('clearAll with non-matching prefix leaves all dots intact', () => {
    const { show, clearAll, isVisible } = useRedDot()
    show('chapter:basics')
    show('chapter:query')

    clearAll('nonexistent:')

    expect(isVisible('chapter:basics')).toBe(true)
    expect(isVisible('chapter:query')).toBe(true)
  })

  // D-06 (WR-02): clearAll must cascade to parents via clear(key) loop.

  it('clearAll cascades to parent when last child removed', () => {
    const { show, clearAll, isVisible } = useRedDot()
    show('task:t1', ['category:core', 'tab:tasks'])
    show('task:t2', ['category:core', 'tab:tasks'])

    clearAll('task:')

    expect(isVisible('task:t1')).toBe(false)
    expect(isVisible('task:t2')).toBe(false)
    // Cascade: no remaining visible task → category:core auto-cleared,
    // then tab:tasks auto-cleared.
    expect(isVisible('category:core')).toBe(false)
    expect(isVisible('tab:tasks')).toBe(false)
  })

  it('clearAll preserves parents with children in other prefixes', () => {
    const { show, clearAll, isVisible } = useRedDot()
    show('task:t1', ['category:core', 'tab:tasks'])
    show('task:t2', ['category:deep-dive', 'tab:tasks'])

    clearAll('task:')  // clears both tasks
    // Both categories had only 1 child each → both auto-cleared.
    // tab:tasks had 2 children across categories, both cleared → tab auto-cleared.
    expect(isVisible('category:core')).toBe(false)
    expect(isVisible('category:deep-dive')).toBe(false)
    expect(isVisible('tab:tasks')).toBe(false)
  })

  it('clearAll with non-visible matching keys is no-op', () => {
    const { show, clear, clearAll, isVisible } = useRedDot()
    show('task:t1', ['category:core', 'tab:tasks'])
    clear('task:t1')  // already cleared via cascade

    // redDots has task:t1=false, category:core=false, tab:tasks=false.
    // clearAll('task:') should be a no-op (no visible matching keys).
    expect(() => clearAll('task:')).not.toThrow()
    expect(isVisible('task:t1')).toBe(false)
    expect(isVisible('category:core')).toBe(false)
    expect(isVisible('tab:tasks')).toBe(false)
  })
})

// ── hasAnyDot ────────────────────────────────────────────────────

describe('hasAnyDot', () => {
  it('hasAnyDot returns true when any dot is visible', () => {
    const { show, hasAnyDot } = useRedDot()
    show('chapter:basics')
    expect(hasAnyDot.value).toBe(true)
  })

  it('hasAnyDot returns false when all dots are hidden', () => {
    const { show, clear, hasAnyDot } = useRedDot()
    show('chapter:basics')
    clear('chapter:basics')
    expect(hasAnyDot.value).toBe(false)
  })

  it('hasAnyDot returns false when no dots have ever been set', () => {
    const { hasAnyDot } = useRedDot()
    expect(hasAnyDot.value).toBe(false)
  })
})

// ── localStorage persistence ─────────────────────────────────────

describe('localStorage persistence', () => {
  it('persists state to localStorage', async () => {
    const { show } = useRedDot()
    show('chapter:basics')
    show('chapter:query')

    await nextTick()

    const raw = localStorage.getItem('ai-knowledge-reddot')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed['chapter:basics']).toBe(true)
    expect(parsed['chapter:query']).toBe(true)
  })

  it('survives re-creation (page refresh sim)', async () => {
    const first = useRedDot()
    first.show('chapter:basics')
    first.show('chapter:query')
    first.clear('chapter:query')

    await nextTick()

    const second = useRedDot()
    expect(second.isVisible('chapter:basics')).toBe(true)
    expect(second.isVisible('chapter:query')).toBe(false)
  })
})

// ── hierarchical propagation (D-03) ───────────────────────────

describe('hierarchical propagation', () => {
  it('show with parents sets parent dots visible', () => {
    const { show, isVisible } = useRedDot()
    show('task:t1', ['category:core', 'tab:tasks'])

    expect(isVisible('task:t1')).toBe(true)
    expect(isVisible('category:core')).toBe(true)
    expect(isVisible('tab:tasks')).toBe(true)
  })

  it('clear last task under category auto-clears category and tab', () => {
    const { show, clear, isVisible } = useRedDot()
    show('task:t1', ['category:core', 'tab:tasks'])
    show('task:t2', ['category:core', 'tab:tasks'])

    // t1 cleared but t2 still active → category and tab stay visible
    clear('task:t1')
    expect(isVisible('task:t1')).toBe(false)
    expect(isVisible('category:core')).toBe(true)
    expect(isVisible('tab:tasks')).toBe(true)

    // clear last task under category:core → category auto-clears, then tab auto-clears
    clear('task:t2')
    expect(isVisible('task:t2')).toBe(false)
    expect(isVisible('category:core')).toBe(false)
    expect(isVisible('tab:tasks')).toBe(false)
  })

  it('clear non-last task does not auto-clear parent', () => {
    const { show, clear, isVisible } = useRedDot()
    show('task:t1', ['category:core', 'tab:tasks'])
    show('task:t2', ['category:core', 'tab:tasks'])

    clear('task:t1')
    // t2 still active, so parent should stay visible
    expect(isVisible('category:core')).toBe(true)
    expect(isVisible('tab:tasks')).toBe(true)
  })

  it('show without parents is backward compatible', () => {
    const { show, isVisible } = useRedDot()
    show('chapter:basics')
    expect(isVisible('chapter:basics')).toBe(true)
  })

  it('clear without parents does not propagate', () => {
    const { show, clear, isVisible } = useRedDot()
    show('chapter:basics')
    clear('chapter:basics')
    expect(isVisible('chapter:basics')).toBe(false)
  })

  it('hasDotInPrefix returns true when any key with prefix visible', () => {
    const { show, hasDotInPrefix } = useRedDot()
    show('task:t1', ['category:core', 'tab:tasks'])

    expect(hasDotInPrefix('task:')).toBe(true)
    expect(hasDotInPrefix('category:')).toBe(true)
    expect(hasDotInPrefix('nav:')).toBe(false)
  })
})
