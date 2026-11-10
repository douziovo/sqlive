import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import KnowledgePanelFilters from '@/components/knowledge/panel/KnowledgePanelFilters.vue'
import KnowledgePanelTopbar from '@/components/knowledge/panel/KnowledgePanelTopbar.vue'

const progress = {
    count: 3,
    total: 10,
    levelName: 'Lv.2',
    xp: 40,
    nextLevelXp: 100,
    streak: 2
}

function mountTopbar(props: Record<string, unknown> = {}) {
    return mount(KnowledgePanelTopbar, {
        props: {
            activeTab: 'graph',
            searchQuery: '',
            activeDifficulty: null,
            activeCategory: null,
            showTaskTabDot: false,
            progress,
            xpBarPercent: 40,
            ...props
        }
    })
}

describe('KnowledgePanelTopbar', () => {
    it('emits close from the back button', async () => {
        const wrapper = mountTopbar()
        await wrapper.find('.knowledge-panel__back-btn').trigger('click')
        expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('emits update:searchQuery while typing', async () => {
        const wrapper = mountTopbar()
        const input = wrapper.find('.knowledge-panel__search')
        await input.setValue('join')
        expect(wrapper.emitted('update:searchQuery')).toEqual([['join']])
        // v-model passthrough keeps the prop value
        await wrapper.setProps({ searchQuery: 'join' })
        expect((input.element as HTMLInputElement).value).toBe('join')
    })

    it('emits tab-click for graph / tasks / chapters', async () => {
        const wrapper = mountTopbar()
        const tabs = wrapper.findAll('.knowledge-panel__tab')
        expect(tabs.length).toBe(3)
        await tabs[0].trigger('click')
        await tabs[1].trigger('click')
        await tabs[2].trigger('click')
        expect(wrapper.emitted('tab-click')).toEqual([['graph'], ['tasks'], ['chapters']])
    })

    it('marks the active tab', () => {
        const wrapper = mountTopbar({ activeTab: 'tasks' })
        const active = wrapper.findAll('.knowledge-panel__tab--active')
        expect(active.length).toBe(1)
        expect(active[0].text()).toContain('任务')
    })

    it('shows filters only on the graph tab and forwards their events', async () => {
        const wrapper = mountTopbar()
        let filters = wrapper.findComponent(KnowledgePanelFilters)
        expect(filters.exists()).toBe(true)
        filters.vm.$emit('toggle-difficulty', 'beginner')
        filters.vm.$emit('toggle-category', 'join')
        filters.vm.$emit('reset-filters')
        expect(wrapper.emitted('toggle-difficulty')).toEqual([['beginner']])
        expect(wrapper.emitted('toggle-category')).toEqual([['join']])
        expect(wrapper.emitted('reset-filters')).toHaveLength(1)

        await wrapper.setProps({ activeTab: 'tasks' })
        expect(wrapper.findComponent(KnowledgePanelFilters).exists()).toBe(false)
    })

    it('shows the task tab dot only when enabled', () => {
        const withoutDot = mountTopbar()
        expect(withoutDot.find('.red-dot-badge').exists()).toBe(false)
        const withDot = mountTopbar({ showTaskTabDot: true })
        expect(withDot.find('.red-dot-badge').exists()).toBe(true)
    })

    it('renders progress numbers, XP bar width and streak', () => {
        const wrapper = mountTopbar()
        expect(wrapper.text()).toContain('Lv.2')
        expect(wrapper.text()).toContain('40/100')
        expect(wrapper.text()).toContain('3/10')
        expect(wrapper.find('.knowledge-panel__xp-bar-fill').attributes('style')).toContain(
            'width: 40%'
        )
        expect(wrapper.find('.knowledge-panel__streak').exists()).toBe(true)
    })

    it('hides the streak badge at zero streak', () => {
        const wrapper = mountTopbar({ progress: { ...progress, streak: 0 } })
        expect(wrapper.find('.knowledge-panel__streak').exists()).toBe(false)
    })
})
