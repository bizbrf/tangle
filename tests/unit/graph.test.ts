// tests/unit/graph.test.ts
// Environment: node (default from vitest.config.ts — no override needed)
// Covers: GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05, GRAPH-06, GRAPH-07, GRAPH-08, GRAPH-09, GRAPH-10
import { describe, it, expect } from 'vitest'
import type { WorkbookFile, SheetReference, SheetWorkload } from '../../src/types'
import { buildGraph, reorganizeLayout } from '../../src/lib/graph'

// ── Shared factory ────────────────────────────────────────────────────────────

const zeroWorkload: SheetWorkload = {
  totalFormulas: 0, withinSheetRefs: 0, crossSheetRefs: 0, crossFileRefs: 0,
}

function makeWorkbook(
  name: string,
  sheets: { sheetName: string; refs?: SheetReference[] }[],
): WorkbookFile {
  return {
    id: name,
    name,
    namedRanges: [],
    tables: [],
    sheets: sheets.map(({ sheetName, refs = [] }) => ({
      workbookName: name,
      sheetName,
      references: refs,
      workload: { ...zeroWorkload },
    })),
  }
}

// ── GRAPH-01: one node per uploaded sheet (standard layout) ───────────────────

describe('GRAPH-01: one node per uploaded sheet (standard layout)', () => {
  it('single workbook with two sheets produces exactly two nodes', () => {
    const wb = makeWorkbook('FileA.xlsx', [
      { sheetName: 'Sheet1' },
      { sheetName: 'Sheet2' },
    ])
    const { nodes } = buildGraph([wb])
    // No external refs in this topology — all nodes are sheet nodes
    expect(nodes).toHaveLength(2)
    // Each node corresponds to an uploaded sheet (not external)
    expect(nodes.every(n => !n.data.isExternal)).toBe(true)
  })

  it('two workbooks with three sheets total produce exactly three nodes', () => {
    const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1' }, { sheetName: 'Sheet2' }])
    const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Data' }])
    const { nodes } = buildGraph([wbA, wbB])
    const sheetNodes = nodes.filter(n => !n.data.isExternal && !n.data.isFileNode)
    expect(sheetNodes).toHaveLength(3)
  })
})

// ── GRAPH-02: edges created for cross-sheet references ────────────────────────

describe('GRAPH-02: edges created for cross-sheet references', () => {
  it('one cross-sheet ref produces exactly one edge', () => {
    const crossSheetRef: SheetReference = {
      targetWorkbook: null,
      targetSheet: 'Sheet2',
      cells: ['A1'],
      formula: 'Sheet2!A1',
      sourceCell: 'A1',
    }
    const wb = makeWorkbook('FileA.xlsx', [
      { sheetName: 'Sheet1', refs: [crossSheetRef] },
      { sheetName: 'Sheet2' },
    ])
    const { edges } = buildGraph([wb])
    expect(edges).toHaveLength(1)
  })

  it('two refs from the same sheet to the same target are aggregated into one edge', () => {
    const ref1: SheetReference = {
      targetWorkbook: null, targetSheet: 'Sheet2', cells: ['A1'], formula: 'Sheet2!A1', sourceCell: 'A1',
    }
    const ref2: SheetReference = {
      targetWorkbook: null, targetSheet: 'Sheet2', cells: ['B1'], formula: 'Sheet2!B1', sourceCell: 'B1',
    }
    const wb = makeWorkbook('FileA.xlsx', [
      { sheetName: 'Sheet1', refs: [ref1, ref2] },
      { sheetName: 'Sheet2' },
    ])
    const { edges } = buildGraph([wb])
    // Both refs share the same source→target pair → aggregated into one edge
    expect(edges).toHaveLength(1)
    expect(edges[0].data!.refCount).toBe(2)
  })
})

// ── GRAPH-03: edge kind classification ───────────────────────────────────────

