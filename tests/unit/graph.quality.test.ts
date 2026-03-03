// tests/unit/graph.quality.test.ts
// Covers: QUAL-01 (determinism), QUAL-02 (no overlap), QUAL-03 (crossing stability),
//         PERF-01 (layout budget), PERF-02 (formula batch budget)
import { describe, it, expect } from 'vitest'
import type { WorkbookFile, SheetReference, SheetWorkload } from '../../src/types'
import {
  buildGraph,
  countNodeOverlaps,
  countEdgeCrossings,
  type LayoutMode,
  type LayoutDirection,
} from '../../src/lib/graph'

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

/** Build a synthetic chain graph: Sheet0 → Sheet1 → … → SheetN */
function makeChainWorkbook(name: string, sheetCount: number): WorkbookFile {
  const sheets: { sheetName: string; refs?: SheetReference[] }[] = []
  for (let i = 0; i < sheetCount; i++) {
    const refs: SheetReference[] = i > 0
      ? [{
          targetWorkbook: null,
          targetSheet: `Sheet${i - 1}`,
          cells: ['A1'],
          formula: `Sheet${i - 1}!A1`,
          sourceCell: 'A1',
        }]
      : []
    sheets.push({ sheetName: `Sheet${i}`, refs })
  }
  return makeWorkbook(name, sheets)
}

/**
 * Build a synthetic multi-file graph with `fileCount` workbooks, each having
 * `sheetsPerFile` sheets. Odd sheets within a file reference the previous
 * sheet; each file also has one cross-file edge to the next file.
 */
function makeSyntheticWorkbooks(fileCount: number, sheetsPerFile: number): WorkbookFile[] {
  const wbs: WorkbookFile[] = []
  for (let f = 0; f < fileCount; f++) {
    const name = `File${f}.xlsx`
    const nextName = `File${(f + 1) % fileCount}.xlsx`
    const sheets: { sheetName: string; refs?: SheetReference[] }[] = []
    for (let s = 0; s < sheetsPerFile; s++) {
      const refs: SheetReference[] = []
      // Intra-file: reference previous sheet
      if (s > 0) {
        refs.push({
          targetWorkbook: null,
          targetSheet: `Sheet${s - 1}`,
          cells: ['A1'],
          formula: `Sheet${s - 1}!A1`,
          sourceCell: 'A1',
        })
      }
      // Cross-file: last sheet of each file references first sheet of next file
      if (s === sheetsPerFile - 1) {
        refs.push({
          targetWorkbook: nextName,
          targetSheet: 'Sheet0',
          cells: ['B1'],
          formula: `[${nextName}]Sheet0!B1`,
          sourceCell: 'B1',
        })
      }
      sheets.push({ sheetName: `Sheet${s}`, refs })
    }
    wbs.push(makeWorkbook(name, sheets))
  }
  return wbs
}

// ── QUAL-01: Determinism ──────────────────────────────────────────────────────

describe('QUAL-01: layout is deterministic for same graph and seed', () => {
  const modes: LayoutMode[] = ['graph', 'grouped', 'overview']
  const directions: LayoutDirection[] = ['LR', 'TB']
  const wb = makeChainWorkbook('FileA.xlsx', 6)
  const crossRef: SheetReference = {
    targetWorkbook: 'FileB.xlsx',
    targetSheet: 'Sheet0',
    cells: ['A1'],
    formula: '[FileB.xlsx]Sheet0!A1',
    sourceCell: 'A1',
  }
  const wbA = makeWorkbook('FileA.xlsx', [
    { sheetName: 'Sheet0', refs: [crossRef] },
    { sheetName: 'Sheet1' },
    { sheetName: 'Sheet2' },
  ])
  const wbB = makeWorkbook('FileB.xlsx', [
    { sheetName: 'Sheet0' },
    { sheetName: 'Sheet1' },
  ])

  for (const mode of modes) {
    for (const dir of directions) {
      if (mode === 'overview' && dir === 'TB') continue // overview ignores direction
      it(`identical positions (±1 px) for mode=${mode} dir=${dir} with same seed`, () => {
        const seed = 'test-seed-42'
        const r1 = buildGraph([wbA, wbB], mode, new Set(), false, false, dir, seed)
        const r2 = buildGraph([wbA, wbB], mode, new Set(), false, false, dir, seed)
        expect(r1.nodes.length).toBe(r2.nodes.length)
        const pos2 = new Map(r2.nodes.map((n) => [n.id, n.position]))
        for (const n of r1.nodes) {
          const p2 = pos2.get(n.id)
          expect(p2).toBeDefined()
          expect(Math.abs(n.position.x - p2!.x)).toBeLessThanOrEqual(1)
          expect(Math.abs(n.position.y - p2!.y)).toBeLessThanOrEqual(1)
        }
      })
    }
  }

  it('identical positions without an explicit seed (single-workbook chain)', () => {
    const r1 = buildGraph([wb])
    const r2 = buildGraph([wb])
    expect(r1.nodes.length).toBe(r2.nodes.length)
    const pos2 = new Map(r2.nodes.map((n) => [n.id, n.position]))
    for (const n of r1.nodes) {
      const p2 = pos2.get(n.id)
      expect(p2).toBeDefined()
      expect(n.position.x).toBe(p2!.x)
      expect(n.position.y).toBe(p2!.y)
    }
  })
})

// ── QUAL-02: No node overlap ──────────────────────────────────────────────────

