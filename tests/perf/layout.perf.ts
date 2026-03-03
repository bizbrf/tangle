// tests/perf/layout.perf.ts
// Lightweight perf harness: measures layout/reorganize/grouping timing and
// writes a JSON summary to tests/perf/results.json.
// Run with: npm run test:perf
// CI: fail when any metric exceeds baseline × tolerance (1.15).

import { describe, it, afterAll } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WorkbookFile, SheetReference, SheetWorkload } from '../../src/types'
import { buildGraph, countNodeOverlaps, countEdgeCrossings } from '../../src/lib/graph'
import baselines from './baselines.json'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Tolerance ─────────────────────────────────────────────────────────────────

/** CI budgets may be exceeded by up to this fraction before the harness fails. */
const TOLERANCE = 0.15

function budget(baseline: number): number {
  return Math.ceil(baseline * (1 + TOLERANCE))
}

// ── Factories ─────────────────────────────────────────────────────────────────

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

/**
 * Build `fileCount` workbooks each with `sheetsPerFile` sheets.
 * Adjacent sheets in a file reference the previous sheet (chain).
 * The last sheet of each file has a cross-file edge to the first sheet of the
 * next file (cycle of files).
 */
function makeSyntheticWorkbooks(fileCount: number, sheetsPerFile: number): WorkbookFile[] {
  const wbs: WorkbookFile[] = []
  for (let f = 0; f < fileCount; f++) {
    const name = `File${f}.xlsx`
    const nextName = `File${(f + 1) % fileCount}.xlsx`
    const sheets: { sheetName: string; refs?: SheetReference[] }[] = []
    for (let s = 0; s < sheetsPerFile; s++) {
      const refs: SheetReference[] = []
      if (s > 0) {
        refs.push({
          targetWorkbook: null,
          targetSheet: `Sheet${s - 1}`,
          cells: ['A1'],
          formula: `Sheet${s - 1}!A1`,
          sourceCell: 'A1',
        })
      }
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

// ── Results collector ─────────────────────────────────────────────────────────

interface PerfResult {
  metric: string
  durationMs: number
  budgetMs: number
  passed: boolean
  nodes?: number
  edges?: number
  overlaps?: number
  crossings?: number
}

const results: PerfResult[] = []

function record(r: PerfResult) {
  results.push(r)
  console.info(
    `perf:${r.metric} ${r.durationMs}ms / budget ${r.budgetMs}ms [${r.passed ? 'PASS' : 'FAIL'}]` +
    (r.nodes !== undefined ? ` nodes=${r.nodes}` : '') +
    (r.edges !== undefined ? ` edges=${r.edges}` : '') +
    (r.overlaps !== undefined ? ` overlaps=${r.overlaps}` : '') +
    (r.crossings !== undefined ? ` crossings=${r.crossings}` : ''),
  )
}

// Write summary after all tests run.
afterAll(() => {
  const outPath = join(__dirname, 'results.json')
  writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2))
  console.info(`perf:summary written to ${outPath}`)
})

// ── Perf: initial graph render — 300 nodes / ~600 edges ───────────────────────
// 30 files × 10 sheets = 300 nodes; chain refs ≈ 9 edges/file + 1 cross-file = 300 edges.

describe('perf:layout — initial graph render (300 nodes / ~300 edges)', () => {
  // 30 files × 10 sheets = 300 sheets (nodes). Each file has ~9 internal chain
  // edges + 1 cross-file edge = ~300 edges total.
  const wbs = makeSyntheticWorkbooks(30, 10)

  it(`cold layout ≤ ${budget(baselines.layoutColdMs)} ms`, () => {
    const t0 = performance.now()
    const { nodes, edges } = buildGraph(wbs, 'graph', new Set(), false, false, 'LR', 'perf-harness')
    const durationMs = Math.round(performance.now() - t0)
    const overlaps = countNodeOverlaps(nodes)
    const crossings = countEdgeCrossings(nodes, edges)
    const b = budget(baselines.layoutColdMs)
    record({ metric: 'layout.cold', durationMs, budgetMs: b, passed: durationMs <= b, nodes: nodes.length, edges: edges.length, overlaps, crossings })
    expect(durationMs).toBeLessThan(b)
    expect(overlaps).toBe(0)
  })

  it(`warm layout ≤ ${budget(baselines.layoutWarmMs)} ms`, () => {
    // One warm-up pass
    buildGraph(wbs, 'graph', new Set(), false, false, 'LR', 'perf-harness')
    const t0 = performance.now()
    const { nodes, edges } = buildGraph(wbs, 'graph', new Set(), false, false, 'LR', 'perf-harness')
    const durationMs = Math.round(performance.now() - t0)
    const overlaps = countNodeOverlaps(nodes)
    const b = budget(baselines.layoutWarmMs)
    record({ metric: 'layout.warm', durationMs, budgetMs: b, passed: durationMs <= b, nodes: nodes.length, edges: edges.length, overlaps })
    expect(durationMs).toBeLessThan(b)
  })
})

// ── Perf: reorganize action ───────────────────────────────────────────────────

describe('perf:reorg — reorganize action (300 nodes)', () => {
  const wbs = makeSyntheticWorkbooks(30, 10)

  it(`reorganize (re-layout) ≤ ${budget(baselines.reorganizeColdMs)} ms`, () => {
    // Simulate a reorganize: rebuild the layout from the same graph data.
    // This represents the end-to-end cost of clicking "reorganize" / changing layout mode.
    const t0 = performance.now()
    buildGraph(wbs, 'graph', new Set(), false, false, 'LR', 'reorg-seed')
    const durationMs = Math.round(performance.now() - t0)
    const b = budget(baselines.reorganizeColdMs)
    record({ metric: 'reorg', durationMs, budgetMs: b, passed: durationMs <= b })
    console.info('perf:reorg', { durationMs })
    expect(durationMs).toBeLessThan(b)
  })
})

// ── Perf: grouping toggle ─────────────────────────────────────────────────────

describe('perf:grouping — grouping toggle (300 nodes)', () => {
  const wbs = makeSyntheticWorkbooks(30, 10)

  it(`grouped layout ≤ ${budget(baselines.groupingMs)} ms`, () => {
    const t0 = performance.now()
    const { nodes } = buildGraph(wbs, 'grouped', new Set(), false, false, 'LR', 'grouping-seed')
    const durationMs = Math.round(performance.now() - t0)
    const overlaps = countNodeOverlaps(nodes)
    const b = budget(baselines.groupingMs)
    record({ metric: 'grouping', durationMs, budgetMs: b, passed: durationMs <= b, nodes: nodes.length, overlaps })
    console.info('perf:grouping', { durationMs })
    expect(durationMs).toBeLessThan(b)
  })
})

// ── Perf: formula evaluation proxy ────────────────────────────────────────────

describe('perf:formula — 5k formula evaluations (warm)', () => {
  it(`5 000 buildGraph calls ≤ ${budget(baselines.formulaWarmMs)} ms`, () => {
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
    // Note: 5 000 full graph builds is heavier than 5 000 raw formula evals.
    // The formulaWarmMs baseline accounts for this overhead.
    const t0 = performance.now()
    for (let i = 0; i < 5_000; i++) {
      buildGraph([wb])
    }
    const durationMs = Math.round(performance.now() - t0)
    const b = budget(baselines.formulaWarmMs)
    record({ metric: 'formula.5k.warm', durationMs, budgetMs: b, passed: durationMs <= b })
    console.info('perf:formula', { evaluations: 5_000, durationMs })
    expect(durationMs).toBeLessThan(b)
  })
})