describe('GRAPH-03: edge kind classification', () => {
  const crossSheetRef: SheetReference = {
    targetWorkbook: null,
    targetSheet: 'Sheet2',
    cells: ['A1'],
    formula: 'Sheet2!A1',
    sourceCell: 'A1',
  }
  const crossFileRef: SheetReference = {
    targetWorkbook: 'FileB.xlsx',
    targetSheet: 'Sheet1',
    cells: ['C3'],
    formula: '[FileB.xlsx]Sheet1!C3',
    sourceCell: 'B1',
  }
  const externalRef: SheetReference = {
    targetWorkbook: 'External.xlsx',
    targetSheet: 'Data',
    cells: ['D5'],
    formula: '[External.xlsx]Data!D5',
    sourceCell: 'C1',
  }
  const namedRangeRef: SheetReference = {
    targetWorkbook: null,
    targetSheet: 'Sheet2',
    cells: ['A1:A10'],
    formula: 'MyRange',
    sourceCell: 'D1',
    namedRangeName: 'MyRange',
  }

  const wbA = makeWorkbook('FileA.xlsx', [
    { sheetName: 'Sheet1', refs: [crossSheetRef, crossFileRef, externalRef] },
    { sheetName: 'Sheet2' },
  ])
  const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Sheet1' }])
  const wbWithNR = makeWorkbook('FileA.xlsx', [
    { sheetName: 'Sheet1', refs: [namedRangeRef] },
    { sheetName: 'Sheet2' },
  ])

  it("internal edge: same-workbook cross-sheet ref has edgeKind 'internal'", () => {
    const { edges } = buildGraph([wbA, wbB])
    const internalEdge = edges.find(e => e.data!.edgeKind === 'internal')
    expect(internalEdge).toBeDefined()
  })

  it("cross-file edge: ref to uploaded workbook has edgeKind 'cross-file'", () => {
    const { edges } = buildGraph([wbA, wbB])
    const crossFileEdge = edges.find(e => e.data!.edgeKind === 'cross-file')
    expect(crossFileEdge).toBeDefined()
  })

  it("external edge: ref to non-uploaded workbook has edgeKind 'external'", () => {
    // Upload only wbA — External.xlsx is not uploaded
    const { edges } = buildGraph([wbA])
    // crossFileRef now also becomes external (FileB.xlsx not uploaded)
    const externalEdges = edges.filter(e => e.data!.edgeKind === 'external')
    expect(externalEdges.length).toBeGreaterThan(0)
  })

  it("named-range edge: ref with namedRangeName has edgeKind 'named-range' when showNamedRanges=true", () => {
    const { edges } = buildGraph([wbWithNR], 'graph', new Set(), true)
    const nrEdge = edges.find(e => e.data!.edgeKind === 'named-range')
    expect(nrEdge).toBeDefined()
  })
})

// ── GRAPH-04: hidden files excluded from nodes and edges ──────────────────────

describe('GRAPH-04: hidden files excluded from nodes and edges', () => {
  const crossFileRef: SheetReference = {
    targetWorkbook: 'FileB.xlsx',
    targetSheet: 'Sheet1',
    cells: ['A1'],
    formula: '[FileB.xlsx]Sheet1!A1',
    sourceCell: 'A1',
  }
  const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [crossFileRef] }])
  const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Sheet1' }, { sheetName: 'Sheet2' }])

  it('hidden workbook sheet nodes are absent from the result', () => {
    const hidden = new Set(['FileB.xlsx'])
    const { nodes } = buildGraph([wbA, wbB], 'graph', hidden)
    // No sheet-level node should belong to FileB.xlsx
    const fileBSheetNodes = nodes.filter(
      n => n.data.workbookName === 'FileB.xlsx' && !n.data.isFileNode,
    )
    expect(fileBSheetNodes).toHaveLength(0)
  })

  it('edges originating from a hidden workbook are absent', () => {
    // Hide wbA — its Sheet1 has the outgoing ref
    const hidden = new Set(['FileA.xlsx'])
    const { edges } = buildGraph([wbA, wbB], 'graph', hidden)
    // No edge should have source equal to FileA.xlsx::Sheet1
    const filAEdges = edges.filter(e => e.source.startsWith('FileA.xlsx::'))
    expect(filAEdges).toHaveLength(0)
  })

  it('non-hidden workbook nodes are still present when one file is hidden', () => {
    const hidden = new Set(['FileB.xlsx'])
    const { nodes } = buildGraph([wbA, wbB], 'graph', hidden)
    const fileANodes = nodes.filter(
      n => n.data.workbookName === 'FileA.xlsx' && !n.data.isFileNode,
    )
    expect(fileANodes).toHaveLength(1)
  })
})

