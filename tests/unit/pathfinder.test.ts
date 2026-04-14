import { describe, it, expect } from 'vitest';
import { findAllPaths } from '../../src/lib/pathfinder';
import type { Edge } from '@xyflow/react';

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target } as Edge;
}

describe('findAllPaths', () => {
  it('finds a direct path between two connected nodes', () => {
    const edges = [makeEdge('e1', 'A', 'B')];
    const result = findAllPaths('A', 'B', edges, 5);
    expect(result.pathNodeIds).toEqual(new Set(['A', 'B']));
    expect(result.pathEdgeIds).toEqual(new Set(['e1']));
  });

  it('finds paths through intermediate nodes', () => {
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'B', 'C'),
    ];
    const result = findAllPaths('A', 'C', edges, 5);
    expect(result.pathNodeIds).toEqual(new Set(['A', 'B', 'C']));
    expect(result.pathEdgeIds).toEqual(new Set(['e1', 'e2']));
  });

  it('finds multiple parallel paths', () => {
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'B', 'D'),
      makeEdge('e3', 'A', 'C'),
      makeEdge('e4', 'C', 'D'),
    ];
    const result = findAllPaths('A', 'D', edges, 5);
    expect(result.pathNodeIds).toEqual(new Set(['A', 'B', 'C', 'D']));
    expect(result.pathEdgeIds).toEqual(new Set(['e1', 'e2', 'e3', 'e4']));
  });

  it('returns empty sets when no path exists', () => {
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'C', 'D'),
    ];
    const result = findAllPaths('A', 'D', edges, 5);
    expect(result.pathNodeIds.size).toBe(0);
    expect(result.pathEdgeIds.size).toBe(0);
  });

  it('respects maxDepth limit', () => {
    // Chain: A -> B -> C -> D -> E (4 hops)
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'B', 'C'),
      makeEdge('e3', 'C', 'D'),
      makeEdge('e4', 'D', 'E'),
    ];
    // maxDepth=3 means path length <= 3 hops => max 4 nodes in path
    const result = findAllPaths('A', 'E', edges, 3);
    // Path A->B->C->D->E has length 5 nodes (4 edges), which exceeds maxDepth=3
    expect(result.pathNodeIds.size).toBe(0);
    expect(result.pathEdgeIds.size).toBe(0);
  });

  it('finds paths within maxDepth', () => {
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'B', 'C'),
      makeEdge('e3', 'C', 'D'),
      makeEdge('e4', 'D', 'E'),
    ];
    const result = findAllPaths('A', 'E', edges, 5);
    expect(result.pathNodeIds).toEqual(new Set(['A', 'B', 'C', 'D', 'E']));
    expect(result.pathEdgeIds).toEqual(new Set(['e1', 'e2', 'e3', 'e4']));
  });

  it('handles same start and end node', () => {
    const edges = [makeEdge('e1', 'A', 'B')];
    const result = findAllPaths('A', 'A', edges, 5);
    // Start === end, so we find it immediately with just the start node
    expect(result.pathNodeIds).toEqual(new Set(['A']));
    expect(result.pathEdgeIds.size).toBe(0);
  });

  it('avoids cycles in path traversal', () => {
    // Triangle: A-B, B-C, C-A, plus B-D
    const edges = [
      makeEdge('e1', 'A', 'B'),
      makeEdge('e2', 'B', 'C'),
      makeEdge('e3', 'C', 'A'),
      makeEdge('e4', 'B', 'D'),
    ];
    const result = findAllPaths('A', 'D', edges, 5);
    // Should find A->B->D and A<-C<-B (reversed via undirected), A->C->B->D
    expect(result.pathNodeIds.has('A')).toBe(true);
    expect(result.pathNodeIds.has('D')).toBe(true);
    expect(result.pathEdgeIds.has('e4')).toBe(true); // B->D must be in paths
  });

  it('traverses edges in both directions (undirected)', () => {
    // Edge goes B->A in the data, but we search A to B
    const edges = [makeEdge('e1', 'B', 'A')];
    const result = findAllPaths('A', 'B', edges, 5);
    expect(result.pathNodeIds).toEqual(new Set(['A', 'B']));
    expect(result.pathEdgeIds).toEqual(new Set(['e1']));
  });

  it('handles disconnected nodes gracefully', () => {
    const result = findAllPaths('X', 'Y', [], 5);
    expect(result.pathNodeIds.size).toBe(0);
    expect(result.pathEdgeIds.size).toBe(0);
  });
});
