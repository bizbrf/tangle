// tests/unit/graph.test.ts
// Environment: node (default from vitest.config.ts — no override needed)
// Covers: GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05, GRAPH-06, GRAPH-07
import { describe, it, expect } from 'vitest'
import type { WorkbookFile, SheetReference, SheetWorkload } from '../../src/types'
import { buildGraph } from '../../src/lib/graph'

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
    expect(edges[0].data.refCount).toBe(2)
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
    const internalEdge = edges.find(e => e.data.edgeKind === 'internal')
    expect(internalEdge).toBeDefined()
  })

  it("cross-file edge: ref to uploaded workbook has edgeKind 'cross-file'", () => {
    const { edges } = buildGraph([wbA, wbB])
    const crossFileEdge = edges.find(e => e.data.edgeKind === 'cross-file')
    expect(crossFileEdge).toBeDefined()
  })

  it("external edge: ref to non-uploaded workbook has edgeKind 'external'", () => {
    // Upload only wbA — External.xlsx is not uploaded
    const { edges } = buildGraph([wbA])
    // crossFileRef now also becomes external (FileB.xlsx not uploaded)
    const externalEdges = edges.filter(e => e.data.edgeKind === 'external')
    expect(externalEdges.length).toBeGreaterThan(0)
  })

  it("named-range edge: ref with namedRangeName has edgeKind 'named-range' when showNamedRanges=true", () => {
    const { edges } = buildGraph([wbWithNR], 'graph', new Set(), true)
    const nrEdge = edges.find(e => e.data.edgeKind === 'named-range')
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
    expect(edges.every(e => e.data.edgeKind === 'named-range')).toBe(true)
    expect(edges).toHaveLength(2)
  })

  it('showNamedRanges=false: a direct edge exists (not named-range kind)', () => {
    const { edges } = buildGraph([wbWithNR], 'graph', new Set(), false)
    expect(edges).toHaveLength(1)
    expect(edges[0].data.edgeKind).not.toBe('named-range')
  })
})
