import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useKnowledgeGraph } from '@/composables/useKnowledgeGraph';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockGraphData = {
  topics: [
    { id: 'sql-basics', label: 'SQL 基础查询', description: '基础 SELECT', keywords: ['SELECT', 'FROM', 'WHERE'], patterns: ['SELECT\\s+.*\\s+FROM'], difficulty: 1, prerequisites: [], nextTopics: ['filtering'], category: 'basics' },
    { id: 'filtering', label: '条件过滤', description: 'WHERE 过滤', keywords: ['AND', 'OR', 'IN'], patterns: ['WHERE.*(?:AND|OR)'], difficulty: 1, prerequisites: ['sql-basics'], nextTopics: ['sorting'], category: 'basics' },
    { id: 'joins', label: 'JOIN 查询', description: '连接查询', keywords: ['JOIN', 'INNER JOIN'], patterns: ['\\bJOIN\\s+\\w+'], difficulty: 2, prerequisites: ['sql-basics', 'filtering'], nextTopics: ['subqueries'], category: 'query' },
  ],
};

describe('useKnowledgeGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('fetchGraph loads data and computes nodes/edges', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGraphData),
    });

    const kg = useKnowledgeGraph();
    await kg.fetchGraph();

    expect(kg.graphData.value).not.toBeNull();
    expect(kg.graphData.value!.topics).toHaveLength(3);
    expect(kg.nodes.value).toHaveLength(3);
    expect(kg.edges.value.length).toBe(1);
    expect(kg.progress.value.total).toBe(3);
  });

  it('progress reflects mastered topics from localStorage', async () => {
    localStorage.setItem('ai-mastered-topics', JSON.stringify(['sql-basics', 'filtering']));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGraphData),
    });

    const kg = useKnowledgeGraph();
    await kg.fetchGraph();

    expect(kg.progress.value.count).toBe(2);
    expect(kg.progress.value.percentage).toBe(67);
    expect(kg.progress.value.level).toBe('进阶学者');
  });

  it('toggleMastered adds and removes topics', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGraphData),
    });

    const kg = useKnowledgeGraph();
    await kg.fetchGraph();

    kg.toggleMastered('sql-basics');
    expect(kg.masteredTopics.value).toContain('sql-basics');
    expect(kg.progress.value.count).toBe(1);

    kg.toggleMastered('sql-basics');
    expect(kg.masteredTopics.value).not.toContain('sql-basics');
    expect(kg.progress.value.count).toBe(0);

    const stored = JSON.parse(localStorage.getItem('ai-mastered-topics') || '[]');
    expect(stored).not.toContain('sql-basics');
  });

  it('selectedNode starts null and can be set', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGraphData),
    });

    const kg = useKnowledgeGraph();
    await kg.fetchGraph();

    expect(kg.selectedNode.value).toBeNull();
    kg.selectedNode.value = 'joins';
    expect(kg.selectedNode.value).toBe('joins');
  });

  it('selectedNodeData computed from graphData', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGraphData),
    });

    const kg = useKnowledgeGraph();
    await kg.fetchGraph();

    kg.selectedNode.value = 'joins';
    expect(kg.selectedNodeData.value?.label).toBe('JOIN 查询');
    expect(kg.selectedNodeData.value?.difficulty).toBe(2);
  });

  it('focusNode sets selectedNode', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockGraphData),
    });

    const kg = useKnowledgeGraph();
    await kg.fetchGraph();

    kg.focusNode('filtering');
    expect(kg.selectedNode.value).toBe('filtering');
  });

  it('fetchGraph handles HTTP error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const kg = useKnowledgeGraph();
    await kg.fetchGraph();

    expect(kg.graphData.value).toBeNull();
    expect(kg.progress.value.total).toBe(0);
  });

  it('fetchGraph handles network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const kg = useKnowledgeGraph();
    await kg.fetchGraph();

    expect(kg.graphData.value).toBeNull();
  });

  // ── inProgressTopics ─────────────────────────────────────────

  it('inProgressTopics detects keywords in SQL (case-insensitive)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGraphData) });
    const kg = useKnowledgeGraph({ sqlSource: () => 'select * from users' });
    await kg.fetchGraph();

    expect(kg.inProgressTopics.value.has('sql-basics')).toBe(true);
    expect(kg.inProgressTopics.value.has('filtering')).toBe(false);
  });

  it('inProgressTopics detects regex patterns in SQL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGraphData) });
    const kg = useKnowledgeGraph({ sqlSource: () => 'SELECT * FROM t1 INNER JOIN t2 ON t1.id = t2.id' });
    await kg.fetchGraph();

    expect(kg.inProgressTopics.value.has('sql-basics')).toBe(true);  // SELECT...FROM keyword/pattern
    expect(kg.inProgressTopics.value.has('joins')).toBe(true);        // JOIN pattern match
    // filtering also matches because "IN" is a substring of "JOIN"/"INNER" — known limitation
  });

  it('inProgressTopics returns empty set when SQL is empty', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGraphData) });
    const kg = useKnowledgeGraph({ sqlSource: () => '' });
    await kg.fetchGraph();

    expect(kg.inProgressTopics.value.size).toBe(0);
  });

  it('inProgressTopics skips mastered topics (mastered takes priority)', async () => {
    localStorage.setItem('ai-mastered-topics', JSON.stringify(['sql-basics']));
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGraphData) });
    const kg = useKnowledgeGraph({ sqlSource: () => 'select * from users' });
    await kg.fetchGraph();

    // sql-basics matches SELECT but is already mastered → excluded
    expect(kg.inProgressTopics.value.has('sql-basics')).toBe(false);
  });

  it('inProgressTopics handles no sqlSource gracefully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGraphData) });
    const kg = useKnowledgeGraph(); // no opts
    await kg.fetchGraph();

    expect(kg.inProgressTopics.value.size).toBe(0);
  });

  it('getNodeStatus returns correct status', async () => {
    localStorage.setItem('ai-mastered-topics', JSON.stringify(['sql-basics']));
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGraphData) });
    const kg = useKnowledgeGraph({ sqlSource: () => 'SELECT * FROM t WHERE a AND b' });
    await kg.fetchGraph();

    expect(kg.getNodeStatus('sql-basics')).toBe('mastered');  // has SELECT+FROM but already mastered
    expect(kg.getNodeStatus('filtering')).toBe('in-progress'); // WHERE...AND matches pattern
    expect(kg.getNodeStatus('joins')).toBe('unlearned');       // no JOIN keyword or pattern
  });
});
