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
