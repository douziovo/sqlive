import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@vue-flow/core';
import { layoutNodes } from '@/composables/useDagreLayout';

describe('useDagreLayout', () => {
  it('layouts nodes using dagre', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'test', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', type: 'test', position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];

    const result = layoutNodes(nodes, edges);

    expect(result).toHaveLength(2);
    expect(result[0].position.x).not.toBe(0);
    expect(result[1].position.x).not.toBe(0);
  });

  it('respects custom options', () => {
    const nodes: Node[] = [{ id: 'a', type: 't', position: { x: 0, y: 0 }, data: {} }];
    const result = layoutNodes(nodes, [], null, { rankdir: 'TB' });
    expect(result).toHaveLength(1);
  });
});
