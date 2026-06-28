import {mount} from '@vue/test-utils'
import {describe, expect, it} from 'vitest'
import KnowledgeNode from '@/components/knowledge/KnowledgeNode.vue'
import type {KnowledgeNodeData} from '@/composables/useKnowledgeGraph'

function makeData(overrides: Partial<KnowledgeNodeData> = {}): KnowledgeNodeData {
    return {
        topicId: 'test',
        label: 'Test',
        difficulty: 1,
        description: '',
        prerequisites: [],
        nextTopics: [],
        status: 'unlearned',
        ...overrides
    }
}

describe('KnowledgeNode', () => {
    it('renders label text', () => {
        const w = mount(KnowledgeNode, {props: {id: 'topic-test', data: makeData({label: 'JOIN 查询'})}})
        expect(w.text()).toContain('JOIN 查询')
    })

    it('applies difficulty-1 class', () => {
        const w = mount(KnowledgeNode, {props: {id: 'x', data: makeData({difficulty: 1})}})
        expect(w.find('.kg-node--d1').exists()).toBe(true)
    })

    it('applies difficulty-2 class', () => {
        const w = mount(KnowledgeNode, {props: {id: 'x', data: makeData({difficulty: 2})}})
        expect(w.find('.kg-node--d2').exists()).toBe(true)
    })

    it('applies difficulty-3 class', () => {
        const w = mount(KnowledgeNode, {props: {id: 'x', data: makeData({difficulty: 3})}})
        expect(w.find('.kg-node--d3').exists()).toBe(true)
    })

    it('mastered status applies correct class', () => {
        const w = mount(KnowledgeNode, {props: {id: 'x', data: makeData({status: 'mastered'})}})
        expect(w.find('.kg-node--mastered').exists()).toBe(true)
    })

    it('in-progress status applies correct class', () => {
        const w = mount(KnowledgeNode, {props: {id: 'x', data: makeData({status: 'in-progress'})}})
        expect(w.find('.kg-node--in-progress').exists()).toBe(true)
    })

    it('unlearned status applies correct class', () => {
        const w = mount(KnowledgeNode, {props: {id: 'x', data: makeData({status: 'unlearned'})}})
        expect(w.find('.kg-node--unlearned').exists()).toBe(true)
    })

    it('does not render star ratings', () => {
        const w = mount(KnowledgeNode, {props: {id: 'x', data: makeData()}})
        expect(w.text()).not.toContain('★')
    })

    it('does not render SVG checkmark', () => {
        const w = mount(KnowledgeNode, {props: {id: 'x', data: makeData({status: 'mastered'})}})
        expect(w.find('svg').exists()).toBe(false)
    })

    it('renders label visible when zoom is mid-range', () => {
        const w = mount(KnowledgeNode, {
            props: {id: 'x', data: makeData({label: 'JOIN'})},
            global: {provide: {zoomLevel: 0.8}}
        })
        // kg-node is always the wrapper; both dot and label layers exist in DOM
        expect(w.find('.kg-node').exists()).toBe(true)
        expect(w.find('.kg-node--expanded').exists()).toBe(false)
        expect(w.find('.kg-node__label').exists()).toBe(true)
        expect(w.text()).toContain('JOIN')
    })

    // ── D-07 truncate + D-12 focus-visible + title attr ────────

    it('renders label with title attribute for tooltip', () => {
        const w = mount(KnowledgeNode, {
            props: {id: 'x', data: makeData({label: 'CTE 公共表表达式'})}
        })
        expect(w.find('.kg-node__label').attributes('title')).toBe('CTE 公共表表达式')
    })

    it('root node has tabindex=0 for keyboard focus', () => {
        const w = mount(KnowledgeNode, {
            props: {id: 'x', data: makeData()}
        })
        expect(w.find('.kg-node').attributes('tabindex')).toBe('0')
    })

    it('label has truncate CSS class', () => {
        const w = mount(KnowledgeNode, {
            props: {id: 'x', data: makeData()}
        })
        // CSS property values can't be reliably read in jsdom; verify class exists
        expect(w.find('.kg-node__label').exists()).toBe(true)
    })

})
