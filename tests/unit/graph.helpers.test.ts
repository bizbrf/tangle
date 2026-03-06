// tests/unit/graph.helpers.test.ts
// Environment: node (default from vitest.config.ts — no override needed)
// Covers: stripExcelExt, computeClusterNodes, groupedLayout external-nodes path,
//         buildOverviewGraph external file path
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import type { SheetReference, WorkbookFile, SheetWorkload } from '../../src/types'
import { applyLayoutAlgorithm, stripExcelExt, computeClusterNodes, buildGraph, radialLayout, randomizeLayout, type NodeData } from '../../src/lib/graph'

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

function makeExternalRef(targetWorkbook: string, targetSheet: string): SheetReference {
  return {
    targetWorkbook,
    targetSheet,
    cells: ['A1'],
    formula: `[${targetWorkbook}]${targetSheet}!A1`,
    sourceCell: 'A1',
  }
}

// ── HELPER-01: stripExcelExt (file naming sanitizer) ─────────────────────────

describe('HELPER-01: stripExcelExt — file naming sanitizer', () => {
  it('strips .xlsx extension', () => {
    expect(stripExcelExt('Report.xlsx')).toBe('Report')
  })

  it('strips .xls extension', () => {
    expect(stripExcelExt('Data.xls')).toBe('Data')
  })

  it('strips .xlsm extension', () => {
    expect(stripExcelExt('Model.xlsm')).toBe('Model')
  })

  it('strips .xlsb extension', () => {
    expect(stripExcelExt('Archive.xlsb')).toBe('Archive')
  })

  it('is case-insensitive when stripping', () => {
    expect(stripExcelExt('File.XLSX')).toBe('File')
    expect(stripExcelExt('File.Xlsx')).toBe('File')
  })

  it('leaves name unchanged when no Excel extension is present', () => {
    expect(stripExcelExt('README')).toBe('README')
    expect(stripExcelExt('report.pdf')).toBe('report.pdf')
  })

  it('strips only the trailing Excel extension, preserving dots in the stem', () => {
    expect(stripExcelExt('my.report.xlsx')).toBe('my.report')
  })
})

// ── HELPER-02: computeClusterNodes — layout helper ───────────────────────────

describe('HELPER-02: computeClusterNodes — layout helper', () => {
  // Build a real positioned node set via buildGraph so positions are valid
  const crossFileRef: SheetReference = makeExternalRef('FileB.xlsx', 'Sheet1')
  const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [crossFileRef] }])
  const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Sheet1' }])

  it('returns one cluster per uploaded workbook in grouped mode', () => {
    const { nodes } = buildGraph([wbA, wbB], 'grouped')
    const internalNodes = nodes.filter(n => !n.data.isExternal)
    const clusters = computeClusterNodes(internalNodes)
    // Should produce one cluster per unique workbook name
    expect(clusters.length).toBeGreaterThanOrEqual(2)
    const clusterWorkbooks = clusters.map(c => c.data.workbookName)
    expect(clusterWorkbooks).toContain('FileA.xlsx')
    expect(clusterWorkbooks).toContain('FileB.xlsx')
  })

  it('cluster id has [cluster] prefix', () => {
    const { nodes } = buildGraph([wbA, wbB], 'grouped')
    const internalNodes = nodes.filter(n => !n.data.isExternal)
    const clusters = computeClusterNodes(internalNodes)
    for (const cluster of clusters) {
      expect(cluster.id).toMatch(/^\[cluster\]/)
    }
  })

  it('cluster type is "cluster"', () => {
    const { nodes } = buildGraph([wbA, wbB], 'grouped')
    const internalNodes = nodes.filter(n => !n.data.isExternal)
    const clusters = computeClusterNodes(internalNodes)
    for (const cluster of clusters) {
      expect(cluster.type).toBe('cluster')
    }
  })

  it('cluster width and height are positive', () => {
    const { nodes } = buildGraph([wbA, wbB], 'grouped')
    const internalNodes = nodes.filter(n => !n.data.isExternal)
    const clusters = computeClusterNodes(internalNodes)
    for (const cluster of clusters) {
      expect(cluster.data.width).toBeGreaterThan(0)
      expect(cluster.data.height).toBeGreaterThan(0)
    }
  })

  it('cluster label matches stripped workbook name', () => {
    const { nodes } = buildGraph([wbA, wbB], 'grouped')
    const internalNodes = nodes.filter(n => !n.data.isExternal)
    const clusters = computeClusterNodes(internalNodes)
    const clusterA = clusters.find(c => c.data.workbookName === 'FileA.xlsx')
    expect(clusterA?.data.label).toBe('FileA')
  })

  it('returns empty array when given an empty node list', () => {
    const clusters = computeClusterNodes([])
    expect(clusters).toHaveLength(0)
  })

  it('external cluster appears when more than one external node exists', () => {
    // Two distinct external refs → two external file nodes
    const ref1 = makeExternalRef('ExtA.xlsx', 'Sheet1')
    const ref2 = makeExternalRef('ExtB.xlsx', 'Sheet1')
    const wbSrc = makeWorkbook('Source.xlsx', [
      { sheetName: 'Sheet1', refs: [ref1, ref2] },
    ])
    const { nodes } = buildGraph([wbSrc], 'grouped')
    const externalNodes = nodes.filter(n => n.data.isExternal)
    // This setup should deterministically produce two external nodes
    expect(externalNodes).toHaveLength(2)
    const clusters = computeClusterNodes(nodes)
    const extCluster = clusters.find(c => c.id === '[cluster]__external__')
    expect(extCluster).toBeDefined()
    expect(extCluster?.data.isExternal).toBe(true)
    expect(extCluster?.data.label).toBe('External Files')
  })

  it('external cluster is not produced for a single external node', () => {
    // Only one external ref → only one external node → no external cluster
    const { nodes } = buildGraph([wbA], 'grouped') // wbA refs External.xlsx, not uploaded
    const clusters = computeClusterNodes(nodes)
    const extCluster = clusters.find(c => c.id === '[cluster]__external__')
    expect(extCluster).toBeUndefined()
  })
})

