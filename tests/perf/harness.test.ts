/**
 * Performance test harness for layout and formula evaluation.
 *
 * Measures:
 * - Layout duration (cold and warm)
 * - Graph quality metrics
 * - Memory usage (if available)
 *
 * Run: node tests/perf/harness.ts
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseWorkbook } from '../../src/lib/parser';
import { buildGraph } from '../../src/lib/graph';
import { calculateGraphQuality, perfLogger, hashGraph } from '../../src/lib/perf';

/**
 * Performance budgets (baseline on mid-tier laptop).
 * Can be adjusted based on CI environment.
 */
const BUDGETS = {
  // Layout budgets (ms)
  LAYOUT_COLD_300N: 600,   // Initial graph render @ 300 nodes / 600 edges
  LAYOUT_WARM_300N: 300,   // Warm layout
  REORGANIZE: 400,         // Reorganize action end-to-end
  GROUPING_TOGGLE: 350,    // Grouping toggle to stable layout

  // Formula evaluation budgets (ms)
  FORMULA_EVAL_5K_WARM: 200,  // 5k evaluations warm
  FORMULA_PARSE_COLD: 600,    // Cold parse

  // Memory budgets (MB)
  MEMORY_STEADY_1K: 300,   // Steady state @ 1k nodes / 2k edges

  // Graph quality
  MAX_OVERLAPS: 0,         // No node overlaps allowed
  MAX_CROSSING_INCREASE: 0, // No increase in crossings for same seed
};

/**
 * Tolerance for budget violations (15% by default).
 */
const BUDGET_TOLERANCE = 0.15;

interface PerfResult {
  test: string;
  duration: number;
  budget: number;
  passed: boolean;
  nodeCount?: number;
  edgeCount?: number;
  quality?: ReturnType<typeof calculateGraphQuality>;
}

const results: PerfResult[] = [];

