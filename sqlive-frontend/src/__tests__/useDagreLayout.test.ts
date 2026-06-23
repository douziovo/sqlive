import type { Edge, Node } from '@vue-flow/core'
import { describe, expect, it } from 'vitest'
import { layoutNodes } from '@/composables/useDagreLayout'

describe('useDagreLayout', () => {
  // ============================================================
  //  Basic layout
  // ============================================================

  it('layouts nodes using dagre', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'test', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', type: 'test', position: { x: 0, y: 0 }, data: {} }
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }]

    const result = layoutNodes(nodes, edges)

    expect(result).toHaveLength(2)
    expect(result[0].position.x).not.toBe(0)
    expect(result[1].position.x).not.toBe(0)
  })

  it('respects custom options', () => {
    const nodes: Node[] = [{ id: 'a', type: 't', position: { x: 0, y: 0 }, data: {} }]
    const result = layoutNodes(nodes, [], null, { rankdir: 'TB' })
    expect(result).toHaveLength(1)
  })

  // ============================================================
  //  Empty and single node edge cases
  // ============================================================

  it('handles empty nodes array', () => {
    const result = layoutNodes([], [])
    expect(result).toHaveLength(0)
  })

  it('handles single node with no edges', () => {
    const nodes: Node[] = [{ id: 'solo', type: 't', position: { x: 0, y: 0 }, data: { label: 'alone' } }]
    const result = layoutNodes(nodes, [])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('solo')
    // Single node should get a valid position (dagre centers it)
    expect(typeof result[0].position.x).toBe('number')
    expect(typeof result[0].position.y).toBe('number')
  })

  it('handles disconnected nodes (no edges between them)', () => {
    const nodes: Node[] = [
      { id: 'a', type: 't', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', type: 't', position: { x: 0, y: 0 }, data: {} },
      { id: 'c', type: 't', position: { x: 0, y: 0 }, data: {} }
    ]
    const result = layoutNodes(nodes, [])
    expect(result).toHaveLength(3)
    // All nodes should have distinct positions
    const positions = result.map((n) => `${n.position.x},${n.position.y}`)
    const unique = new Set(positions)
    expect(unique.size).toBe(3)
  })

  // ============================================================
  //  Layout with edges
  // ============================================================

  it('positions connected nodes apart (not stacked at origin)', () => {
    const nodes: Node[] = [
      { id: 'a', type: 't', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', type: 't', position: { x: 0, y: 0 }, data: {} },
      { id: 'c', type: 't', position: { x: 0, y: 0 }, data: {} }
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' }
    ]
    const result = layoutNodes(nodes, edges)

    // Nodes should not all be at {0,0} — the known bug pattern
    const allAtOrigin = result.every((n) => n.position.x === 0 && n.position.y === 0)
    expect(allAtOrigin).toBe(false)
  })

  it('preserves node properties after layout', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'custom', position: { x: 0, y: 0 }, data: { tableName: 'users', columns: ['id', 'name'] } },
      { id: 'b', type: 'custom', position: { x: 0, y: 0 }, data: { tableName: 'posts', columns: ['id', 'user_id'] } }
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }]
    const result = layoutNodes(nodes, edges)

    // Preserve id, type, data
    expect(result[0].id).toBe('a')
    expect(result[0].type).toBe('custom')
    expect(result[0].data.tableName).toBe('users')
    expect(result[1].id).toBe('b')
    expect(result[1].data.tableName).toBe('posts')
  })

  // ============================================================
  //  Re-layout consistency (panel reopen scenario)
  // ============================================================

  it('produces consistent positions on re-layout with same input', () => {
    const nodes: Node[] = [
      { id: 'a', type: 't', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', type: 't', position: { x: 0, y: 0 }, data: {} }
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }]

    const first = layoutNodes(nodes, edges)
    // Simulate re-layout: pass nodes with current positions (as would happen on panel reopen)
    const second = layoutNodes(first, edges)

    // Positions should be the same after re-layout
    expect(second[0].position.x).toBe(first[0].position.x)
    expect(second[0].position.y).toBe(first[0].position.y)
    expect(second[1].position.x).toBe(first[1].position.x)
    expect(second[1].position.y).toBe(first[1].position.y)
  })

  // ============================================================
  //  Direction options
  // ============================================================

  it('layouts left-to-right by default', () => {
    const nodes: Node[] = [
      { id: 'a', type: 't', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', type: 't', position: { x: 0, y: 0 }, data: {} }
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }]
    const result = layoutNodes(nodes, edges)

    // LR layout: target should be to the right of source
    expect(result[1].position.x).toBeGreaterThan(result[0].position.x)
  })

  it('layouts top-to-bottom when rankdir is TB', () => {
    const nodes: Node[] = [
      { id: 'a', type: 't', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', type: 't', position: { x: 0, y: 0 }, data: {} }
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }]
    const result = layoutNodes(nodes, edges, null, { rankdir: 'TB' })

    // TB layout: target should be below source
    expect(result[1].position.y).toBeGreaterThan(result[0].position.y)
  })
})
