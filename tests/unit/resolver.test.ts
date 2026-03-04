// tests/unit/resolver.test.ts
// Covers: formula reference resolver, dependency graph, cycle detection, caching, rename
import { describe, it, expect, beforeEach } from 'vitest'
import type { WorkbookFile, ExcelTable, SheetReference, SheetWorkload } from '../../src/types'
import {
  parseStructuredRefs,
  parseStructuredRefsCached,
  clearParseCache,
  detectCycles,
  buildDependencyGraph,
  renameReference,
  topoSort,
} from '../../src/lib/resolver'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTableMap(tables: ExcelTable[]): Map<string, ExcelTable> {
  return new Map(tables.map((t) => [t.name.toLowerCase(), t]))
}

const zeroWorkload: SheetWorkload = {
  totalFormulas: 0, withinSheetRefs: 0, crossSheetRefs: 0, crossFileRefs: 0,
}

function makeRef(targetSheet: string, targetWorkbook: string | null = null): SheetReference {
  return { targetWorkbook, targetSheet, cells: ['A1'], formula: `${targetSheet}!A1`, sourceCell: 'A1' }
}

function makeWorkbook(name: string, sheetsWithRefs: { sheetName: string; refs?: SheetReference[] }[]): WorkbookFile {
  return {
    id: name,
    name,
    namedRanges: [],
    tables: [],
    sheets: sheetsWithRefs.map(({ sheetName, refs = [] }) => ({
      workbookName: name,
      sheetName,
      references: refs,
      workload: { ...zeroWorkload },
    })),
  }
}

// ── parseStructuredRefs ───────────────────────────────────────────────────────

describe('parseStructuredRefs — TableName[ColumnName]', () => {
  it('detects a simple TableName[ColumnName] reference', () => {
    const tableMap = makeTableMap([
      { name: 'SalesTable', ref: 'A1:B10', targetSheet: 'Data', cells: 'A1:B10' },
    ])
    const { refs, errors } = parseStructuredRefs('SUM(SalesTable[Amount])', tableMap)
    expect(refs).toHaveLength(1)
    expect(refs[0].kind).toBe('table-column')
    expect(refs[0].tableName).toBe('SalesTable')
    expect(refs[0].columnName).toBe('Amount')
    expect(errors).toHaveLength(0)
  })

  it('returns MISSING_TABLE error when table is not in tableMap', () => {
    const { refs, errors } = parseStructuredRefs('SUM(UnknownTable[Amount])', new Map())
    expect(refs).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].kind).toBe('MISSING_TABLE')
    expect(errors[0].message).toContain('UnknownTable')
    expect(errors[0].formula).toBe('SUM(UnknownTable[Amount])')
  })

  it('returns MISSING_COLUMN error when column is not in table columns list', () => {
    const tableMap = makeTableMap([
      { name: 'SalesTable', ref: 'A1:B10', targetSheet: 'Data', cells: 'A1:B10', columns: ['Name', 'Amount'] },
    ])
    const { errors } = parseStructuredRefs('SUM(SalesTable[NoSuchColumn])', tableMap)
    expect(errors).toHaveLength(1)
    expect(errors[0].kind).toBe('MISSING_COLUMN')
    expect(errors[0].message).toContain('NoSuchColumn')
    expect(errors[0].message).toContain('SalesTable')
  })

  it('does NOT emit MISSING_COLUMN when table has no columns metadata', () => {
    // When columns are not extracted we cannot validate them — skip the check
    const tableMap = makeTableMap([
      { name: 'SalesTable', ref: 'A1:B10', targetSheet: 'Data', cells: 'A1:B10' },
    ])
    const { errors } = parseStructuredRefs('SUM(SalesTable[AnyColumn])', tableMap)
    expect(errors).toHaveLength(0)
  })

  it('matching is case-insensitive for table name', () => {
    const tableMap = makeTableMap([
      { name: 'SalesTable', ref: 'A1:B10', targetSheet: 'Data', cells: 'A1:B10' },
    ])
    const { refs, errors } = parseStructuredRefs('SUM(SALESTABLE[Amount])', tableMap)
    expect(errors).toHaveLength(0)
    expect(refs).toHaveLength(1)
    expect(refs[0].tableName).toBe('SALESTABLE')
  })

  it('deduplicates identical refs in one formula', () => {
    const tableMap = makeTableMap([
      { name: 'SalesTable', ref: 'A1:B10', targetSheet: 'Data', cells: 'A1:B10' },
    ])
    const { refs } = parseStructuredRefs('SalesTable[Amount]+SalesTable[Amount]', tableMap)
    // The same rawRef appears twice — should be deduplicated
    const tblRefs = refs.filter((r) => r.tableName === 'SalesTable' && r.columnName === 'Amount')
    expect(tblRefs).toHaveLength(1)
  })

  it('skips [#Headers], [#Data], [#All] Excel special selectors', () => {
    const tableMap = makeTableMap([
      { name: 'SalesTable', ref: 'A1:B10', targetSheet: 'Data', cells: 'A1:B10' },
    ])
    const { refs } = parseStructuredRefs('SalesTable[#Headers]', tableMap)
    const specialRefs = refs.filter((r) => r.columnName?.startsWith('#'))
    expect(specialRefs).toHaveLength(0)
  })
})