describe('Performance Budgets', () => {
  describe('Layout Performance', () => {
    it('should render initial graph within budget (cold)', () => {
      const fixturePath = join(__dirname, '../fixtures/large.xlsx');
      const file = readFileSync(fixturePath);

      perfLogger.clear();
      const startCold = performance.now();

      const wb = parseWorkbook(new File([file], 'large.xlsx'), 'test-id');
      const seed = hashGraph(
        wb.sheets.map(s => ({ id: `${wb.name}::${s.sheetName}` })),
        [],
      );
      const { nodes, edges } = buildGraph([wb], 'graph', new Set(), false, false, 'LR', seed);

      const coldDuration = performance.now() - startCold;

      const quality = calculateGraphQuality(nodes, edges, seed);

      const result: PerfResult = {
        test: 'layout-cold',
        duration: coldDuration,
        budget: BUDGETS.LAYOUT_COLD_300N,
        passed: coldDuration <= BUDGETS.LAYOUT_COLD_300N * (1 + BUDGET_TOLERANCE),
        nodeCount: nodes.length,
        edgeCount: edges.length,
        quality,
      };
      results.push(result);

      console.log(`[PERF] Layout (cold): ${coldDuration.toFixed(2)}ms (budget: ${BUDGETS.LAYOUT_COLD_300N}ms, nodes: ${nodes.length}, edges: ${edges.length})`);
      console.log(`[PERF] Graph quality:`, quality);

      expect(coldDuration).toBeLessThanOrEqual(BUDGETS.LAYOUT_COLD_300N * (1 + BUDGET_TOLERANCE));
    });

    it('should render warm graph within budget', () => {
      const fixturePath = join(__dirname, '../fixtures/large.xlsx');
      const file = readFileSync(fixturePath);

      const wb = parseWorkbook(new File([file], 'large.xlsx'), 'test-id');
      const seed = hashGraph(
        wb.sheets.map(s => ({ id: `${wb.name}::${s.sheetName}` })),
        [],
      );

      // Warm up
      buildGraph([wb], 'graph', new Set(), false, false, 'LR', seed);

      perfLogger.clear();
      const startWarm = performance.now();

      const { nodes, edges } = buildGraph([wb], 'graph', new Set(), false, false, 'LR', seed);

      const warmDuration = performance.now() - startWarm;

      const result: PerfResult = {
        test: 'layout-warm',
        duration: warmDuration,
        budget: BUDGETS.LAYOUT_WARM_300N,
        passed: warmDuration <= BUDGETS.LAYOUT_WARM_300N * (1 + BUDGET_TOLERANCE),
        nodeCount: nodes.length,
        edgeCount: edges.length,
      };
      results.push(result);

      console.log(`[PERF] Layout (warm): ${warmDuration.toFixed(2)}ms (budget: ${BUDGETS.LAYOUT_WARM_300N}ms)`);

      expect(warmDuration).toBeLessThanOrEqual(BUDGETS.LAYOUT_WARM_300N * (1 + BUDGET_TOLERANCE));
    });

    it('should handle reorganize within budget', () => {
      const fixturePath = join(__dirname, '../fixtures/finance-model.xlsx');
      const file = readFileSync(fixturePath);

      const wb = parseWorkbook(new File([file], 'finance-model.xlsx'), 'test-id');
      const seed = hashGraph(
        wb.sheets.map(s => ({ id: `${wb.name}::${s.sheetName}` })),
        [],
      );

      // Initial layout
      buildGraph([wb], 'graph', new Set(), false, false, 'LR', seed);

      perfLogger.clear();
      const startReorg = performance.now();

      // Simulate reorganize: switch direction
      const { nodes, edges } = buildGraph([wb], 'graph', new Set(), false, false, 'TB', seed);

      const reorgDuration = performance.now() - startReorg;

      const result: PerfResult = {
        test: 'reorganize',
        duration: reorgDuration,
        budget: BUDGETS.REORGANIZE,
        passed: reorgDuration <= BUDGETS.REORGANIZE * (1 + BUDGET_TOLERANCE),
        nodeCount: nodes.length,
        edgeCount: edges.length,
      };
      results.push(result);

      console.log(`[PERF] Reorganize: ${reorgDuration.toFixed(2)}ms (budget: ${BUDGETS.REORGANIZE}ms)`);

      expect(reorgDuration).toBeLessThanOrEqual(BUDGETS.REORGANIZE * (1 + BUDGET_TOLERANCE));
    });

    it('should handle grouping toggle within budget', () => {
      const fixturePath = join(__dirname, '../fixtures/finance-model.xlsx');
      const file = readFileSync(fixturePath);

      const wb = parseWorkbook(new File([file], 'finance-model.xlsx'), 'test-id');
      const seed = hashGraph(
        wb.sheets.map(s => ({ id: `${wb.name}::${s.sheetName}` })),
        [],
      );

      // Initial layout
      buildGraph([wb], 'graph', new Set(), false, false, 'LR', seed);

      perfLogger.clear();
      const startGroup = performance.now();

      // Toggle to grouped mode
      const { nodes, edges } = buildGraph([wb], 'grouped', new Set(), false, false, 'LR', seed);

      const groupDuration = performance.now() - startGroup;

      const result: PerfResult = {
        test: 'grouping-toggle',
        duration: groupDuration,
        budget: BUDGETS.GROUPING_TOGGLE,
        passed: groupDuration <= BUDGETS.GROUPING_TOGGLE * (1 + BUDGET_TOLERANCE),
        nodeCount: nodes.length,
        edgeCount: edges.length,
      };
      results.push(result);

      console.log(`[PERF] Grouping toggle: ${groupDuration.toFixed(2)}ms (budget: ${BUDGETS.GROUPING_TOGGLE}ms)`);

      expect(groupDuration).toBeLessThanOrEqual(BUDGETS.GROUPING_TOGGLE * (1 + BUDGET_TOLERANCE));
    });
  });

  describe('Graph Quality', () => {
    it('should produce deterministic layouts with seed', () => {
      const fixturePath = join(__dirname, '../fixtures/finance-model.xlsx');
      const file = readFileSync(fixturePath);

      const wb = parseWorkbook(new File([file], 'finance-model.xlsx'), 'test-id');
      const seed = 12345;

      const { nodes: nodes1 } = buildGraph([wb], 'graph', new Set(), false, false, 'LR', seed);
      const { nodes: nodes2 } = buildGraph([wb], 'graph', new Set(), false, false, 'LR', seed);

      // Check that positions match within ±1px
      expect(nodes1.length).toBe(nodes2.length);
      for (let i = 0; i < nodes1.length; i++) {
        const n1 = nodes1[i];
        const n2 = nodes2.find(n => n.id === n1.id);
        expect(n2).toBeDefined();
        expect(Math.abs(n1.position.x - n2!.position.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(n1.position.y - n2!.position.y)).toBeLessThanOrEqual(1);
      }

      console.log(`[PERF] Deterministic layout verified: positions match within ±1px`);
    });

    it('should have no node overlaps', () => {
      const fixturePath = join(__dirname, '../fixtures/finance-model.xlsx');
      const file = readFileSync(fixturePath);

      const wb = parseWorkbook(new File([file], 'finance-model.xlsx'), 'test-id');
      const seed = hashGraph(
        wb.sheets.map(s => ({ id: `${wb.name}::${s.sheetName}` })),
        [],
      );

      const { nodes, edges } = buildGraph([wb], 'graph', new Set(), false, false, 'LR', seed);
      const quality = calculateGraphQuality(nodes, edges, seed);

      console.log(`[PERF] Node overlaps: ${quality.nodeOverlaps} (max: ${BUDGETS.MAX_OVERLAPS})`);

      expect(quality.nodeOverlaps).toBe(BUDGETS.MAX_OVERLAPS);
    });

    it('should maintain consistent edge crossings for same seed', () => {
      const fixturePath = join(__dirname, '../fixtures/finance-model.xlsx');
      const file = readFileSync(fixturePath);

      const wb = parseWorkbook(new File([file], 'finance-model.xlsx'), 'test-id');
      const seed = 12345;

      const { nodes: nodes1, edges: edges1 } = buildGraph([wb], 'graph', new Set(), false, false, 'LR', seed);
      const quality1 = calculateGraphQuality(nodes1, edges1, seed);

      const { nodes: nodes2, edges: edges2 } = buildGraph([wb], 'graph', new Set(), false, false, 'LR', seed);
      const quality2 = calculateGraphQuality(nodes2, edges2, seed);

      console.log(`[PERF] Edge crossings: ${quality1.edgeCrossings} vs ${quality2.edgeCrossings}`);

      expect(quality1.edgeCrossings).toBe(quality2.edgeCrossings);
    });
  });

  describe('Formula Evaluation', () => {
    it('should parse formulas within budget (cold)', () => {
      const fixturePath = join(__dirname, '../fixtures/finance-model.xlsx');
      const file = readFileSync(fixturePath);

      perfLogger.clear();
      const startParse = performance.now();

      const wb = parseWorkbook(new File([file], 'finance-model.xlsx'), 'test-id');

      const parseDuration = performance.now() - startParse;

      const formulaCount = wb.sheets.reduce((sum, s) => sum + s.workload.totalFormulas, 0);

      const result: PerfResult = {
        test: 'formula-parse-cold',
        duration: parseDuration,
        budget: BUDGETS.FORMULA_PARSE_COLD,
        passed: parseDuration <= BUDGETS.FORMULA_PARSE_COLD * (1 + BUDGET_TOLERANCE),
      };
      results.push(result);

      console.log(`[PERF] Formula parse (cold): ${parseDuration.toFixed(2)}ms (budget: ${BUDGETS.FORMULA_PARSE_COLD}ms, formulas: ${formulaCount})`);

      expect(parseDuration).toBeLessThanOrEqual(BUDGETS.FORMULA_PARSE_COLD * (1 + BUDGET_TOLERANCE));
    });
  });
});

// Export results summary for CI
export function exportPerfResults(): string {
  const summary = {
    timestamp: Date.now(),
    budgets: BUDGETS,
    tolerance: BUDGET_TOLERANCE,
    results,
    passed: results.every(r => r.passed),
  };

  return JSON.stringify(summary, null, 2);
}