// ── HELPER-03: grouped layout handles external file nodes ─────────────────────

describe('HELPER-03: grouped layout — external nodes path', () => {
  it('grouped layout includes external file node when ref target is not uploaded', () => {
    const ref = makeExternalRef('NotUploaded.xlsx', 'Data')
    const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [ref] }])
    const { nodes } = buildGraph([wbA], 'grouped')
    const externalNode = nodes.find(n => n.data.isExternal)
    expect(externalNode).toBeDefined()
    expect(externalNode?.data.workbookName).toBe('NotUploaded.xlsx')
  })

  it('grouped layout: external node has valid position', () => {
    const ref = makeExternalRef('NotUploaded.xlsx', 'Data')
    const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [ref] }])
    const { nodes } = buildGraph([wbA], 'grouped')
    const externalNode = nodes.find(n => n.data.isExternal)
    expect(externalNode?.position.x).toBeGreaterThanOrEqual(0)
    expect(externalNode?.position.y).toBeGreaterThanOrEqual(0)
  })

  it('grouped layout TB direction: external node present and positioned', () => {
    const ref = makeExternalRef('External.xlsx', 'Sheet1')
    const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [ref] }])
    const { nodes } = buildGraph([wbA], 'grouped', new Set(), false, false, 'TB')
    const externalNode = nodes.find(n => n.data.isExternal)
    expect(externalNode).toBeDefined()
    expect(externalNode?.position.x).toBeGreaterThanOrEqual(0)
    expect(externalNode?.position.y).toBeGreaterThanOrEqual(0)
  })
})

// ── HELPER-04: overview mode handles external file refs ───────────────────────

describe('HELPER-04: overview mode — external file reference', () => {
  it('overview with external ref produces an external node for the non-uploaded file', () => {
    const ref = makeExternalRef('External.xlsx', 'Data')
    const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [ref] }])
    const { nodes } = buildGraph([wbA], 'overview')
    const externalNode = nodes.find(n => n.data.isExternal)
    expect(externalNode).toBeDefined()
    expect(externalNode?.data.workbookName).toBe('External.xlsx')
    expect(externalNode?.data.label).toBe('External') // stripExcelExt applied
  })

  it('overview with external ref produces an edge of kind "external"', () => {
    const ref = makeExternalRef('External.xlsx', 'Data')
    const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [ref] }])
    const { edges } = buildGraph([wbA], 'overview')
    const externalEdge = edges.find(e => e.data?.edgeKind === 'external')
    expect(externalEdge).toBeDefined()
  })

  it('overview with cross-file ref to uploaded workbook produces "cross-file" edge', () => {
    const ref = makeExternalRef('FileB.xlsx', 'Sheet1')
    const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [ref] }])
    const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Sheet1' }])
    const { edges } = buildGraph([wbA, wbB], 'overview')
    const crossFileEdge = edges.find(e => e.data?.edgeKind === 'cross-file')
    expect(crossFileEdge).toBeDefined()
  })
})

// ── HELPER-05: computeClusterNodes with manually positioned nodes ─────────────