// ── GRAPH-05: all layout modes return non-empty nodes with valid positions ─────

describe('GRAPH-05: all layout modes return non-empty nodes with valid positions', () => {
  // Two workbooks with a cross-file reference — ensures inter-group edges in grouped layout
  const crossFileRef: SheetReference = {
    targetWorkbook: 'FileB.xlsx',
    targetSheet: 'Sheet1',
    cells: ['A1'],
    formula: '[FileB.xlsx]Sheet1!A1',
    sourceCell: 'A1',
  }
  const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [crossFileRef] }])
  const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Sheet1' }])

  it('graph layout returns non-empty nodes with non-zero positions', () => {
    const { nodes } = buildGraph([wbA, wbB], 'graph')
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.position.x).toBeGreaterThan(0)
      expect(node.position.y).toBeGreaterThan(0)
    }
  })

  it('grouped layout returns non-empty nodes with non-zero positions', () => {
    const { nodes } = buildGraph([wbA, wbB], 'grouped')
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.position.x).toBeGreaterThan(0)
      expect(node.position.y).toBeGreaterThan(0)
    }
  })

  it('overview layout returns non-empty nodes with non-zero positions', () => {
    const { nodes } = buildGraph([wbA, wbB], 'overview')
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.position.x).toBeGreaterThan(0)
      expect(node.position.y).toBeGreaterThan(0)
    }
  })
})

// ── GRAPH-06: overview mode returns one node per uploaded workbook ────────────

describe('GRAPH-06: overview mode returns one node per uploaded workbook', () => {
  it('two uploaded workbooks produce exactly two non-external nodes in overview mode', () => {
    // Use cross-file refs so overview has edges, but both targets are uploaded
    const crossFileRef: SheetReference = {
      targetWorkbook: 'FileB.xlsx',
      targetSheet: 'Sheet1',
      cells: ['A1'],
      formula: '[FileB.xlsx]Sheet1!A1',
      sourceCell: 'A1',
    }
    const wbA = makeWorkbook('FileA.xlsx', [
      { sheetName: 'Sheet1', refs: [crossFileRef] },
      { sheetName: 'Sheet2' },
    ])
    const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Sheet1' }])

    const { nodes } = buildGraph([wbA, wbB], 'overview')
    // Filter out any external file nodes — only count uploaded workbook nodes
    const uploadedNodes = nodes.filter(n => !n.data.isExternal)
    expect(uploadedNodes).toHaveLength(2)
  })

  it('three uploaded workbooks produce exactly three non-external nodes in overview mode', () => {
    const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1' }])
    const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Sheet1' }])
    const wbC = makeWorkbook('FileC.xlsx', [{ sheetName: 'Sheet1' }])
    const { nodes } = buildGraph([wbA, wbB, wbC], 'overview')
    const uploadedNodes = nodes.filter(n => !n.data.isExternal)
    expect(uploadedNodes).toHaveLength(3)
  })
})

// ── GRAPH-07: named range nodes toggle with showNamedRanges flag ──────────────

