// tests/unit/controls.test.ts
// Covers: CTRL-01 to CTRL-06
// Unit tests for GroupingMode layout logic, deterministic layout, and URL state helpers.
import { describe, it, expect } from 'vitest'
import type { WorkbookFile, SheetReference, SheetWorkload } from '../../src/types'
import { buildGraph, type GroupingMode } from '../../src/lib/graph'

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

const crossFileRef: SheetReference = {
  targetWorkbook: 'FileB.xlsx',
  targetSheet: 'Sheet1',
  cells: ['A1'],
  formula: '[FileB.xlsx]Sheet1!A1',
  sourceCell: 'A1',
}

const wbA = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1', refs: [crossFileRef] }])
const wbB = makeWorkbook('FileB.xlsx', [{ sheetName: 'Sheet1' }])

// ── CTRL-01: GroupingMode 'off' produces flat dagre layout ────────────────────

describe("CTRL-01: GroupingMode 'off' produces flat dagre layout", () => {
  it("groupingMode 'off' gives same result as layoutMode 'graph'", () => {
    const { nodes: graphNodes } = buildGraph([wbA, wbB], 'graph')
    const { nodes: offNodes } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'LR', 'off')
    expect(offNodes.length).toBe(graphNodes.length)
    const graphById = new Map(graphNodes.map((n) => [n.id, n.position]))
    for (const node of offNodes) {
      expect(graphById.get(node.id)).toEqual(node.position)
    }
  })
})

// ── CTRL-02: GroupingMode 'by-type' clusters nodes by workbook ────────────────

describe("CTRL-02: GroupingMode 'by-type' clusters nodes by workbook", () => {
  it("groupingMode 'by-type' gives same layout as layoutMode 'grouped'", () => {
    const { nodes: groupedNodes } = buildGraph([wbA, wbB], 'grouped')
    const { nodes: byTypeNodes } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'LR', 'by-type')
    expect(byTypeNodes.length).toBe(groupedNodes.length)
    const groupedById = new Map(groupedNodes.map((n) => [n.id, n.position]))
    for (const node of byTypeNodes) {
      expect(groupedById.get(node.id)).toEqual(node.position)
    }
  })

  it("groupingMode 'by-type' returns non-empty nodes with valid positions", () => {
    const { nodes } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'LR', 'by-type')
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.position.x).toBeGreaterThan(0)
      expect(node.position.y).toBeGreaterThan(0)
    }
  })
})

// ── CTRL-03: GroupingMode 'by-table' produces valid layout ───────────────────

describe("CTRL-03: GroupingMode 'by-table' produces valid layout", () => {
  it("groupingMode 'by-table' returns non-empty nodes with valid positions", () => {
    const { nodes } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'LR', 'by-table')
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(node.position.x).toBeGreaterThan(0)
      expect(node.position.y).toBeGreaterThan(0)
    }
  })

  it("groupingMode 'by-table' with table nodes groups table nodes into own cluster", () => {
    const tableRef: SheetReference = {
      targetWorkbook: null, targetSheet: 'Data', cells: ['A1:B10'],
      formula: 'SUM(SalesTable[Amount])', sourceCell: 'A1', tableName: 'SalesTable',
    }
    const wb = makeWorkbook('FileA.xlsx', [
      { sheetName: 'Summary', refs: [tableRef] },
      { sheetName: 'Data' },
    ])
    const { nodes } = buildGraph([wb], 'graph', new Set(), false, true, 'LR', 'by-table')
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(isFinite(node.position.x)).toBe(true)
      expect(isFinite(node.position.y)).toBe(true)
    }
  })
})

// ── CTRL-04: Deterministic layout — same inputs → identical positions ─────────

