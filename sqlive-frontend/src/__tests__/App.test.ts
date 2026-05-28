import { describe, it, expect, vi } from 'vitest';

import { mount } from '@vue/test-utils';
import App from '@/App.vue';
import { SQL_CONTEXT_KEY, AI_ACTIONS_KEY } from '@/model/injectionKeys';

describe('App', () => {
  it('renders without error', () => {
    const w = mount(App, {
      global: {
        stubs: {
          Splitpanes: { template: '<div><slot /></div>' },
          Pane: { template: '<div><slot /></div>' },
          CodeEditor: true,
          DataVisualizer: true,
          AiChatPanel: true,
          KnowledgePanel: true,
          LearningCompanion: true,
        },
        provide: {
          [SQL_CONTEXT_KEY as symbol]: {
            db: {
              tables: [],
              queryResults: [],
              indexes: [],
              views: [],
              triggers: [],
              foreignKeys: [],
              metadata: null,
            },
            highlight: {
              actionType: 'none',
              activeTables: [],
              activeRows: [],
              activeColumns: [],
              flashingRows: [],
              refreshSeed: 0,
            },
          },
          [AI_ACTIONS_KEY as symbol]: {
            isLoading: { value: false },
            analyzeError: vi.fn(),
          },
        },
      },
    });
    expect(w.exists()).toBe(true);
  });
});
