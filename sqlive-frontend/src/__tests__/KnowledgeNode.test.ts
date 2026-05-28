import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import KnowledgeNode from '@/components/knowledge/KnowledgeNode.vue'
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph'

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
    const w = mount(KnowledgeNode, { props: { id: 'topic-test', data: makeData({ label: 'JOIN 查询' }) } })
    expect(w.text()).toContain('JOIN 查询')
  })

  it('applies difficulty-1 background class', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ difficulty: 1 }) } })
    expect(w.find('.knowledge-node--difficulty-1').exists()).toBe(true)
  })

  it('applies difficulty-2 background class', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ difficulty: 2 }) } })
    expect(w.find('.knowledge-node--difficulty-2').exists()).toBe(true)
  })

  it('applies difficulty-3 background class', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ difficulty: 3 }) } })
    expect(w.find('.knowledge-node--difficulty-3').exists()).toBe(true)
  })

  it('mastered status shows solid green dot', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ status: 'mastered' }) } })
    expect(w.find('.knowledge-node__dot--mastered').exists()).toBe(true)
    expect(w.find('.knowledge-node--status-mastered').exists()).toBe(true)
  })

  it('in-progress status shows solid yellow dot', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ status: 'in-progress' }) } })
    expect(w.find('.knowledge-node__dot--in-progress').exists()).toBe(true)
    expect(w.find('.knowledge-node--status-in-progress').exists()).toBe(true)
  })

  it('unlearned status shows hollow gray dot', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ status: 'unlearned' }) } })
    expect(w.find('.knowledge-node__dot--unlearned').exists()).toBe(true)
    expect(w.find('.knowledge-node--status-unlearned').exists()).toBe(true)
  })

  it('does not render star ratings', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData() } })
    expect(w.text()).not.toContain('★')
  })

  it('does not render SVG checkmark', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ status: 'mastered' }) } })
    expect(w.find('svg').exists()).toBe(false)
  })

  it('renders dot-only circle when zoomLevel < 0.5', () => {
    const w = mount(KnowledgeNode, {
      props: { id: 'x', data: makeData({ label: 'JOIN' }) },
      global: { provide: { zoomLevel: 0.3 } }
    })
    expect(w.find('.knowledge-node-dot').exists()).toBe(true)
    expect(w.find('.knowledge-node').exists()).toBe(false)
  })

  it('renders compact mode when zoom between 0.5 and 1.2', () => {
    const w = mount(KnowledgeNode, {
      props: { id: 'x', data: makeData({ label: 'JOIN' }) },
      global: { provide: { zoomLevel: 0.8 } }
    })
    expect(w.find('.knowledge-node').exists()).toBe(true)
    expect(w.find('.knowledge-node--expanded').exists()).toBe(false)
    expect(w.find('.knowledge-node-dot').exists()).toBe(false)
  })

  it('renders expanded mode with description when zoom >= 1.2', () => {
    const w = mount(KnowledgeNode, {
      props: { id: 'x', data: makeData({ label: 'JOIN', description: 'Learn how to combine tables' }) },
      global: { provide: { zoomLevel: 1.5 } }
    })
    expect(w.find('.knowledge-node--expanded').exists()).toBe(true)
    expect(w.text()).toContain('Learn how to combine tables')
  })

  it('truncates long description in expanded mode', () => {
    const longDesc = 'A very long description that exceeds thirty characters definitely'
    const w = mount(KnowledgeNode, {
      props: { id: 'x', data: makeData({ label: 'Test', description: longDesc }) },
      global: { provide: { zoomLevel: 1.5 } }
    })
    expect(w.text()).toContain('...')
  })

  it('renders difficulty tag in expanded mode', () => {
    const w = mount(KnowledgeNode, {
      props: { id: 'x', data: makeData({ difficulty: 2 }) },
      global: { provide: { zoomLevel: 1.5 } }
    })
    expect(w.find('.knowledge-node__diff-tag').exists()).toBe(true)
    expect(w.text()).toContain('进阶')
  })
})
