import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { PreviewItem } from '@/composables/useFilteredList'

import HoverPreview from '../../components/HoverPreview.vue'

const sampleItems: PreviewItem[] = [
    { id: 'idx-1', icon: '\u{1F4CB}', label: 'idx_employees_dept', meta: ['列: dept_id  ·  普通'] },
    {
        id: 'idx-2',
        icon: '\u{1F48E}',
        label: 'idx_employees_email',
        meta: ['列: email  ·  UNIQUE'],
        accent: 'blue'
    }
]

function mountPreview(overrides: Record<string, any> = {}) {
    const triggerEl = document.createElement('div')
    document.body.append(triggerEl)

    return {
        wrapper: mount(HoverPreview, {
            props: {
                show: false,
                triggerEl,
                icon: '\u{1F4C7}',
                title: '索引 · employees 表',
                subtitle: '共 6 个索引',
                categoryName: '索引',
                items: sampleItems,
                ...overrides
            },
            global: { stubs: { teleport: true } }
        }),
        triggerEl
    }
}

async function showPreview(wrapper: ReturnType<typeof mount>, overrides: Record<string, any> = {}) {
    await wrapper.setProps({ show: true, ...overrides })
    await vi.advanceTimersByTimeAsync(350)
}

describe('HoverPreview', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('shows title when show becomes true', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)
        expect(wrapper.text()).toContain('索引 · employees 表')
    })

    it('shows subtitle', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)
        expect(wrapper.text()).toContain('共 6 个索引')
    })

    it('renders all items', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)
        expect(wrapper.text()).toContain('idx_employees_dept')
        expect(wrapper.text()).toContain('idx_employees_email')
    })

    it('filters items by text', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        const input = wrapper.find('input')
        await input.setValue('email')
        await nextTick()

        expect(wrapper.text()).toContain('idx_employees_email')
        expect(wrapper.text()).not.toContain('idx_employees_dept')
    })

    it('shows "无匹配项" when filter has no matches', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        const input = wrapper.find('input')
        await input.setValue('zzz_nonexistent')
        await nextTick()

        expect(wrapper.text()).toContain('无匹配项')
    })

    it('shows filtered count', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        const input = wrapper.find('input')
        await input.setValue('email')
        await nextTick()

        expect(wrapper.text()).toContain('1/2')
    })

    it('emits select when item is clicked', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        const firstItem = wrapper.find('[class*="cursor-pointer"]')
        await firstItem.trigger('click')
        const selectEvents = wrapper.emitted('select')
        expect(selectEvents).toBeTruthy()
        expect(selectEvents?.[0]).toEqual(['idx-1'])
    })

    it('handles empty items array gracefully', async () => {
        const { wrapper } = mountPreview({ items: [] })
        await showPreview(wrapper, { items: [] })
        // Should render without crashing — the popup content renders
        expect(wrapper.find('input').exists()).toBe(true)
    })

    it('updates cache when props change while visible', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)
        expect(wrapper.text()).toContain('索引 · employees 表')

        await wrapper.setProps({
            title: '触发器 · employees 表',
            subtitle: '共 4 个触发器',
            icon: '\u{26A1}',
            categoryName: '触发器',
            items: [
                {
                    id: 'trg-1',
                    icon: '\u{26A1}',
                    label: 'trg_employees_insert',
                    meta: ['AFTER INSERT']
                }
            ]
        })
        await nextTick()

        expect(wrapper.text()).toContain('触发器 · employees 表')
        expect(wrapper.text()).toContain('共 4 个触发器')
        expect(wrapper.text()).toContain('trg_employees_insert')
    })

    it('ArrowDown 递增 keyboardIndex 并高亮第一项', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        const input = wrapper.find('input')
        await input.trigger('keydown', { key: 'ArrowDown' })

        // First item (idx-1, accent 'none') should get bg-muted class
        const items = wrapper.findAll('[class*="cursor-pointer"]')
        expect(items[0].classes()).toContain('bg-muted')
    })

    it('ArrowUp 递减 keyboardIndex', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        const input = wrapper.find('input')
        // Navigate down twice to land on second item
        await input.trigger('keydown', { key: 'ArrowDown' })
        await input.trigger('keydown', { key: 'ArrowDown' })
        // Navigate up once — should go back to first item
        await input.trigger('keydown', { key: 'ArrowUp' })

        const items = wrapper.findAll('[class*="cursor-pointer"]')
        expect(items[0].classes()).toContain('bg-muted')
        expect(items[1].classes()).not.toContain('bg-muted')
    })

    it('Enter 在选中项时触发 select 事件', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        const input = wrapper.find('input')
        await input.trigger('keydown', { key: 'ArrowDown' })
        await input.trigger('keydown', { key: 'Enter' })

        const selectEvents = wrapper.emitted('select')
        expect(selectEvents).toBeTruthy()
        expect(selectEvents?.[0]).toEqual(['idx-1'])
    })

    it('Escape 先清除 filterText，再次关闭弹窗', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        const input = wrapper.find('input')
        await input.setValue('email')
        await nextTick()
        // After filtering: only one item visible, counter shows "1/2"
        expect(wrapper.text()).toContain('1/2')

        // First Escape: clears filter — counter disappears, both items visible
        await input.trigger('keydown', { key: 'Escape' })
        await nextTick()
        expect(wrapper.text()).toContain('idx_employees_dept')
        expect(wrapper.text()).not.toContain('1/2')

        // Second Escape: hides popup via v-show
        await input.trigger('keydown', { key: 'Escape' })
        await nextTick()
        const popupEl = wrapper.find('[class*="fixed"][class*="z-50"]')
        expect(popupEl.exists()).toBe(true)
        expect((popupEl.element as HTMLElement).style.display).toBe('none')
    })

    it('positionPopup 计算 above 定位（triggerEl 靠近底部）', async () => {
        const { wrapper, triggerEl } = mountPreview()

        // Mock triggerEl near bottom of viewport
        vi.spyOn(triggerEl, 'getBoundingClientRect').mockReturnValue({
            x: 100,
            y: 900,
            width: 100,
            height: 20,
            top: 900,
            right: 200,
            bottom: 920,
            left: 100,
            toJSON: () => ({})
        })

        await showPreview(wrapper)

        // popup should be positioned above the trigger (top < 800 for viewport ~1024)
        const popupEl = wrapper.find('[class*="fixed"][class*="z-50"]')
        expect(popupEl.exists()).toBe(true)
        const styleTop = (popupEl.element as HTMLElement).style.top
        expect(styleTop).toBeTruthy()
        const topVal = parseInt(styleTop, 10)
        // With rect.bottom=920, viewportH~1024, top should be above (~696)
        expect(topVal).toBeLessThan(800)
    })

    it('selectedItem 按钮点击触发 select', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        // Filter to single item, then use ArrowDown to set keyboardIndex
        const input = wrapper.find('input')
        await input.setValue('email')
        await nextTick()
        await input.trigger('keydown', { key: 'ArrowDown' })

        // The "查看" button with selectedItem label should now be visible
        const buttons = wrapper.findAll('button')
        const viewBtn = buttons.find((b) => b.text().includes('idx_employees_email'))
        expect(viewBtn).toBeTruthy()

        await viewBtn!.trigger('click')
        const selectEvents = wrapper.emitted('select')
        expect(selectEvents).toBeTruthy()
        expect(selectEvents?.[0]).toEqual(['idx-2'])
    })

    it('cancels a pending show timer when hidden before the delay elapses', async () => {
        const { wrapper } = mountPreview()
        await wrapper.setProps({ show: true })
        await vi.advanceTimersByTimeAsync(100) // show timer still pending
        await wrapper.setProps({ show: false })
        await vi.advanceTimersByTimeAsync(400)

        // The 300ms show delay never completed, so the popup never appeared
        const popupEl = wrapper.find('[class*="fixed"][class*="z-50"]')
        expect((popupEl.element as HTMLElement).style.display).toBe('none')
    })

    it('re-showing within the hide delay cancels the pending hide', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)
        await wrapper.setProps({ show: false })
        await vi.advanceTimersByTimeAsync(100) // hide timer pending, still visible
        await wrapper.setProps({ show: true })
        await vi.advanceTimersByTimeAsync(400)

        const popupEl = wrapper.find('[class*="fixed"][class*="z-50"]')
        expect((popupEl.element as HTMLElement).style.display).not.toBe('none')
        expect(wrapper.text()).toContain('idx_employees_dept')
    })

    it('clears the cached display data after the hide delay', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)
        expect(wrapper.text()).toContain('索引 · employees 表')

        await wrapper.setProps({ show: false, title: '', subtitle: '', items: [] })
        await vi.advanceTimersByTimeAsync(250)

        const popupEl = wrapper.find('[class*="fixed"][class*="z-50"]')
        expect((popupEl.element as HTMLElement).style.display).toBe('none')
        expect(wrapper.text()).not.toContain('索引 · employees 表')
    })

    it('clicking an item during the hide delay selects it and hides immediately', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)
        await wrapper.setProps({ show: false }) // hide pending, popup still visible

        const item = wrapper.findAll('[class*="cursor-pointer"]')[0]
        await item.trigger('click')
        expect(wrapper.emitted('select')).toEqual([['idx-1']])

        const popupEl = wrapper.find('[class*="fixed"][class*="z-50"]')
        expect((popupEl.element as HTMLElement).style.display).toBe('none')
    })

    it('clear-filter button resets the filter and refocuses the input', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        await wrapper.find('input').setValue('email')
        expect(wrapper.text()).toContain('1/2')

        const clearBtn = wrapper.findAll('button').find((b) => b.text().includes('✕'))
        await clearBtn!.trigger('click')
        await nextTick()
        expect(wrapper.text()).not.toContain('1/2')
        expect(wrapper.text()).toContain('idx_employees_dept')
    })

    it('mouseenter drives the hovered highlight and mouseleave resets it', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        const items = wrapper.findAll('[class*="cursor-pointer"]')
        await items[1].trigger('mouseenter')
        // Re-query: DOMWrapper caches classes at creation time
        expect(wrapper.findAll('[class*="cursor-pointer"]')[1].classes()).toContain('bg-primary/10')

        // Moving to the other item moves the highlight (hoveredIndex + keyboardIndex)
        await wrapper.findAll('[class*="cursor-pointer"]')[0].trigger('mouseleave')
        await wrapper.findAll('[class*="cursor-pointer"]')[0].trigger('mouseenter')
        const after = wrapper.findAll('[class*="cursor-pointer"]')
        expect(after[0].classes()).toContain('bg-muted')
        expect(after[1].classes()).not.toContain('bg-primary/10')
    })

    it('keyboard navigation with no matching items is a no-op', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        const input = wrapper.find('input')
        await input.setValue('zzz_no_match')
        await nextTick()
        expect(wrapper.text()).toContain('无匹配项')

        await input.trigger('keydown', { key: 'ArrowDown' })
        await input.trigger('keydown', { key: 'Enter' })
        expect(wrapper.emitted('select')).toBeUndefined()
    })

    it('Enter without a keyboard selection does not emit select', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)
        await wrapper.find('input').trigger('keydown', { key: 'Enter' })
        expect(wrapper.emitted('select')).toBeUndefined()
    })

    it('Escape during the pending hide delay hides the popup immediately', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)
        // Start the delayed hide, then press Escape before the delay elapses
        await wrapper.setProps({ show: false })
        await wrapper.find('input').trigger('keydown', { key: 'Escape' })
        const popupEl = wrapper.find('[class*="fixed"][class*="z-50"]')
        expect((popupEl.element as HTMLElement).style.display).toBe('none')
    })

    it('forwards mouseenter/mouseleave from the popup body', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)
        const popup = wrapper.find('[class*="fixed"][class*="z-50"]')
        await popup.trigger('mouseenter')
        expect(wrapper.emitted('mouseenter')).toHaveLength(1)
        await popup.trigger('mouseleave')
        expect(wrapper.emitted('mouseleave')).toHaveLength(1)
    })

    it('emits navigate-all from the bottom action bar', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)
        const viewAllBtn = wrapper.findAll('button').find((b) => b.text().includes('查看全部'))
        expect(viewAllBtn).toBeTruthy()
        await viewAllBtn!.trigger('click')
        expect(wrapper.emitted('navigate-all')).toHaveLength(1)
    })

    it('ArrowDown scrolls the highlighted item into view', async () => {
        const { wrapper } = mountPreview()
        await showPreview(wrapper)

        const list = wrapper.find('[class*="max-h-[320px]"]')
        const firstChild = list.element.children[0] as HTMLElement
        const scrollSpy = vi.spyOn(firstChild, 'scrollIntoView').mockImplementation(() => {})
        await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' })
        expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest' })
    })
})