describe('parseStructuredRefs — [@ColumnName] relative references', () => {
  it('detects [@ColumnName] relative reference', () => {
    const { refs, errors } = parseStructuredRefs('[@Amount]*1.1', new Map())
    expect(refs).toHaveLength(1)
    expect(refs[0].kind).toBe('relative')
    expect(refs[0].columnName).toBe('Amount')
    expect(refs[0].tableName).toBe('')
    expect(errors).toHaveLength(0)
  })

  it('detects multiple distinct [@ColumnName] refs', () => {
    const { refs } = parseStructuredRefs('[@Price]*[@Qty]', new Map())
    const relRefs = refs.filter((r) => r.kind === 'relative')
    expect(relRefs).toHaveLength(2)
    expect(relRefs.map((r) => r.columnName).sort()).toEqual(['Price', 'Qty'])
  })

  it('does not return errors for [@ColumnName] — relative refs are always valid structurally', () => {
    const { errors } = parseStructuredRefs('[@NoSuchColumn]', new Map())
    expect(errors).toHaveLength(0)
  })
})

describe('parseStructuredRefs — QueryName.Result[ColumnName]', () => {
  it('detects QueryName.Result[ColumnName] reference', () => {
    const tableMap = makeTableMap([
      { name: 'SalesQuery', ref: 'A1:C5', targetSheet: 'QueryOutput', cells: 'A1:C5' },
    ])
    const { refs, errors } = parseStructuredRefs('SalesQuery.Result[Revenue]', tableMap)
    expect(refs).toHaveLength(1)
    expect(refs[0].kind).toBe('query-result')
    expect(refs[0].tableName).toBe('SalesQuery')
    expect(refs[0].columnName).toBe('Revenue')
    expect(errors).toHaveLength(0)
  })

  it('returns MISSING_TABLE error for unknown query', () => {
    const { errors } = parseStructuredRefs('UnknownQuery.Result[Col]', new Map())
    expect(errors).toHaveLength(1)
    expect(errors[0].kind).toBe('MISSING_TABLE')
    expect(errors[0].message).toContain('UnknownQuery')
  })

  it('returns MISSING_COLUMN error for known query with column metadata mismatch', () => {
    const tableMap = makeTableMap([
      { name: 'SalesQuery', ref: 'A1:C5', targetSheet: 'QueryOutput', cells: 'A1:C5', columns: ['ID', 'Revenue'] },
    ])
    const { errors } = parseStructuredRefs('SalesQuery.Result[MissingCol]', tableMap)
    expect(errors).toHaveLength(1)
    expect(errors[0].kind).toBe('MISSING_COLUMN')
    expect(errors[0].message).toContain('MissingCol')
  })

  it('uses queryMap as alternative resolution for query names not in tableMap', () => {
    const queryMap = new Map([['salesquery', 'QueryOutput']])
    const { refs, errors } = parseStructuredRefs('SalesQuery.Result[Revenue]', new Map(), queryMap)
    expect(errors).toHaveLength(0)
    expect(refs).toHaveLength(1)
    expect(refs[0].kind).toBe('query-result')
  })
})

// ── Caching ───────────────────────────────────────────────────────────────────