describe('GRAPH-07: named range nodes toggle with showNamedRanges flag', () => {
  // Sheet1 has a named range ref pointing to Sheet2 — target sheet differs from source (no self-edge)
  const namedRangeRef: SheetReference = {
    targetWorkbook: null,
    targetSheet: 'Sheet2',
    cells: ['A1:A10'],
    formula: 'MyRange',
    sourceCell: 'A1',
    namedRangeName: 'MyRange',
  }
  const wbWithNR = makeWorkbook('FileA.xlsx', [
    { sheetName: 'Sheet1', refs: [namedRangeRef] },
    { sheetName: 'Sheet2' },
  ])

  it('showNamedRanges=false: no named range nodes in output', () => {
    const { nodes } = buildGraph([wbWithNR], 'graph', new Set(), false)
    expect(nodes.some(n => n.data.isNamedRange)).toBe(false)
  })

  it('showNamedRanges=true: named range node appears in output', () => {
    const { nodes } = buildGraph([wbWithNR], 'graph', new Set(), true)
    expect(nodes.some(n => n.data.isNamedRange)).toBe(true)
  })

  it('showNamedRanges=true: named range node has correct namedRangeName', () => {
    const { nodes } = buildGraph([wbWithNR], 'graph', new Set(), true)
    const nrNode = nodes.find(n => n.data.isNamedRange)
    expect(nrNode).toBeDefined()
    expect(nrNode?.data.namedRangeName).toBe('MyRange')
  })

  it('showNamedRanges=true: named-range edges replace the direct edge', () => {
    const { edges } = buildGraph([wbWithNR], 'graph', new Set(), true)
    // Direct edge replaced by two 'named-range' edges (source->NR and NR->consumer)
    expect(edges.every(e => e.data!.edgeKind === 'named-range')).toBe(true)
    expect(edges).toHaveLength(2)
  })

  it('showNamedRanges=false: a direct edge exists (not named-range kind)', () => {
    const { edges } = buildGraph([wbWithNR], 'graph', new Set(), false)
    expect(edges).toHaveLength(1)
    expect(edges[0].data!.edgeKind).not.toBe('named-range')
  })
})

// ── GRAPH-08: layout direction (LR vs TB) changes node positions ──────────────

describe('GRAPH-08: layout direction (LR vs TB) changes node positions', () => {
  const crossFileRef: SheetReference = {
    targetWorkbook: 'FileB.xlsx',
    targetSheet: 'Sheet1',
    cells: ['A1'],
    formula: '[FileB.xlsx]Sheet1!A1',
    sourceCell: 'A1',
  }
  const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [crossFileRef] }])
  const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Sheet1' }])

  it('graph layout: TB direction produces different positions than LR', () => {
    const { nodes: lrNodes } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'LR')
    const { nodes: tbNodes } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'TB')
    expect(lrNodes.length).toBe(tbNodes.length)
    // Compare by node ID so ordering differences don't matter
    const tbById = new Map(tbNodes.map((n) => [n.id, n.position]))
    const hasDiff = lrNodes.some((lr) => {
      const tb = tbById.get(lr.id)
      return !tb || lr.position.x !== tb.x || lr.position.y !== tb.y
    })
    expect(hasDiff).toBe(true)
  })

  it('grouped layout: TB direction produces different positions than LR', () => {
    const { nodes: lrNodes } = buildGraph([wbA, wbB], 'grouped', new Set(), false, false, 'LR')
    const { nodes: tbNodes } = buildGraph([wbA, wbB], 'grouped', new Set(), false, false, 'TB')
    expect(lrNodes.length).toBe(tbNodes.length)
    const tbById = new Map(tbNodes.map((n) => [n.id, n.position]))
    const hasDiff = lrNodes.some((lr) => {
      const tb = tbById.get(lr.id)
      return !tb || lr.position.x !== tb.x || lr.position.y !== tb.y
    })
    expect(hasDiff).toBe(true)
  })

  it('TB direction returns non-empty nodes with valid positions', () => {
    const { nodes } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'TB')
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.position.x).toBeGreaterThanOrEqual(0)
      expect(node.position.y).toBeGreaterThanOrEqual(0)
    }
  })
})

// ── GRAPH-09: table nodes toggle with showTables flag ─────────────────────────

