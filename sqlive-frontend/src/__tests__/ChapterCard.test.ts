// ── imports ────────────────────────────────────────────────────────

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChapterCard from '@/components/knowledge/ChapterCard.vue'
import type { LearningChapter } from '@/data/learningChapters'

// ── mock data ─────────────────────────────────────────────────────

const mockChapter: LearningChapter = {
  id: 'basics',
  title: '基础篇',
  description: '掌握 SQL 最核心的查询语法',
  rankRequired: 0,
  rewardXp: 100,
  categoryKey: 'basics',
  topicCount: 6
}

const unlockedProgress = { completed: 3, total: 6 }
const lockedProgress = { completed: 0, total: 0 }

// ── ChapterCard ────────────────────────────────────────────────────

describe('ChapterCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders chapter title and description', () => {
    const w = mount(ChapterCard, {
      props: {
        chapter: mockChapter,
        progress: unlockedProgress,
        unlocked: true,
        currentLevel: 0
      }
    })
    expect(w.text()).toContain('基础篇')
    expect(w.text()).toContain('掌握 SQL 最核心的查询语法')
  })

  it('shows progress fraction correctly', () => {
    const w = mount(ChapterCard, {
      props: {
        chapter: mockChapter,
        progress: unlockedProgress,
        unlocked: true,
        currentLevel: 0
      }
    })
    expect(w.text()).toContain('3/6 完成')
  })

  it('renders progress bar with correct width', () => {
    const w = mount(ChapterCard, {
      props: {
        chapter: mockChapter,
        progress: { completed: 3, total: 6 },
        unlocked: true,
        currentLevel: 0
      }
    })
    const bar = w.find('.chapter-card__bar-fill')
    expect(bar.attributes('style')).toContain('width: 50%')
  })

  it('shows reward XP amount', () => {
    const w = mount(ChapterCard, {
      props: {
        chapter: mockChapter,
        progress: unlockedProgress,
        unlocked: true,
        currentLevel: 0
      }
    })
    expect(w.text()).toContain('+100 XP')
  })

  it('emits openChapter when button clicked (unlocked)', async () => {
    const w = mount(ChapterCard, {
      props: {
        chapter: mockChapter,
        progress: unlockedProgress,
        unlocked: true,
        currentLevel: 0
      }
    })
    const btn = w.find('.chapter-card__btn')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('开始学习')
    await btn.trigger('click')
    expect(w.emitted('openChapter')).toBeTruthy()
    expect(w.emitted('openChapter')?.[0]).toEqual(['basics'])
  })

  it('shows lock icon and level hint when locked', () => {
    const w = mount(ChapterCard, {
      props: {
        chapter: mockChapter,
        progress: lockedProgress,
        unlocked: false,
        currentLevel: 0
      }
    })
    expect(w.text()).toContain('🔒')
    expect(w.text()).toContain('等级解锁')
    expect(w.find('.chapter-card--locked').exists()).toBe(true)
  })

  it('button is absent when locked', () => {
    const w = mount(ChapterCard, {
      props: {
        chapter: mockChapter,
        progress: lockedProgress,
        unlocked: false,
        currentLevel: 0
      }
    })
    expect(w.find('.chapter-card__btn').exists()).toBe(false)
  })

  it('handles zero progress gracefully', () => {
    const w = mount(ChapterCard, {
      props: {
        chapter: mockChapter,
        progress: { completed: 0, total: 6 },
        unlocked: true,
        currentLevel: 0
      }
    })
    const bar = w.find('.chapter-card__bar-fill')
    expect(bar.attributes('style')).toContain('width: 0%')
  })
})
