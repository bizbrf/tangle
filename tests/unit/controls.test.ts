import { describe, it, expect } from 'vitest'
import type { WorkbookFile, SheetReference, SheetWorkload } from '../../src/types'
import { buildGraph } from '../../src/lib/graph'

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
    originalName: name,
    storageName: name,
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

const crossFileRef: SheetReference = {
  targetWorkbook: 'FileB.xlsx',
  targetSheet: 'Sheet1',
  cells: ['A1'],
  formula: '[FileB.xlsx]Sheet1!A1',
  sourceCell: 'A1',
}

const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [crossFileRef] }])
const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Sheet1' }])

describe('CTRL-01: default graph layout remains flat dagre', () => {
  it("explicit groupingMode 'off' matches the default graph layout", () => {
    const { nodes: graphNodes } = buildGraph([wbA, wbB], 'graph')
    const { nodes: offNodes } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'LR', 'off')

    expect(offNodes.length).toBe(graphNodes.length)

    const graphById = new Map(graphNodes.map((n) => [n.id, n.position]))
    for (const node of offNodes) {
      expect(graphById.get(node.id)).toEqual(node.position)
    }
  })
})

describe('CTRL-02: layout stays deterministic', () => {
  it('graph mode produces identical positions across runs', () => {
    const { nodes: first } = buildGraph([wbA, wbB], 'graph')
    const { nodes: second } = buildGraph([wbA, wbB], 'graph')
    const secondById = new Map(second.map((n) => [n.id, n.position]))

    for (const node of first) {
      expect(secondById.get(node.id)).toEqual(node.position)
    }
  })

  it('grouped layout mode stays deterministic for helper/overview logic', () => {
    const { nodes: first } = buildGraph([wbA, wbB], 'grouped')
    const { nodes: second } = buildGraph([wbA, wbB], 'grouped')
    const secondById = new Map(second.map((n) => [n.id, n.position]))

    for (const node of first) {
      expect(secondById.get(node.id)).toEqual(node.position)
    }
  })

  it('TB direction stays deterministic across runs', () => {
    const { nodes: first } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'TB')
    const { nodes: second } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'TB')
    const secondById = new Map(second.map((n) => [n.id, n.position]))

    for (const node of first) {
      expect(secondById.get(node.id)).toEqual(node.position)
    }
  })
})

describe('CTRL-03: legacy grouping URL state is ignored', () => {
  function readUrlState(search: string) {
    const p = new URLSearchParams(search)
    const viewMode = p.get('view') === 'overview' ? 'overview' : 'graph'
    const dir = p.get('dir') === 'TB' ? 'TB' : 'LR'
    const fit = p.get('fit') !== 'false'
    return { viewMode, dir, fit }
  }

  function writeUrlState(search: string, viewMode: 'graph' | 'overview', dir: 'LR' | 'TB', fit: boolean) {
    const p = new URLSearchParams(search)
    p.set('view', viewMode)
    p.set('dir', dir)
    p.delete('group')
    p.set('fit', String(fit))
    return p
  }

  it('ignores old by-type/by-table values when restoring control state', () => {
    expect(readUrlState('?group=by-type')).toEqual({ viewMode: 'graph', dir: 'LR', fit: true })
    expect(readUrlState('?group=by-table&view=overview&dir=TB&fit=false')).toEqual({ viewMode: 'overview', dir: 'TB', fit: false })
  })

  it('removes stale group params when persisting URL state', () => {
    const params = writeUrlState('?group=by-type&view=overview', 'graph', 'TB', true)
    expect(params.get('view')).toBe('graph')
    expect(params.get('dir')).toBe('TB')
    expect(params.get('fit')).toBe('true')
    expect(params.has('group')).toBe(false)
  })
})
