import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import KnowledgePanel from '@/components/knowledge/KnowledgePanel.vue';
import { SQL_CONTEXT_KEY } from '@/viewmodel/injectionKeys';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockProvide = {
  [SQL_CONTEXT_KEY as symbol]: { tabs: { value: [] }, activeTabId: { value: '1' } },
};

describe('KnowledgePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('renders when isOpen is true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        topics: [
          { id: 'a', label: 'SQL 基础', description: '', keywords: [], patterns: [],
            difficulty: 1, prerequisites: [], nextTopics: [], category: 'basics' },
        ],
      }),
    });
    mount(KnowledgePanel, {
      props: { isOpen: true },
      global: { provide: mockProvide },
    });
    await vi.waitFor(() => document.querySelector('.knowledge-panel__topbar'), { timeout: 2000 });

    expect(document.querySelector('.knowledge-panel__title')?.textContent).toBe('知识图谱');
    expect(document.querySelector('.knowledge-panel__search')).not.toBeNull();
    expect(document.querySelector('.knowledge-panel__sidebar')).not.toBeNull();
  });

  it('does not render when isOpen is false', () => {
    mount(KnowledgePanel, {
      props: { isOpen: false },
      global: { provide: mockProvide },
    });
    expect(document.querySelector('.knowledge-panel__topbar')).toBeNull();
  });

  it('emits close on backdrop click', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ topics: [] }) });
    const w = mount(KnowledgePanel, {
      props: { isOpen: true },
      global: { provide: mockProvide },
    });
    await vi.waitFor(() => document.querySelector('.knowledge-panel__backdrop'), { timeout: 2000 });
    (document.querySelector('.knowledge-panel__backdrop') as HTMLElement)?.click();
    expect(w.emitted('close')).toBeTruthy();
  });
});
