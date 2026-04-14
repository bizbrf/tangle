import type { Edge } from '@xyflow/react';

export interface PathResult {
  pathNodeIds: Set<string>;
  pathEdgeIds: Set<string>;
}

/**
 * Find all simple paths between two nodes in the graph, up to maxDepth hops.
 * Uses BFS to enumerate paths. Edges are treated as undirected (traversable
 * in either direction) to find all connecting paths.
 *
 * Returns the set of node IDs and edge IDs that lie on at least one path.
 */
export function findAllPaths(
  startId: string,
  endId: string,
  edges: Edge[],
  maxDepth: number = 5,
): PathResult {
  const pathNodeIds = new Set<string>();
  const pathEdgeIds = new Set<string>();

  // Build adjacency list: node -> [{ neighbor, edgeId }]
  const adj = new Map<string, { neighbor: string; edgeId: string }[]>();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.source)!.push({ neighbor: edge.target, edgeId: edge.id });
    adj.get(edge.target)!.push({ neighbor: edge.source, edgeId: edge.id });
  }

  // BFS over paths (each queue entry is a full path of node IDs + edge IDs used)
  const queue: { nodes: string[]; edgeIds: string[] }[] = [
    { nodes: [startId], edgeIds: [] },
  ];

  while (queue.length > 0) {
    const { nodes: path, edgeIds: pathEdges } = queue.shift()!;
    const current = path[path.length - 1];

    if (current === endId) {
      for (const nid of path) pathNodeIds.add(nid);
      for (const eid of pathEdges) pathEdgeIds.add(eid);
      continue;
    }

    // Stop exploring if we've reached max depth
    if (path.length > maxDepth) continue;

    const neighbors = adj.get(current);
    if (!neighbors) continue;

    for (const { neighbor, edgeId } of neighbors) {
      // Avoid cycles within the same path
      if (path.includes(neighbor)) continue;
      queue.push({
        nodes: [...path, neighbor],
        edgeIds: [...pathEdges, edgeId],
      });
    }
  }

  return { pathNodeIds, pathEdgeIds };
}