describe('HELPER-05: computeClusterNodes — bounding box geometry', () => {
  function makeNode(id: string, workbookName: string, x: number, y: number, isExternal = false): Node<NodeData> {
    return {
      id,
      type: 'sheet',
      position: { x, y },
      data: {
        label: id,
        workbookName,
        sheetName: id,
        isExternal,
        isFileNode: false,
        isNamedRange: false,
        isTable: false,
        outgoingCount: 0,
        incomingCount: 0,
        workload: null,
      },
    }
  }

  it('cluster x is less than the leftmost node position', () => {
    const nodes = [makeNode('n1', 'File.xlsx', 100, 200), makeNode('n2', 'File.xlsx', 300, 400)]
    const clusters = computeClusterNodes(nodes)
    expect(clusters[0].position.x).toBeLessThan(100)
  })

  it('cluster y is less than the topmost node position', () => {
    const nodes = [makeNode('n1', 'File.xlsx', 100, 200), makeNode('n2', 'File.xlsx', 300, 400)]
    const clusters = computeClusterNodes(nodes)
    expect(clusters[0].position.y).toBeLessThan(200)
  })

  it('two workbooks produce two non-external clusters', () => {
    const nodes = [
      makeNode('a1', 'FileA.xlsx', 50, 50),
      makeNode('b1', 'FileB.xlsx', 400, 50),
    ]
    const clusters = computeClusterNodes(nodes)
    expect(clusters.filter(c => !c.data.isExternal)).toHaveLength(2)
  })
})

// ── HELPER-06: cross-file ref to non-existent sheet in uploaded workbook ───────

describe('HELPER-06: cross-file ref to unregistered sheet in uploaded workbook', () => {
  it('creates a node for the missing target sheet when it is in an uploaded workbook', () => {
    // FileA refs a sheet "Phantom" in FileB, but FileB only declares "Sheet1"
    const phantomRef: SheetReference = {
      targetWorkbook: 'FileB.xlsx',
      targetSheet: 'Phantom',
      cells: ['A1'],
      formula: '[FileB.xlsx]Phantom!A1',
      sourceCell: 'A1',
    }
    const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [phantomRef] }])
    const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Sheet1' }])
    const { nodes, edges } = buildGraph([wbA, wbB], 'graph')
    // Node for "Phantom" should be auto-created since FileB is uploaded
    const phantomNode = nodes.find(n => n.data.sheetName === 'Phantom')
    expect(phantomNode).toBeDefined()
    // And there should be an edge connecting it
    expect(edges.length).toBeGreaterThan(0)
  })
})

