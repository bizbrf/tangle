import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph, countEdgeCrossings, countNodeOverlaps, edgeLengthVariance, graphSnapshotKey } from '../../src/lib/graph';
import { extractReferences } from '../../src/lib/parser';
import type { WorkbookFile, SheetReference, SheetWorkload } from '../../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASELINE_PATH = path.resolve(__dirname, 'baseline.json');
const SUMMARY_PATH = path.resolve(__dirname, '..', '..', 'perf-results.json');

type Baseline = {
  layout: { coldMs: number; warmMs: number; overlaps: number; crossings: number; edgeLengthVariance: number };
  reorganize: { budgetMs: number };
  grouping: { budgetMs: number };
  formula: { batchWarmMs: number; coldParseMs: number };
  tolerance: number;
};

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Baseline;

const zeroWorkload: SheetWorkload = { totalFormulas: 0, withinSheetRefs: 0, crossSheetRefs: 0, crossFileRefs: 0 };

function makeSeededRandom(seed: string): () => number {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 33) ^ seed.charCodeAt(i);
  }
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function makeReference(targetWorkbook: string, targetSheet: string, selfWorkbook: string): SheetReference {
  const sameFile = targetWorkbook === selfWorkbook;
  return {
    targetWorkbook: sameFile ? null : targetWorkbook,
    targetSheet,
    cells: ['A1'],
    formula: sameFile ? `${targetSheet}!A1` : `[${targetWorkbook}]${targetSheet}!A1`,
    sourceCell: 'A1',
  };
}

function syntheticWorkbooks(): WorkbookFile[] {
  const totalSheets = 300;
  const workbookName = 'Perf.xlsx';
  const sheets: WorkbookFile['sheets'] = [];

  for (let i = 0; i < totalSheets; i++) {
    const targets = [(i + 1) % totalSheets, (i + 2) % totalSheets];
    const refs = targets.map((t) => makeReference(workbookName, `Sheet${t}`, workbookName));
    sheets.push({
      workbookName,
      sheetName: `Sheet${i}`,
      references: refs,
      workload: { ...zeroWorkload },
    });
  }

  return [{
    id: workbookName,
    name: workbookName,
    sheets,
    namedRanges: [],
    tables: [],
  }];
}

function writeSummary(section: string, payload: Record<string, unknown>) {
  let current: Record<string, unknown> = {};
  if (fs.existsSync(SUMMARY_PATH)) {
    current = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
  }
  current[section] = payload;
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(current, null, 2));
}

function measureFormulaBatch(batchSize: number): { durationMs: number; refCount: number } {
  const sheet: Record<string, unknown> = {};
  const formulas = [
    'Sheet2!A1',
    'SUM(Sheet3!A1:A10)',
    '[PerfB.xlsx]Sheet9!C3',
    "'[PerfC.xlsx]Sheet2'!D5",
  ];
  for (let i = 0; i < batchSize; i++) {
    sheet[`A${i + 1}`] = { f: formulas[i % formulas.length] };
  }
  const start = performance.now();
  const { references } = extractReferences(sheet as never, 'Sheet1', 'PerfA.xlsx', new Map(), new Map());
  const durationMs = performance.now() - start;
  return { durationMs, refCount: references.length };
}

describe.sequential('performance budgets', () => {
  const originalRandom = Math.random;

  beforeAll(() => {
    Math.random = makeSeededRandom('perf-harness');
  });

  afterAll(() => {
    Math.random = originalRandom;
  });

  it('layout, reorganize, and quality stay within budget', () => {
    const workbooks = syntheticWorkbooks();
    const hidden = new Set<string>();
    const snapshotHash = graphSnapshotKey(workbooks, hidden, false, false);

    const t0 = performance.now();
    const first = buildGraph(workbooks, 'graph', hidden, false, false, 'LR', { layoutSeed: 'perf-seed', snapshotHash });
    const layoutMs = performance.now() - t0;

    const reorgStart = performance.now();
    const regrouped = buildGraph(workbooks, 'grouped', hidden, false, false, 'LR', { layoutSeed: 'perf-seed', snapshotHash });
    const reorgMs = performance.now() - reorgStart;

    const overlaps = countNodeOverlaps(first.nodes);
    const crossings = countEdgeCrossings(first.nodes, first.edges);
    const variance = edgeLengthVariance(first.nodes, first.edges);

    // Determinism check — same seed + graph hash yields same positions (±1px)
    const warmStart = performance.now();
    const repeat = buildGraph(workbooks, 'graph', hidden, false, false, 'LR', { layoutSeed: 'perf-seed', snapshotHash });
    const warmMs = performance.now() - warmStart;
    for (const node of first.nodes) {
      const other = repeat.nodes.find((n) => n.id === node.id);
      expect(other).toBeDefined();
      if (!other) continue;
      expect(Math.abs(node.position.x - other.position.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(node.position.y - other.position.y)).toBeLessThanOrEqual(1);
    }

    const summary = {
      seed: 'perf-seed',
      snapshotHash,
      layoutMs,
      warmLayoutMs: warmMs,
      overlaps,
      crossings,
      edgeLengthVariance: variance,
      reorgMs,
      groupedOverlaps: countNodeOverlaps(regrouped.nodes),
    };
    writeSummary('layout', summary);

    expect(layoutMs).toBeLessThanOrEqual(baseline.layout.coldMs * (1 + baseline.tolerance));
    expect(warmMs).toBeLessThanOrEqual(baseline.layout.warmMs * (1 + baseline.tolerance));
    expect(reorgMs).toBeLessThanOrEqual(baseline.reorganize.budgetMs * (1 + baseline.tolerance));
    expect(overlaps).toBeLessThanOrEqual(baseline.layout.overlaps);
    expect(crossings).toBeLessThanOrEqual(baseline.layout.crossings);
    expect(variance).toBeLessThanOrEqual(baseline.layout.edgeLengthVariance * (1 + baseline.tolerance));
  });

  it('formula evaluation batch stays within budget', () => {
    const cold = measureFormulaBatch(5000);
    const warm = measureFormulaBatch(5000);

    writeSummary('formula', {
      evaluations: cold.refCount,
      coldMs: cold.durationMs,
      warmMs: warm.durationMs,
    });

    expect(cold.durationMs).toBeLessThanOrEqual(baseline.formula.coldParseMs * (1 + baseline.tolerance));
    expect(warm.durationMs).toBeLessThanOrEqual(baseline.formula.batchWarmMs * (1 + baseline.tolerance));
  });
});