describe('parseStructuredRefsCached', () => {
  beforeEach(() => clearParseCache())

  it('returns the same result as parseStructuredRefs', () => {
    const tableMap = makeTableMap([
      { name: 'SalesTable', ref: 'A1:B10', targetSheet: 'Data', cells: 'A1:B10' },
    ])
    const direct = parseStructuredRefs('SUM(SalesTable[Amount])', tableMap)
    const cached = parseStructuredRefsCached('SUM(SalesTable[Amount])', tableMap)
    expect(cached.refs).toEqual(direct.refs)
    expect(cached.errors).toEqual(direct.errors)
  })

  it('serves repeated calls from cache (reference equality)', () => {
    const tableMap = makeTableMap([
      { name: 'T', ref: 'A1:A5', targetSheet: 'Sheet1', cells: 'A1:A5' },
    ])
    const initialCall = parseStructuredRefsCached('T[Col]', tableMap)
    const cachedCall = parseStructuredRefsCached('T[Col]', tableMap)
    // Same cached object
    expect(initialCall).toBe(cachedCall)
  })

  it('clearParseCache() forces recomputation', () => {
    const tableMap = makeTableMap([
      { name: 'T', ref: 'A1:A5', targetSheet: 'Sheet1', cells: 'A1:A5' },
    ])
    const beforeClear = parseStructuredRefsCached('T[Col]', tableMap)
    clearParseCache()
    const afterClear = parseStructuredRefsCached('T[Col]', tableMap)
    // Different object instances after cache clear
    expect(beforeClear).not.toBe(afterClear)
    expect(beforeClear.refs).toEqual(afterClear.refs)
  })
})

// ── detectCycles ──────────────────────────────────────────────────────────────

describe('detectCycles', () => {
  it('returns empty array for an acyclic graph', () => {
    const graph = {
      nodes: ['A', 'B', 'C'],
      edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }],
    }
    expect(detectCycles(graph)).toHaveLength(0)
  })

  it('detects a simple two-node cycle A → B → A', () => {
    const graph = {
      nodes: ['A', 'B'],
      edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }],
    }
    const cycles = detectCycles(graph)
    expect(cycles.length).toBeGreaterThan(0)
    // The cycle should contain both nodes
    const flat = cycles.flat()
    expect(flat).toContain('A')
    expect(flat).toContain('B')
  })

  it('detects a three-node cycle A → B → C → A', () => {
    const graph = {
      nodes: ['A', 'B', 'C'],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
      ],
    }
    const cycles = detectCycles(graph)
    expect(cycles.length).toBeGreaterThan(0)
    const flat = cycles.flat()
    expect(flat).toContain('A')
    expect(flat).toContain('B')
    expect(flat).toContain('C')
  })

  it('does not detect a cycle in a diamond graph (no back-edge)', () => {
    // A → B, A → C, B → D, C → D
    const graph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'A', to: 'C' },
        { from: 'B', to: 'D' },
        { from: 'C', to: 'D' },
      ],
    }
    expect(detectCycles(graph)).toHaveLength(0)
  })

  it('handles empty graph gracefully', () => {
    expect(detectCycles({ nodes: [], edges: [] })).toHaveLength(0)
  })

  it('handles a self-loop A → A', () => {
    const graph = {
      nodes: ['A'],
      edges: [{ from: 'A', to: 'A' }],
    }
    const cycles = detectCycles(graph)
    expect(cycles.length).toBeGreaterThan(0)
    expect(cycles[0]).toContain('A')
  })

  it('canonicalizes by rotation so the same cycle found from different entry points is deduplicated', () => {
    // A → B → C → A: regardless of which node DFS starts from, only one cycle reported
    const graph = {
      nodes: ['A', 'B', 'C'],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
      ],
    }
    const cycles = detectCycles(graph)
    expect(cycles).toHaveLength(1)
    // The canonical cycle starts at the lexicographically smallest node ('A')
    expect(cycles[0][0]).toBe('A')
    expect(new Set(cycles[0])).toEqual(new Set(['A', 'B', 'C']))
  })

  it('does NOT merge two distinct cycles sharing the same nodes (different edge sets)', () => {
    // Two separate 2-cycles over the same nodes: A→B→A AND A→C→A (both distinct)
    const graph = {
      nodes: ['A', 'B', 'C'],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' }, // cycle 1: A → B → A
        { from: 'A', to: 'C' },
        { from: 'C', to: 'A' }, // cycle 2: A → C → A
      ],
    }
    const cycles = detectCycles(graph)
    // Both cycles contain node 'A', but they use different edges — they must not be merged
    expect(cycles).toHaveLength(2)
    const flatCycles = cycles.map((c) => new Set(c))
    // Each cycle should involve a different secondary node
    const hasBCycle = flatCycles.some((s) => s.has('B'))
    const hasCCycle = flatCycles.some((s) => s.has('C'))
    expect(hasBCycle).toBe(true)
    expect(hasCCycle).toBe(true)
  })
})

