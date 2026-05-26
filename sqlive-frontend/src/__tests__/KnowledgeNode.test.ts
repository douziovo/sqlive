import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import KnowledgeNode from '@/components/knowledge/KnowledgeNode.vue';
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph';

function makeData(overrides: Partial<KnowledgeNodeData> = {}): KnowledgeNodeData {
  return {
    topicId: 'test', label: 'Test', difficulty: 1, description: '',
    prerequisites: [], nextTopics: [], status: 'unlearned', ...overrides,
  };
}

describe('KnowledgeNode', () => {
  it('renders label text', () => {
    const w = mount(KnowledgeNode, { props: { id: 'topic-test', data: makeData({ label: 'JOIN 查询' }) } });
    expect(w.text()).toContain('JOIN 查询');
  });

  it('applies difficulty-1 background class', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ difficulty: 1 }) } });
    expect(w.find('.knowledge-node--difficulty-1').exists()).toBe(true);
  });

  it('applies difficulty-2 background class', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ difficulty: 2 }) } });
    expect(w.find('.knowledge-node--difficulty-2').exists()).toBe(true);
  });

  it('applies difficulty-3 background class', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ difficulty: 3 }) } });
    expect(w.find('.knowledge-node--difficulty-3').exists()).toBe(true);
  });

  it('mastered status shows solid green dot', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ status: 'mastered' }) } });
    expect(w.find('.knowledge-node__dot--mastered').exists()).toBe(true);
    expect(w.find('.knowledge-node--status-mastered').exists()).toBe(true);
  });

  it('in-progress status shows solid yellow dot', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ status: 'in-progress' }) } });
    expect(w.find('.knowledge-node__dot--in-progress').exists()).toBe(true);
    expect(w.find('.knowledge-node--status-in-progress').exists()).toBe(true);
  });

  it('unlearned status shows hollow gray dot', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ status: 'unlearned' }) } });
    expect(w.find('.knowledge-node__dot--unlearned').exists()).toBe(true);
    expect(w.find('.knowledge-node--status-unlearned').exists()).toBe(true);
  });

  it('does not render star ratings', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData() } });
    expect(w.text()).not.toContain('★');
  });

  it('does not render SVG checkmark', () => {
    const w = mount(KnowledgeNode, { props: { id: 'x', data: makeData({ status: 'mastered' }) } });
    expect(w.find('svg').exists()).toBe(false);
  });
});
