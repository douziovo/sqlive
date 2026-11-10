import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import TruncationTooltip from '@/components/table/TruncationTooltip.vue'
import type { TruncationInfo } from '@/model/DatabaseTypes'
import { SQL_CONTEXT_KEY } from '@/model/injectionKeys'

function mountTooltip(truncations: TruncationInfo[] = []) {
    const lastTruncations = ref<TruncationInfo[]>(truncations)
    const wrapper = mount(TruncationTooltip, {
        global: {
            provide: { [SQL_CONTEXT_KEY as symbol]: { lastTruncations } },
            stubs: { teleport: true }
        }
    })
    return { wrapper, lastTruncations }
}

describe('TruncationTooltip', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('ignores empty truncation lists', async () => {
        const { wrapper, lastTruncations } = mountTooltip()
        lastTruncations.value = []
        await nextTick()
        // The tooltip markup is always present but kept hidden via v-show
        expect(wrapper.find('.fixed').attributes('style')).toContain('display: none')
        expect(wrapper.text()).toContain('原始长度 0 字符')
    })

    it('shows lengths and auto-hides after 3s', async () => {
        const cell = document.createElement('td')
        cell.dataset.column = 'name'
        document.body.append(cell)
        try {
            const { wrapper, lastTruncations } = mountTooltip()
            lastTruncations.value = [
                {
                    value: 'Ale',
                    wasTruncated: true,
                    originalValue: 'Alexander',
                    maxLength: 3,
                    column: 'name'
                }
            ]
            await nextTick()
            expect(wrapper.text()).toContain('原始长度 9 字符')
            expect(wrapper.text()).toContain('已截断为 3 字符')
            expect(wrapper.text()).toContain('列最大长度: 3')

            await vi.advanceTimersByTimeAsync(3100)
            await nextTick()
            expect(wrapper.find('.fixed').attributes('style')).toContain('display: none')
        } finally {
            cell.remove()
        }
    })

    it('defaults missing originalValue/maxLength to zero', async () => {
        const cell = document.createElement('td')
        cell.dataset.column = 'note'
        document.body.append(cell)
        try {
            const { wrapper, lastTruncations } = mountTooltip()
            lastTruncations.value = [{ value: 'x', wasTruncated: true, column: 'note' }]
            await nextTick()
            expect(wrapper.text()).toContain('原始长度 0 字符')
            expect(wrapper.text()).toContain('列最大长度: 0')
        } finally {
            cell.remove()
        }
    })

    it('positions the tooltip above the cell when below would overflow', async () => {
        const cell = document.createElement('td')
        cell.dataset.column = 'bio'
        // Cell near the bottom of a short viewport → below does not fit and above >= 0
        cell.getBoundingClientRect = () =>
            ({ top: 340, bottom: 360, left: 100, width: 50 }) as DOMRect
        document.body.append(cell)
        const innerHeightSpy = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(400)
        const innerWidthSpy = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800)
        try {
            const { wrapper, lastTruncations } = mountTooltip()
            lastTruncations.value = [
                {
                    value: 'x',
                    wasTruncated: true,
                    originalValue: 'y',
                    maxLength: 1,
                    column: 'bio'
                }
            ]
            await nextTick()
            await nextTick()
            await nextTick()
            const style = wrapper.find('.fixed').attributes('style') ?? ''
            // popupHeight fallback 60 → above = 340 - 60 - 4 = 276
            expect(style).toContain('top: 276px')
        } finally {
            innerHeightSpy.mockRestore()
            innerWidthSpy.mockRestore()
            cell.remove()
        }
    })

    it('replaces a pending hide timer when a second truncation arrives', async () => {
        const cell = document.createElement('td')
        cell.dataset.column = 'a'
        document.body.append(cell)
        try {
            const { wrapper, lastTruncations } = mountTooltip()
            lastTruncations.value = [
                { value: 'x', wasTruncated: true, originalValue: 'yy', maxLength: 1, column: 'a' }
            ]
            await nextTick()
            // Second truncation 2s later resets the 3s timer
            await vi.advanceTimersByTimeAsync(2000)
            lastTruncations.value = [
                { value: 'z', wasTruncated: true, originalValue: 'zzz', maxLength: 1, column: 'a' }
            ]
            await nextTick()
            expect(wrapper.text()).toContain('原始长度 3 字符')
            await vi.advanceTimersByTimeAsync(2500)
            expect(wrapper.text()).toContain('原始长度 3 字符')
            await vi.advanceTimersByTimeAsync(600)
            expect(wrapper.find('.fixed').attributes('style')).toContain('display: none')
        } finally {
            cell.remove()
        }
    })

    it('clears a pending timer on unmount', async () => {
        const cell = document.createElement('td')
        cell.dataset.column = 'b'
        document.body.append(cell)
        try {
            const { wrapper, lastTruncations } = mountTooltip()
            lastTruncations.value = [
                { value: 'x', wasTruncated: true, originalValue: 'yy', maxLength: 1, column: 'b' }
            ]
            await nextTick()
            wrapper.unmount()
            vi.advanceTimersByTime(4000)
            expect(vi.getTimerCount()).toBe(0)
        } finally {
            cell.remove()
        }
    })
})