describe('HELPER-07: randomizeLayout', () => {
  function makeNode(id: string, workbookName: string, x: number, y: number): Node<NodeData> {
    return {
      id,
      type: 'sheet',
      position: { x, y },
      data: {
        label: id,
        workbookName,
        sheetName: id,
        isExternal: false,
        isFileNode: false,
        isNamedRange: false,
        isTable: false,
        outgoingCount: 0,
        incomingCount: 0,
        workload: null,
      },
    }
  }

  it('returns deterministic positions for the same seed', () => {
    const nodes = [
      makeNode('n1', 'FileA.xlsx', 0, 0),
      makeNode('n2', 'FileA.xlsx', 10, 10),
      makeNode('n3', 'FileB.xlsx', 20, 20),
      makeNode('n4', 'FileB.xlsx', 30, 30),
      makeNode('n5', 'FileB.xlsx', 40, 40),
    ]
    const edges = [
      { id: 'n1->n2', source: 'n1', target: 'n2', data: { references: [], refCount: 0, edgeKind: 'internal' }, type: 'weighted' as const },
      { id: 'n1->n3', source: 'n1', target: 'n3', data: { references: [], refCount: 0, edgeKind: 'cross-file' }, type: 'weighted' as const },
      { id: 'n1->n4', source: 'n1', target: 'n4', data: { references: [], refCount: 0, edgeKind: 'cross-file' }, type: 'weighted' as const },
      { id: 'n1->n5', source: 'n1', target: 'n5', data: { references: [], refCount: 0, edgeKind: 'cross-file' }, type: 'weighted' as const },
    ]

    const first = randomizeLayout(nodes, edges, 'graph', 'LR', 42)
    const second = randomizeLayout(nodes, edges, 'graph', 'LR', 42)

    expect(first.map((node) => node.position)).toEqual(second.map((node) => node.position))
  })

  it('can generate a different layout for a different seed', () => {
    const nodes = [
      makeNode('n1', 'FileA.xlsx', 0, 0),
      makeNode('n2', 'FileA.xlsx', 10, 10),
      makeNode('n3', 'FileB.xlsx', 20, 20),
      makeNode('n4', 'FileB.xlsx', 30, 30),
      makeNode('n5', 'FileB.xlsx', 40, 40),
    ]
    const edges = [
      { id: 'n1->n2', source: 'n1', target: 'n2', data: { references: [], refCount: 0, edgeKind: 'internal' }, type: 'weighted' as const },
      { id: 'n1->n3', source: 'n1', target: 'n3', data: { references: [], refCount: 0, edgeKind: 'cross-file' }, type: 'weighted' as const },
      { id: 'n1->n4', source: 'n1', target: 'n4', data: { references: [], refCount: 0, edgeKind: 'cross-file' }, type: 'weighted' as const },
      { id: 'n1->n5', source: 'n1', target: 'n5', data: { references: [], refCount: 0, edgeKind: 'cross-file' }, type: 'weighted' as const },
    ]

    const first = randomizeLayout(nodes, edges, 'graph', 'LR', 1)
    const alternatives = [2, 3, 4, 5].map((seed) => randomizeLayout(nodes, edges, 'graph', 'LR', seed))

    expect(alternatives.some((candidate) =>
      first.some((node, index) => {
        const other = candidate[index]
        return node.position.x !== other.position.x || node.position.y !== other.position.y
      }))).toBe(true)
  })

  it('preserves a layered left-to-right layout instead of using a grid', () => {
    const { nodes, edges } = buildGraph([
      makeWorkbook('FileA.xlsx', [{ sheetName: 'Source1' }, { sheetName: 'Source2' }]),
      makeWorkbook('FileB.xlsx', [{
        sheetName: 'Consumer',
        refs: [
          { targetWorkbook: 'FileA.xlsx', targetSheet: 'Source1', cells: ['A1'], formula: '[FileA.xlsx]Source1!A1', sourceCell: 'A1' },
          { targetWorkbook: 'FileA.xlsx', targetSheet: 'Source2', cells: ['A1'], formula: '[FileA.xlsx]Source2!A1', sourceCell: 'A2' },
        ],
      }]),
    ], 'graph', new Set(), false, false, 'LR')

    const randomized = randomizeLayout(nodes, edges, 'graph', 'LR', 7)
    const byId = new Map(randomized.map((node) => [node.id, node.position]))

    expect(byId.get('FileA.xlsx::Source1')!.x).toBeLessThan(byId.get('FileB.xlsx::Consumer')!.x)
    expect(byId.get('FileA.xlsx::Source2')!.x).toBeLessThan(byId.get('FileB.xlsx::Consumer')!.x)
  })

  it('applyLayoutAlgorithm uses the organic layout for the organic option', () => {
    const { nodes, edges } = buildGraph([
      makeWorkbook('FileA.xlsx', [{ sheetName: 'Source1' }, { sheetName: 'Source2' }]),
      makeWorkbook('FileB.xlsx', [{
        sheetName: 'Consumer',
        refs: [
          { targetWorkbook: 'FileA.xlsx', targetSheet: 'Source1', cells: ['A1'], formula: '[FileA.xlsx]Source1!A1', sourceCell: 'A1' },
          { targetWorkbook: 'FileA.xlsx', targetSheet: 'Source2', cells: ['A1'], formula: '[FileA.xlsx]Source2!A1', sourceCell: 'A2' },
        ],
      }]),
    ], 'graph', new Set(), false, false, 'LR')

    const organic = applyLayoutAlgorithm(nodes, edges, 'organic', 'graph', 'LR', 11)
    const byId = new Map(organic.map((node) => [node.id, node.position]))
    expect(byId.get('FileA.xlsx::Source1')!.x).toBeLessThan(byId.get('FileB.xlsx::Consumer')!.x)
  })
})

describe('HELPER-08: radialLayout', () => {
  it('places roots closer to the center than downstream nodes', () => {
    const ref1 = makeExternalRef('FileB.xlsx', 'Input1')
    const ref2 = makeExternalRef('FileB.xlsx', 'Input2')
    const source = makeWorkbook('FileA.xlsx', [{ sheetName: 'Consumer', refs: [ref1, ref2] }])
    const upstream = makeWorkbook('FileB.xlsx', [{ sheetName: 'Input1' }, { sheetName: 'Input2' }])
    const { nodes, edges } = buildGraph([source, upstream], 'graph', new Set(), false, false, 'LR')
    const radial = radialLayout(nodes, edges, 'LR', 5)
    const byId = new Map(radial.map((node) => [node.id, node.position]))

    const centerDistance = (position: { x: number; y: number }) => Math.hypot(position.x - 420, position.y - 320)
    expect(centerDistance(byId.get('FileB.xlsx::Input1')!)).toBeLessThan(centerDistance(byId.get('FileA.xlsx::Consumer')!))
  })
})
