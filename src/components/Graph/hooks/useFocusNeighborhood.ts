/**
 * useFocusNeighborhood — directional BFS over the current edge list to
 * compute the set of node IDs that are within `depth` hops of a focus node.
 *
 * Returns `null` when no node is focused (meaning all nodes are visible).
 * When a Set is returned, only the IDs inside it should be rendered at full
 * opacity; everything else should be dimmed.
 */

import { useMemo } from 'react';
import type { Edge } from '@xyflow/react';
import type { EdgeData } from '../../../lib/graph';

export type FocusDirection = 'both' | 'upstream' | 'downstream';

export function useFocusNeighborhood(
  focusNodeId: string | null,
  focusDepth: number,
  focusDirection: FocusDirection,
  edges: Edge<EdgeData>[],
): Set<string> | null {
  return useMemo(() => {
    if (!focusNodeId) return null;
    const neighbors = new Set<string>([focusNodeId]);
    let frontier = [focusNodeId];
    const dir = focusDirection;
    for (let hop = 0; hop < focusDepth; hop++) {
      const next: string[] = [];
      for (const nid of frontier) {
        for (const edge of edges) {
          if ((dir === 'both' || dir === 'downstream') && edge.source === nid && !neighbors.has(edge.target)) {
            neighbors.add(edge.target);
            next.push(edge.target);
          }
          if ((dir === 'both' || dir === 'upstream') && edge.target === nid && !neighbors.has(edge.source)) {
            neighbors.add(edge.source);
            next.push(edge.source);
          }
        }
      }
      frontier = next;
    }
    return neighbors;
  }, [focusNodeId, focusDepth, focusDirection, edges]);
}