describe('GRAPH-09: table nodes toggle with showTables flag', () => {
  const tableRef: SheetReference = {
    targetWorkbook: null,
    targetSheet: 'Data',
    cells: ['A1:B10'],
    formula: 'SUM(SalesTable[Amount])',
    sourceCell: 'A1',
    tableName: 'SalesTable',
  }
  const wbWithTable = makeWorkbook('FileA.xlsx', [
    { sheetName: 'Summary', refs: [tableRef] },
    { sheetName: 'Data' },
  ])

  it('showTables=false: no table nodes in output', () => {
    const { nodes } = buildGraph([wbWithTable], 'graph', new Set(), false, false)
    expect(nodes.some(n => n.data.isTable)).toBe(false)
  })

  it('showTables=true: table node appears in output', () => {
    const { nodes } = buildGraph([wbWithTable], 'graph', new Set(), false, true)
    expect(nodes.some(n => n.data.isTable)).toBe(true)
  })

  it('showTables=true: table node has correct tableName', () => {
    const { nodes } = buildGraph([wbWithTable], 'graph', new Set(), false, true)
    const tblNode = nodes.find(n => n.data.isTable)
    expect(tblNode).toBeDefined()
    expect(tblNode?.data.tableName).toBe('SalesTable')
  })

  it('showTables=true: table edges replace the direct edge', () => {
    const { edges } = buildGraph([wbWithTable], 'graph', new Set(), false, true)
    // Direct edge replaced by two 'table' edges (source->table and table->consumer)
    expect(edges.every(e => e.data!.edgeKind === 'table')).toBe(true)
    expect(edges).toHaveLength(2)
  })

  it('showTables=false: a direct edge exists (not table kind)', () => {
    const { edges } = buildGraph([wbWithTable], 'graph', new Set(), false, false)
    expect(edges).toHaveLength(1)
    expect(edges[0].data!.edgeKind).toBe('internal')
  })
})

// ── GRAPH-10: reorganizeLayout ────────────────────────────────────────────────