describe('CTRL-04: Deterministic layout — same inputs produce identical positions', () => {
  it('two calls to buildGraph with identical inputs give identical node positions (graph mode)', () => {
    const { nodes: first } = buildGraph([wbA, wbB], 'graph')
    const { nodes: second } = buildGraph([wbA, wbB], 'graph')
    const secondById = new Map(second.map((n) => [n.id, n.position]))
    for (const node of first) {
      const pos2 = secondById.get(node.id)
      expect(pos2).toBeDefined()
      expect(node.position.x).toBe(pos2!.x)
      expect(node.position.y).toBe(pos2!.y)
    }
  })

  it('two calls to buildGraph with identical inputs give identical node positions (grouped mode)', () => {
    const { nodes: first } = buildGraph([wbA, wbB], 'grouped')
    const { nodes: second } = buildGraph([wbA, wbB], 'grouped')
    const secondById = new Map(second.map((n) => [n.id, n.position]))
    for (const node of first) {
      const pos2 = secondById.get(node.id)
      expect(pos2).toBeDefined()
      expect(node.position.x).toBe(pos2!.x)
      expect(node.position.y).toBe(pos2!.y)
    }
  })

  it('two calls to buildGraph with identical inputs give identical positions (by-type grouping)', () => {
    const { nodes: first } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'LR', 'by-type')
    const { nodes: second } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'LR', 'by-type')
    const secondById = new Map(second.map((n) => [n.id, n.position]))
    for (const node of first) {
      const pos2 = secondById.get(node.id)
      expect(pos2).toBeDefined()
      expect(node.position.x).toBe(pos2!.x)
      expect(node.position.y).toBe(pos2!.y)
    }
  })

  it('TB direction is deterministic across multiple calls', () => {
    const { nodes: first } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'TB')
    const { nodes: second } = buildGraph([wbA, wbB], 'graph', new Set(), false, false, 'TB')
    const secondById = new Map(second.map((n) => [n.id, n.position]))
    for (const node of first) {
      const pos2 = secondById.get(node.id)
      expect(pos2).toBeDefined()
      expect(node.position.x).toBe(pos2!.x)
      expect(node.position.y).toBe(pos2!.y)
    }
  })
})

// ── CTRL-05: GroupingMode does not affect overview mode ───────────────────────

describe('CTRL-05: overview mode is unaffected by groupingMode parameter', () => {
  it('overview mode returns one node per uploaded workbook regardless of groupingMode', () => {
    const { nodes: noGroup } = buildGraph([wbA, wbB], 'overview')
    const { nodes: withGroup } = buildGraph([wbA, wbB], 'overview', new Set(), false, false, 'LR', 'by-type')
    const uploadedNoGroup = noGroup.filter((n) => !n.data.isExternal)
    const uploadedWithGroup = withGroup.filter((n) => !n.data.isExternal)
    expect(uploadedNoGroup).toHaveLength(2)
    expect(uploadedWithGroup).toHaveLength(2)
  })
})

// ── CTRL-06: URL state helpers round-trip correctly ───────────────────────────

describe('CTRL-06: URL state helpers encode and decode correctly', () => {
  const VALID_VIEWS = ['graph', 'overview'] as const
  const VALID_DIRS = ['LR', 'TB'] as const
  const VALID_GROUPS: GroupingMode[] = ['off', 'by-type', 'by-table']

  it('every valid view, direction, grouping combination round-trips through URLSearchParams', () => {
    for (const view of VALID_VIEWS) {
      for (const dir of VALID_DIRS) {
        for (const group of VALID_GROUPS) {
          for (const fit of [true, false]) {
            const p = new URLSearchParams()
            p.set('view', view)
            p.set('dir', dir)
            p.set('group', group)
            p.set('fit', String(fit))

            const readView = p.get('view') === 'overview' ? 'overview' : 'graph'
            const readDir = p.get('dir') === 'TB' ? 'TB' : 'LR'
            const rawGroup = p.get('group') ?? 'off'
            const readGroup = (['off', 'by-type', 'by-table'].includes(rawGroup) ? rawGroup : 'off') as GroupingMode
            const readFit = p.get('fit') !== 'false'

            expect(readView).toBe(view)
            expect(readDir).toBe(dir)
            expect(readGroup).toBe(group)
            expect(readFit).toBe(fit)
          }
        }
      }
    }
  })

  it('unknown group param falls back to "off"', () => {
    const p = new URLSearchParams()
    p.set('group', 'invalid-value')
    const rawGroup = p.get('group') ?? 'off'
    const readGroup = (['off', 'by-type', 'by-table'].includes(rawGroup) ? rawGroup : 'off') as GroupingMode
    expect(readGroup).toBe('off')
  })

  it('missing params default correctly', () => {
    const p = new URLSearchParams()
    const readView = p.get('view') === 'overview' ? 'overview' : 'graph'
    const readDir = p.get('dir') === 'TB' ? 'TB' : 'LR'
    const rawGroup = p.get('group') ?? 'off'
    const readGroup = (['off', 'by-type', 'by-table'].includes(rawGroup) ? rawGroup : 'off') as GroupingMode
    const readFit = p.get('fit') !== 'false'

    expect(readView).toBe('graph')
    expect(readDir).toBe('LR')
    expect(readGroup).toBe('off')
    expect(readFit).toBe(true)
  })
})
