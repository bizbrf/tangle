// tests/unit/edge-helpers.test.ts
// Environment: node (default from vitest.config.ts — no override needed)
// Covers: edgeStrokeWidth, edgeAccentColor, edgeRestColor, getNodeIntersection,
//         getEdgePosition from edge-helpers.ts
import { describe, it, expect } from 'vitest'
import type { InternalNode } from '@xyflow/react'
import { Position } from '@xyflow/react'
import { edgeStrokeWidth, edgeAccentColor, edgeRestColor, getNodeIntersection, getEdgePosition } from '../../src/components/Graph/edge-helpers'

// ── Helper: build a minimal InternalNode mock ──────────────────────────────

function mockNode(x: number, y: number, width = 190, height = 88): InternalNode {
  return {
    id: 'mock',
    type: 'sheet',
    position: { x, y },
    data: {},
    measured: { width, height },
    internals: {
      positionAbsolute: { x, y },
      z: 0,
      userNode: {} as InternalNode,
      handleBounds: undefined,
    },
  } as unknown as InternalNode
}

// ── EDGE-01: edgeStrokeWidth ──────────────────────────────────────────────────

describe('EDGE-01: edgeStrokeWidth — stroke width scaling', () => {
  it('returns a positive number for refCount=1', () => {
    expect(edgeStrokeWidth(1)).toBeGreaterThan(0)
  })

  it('never exceeds the maximum of 4.5', () => {
    expect(edgeStrokeWidth(1000)).toBe(4.5)
    expect(edgeStrokeWidth(10000)).toBe(4.5)
  })

  it('scales up with higher refCount', () => {
    expect(edgeStrokeWidth(10)).toBeGreaterThan(edgeStrokeWidth(1))
    expect(edgeStrokeWidth(100)).toBeGreaterThan(edgeStrokeWidth(10))
  })

  it('returns a number ≥ 1 for any positive refCount', () => {
    expect(edgeStrokeWidth(1)).toBeGreaterThanOrEqual(1)
    expect(edgeStrokeWidth(5)).toBeGreaterThanOrEqual(1)
    expect(edgeStrokeWidth(20)).toBeGreaterThanOrEqual(1)
  })

  it('result is monotonically non-decreasing as refCount increases', () => {
    const w1 = edgeStrokeWidth(1)
    const w5 = edgeStrokeWidth(5)
    const w20 = edgeStrokeWidth(20)
    expect(w5).toBeGreaterThanOrEqual(w1)
    expect(w20).toBeGreaterThanOrEqual(w5)
  })
})

// ── EDGE-02: edgeAccentColor ──────────────────────────────────────────────────

describe('EDGE-02: edgeAccentColor — kind to accent color mapping', () => {
  it('returns coral-red (#e8445a) for "internal" edges', () => {
    expect(edgeAccentColor('internal')).toBe('#e8445a')
  })

  it('returns indigo (#818cf8) for "cross-file" edges', () => {
    expect(edgeAccentColor('cross-file')).toBe('#818cf8')
  })

  it('returns amber (#f59e0b) for "external" edges', () => {
    expect(edgeAccentColor('external')).toBe('#f59e0b')
  })

  it('returns emerald (#10b981) for "named-range" edges', () => {
    expect(edgeAccentColor('named-range')).toBe('#10b981')
  })

  it('returns violet (#a78bfa) for "table" edges', () => {
    expect(edgeAccentColor('table')).toBe('#a78bfa')
  })

  it('returns different colors for each edge kind', () => {
    const kinds = ['internal', 'cross-file', 'external', 'named-range', 'table'] as const
    const colors = kinds.map(edgeAccentColor)
    const uniqueColors = new Set(colors)
    expect(uniqueColors.size).toBe(kinds.length)
  })
})

// ── EDGE-03: edgeRestColor ────────────────────────────────────────────────────