// ── buildDependencyGraph ──────────────────────────────────────────────────────

describe('buildDependencyGraph', () => {
  it('creates one node per sheet in the workbook', () => {
    const wb = makeWorkbook('FileA.xlsx', [{ sheetName: 'Sheet1' }, { sheetName: 'Sheet2' }])
    const graph = buildDependencyGraph([wb])
    expect(graph.nodes).toContain('FileA.xlsx::Sheet1')
    expect(graph.nodes).toContain('FileA.xlsx::Sheet2')
  })

  it('creates an edge for a cross-sheet reference', () => {
    const wb = makeWorkbook('FileA.xlsx', [
      { sheetName: 'Sheet1', refs: [makeRef('Sheet2')] },
      { sheetName: 'Sheet2' },
    ])
    const graph = buildDependencyGraph([wb])
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].from).toBe('FileA.xlsx::Sheet1')
    expect(graph.edges[0].to).toBe('FileA.xlsx::Sheet2')
  })

  it('deduplicates multiple refs between the same sheet pair', () => {
    const wb = makeWorkbook('FileA.xlsx', [
      {
        sheetName: 'Sheet1',
        refs: [makeRef('Sheet2'), makeRef('Sheet2')],
      },
      { sheetName: 'Sheet2' },
    ])
    const graph = buildDependencyGraph([wb])
    expect(graph.edges).toHaveLength(1)
  })

  it('creates nodes for cross-file target sheets', () => {
    const wb = makeWorkbook('FileA.xlsx', [
      { sheetName: 'Sheet1', refs: [makeRef('Prices', 'External.xlsx')] },
    ])
    const graph = buildDependencyGraph([wb])
    expect(graph.nodes).toContain('External.xlsx::Prices')
  })

  it('detects circular refs — Sheet1 ↔ Sheet2', () => {
    const wb = makeWorkbook('FileA.xlsx', [
      { sheetName: 'Sheet1', refs: [makeRef('Sheet2')] },
      { sheetName: 'Sheet2', refs: [makeRef('Sheet1')] },
    ])
    const graph = buildDependencyGraph([wb])
    const cycles = detectCycles(graph)
    expect(cycles.length).toBeGreaterThan(0)
  })
})

// ── renameReference ───────────────────────────────────────────────────────────

describe('renameReference — table rename', () => {
  it('renames a table name in TableName[Column]', () => {
    const result = renameReference('SUM(OldTable[Amount])', 'OldTable', 'NewTable', 'table')
    expect(result).toBe('SUM(NewTable[Amount])')
  })

  it('renames a table name in QueryName.Result[Column]', () => {
    const result = renameReference('OldQuery.Result[Col]', 'OldQuery', 'NewQuery', 'table')
    expect(result).toBe('NewQuery.Result[Col]')
  })

  it('does not rename partial matches (word-boundary enforcement)', () => {
    // Renaming "Sales" should NOT change "SalesTable"
    const result = renameReference('SalesTable[Amount]+Sales[Amount]', 'Sales', 'Revenue', 'table')
    // Only plain "Sales[" should match
    expect(result).toContain('SalesTable[Amount]')
    expect(result).toContain('Revenue[Amount]')
  })

  it('rename is case-insensitive', () => {
    const result = renameReference('SUM(OLDTABLE[Amount])', 'OldTable', 'NewTable', 'table')
    expect(result).toBe('SUM(NewTable[Amount])')
  })

  it('returns original formula unchanged when old name not found', () => {
    const formula = 'SUM(SalesTable[Amount])'
    expect(renameReference(formula, 'NoSuchTable', 'X', 'table')).toBe(formula)
  })
})