describe('GRAPH-10: reorganizeLayout', () => {
  const crossFileRef: SheetReference = {
    targetWorkbook: 'FileB.xlsx',
    targetSheet: 'Sheet1',
    cells: ['A1'],
    formula: '[FileB.xlsx]Sheet1!A1',
    sourceCell: 'A1',
  }
  const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [crossFileRef] }])
  const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Sheet1' }])

  it('returns all nodes with valid numeric positions', () => {
    const { nodes, edges } = buildGraph([wbA, wbB])
    const result = reorganizeLayout(nodes, edges, 'graph', 'LR')
    expect(result).toHaveLength(nodes.length)
    for (const n of result) {
      expect(typeof n.position.x).toBe('number')
      expect(typeof n.position.y).toBe('number')
      expect(isNaN(n.position.x)).toBe(false)
      expect(isNaN(n.position.y)).toBe(false)
    }
  })

  it('pinned nodes retain their original positions', () => {
    const { nodes, edges } = buildGraph([wbA, wbB])
    const pinnedId = nodes[0].id
    const originalPos = { ...nodes[0].position }
    const pinnedIds = new Set([pinnedId])
    const result = reorganizeLayout(nodes, edges, 'graph', 'LR', pinnedIds, 1)
    const pinned = result.find((n) => n.id === pinnedId)!
    expect(pinned.position.x).toBe(originalPos.x)
    expect(pinned.position.y).toBe(originalPos.y)
  })

  it('same seed produces identical positions (determinism)', () => {
    const { nodes, edges } = buildGraph([wbA, wbB])
    const r1 = reorganizeLayout(nodes, edges, 'graph', 'LR', new Set(), 42)
    const r2 = reorganizeLayout(nodes, edges, 'graph', 'LR', new Set(), 42)
    const pos1 = new Map(r1.map((n) => [n.id, n.position]))
    for (const n of r2) {
      expect(n.position.x).toBe(pos1.get(n.id)!.x)
      expect(n.position.y).toBe(pos1.get(n.id)!.y)
    }
  })

  it('returns empty array unchanged for empty input', () => {
    const result = reorganizeLayout([], [], 'graph', 'LR')
    expect(result).toHaveLength(0)
  })

  it('works in grouped layout mode preserving group structure', () => {
    // Use workbooks with 2 sheets each so vertical-stacking assertions are meaningful
    const wbAMulti = makeWorkbook('FileA.xlsx', [
      { sheetName: 'Sheet1', refs: [crossFileRef] },
      { sheetName: 'Sheet2' },
    ])
    const wbBMulti = makeWorkbook('FileB.xlsx', [
      { sheetName: 'Sheet1' },
      { sheetName: 'Sheet2' },
    ])
    const { nodes, edges } = buildGraph([wbAMulti, wbBMulti], 'grouped')
    const result = reorganizeLayout(nodes, edges, 'grouped', 'LR')

    // We should preserve the node set
    expect(result).toHaveLength(nodes.length)

    const fileANodes = result.filter((n) => n.data.workbookName === 'FileA.xlsx')
    const fileBNodes = result.filter((n) => n.data.workbookName === 'FileB.xlsx')
    expect(fileANodes.length).toBeGreaterThan(0)
    expect(fileBNodes.length).toBeGreaterThan(0)

    // For grouped layout we expect:
    // - Nodes within the same workbook to form a vertically stacked column
    //   (vertical spread > horizontal spread).
    // - The workbook groups to be horizontally separated (their x-ranges do not overlap).

    const xsA = fileANodes.map((n) => n.position.x)
    const ysA = fileANodes.map((n) => n.position.y)
    const xsB = fileBNodes.map((n) => n.position.x)
    const ysB = fileBNodes.map((n) => n.position.y)

    const minXA = Math.min(...xsA)
    const maxXA = Math.max(...xsA)
    const minYA = Math.min(...ysA)
    const maxYA = Math.max(...ysA)
    const spreadXA = maxXA - minXA
    const spreadYA = maxYA - minYA

    const minXB = Math.min(...xsB)
    const maxXB = Math.max(...xsB)
    const minYB = Math.min(...ysB)
    const maxYB = Math.max(...ysB)
    const spreadXB = maxXB - minXB
    const spreadYB = maxYB - minYB

    // Each workbook should be more "tall" than "wide" → vertically stacked nodes.
    expect(spreadYA).toBeGreaterThan(spreadXA)
    expect(spreadYB).toBeGreaterThan(spreadXB)

    // The two workbook groups should be horizontally separated: their x-ranges
    // should not significantly overlap. We assert that the distance between
    // their centers is greater than the sum of their half-widths.
    const centerXA = (minXA + maxXA) / 2
    const centerXB = (minXB + maxXB) / 2
    const halfWidthA = spreadXA / 2
    const halfWidthB = spreadXB / 2

    expect(Math.abs(centerXA - centerXB)).toBeGreaterThan(halfWidthA + halfWidthB)
  })

  it('different seeds can produce different node positions for graphs with same-rank nodes', () => {
    // A workbook with multiple parallel sheets (no cross-sheet refs) ensures equal-rank nodes
    // whose order Dagre can vary based on input ordering (controlled by seed)
    const wbMulti = makeWorkbook('Multi.xlsx', [
      { sheetName: 'S1' }, { sheetName: 'S2' }, { sheetName: 'S3' },
      { sheetName: 'S4' }, { sheetName: 'S5' },
    ])
    const { nodes, edges } = buildGraph([wbMulti])
    const r1 = reorganizeLayout(nodes, edges, 'graph', 'LR', new Set(), 1)
    const r2 = reorganizeLayout(nodes, edges, 'graph', 'LR', new Set(), 99)
    // Both results must have the same node count with valid positions
    expect(r1).toHaveLength(nodes.length)
    expect(r2).toHaveLength(nodes.length)
    for (const n of [...r1, ...r2]) {
      expect(isNaN(n.position.x)).toBe(false)
      expect(isNaN(n.position.y)).toBe(false)
    }
    // At least one node should have a different position between the two seeds
    const pos1 = new Map(r1.map((n) => [n.id, n.position]))
    const anyDiff = r2.some((n) => {
      const p = pos1.get(n.id)
      return p && (n.position.x !== p.x || n.position.y !== p.y)
    })
    expect(anyDiff).toBe(true)
  })
})
