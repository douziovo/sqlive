import { Position } from '@vue-flow/core'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ErTableNode from '@/components/er/ErTableNode.vue'

vi.mock('@vue-flow/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@vue-flow/core')>()
    return {
        ...actual,
        Handle: {
            name: 'Handle',
            props: ['id', 'type', 'position'],
            template: '<div class="handle-stub" />'
        }
    }
})

const baseData = {
    tableName: 'users',
    columns: [
        { name: 'id', type: 'INTEGER', isPrimaryKey: true },
        { name: 'dept_id', type: 'INTEGER', isForeignKey: true },
        { name: 'email', type: 'TEXT', isUnique: true },
        { name: 'note', type: 'TEXT' }
    ]
}

function mountNode(
    dataOverrides: Record<string, unknown> = {},
    props: Record<string, unknown> = {}
) {
    return mount(ErTableNode, {
        props: {
            id: 'node-1',
            data: { ...baseData, ...dataOverrides },
            ...props
        } as any
    })
}

describe('ErTableNode', () => {
    it('renders the table name and all columns', () => {
        const wrapper = mountNode()
        expect(wrapper.find('.er-table-name').text()).toBe('users')
        expect(wrapper.findAll('.er-column-row')).toHaveLength(4)
    })

    it('renders pk/fk/unique badges per column', () => {
        const wrapper = mountNode()
        expect(wrapper.find('.er-badge-pk').text()).toBe('主键')
        expect(wrapper.find('.er-badge-fk').text()).toBe('外键')
        expect(wrapper.find('.er-badge-uq').text()).toBe('唯一')
    })

    it('renders source/target handles for key columns', () => {
        const wrapper = mountNode()
        // FK source handle + default source + default target + PK target
        const handles = wrapper.findAll('.handle-stub')
        expect(handles.length).toBeGreaterThanOrEqual(4)
    })

    it('applies filter/match state classes', () => {
        const filtered = mountNode({ isFiltered: true })
        expect(filtered.find('.er-table-node').classes()).toContain('opacity-30')

        const active = mountNode({ isActiveMatch: true })
        expect(active.find('.er-table-node').classes()).toContain('er-table-node-active')

        const match = mountNode({ isMatchHighlight: true })
        expect(match.find('.er-table-node').classes()).toContain('er-table-node-match')
    })

    it('emits navigate with the table name on double click', async () => {
        const wrapper = mountNode()
        await wrapper.find('.er-table-node').trigger('dblclick')
        expect(wrapper.emitted('navigate')).toEqual([['users']])
    })

    it('uses provided position props without error', () => {
        const wrapper = mountNode(
            {},
            { selected: true, sourcePosition: Position.Right, targetPosition: Position.Left }
        )
        expect(wrapper.find('.er-table-node').exists()).toBe(true)
    })
})