describe('renameReference — column rename', () => {
  it('renames a column name in [OldColumn]', () => {
    const result = renameReference('SalesTable[OldCol]', 'OldCol', 'NewCol', 'column')
    expect(result).toBe('SalesTable[NewCol]')
  })

  it('renames a column name in [@OldColumn]', () => {
    const result = renameReference('[@OldCol]*1.1', 'OldCol', 'NewCol', 'column')
    expect(result).toBe('[@NewCol]*1.1')
  })

  it('renames both [OldCol] and [@OldCol] in one formula', () => {
    const result = renameReference('SalesTable[OldCol]+[@OldCol]', 'OldCol', 'NewCol', 'column')
    expect(result).toBe('SalesTable[NewCol]+[@NewCol]')
  })

  it('column rename is case-insensitive', () => {
    const result = renameReference('SalesTable[OLDCOL]', 'OldCol', 'NewCol', 'column')
    expect(result).toBe('SalesTable[NewCol]')
  })

  it('returns original formula unchanged when column not found', () => {
    const formula = 'SalesTable[Amount]'
    expect(renameReference(formula, 'NoSuchCol', 'X', 'column')).toBe(formula)
  })
})

// ── topoSort ──────────────────────────────────────────────────────────────────

describe('topoSort', () => {
  it('returns nodes in standard topological (source-first) order for a linear chain', () => {
    // A → B → C: topological order should be A, B, C (sources before consumers)
    const graph = {
      nodes: ['A', 'B', 'C'],
      edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }],
    }
    const { order, cycleNodes } = topoSort(graph)
    expect(cycleNodes.size).toBe(0)
    // In Kahn's algorithm: A has no INCOMING edges, so A comes first in topological order
    // Order: A, B, C (standard topological order — consumers after their dependencies)
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'))
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'))
  })

  it('marks cycle participants in cycleNodes', () => {
    const graph = {
      nodes: ['A', 'B', 'C'],
      edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }, { from: 'C', to: 'A' }],
    }
    const { cycleNodes } = topoSort(graph)
    expect(cycleNodes.has('A')).toBe(true)
    expect(cycleNodes.has('B')).toBe(true)
    // C is not in a cycle
    expect(cycleNodes.has('C')).toBe(false)
  })

  it('handles empty graph', () => {
    const { order, cycleNodes } = topoSort({ nodes: [], edges: [] })
    expect(order).toHaveLength(0)
    expect(cycleNodes.size).toBe(0)
  })

  it('produces deterministic output for the same graph', () => {
    const graph = {
      nodes: ['Z', 'A', 'M'],
      edges: [],
    }
    const r1 = topoSort(graph)
    const r2 = topoSort(graph)
    expect(r1.order).toEqual(r2.order)
  })

  it('isolated nodes (no edges) are included in the order', () => {
    const graph = {
      nodes: ['A', 'B', 'C'],
      edges: [],
    }
    const { order } = topoSort(graph)
    expect(order).toHaveLength(3)
    expect(new Set(order)).toEqual(new Set(['A', 'B', 'C']))
  })
})

// ── Integration: parser + resolver ────────────────────────────────────────────

describe('Integration: extractReferences + parseStructuredRefs', () => {
  it('[@Amount] in formula is recognized as a relative ref by parseStructuredRefs', () => {
    const { refs } = parseStructuredRefs('[@Amount]*1.1', new Map())
    expect(refs[0].kind).toBe('relative')
    expect(refs[0].columnName).toBe('Amount')
  })

  it('QueryName.Result[Col] round-trip: detected and then validated', () => {
    const tableMap = makeTableMap([
      { name: 'SalesQuery', ref: 'A1:C10', targetSheet: 'QuerySheet', cells: 'A1:C10', columns: ['ID', 'Revenue', 'Qty'] },
    ])
    const formula = 'SUM(SalesQuery.Result[Revenue])'
    const { refs, errors } = parseStructuredRefs(formula, tableMap)
    expect(errors).toHaveLength(0)
    expect(refs[0].kind).toBe('query-result')
    expect(refs[0].columnName).toBe('Revenue')
  })

  it('full dependency graph from two mutually-dependent workbooks detects cycle', () => {
    const wbA = makeWorkbook('A.xlsx', [
      { sheetName: 'S1', refs: [makeRef('S1', 'B.xlsx')] },
    ])
    const wbB = makeWorkbook('B.xlsx', [
      { sheetName: 'S1', refs: [makeRef('S1', 'A.xlsx')] },
    ])
    const graph = buildDependencyGraph([wbA, wbB])
    const cycles = detectCycles(graph)
    expect(cycles.length).toBeGreaterThan(0)
  })
})
