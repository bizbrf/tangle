import { Position, type InternalNode } from '@xyflow/react';
import type { EdgeKind } from '../../lib/graph';
import { alpha } from './constants';

// Stroke width scales with ref count using a log curve: thin for 1, moderate for 20+
export function edgeStrokeWidth(refCount: number): number {
  return Math.min(1.2 + Math.log2(refCount + 1) * 0.8, 4.5);
}

// Per-edge-kind highlight color, themed via CSS variables defined in
// :root[data-theme="..."]. Exhaustive Record so adding an EdgeKind fails to
// compile until a token is wired up here.
const EDGE_ACCENT: Record<EdgeKind, string> = {
  internal:      'var(--tg-edge-cross-sheet)',
  'cross-file':  'var(--tg-edge-cross-file)',
  'named-range': 'var(--tg-edge-named)',
  table:         'var(--tg-edge-table)',
  external:      'var(--tg-edge-external)',
};

export function edgeAccentColor(kind: EdgeKind): string {
  return EDGE_ACCENT[kind];
}

// Resting color: subtle tint of the kind's accent, scaled by ref count.
// 20% floor keeps thin edges visible; 55% cap stops dense edges going opaque.
export function edgeRestColor(kind: EdgeKind, refCount: number): string {
  const pct = Math.round(Math.min(20 + Math.log2(refCount + 1) * 7, 55));
  return alpha(edgeAccentColor(kind), pct);
}

// ── Floating edge helpers ────────────────────────────────────────────────────

// Compute the intersection point of a line from the center of `node` toward
// the center of `otherNode` with `node`'s bounding rectangle.
export function getNodeIntersection(node: InternalNode, otherNode: InternalNode): { x: number; y: number } {
  const w = node.measured?.width ?? 190;
  const h = node.measured?.height ?? 88;
  const nx = node.internals.positionAbsolute.x + w / 2;
  const ny = node.internals.positionAbsolute.y + h / 2;

  const ow = otherNode.measured?.width ?? 190;
  const oh = otherNode.measured?.height ?? 88;
  const ox = otherNode.internals.positionAbsolute.x + ow / 2;
  const oy = otherNode.internals.positionAbsolute.y + oh / 2;

  const dx = ox - nx;
  const dy = oy - ny;

  if (dx === 0 && dy === 0) return { x: nx, y: ny };

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const hw = w / 2;
  const hh = h / 2;

  // Which edge of the rectangle does the line cross first?
  if (absDx / hw > absDy / hh) {
    // Exits left or right
    const sign = dx > 0 ? 1 : -1;
    return { x: nx + sign * hw, y: ny + (dy * hw) / absDx };
  } else {
    // Exits top or bottom
    const sign = dy > 0 ? 1 : -1;
    return { x: nx + (dx * hh) / absDy, y: ny + sign * hh };
  }
}

// Determine which side of the node an intersection point falls on.
export function getEdgePosition(node: InternalNode, pt: { x: number; y: number }): Position {
  const cx = node.internals.positionAbsolute.x + (node.measured?.width ?? 190) / 2;
  const cy = node.internals.positionAbsolute.y + (node.measured?.height ?? 88) / 2;
  const dx = pt.x - cx;
  const dy = pt.y - cy;
  const hw = (node.measured?.width ?? 190) / 2;
  const hh = (node.measured?.height ?? 88) / 2;
  if (Math.abs(dx / hw) > Math.abs(dy / hh)) {
    return dx > 0 ? Position.Right : Position.Left;
  }
  return dy > 0 ? Position.Bottom : Position.Top;
}
