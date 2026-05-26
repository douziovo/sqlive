import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import KnowledgeDetail from '@/components/knowledge/KnowledgeDetail.vue';
import type { KnowledgeTopic } from '@/composables/useKnowledgeGraph';

const mockTopic: KnowledgeTopic = {
  id: 'joins', label: 'JOIN 查询',
  description: '连接多张表进行联合查询',
  keywords: [], patterns: [], difficulty: 2,
  prerequisites: ['sql-basics', 'filtering'],
  nextTopics: ['subqueries', 'aggregation'],
  category: 'query',
};

describe('KnowledgeDetail', () => {
  it('renders nothing when topic is null', () => {
    const w = mount(KnowledgeDetail, {
      props: { topic: null, isMastered: false },
    });
    expect(w.find('.knowledge-detail').exists()).toBe(false);
  });

  it('renders topic details', () => {
    const w = mount(KnowledgeDetail, {
      props: { topic: mockTopic, isMastered: false },
    });
    expect(w.text()).toContain('JOIN 查询');
    expect(w.text()).toContain('连接多张表进行联合查询');
    expect(w.text()).toContain('sql-basics, filtering');
    expect(w.text()).toContain('subqueries, aggregation');
  });

  it('shows mark-mastered button when not mastered', () => {
    const w = mount(KnowledgeDetail, {
      props: { topic: mockTopic, isMastered: false },
    });
    expect(w.text()).toContain('标记已掌握');
  });

  it('shows cancel-master button when already mastered', () => {
    const w = mount(KnowledgeDetail, {
      props: { topic: mockTopic, isMastered: true },
    });
    expect(w.text()).toContain('取消掌握');
  });

  it('emits toggle-mastered on button click', async () => {
    const w = mount(KnowledgeDetail, {
      props: { topic: mockTopic, isMastered: false },
    });
    await w.find('.knowledge-detail__btn--master').trigger('click');
    expect(w.emitted('toggle-mastered')).toBeTruthy();
    expect(w.emitted('toggle-mastered')![0]).toEqual(['joins']);
  });

  it('emits ask-ai on AI button click', async () => {
    const w = mount(KnowledgeDetail, {
      props: { topic: mockTopic, isMastered: false },
    });
    await w.find('.knowledge-detail__btn--ai').trigger('click');
    expect(w.emitted('ask-ai')![0]).toEqual(['JOIN 查询']);
  });
});
