import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JournalCategoryTabs from '@/components/knowledge/journal/JournalCategoryTabs.vue'
import RedDotBadge from '@/components/knowledge/RedDotBadge.vue'

function mountTabs(props: Record<string, unknown> = {}) {
    return mount(JournalCategoryTabs, {
        props: {
            activeCategory: 'core',
            hasDot: (cat: string) => cat === 'daily',
            ...props
        }
    })
}

describe('JournalCategoryTabs', () => {
    it('renders the three category tabs with labels', () => {
        const wrapper = mountTabs()
        expect(wrapper.findAll('button').length).toBe(3)
        expect(wrapper.text()).toContain('核心路径')
        expect(wrapper.text()).toContain('深度学习')
        expect(wrapper.text()).toContain('每日练习')
    })

    it('marks the active tab (no chapter filter active)', () => {
        const wrapper = mountTabs({ activeCategory: 'deep-dive' })
        const active = wrapper.findAll('.journal__tab--active')
        expect(active.length).toBe(1)
        expect(active[0].text()).toContain('深度学习')
    })

    it('suppresses the active style while a chapter filter is applied', () => {
        const wrapper = mountTabs({ chapterCategoryFilter: ['core'] })
        expect(wrapper.find('.journal__tab--active').exists()).toBe(false)
    })

    it('emits select with the clicked category', async () => {
        const wrapper = mountTabs()
        await wrapper.findAll('button')[2].trigger('click')
        expect(wrapper.emitted('select')).toEqual([['daily']])
    })

    it('shows the red dot only where hasDot returns true', () => {
        const wrapper = mountTabs()
        const badges = wrapper.findAllComponents(RedDotBadge)
        expect(badges.length).toBe(3)
        expect(badges.map((b) => b.props('show'))).toEqual([false, false, true])
    })
})
