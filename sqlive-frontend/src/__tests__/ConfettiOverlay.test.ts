import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfettiOverlay from '@/components/knowledge/ConfettiOverlay.vue'

function getOverlay(): Element | null {
  return document.body.querySelector('.confetti-overlay')
}

function getPieces(): NodeListOf<Element> {
  return document.body.querySelectorAll('.confetti-piece')
}

describe('ConfettiOverlay', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('不渲染当 active 为 false', () => {
    mount(ConfettiOverlay, { props: { active: false } })
    expect(getOverlay()).toBeNull()
  })

  it('渲染当 active 为 true', async () => {
    mount(ConfettiOverlay, { props: { active: true } })
    expect(getOverlay()).not.toBeNull()
  })

  it('active 时生成 40 个粒子（默认非 burst）', async () => {
    mount(ConfettiOverlay, { props: { active: true } })
    await nextTick()
    const count = getPieces().length
    expect(count).toBeGreaterThanOrEqual(40)
    expect(count).toBeLessThanOrEqual(40)
  })

  it('burst 模式生成 80 个粒子', async () => {
    mount(ConfettiOverlay, { props: { active: true, burst: true } })
    await nextTick()
    const count = getPieces().length
    expect(count).toBeGreaterThanOrEqual(80)
    expect(count).toBeLessThanOrEqual(80)
  })

  it('粒子有 confetti-piece class', async () => {
    mount(ConfettiOverlay, { props: { active: true } })
    await nextTick()
    const pieces = getPieces()
    expect(pieces.length).toBeGreaterThan(0)
    for (const p of pieces) {
      expect(p.classList.contains('confetti-piece')).toBe(true)
    }
  })

  it('粒子有内联样式', async () => {
    mount(ConfettiOverlay, { props: { active: true } })
    await nextTick()
    const pieces = getPieces()
    expect(pieces.length).toBeGreaterThan(0)
    const first = pieces[0] as HTMLElement
    expect(first.style.left).toBeTruthy()
    expect(first.style.top).toBeTruthy()
    expect(first.style.background).toBeTruthy()
    expect(first.style.getPropertyValue('--fall-dist')).toBeTruthy()
    expect(first.style.getPropertyValue('--fall-dur')).toBeTruthy()
  })

  it('粒子尺寸 4-12px', async () => {
    mount(ConfettiOverlay, { props: { active: true } })
    await nextTick()
    const pieces = getPieces()
    expect(pieces.length).toBeGreaterThan(0)
    for (let i = 0; i < Math.min(pieces.length, 5); i++) {
      const size = parseFloat((pieces[i] as HTMLElement).style.width)
      expect(size).toBeGreaterThanOrEqual(4)
      expect(size).toBeLessThanOrEqual(12)
    }
  })

  it('使用自定义原点位置', async () => {
    mount(ConfettiOverlay, { props: { active: true, originX: 300, originY: 200 } })
    await nextTick()
    const pieces = getPieces()
    expect(pieces.length).toBeGreaterThan(0)
    // Particles should be near the origin
    const first = pieces[0] as HTMLElement
    const left = parseFloat(first.style.left)
    expect(left).toBeGreaterThanOrEqual(280)
    expect(left).toBeLessThanOrEqual(380)
  })
})