describe('QUAL-02: no node overlap in layouts', () => {
  const wbs = makeSyntheticWorkbooks(3, 4) // 3 files × 4 sheets = 12 nodes
  const modes: LayoutMode[] = ['graph', 'grouped']

  for (const mode of modes) {
    it(`zero overlapping node pairs in ${mode} layout`, () => {
      const { nodes } = buildGraph(wbs, mode, new Set(), false, false, 'LR', 'seed-overlap')
      const overlaps = countNodeOverlaps(nodes)
      expect(overlaps).toBe(0)
    })
  }

  it('overview layout has zero overlaps', () => {
    const { nodes } = buildGraph(wbs, 'overview', new Set(), false, false, 'LR', 'seed-overlap')
    const overlaps = countNodeOverlaps(nodes)
    expect(overlaps).toBe(0)
  })
})

// ── QUAL-03: Edge crossings stable for same seed ──────────────────────────────

describe('QUAL-03: edge crossings do not increase for same graph and seed', () => {
  it('crossing count is identical across repeated runs (graph layout)', () => {
    const wbs = makeSyntheticWorkbooks(4, 3) // 4 files × 3 sheets
    const seed = 'stable-crossing-seed'
    const r1 = buildGraph(wbs, 'graph', new Set(), false, false, 'LR', seed)
    const r2 = buildGraph(wbs, 'graph', new Set(), false, false, 'LR', seed)
    const c1 = countEdgeCrossings(r1.nodes, r1.edges)
    const c2 = countEdgeCrossings(r2.nodes, r2.edges)
    expect(c2).toBe(c1)
  })

  it('crossing count is identical across repeated runs (grouped layout)', () => {
    const wbs = makeSyntheticWorkbooks(4, 3)
    const seed = 'stable-crossing-seed'
    const r1 = buildGraph(wbs, 'grouped', new Set(), false, false, 'LR', seed)
    const r2 = buildGraph(wbs, 'grouped', new Set(), false, false, 'LR', seed)
    const c1 = countEdgeCrossings(r1.nodes, r1.edges)
    const c2 = countEdgeCrossings(r2.nodes, r2.edges)
    expect(c2).toBe(c1)
  })
})

// ── PERF-01: Layout duration budget ──────────────────────────────────────────
// Budget (scaled for unit-test / CI hardware):
//   ≤ 600 ms cold for 50 nodes / 100 edges (conservative fraction of the 300/600 budget)
//   Warm (second call) ≤ 300 ms

describe('PERF-01: layout duration within budget', () => {
  // 5 files × 10 sheets = 50 nodes, ~50 internal + ~5 cross-file edges
  const wbs = makeSyntheticWorkbooks(5, 10)
  const COLD_BUDGET_MS = 600
  const WARM_BUDGET_MS = 300

  it(`cold layout ≤ ${COLD_BUDGET_MS} ms for 50-node graph`, () => {
    const t0 = performance.now()
    buildGraph(wbs, 'graph', new Set(), false, false, 'LR', 'perf-seed')
    const duration = performance.now() - t0
    expect(duration).toBeLessThan(COLD_BUDGET_MS)
  })

  it(`warm layout ≤ ${WARM_BUDGET_MS} ms for 50-node graph (second call)`, () => {
    // First call to warm up module caches
    buildGraph(wbs, 'graph', new Set(), false, false, 'LR', 'perf-seed')
    const t0 = performance.now()
    buildGraph(wbs, 'graph', new Set(), false, false, 'LR', 'perf-seed')
    const duration = performance.now() - t0
    expect(duration).toBeLessThan(WARM_BUDGET_MS)
  })

  it(`grouped layout ≤ ${COLD_BUDGET_MS} ms for 50-node graph`, () => {
    const t0 = performance.now()
    buildGraph(wbs, 'grouped', new Set(), false, false, 'LR', 'perf-seed')
    const duration = performance.now() - t0
    expect(duration).toBeLessThan(COLD_BUDGET_MS)
  })
})

// ── PERF-02: Formula batch evaluation timing ──────────────────────────────────
// Proxy: repeatedly build a minimal 2-node / 1-edge graph to exercise the full
// reference-extraction + graph-build path. 500 iterations is the scaled unit-
// test equivalent of the 5k production target (reference extraction + layout
// per workbook is heavier than a single formula cell eval).
// Budget: 500 iterations ≤ 1 000 ms warm (2 ms/call guard against regressions).

describe('PERF-02: formula evaluation proxy budget', () => {
  const EVAL_COUNT = 500
  const WARM_BUDGET_MS = 1_000

  it(`${EVAL_COUNT} single-ref buildGraph calls complete in ≤ ${WARM_BUDGET_MS} ms (warm)`, () => {
    const ref: SheetReference = {
      targetWorkbook: null,
      targetSheet: 'Sheet2',
      cells: ['A1'],
      formula: 'Sheet2!A1',
      sourceCell: 'A1',
    }
    const wb = makeWorkbook('FileA.xlsx', [
      { sheetName: 'Sheet1', refs: [ref] },
      { sheetName: 'Sheet2' },
    ])
    // Warm-up
    buildGraph([wb])
    const t0 = performance.now()
    for (let i = 0; i < EVAL_COUNT; i++) {
      buildGraph([wb])
    }
    const duration = performance.now() - t0
    expect(duration).toBeLessThan(WARM_BUDGET_MS)
  })
})
