import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { SortFieldDef } from '../../components/SortFilterToolbar.vue'
import SortFilterToolbar from '../../components/SortFilterToolbar.vue'

const fields: SortFieldDef[] = [
    { key: 'name', label: '名称' },
    { key: 'count', label: '数量' }
]

function mountToolbar(overrides: Record<string, any> = {}) {
    return mount(SortFilterToolbar, {
        props: {
            filter: '',
            placeholder: '搜索...',
            fields,
            sortKey: null as string | null,
            sortDir: null as 'asc' | 'desc' | null,
            itemLabel: '索引',
            totalCount: 10,
            filteredCount: 5,
            ...overrides
        }
    })
}

describe('SortFilterToolbar', () => {
    it('renders filter input with placeholder', () => {
        const wrapper = mountToolbar()
        const input = wrapper.find('input')
        expect(input.exists()).toBe(true)
        expect(input.attributes('placeholder')).toBe('搜索...')
    })

    it('renders sort buttons for each field', () => {
        const wrapper = mountToolbar()
        expect(wrapper.text()).toContain('名称')
        expect(wrapper.text()).toContain('数量')
    })

    it('emits update:filter on input', async () => {
        const wrapper = mountToolbar()
        const input = wrapper.find('input')
        await input.setValue('test')
        // The component likely debounces; check emitted events
        expect(wrapper.emitted('update:filter')?.[0]).toEqual(['test'])
    })

    it('emits toggle-sort when sort button clicked', async () => {
        const wrapper = mountToolbar()
        const buttons = wrapper.findAll('button')
        const nameBtn = buttons.find((b) => b.text().includes('名称'))
        expect(nameBtn).toBeTruthy()

        await nameBtn!.trigger('click')
        expect(wrapper.emitted('toggle-sort')?.[0]).toEqual(['name'])
    })

    it('shows filtered count vs total count', () => {
        const wrapper = mountToolbar()
        expect(wrapper.text()).toContain('5')
        expect(wrapper.text()).toContain('10')
    })

    it('hides the filtered-vs-total suffix when nothing is filtered out', () => {
        const wrapper = mountToolbar({ filteredCount: 10 })
        expect(wrapper.text()).not.toContain('过滤前')
    })

    it('shows the clear (✕) button only with filter text and emits an empty filter', async () => {
        const findClear = (w: ReturnType<typeof mountToolbar>) =>
            w.findAll('button').find((b) => b.text().includes('✕'))
        const wrapper = mountToolbar({ filter: '' })
        expect(findClear(wrapper)).toBeUndefined()

        await wrapper.setProps({ filter: 'abc' })
        const clearBtn = findClear(wrapper)
        expect(clearBtn).toBeTruthy()
        await clearBtn!.trigger('click')
        expect(wrapper.emitted('update:filter')?.at(-1)).toEqual([''])
    })

    it('renders asc/desc arrows on the active sort field', async () => {
        const wrapper = mountToolbar({ sortKey: 'name', sortDir: 'asc' })
        expect(wrapper.text()).toContain('▲')
        await wrapper.setProps({ sortDir: 'desc' })
        expect(wrapper.text()).toContain('▼')
        expect(wrapper.text()).not.toContain('▲')
    })
})