describe('EDGE-03: edgeRestColor — kind to resting color mapping', () => {
  it('returns an rgba(...) string', () => {
    expect(edgeRestColor('internal', 1)).toMatch(/^rgba\(/)
    expect(edgeRestColor('cross-file', 1)).toMatch(/^rgba\(/)
    expect(edgeRestColor('external', 1)).toMatch(/^rgba\(/)
    expect(edgeRestColor('named-range', 1)).toMatch(/^rgba\(/)
    expect(edgeRestColor('table', 1)).toMatch(/^rgba\(/)
  })

  it('returns different colors for different edge kinds', () => {
    const internal = edgeRestColor('internal', 1)
    const crossFile = edgeRestColor('cross-file', 1)
    const external = edgeRestColor('external', 1)
    expect(internal).not.toBe(crossFile)
    expect(internal).not.toBe(external)
    expect(crossFile).not.toBe(external)
  })

  it('opacity increases with higher refCount (not the same for 1 vs 20)', () => {
    const low = edgeRestColor('internal', 1)
    const high = edgeRestColor('internal', 20)
    expect(low).not.toBe(high)
  })

  it('opacity caps at 0.55 (high refCount produces same result as very high refCount)', () => {
    // Both should reach the cap — we just verify they are the same string
    const high = edgeRestColor('internal', 100)
    const veryHigh = edgeRestColor('internal', 10000)
    expect(high).toBe(veryHigh)
  })
})

// ── EDGE-04: getNodeIntersection ──────────────────────────────────────────────

describe('EDGE-04: getNodeIntersection — rectangle boundary intersection', () => {
  it('returns center when source and target have the same center', () => {
    const node = mockNode(0, 0)
    const pt = getNodeIntersection(node, node)
    // Center of node: (0 + 190/2, 0 + 88/2) = (95, 44)
    expect(pt.x).toBeCloseTo(95)
    expect(pt.y).toBeCloseTo(44)
  })

  it('exits via right edge when target is directly to the right', () => {
    const src = mockNode(0, 0)
    const tgt = mockNode(400, 0)
    const pt = getNodeIntersection(src, tgt)
    // Right edge of src: x = 0 + 190 = 190, center-y = 44
    expect(pt.x).toBeCloseTo(190)
    expect(pt.y).toBeCloseTo(44)
  })

  it('exits via left edge when target is directly to the left', () => {
    const src = mockNode(400, 0)
    const tgt = mockNode(0, 0)
    const pt = getNodeIntersection(src, tgt)
    // Left edge of src: x = 400, center-y = 44
    expect(pt.x).toBeCloseTo(400)
    expect(pt.y).toBeCloseTo(44)
  })

  it('exits via bottom edge when target is directly below', () => {
    const src = mockNode(0, 0)
    const tgt = mockNode(0, 400)
    const pt = getNodeIntersection(src, tgt)
    // Bottom edge of src: y = 0 + 88 = 88, center-x = 95
    expect(pt.x).toBeCloseTo(95)
    expect(pt.y).toBeCloseTo(88)
  })

  it('exits via top edge when target is directly above', () => {
    const src = mockNode(0, 400)
    const tgt = mockNode(0, 0)
    const pt = getNodeIntersection(src, tgt)
    // Top edge of src: y = 400, center-x = 95
    expect(pt.x).toBeCloseTo(95)
    expect(pt.y).toBeCloseTo(400)
  })

  it('falls back to default node dimensions (190×88) when measured is absent', () => {
    const src = mockNode(0, 0)
    // Remove measured to force default fallback
    const srcNoMeasured = { ...src, measured: undefined } as unknown as InternalNode
    const tgt = mockNode(400, 0)
    const pt = getNodeIntersection(srcNoMeasured, tgt)
    // Right edge at x=190 (default width)
    expect(pt.x).toBeCloseTo(190)
  })
})

// ── EDGE-05: getEdgePosition ──────────────────────────────────────────────────

describe('EDGE-05: getEdgePosition — side classification', () => {
  it('returns Right when intersection point is to the right of node center', () => {
    const node = mockNode(0, 0)
    // Point at right edge midpoint
    const side = getEdgePosition(node, { x: 190, y: 44 })
    expect(side).toBe(Position.Right)
  })

  it('returns Left when intersection point is to the left of node center', () => {
    const node = mockNode(100, 0)
    // Point left of center (center.x = 195)
    const side = getEdgePosition(node, { x: 100, y: 44 })
    expect(side).toBe(Position.Left)
  })

  it('returns Bottom when intersection point is below node center', () => {
    const node = mockNode(0, 0)
    // Point at bottom center
    const side = getEdgePosition(node, { x: 95, y: 88 })
    expect(side).toBe(Position.Bottom)
  })

  it('returns Top when intersection point is above node center', () => {
    const node = mockNode(0, 100)
    // Point above center (center.y = 144)
    const side = getEdgePosition(node, { x: 95, y: 100 })
    expect(side).toBe(Position.Top)
  })
})
