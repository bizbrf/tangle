# Roadmap: Tangle Test Suite

## Overview

Tangle has 10 shipped features and zero automated tests. This milestone builds a complete test suite from scratch: Vitest unit tests for the two pure-TypeScript core modules (parser and graph builder), Playwright E2E tests for the full upload-to-render pipeline, and the infrastructure that makes all of it reliable. The phases follow a strict dependency chain — infrastructure first (five critical pitfalls must be resolved before any test is written), then unit tests for the parser and graph in isolation, then E2E tests that validate the full integrated pipeline.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure** - Install and configure Vitest, Playwright, and the fixture generator so tests can run at all (completed 2026-02-27)
- [x] **Phase 2: Parser Unit Tests** - Cover all reference extraction logic in `parser.ts` including edge cases and error handling (completed 2026-02-27)
- [x] **Phase 3: Graph Unit Tests** - Cover `buildGraph()`, layout modes, and edge classification in `graph.ts` (completed 2026-02-27)
- [x] **Phase 4: E2E Tests** - Cover the full upload-to-graph pipeline and feature interactions in a real browser (partially complete — E2E-01 through E2E-04 passing; E2E-05 through E2E-15 pending plan 04-03)

## Phase Details

### Phase 1: Infrastructure
**Goal**: The test infrastructure exists and is correctly configured — `npm test`, `npm run test:e2e`, and `npm run test:coverage` all run without error, and the fixture generator produces verified `.xlsx` files with readable formula data
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07
**Success Criteria** (what must be TRUE):
  1. Running `npm test` executes the Vitest suite without import errors (SheetJS resolves correctly via `inline: ['xlsx']`)
  2. Running `npm run test:e2e` launches the Vite dev server and runs Playwright against `localhost:5173` without hanging
  3. Running `npm run fixtures:generate` produces `.xlsx` files in `tests/fixtures/` where each file has at least one cell with a formula string (verified by a read-back check in the script)
  4. Running `npm run test:coverage` generates an HTML coverage report in `coverage/`
  5. `vitest.config.ts` and `vite.config.ts` are separate files with no TypeScript context conflicts
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Vitest config, coverage, TypeScript/ESLint updates, all npm scripts
- [ ] 01-02-PLAN.md — Playwright config and E2E smoke test
- [ ] 01-03-PLAN.md — Fixture generator (7 verified .xlsx files) and Vitest smoke test

### Phase 2: Parser Unit Tests
**Goal**: Every reference extraction path in `parser.ts` is covered by a passing unit test — cross-sheet refs, external file refs, named ranges, workload metrics, empty workbooks, malformed files, and circular refs all have verified behavior
**Depends on**: Phase 1
**Requirements**: PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06, PARSE-07, PARSE-08, PARSE-09, PARSE-10, PARSE-11
**Success Criteria** (what must be TRUE):
  1. `npm test` passes all tests in `tests/unit/parser.test.ts` — cross-sheet (quoted and unquoted), external file (numeric index and bracketed filename), named ranges, and workload metric assertions all green
  2. `npm test` passes all tests in `tests/unit/parser.error.test.ts` — empty workbooks return zero metrics, corrupt files cause `parseWorkbook()` to reject (not crash), circular refs between sheets complete without hanging
  3. Named range tests confirm that Excel built-ins (e.g., `SUM(...)`) are not detected as named range references and that duplicate named-range edges are not emitted
**Plans**: TBD

### Phase 3: Graph Unit Tests
**Goal**: Every code path in `buildGraph()`, the three layout functions, edge classification, and named range node toggling is covered by a passing unit test
**Depends on**: Phase 1
**Requirements**: GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05, GRAPH-06, GRAPH-07
**Success Criteria** (what must be TRUE):
  1. `npm test` passes all tests in `tests/unit/graph.test.ts` — `buildGraph()` produces the correct node count (one per uploaded sheet), correct edge count, and correct edge kind labels (`internal`, `cross-file`, `external`, `named-range`) for a known fixture topology
  2. Passing `hiddenFiles` to `buildGraph()` results in those sheets' nodes and all their edges being absent from the output
  3. All three layout modes (graph, grouped, overview) return non-empty node arrays where every node has non-zero `x` and `y` position coordinates; overview mode returns exactly one node per uploaded workbook
  4. Named range nodes appear in the output when `showNamedRanges: true` and are absent when `showNamedRanges: false`
**Plans**: TBD

### Phase 4: E2E Tests
**Goal**: The full upload-to-graph pipeline works end-to-end in a real browser — users can upload files, see nodes, interact with features, and receive meaningful errors when uploads fail
**Depends on**: Phase 1, Phase 2, Phase 3
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, E2E-07, E2E-08, E2E-09, E2E-10, E2E-11, E2E-12, E2E-13, E2E-14, E2E-15
**Success Criteria** (what must be TRUE):
  1. Uploading a valid `.xlsx` fixture via `setInputFiles()` causes the filename to appear in the sidebar and at least one `.react-flow__node` element to appear in the graph canvas
  2. Uploading two files results in both filenames appearing in the sidebar and both files' sheets visible in the expanded list
  3. Switching layout mode (Graph to Overview) causes the node count in the graph to change to one node per workbook; toggling an edge kind filter removes those edge elements from the DOM
  4. Clicking the eye icon on a file removes that file's nodes from the graph; clicking it again restores them
  5. Clicking a sheet node opens the detail panel showing the sheet name and workload metrics; clicking an edge opens the detail panel showing source and target names
  6. Uploading a `.txt` file shows an error message in the UI without crashing; uploading a corrupt `.xlsx` shows an error message and the previously uploaded files remain visible
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md — Add data-testid attributes to FilePanel.tsx and GraphView.tsx; create not-excel.txt fixture
- [x] 04-02-PLAN.md — E2E helpers module and upload spec (E2E-01 through E2E-04)
- [ ] 04-03-PLAN.md — Interaction, detail panel, and error specs (E2E-05 through E2E-15)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

Note: Phase 2 and Phase 3 are independent — they can be developed in parallel once Phase 1 is complete.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure | 3/3 | Complete    | 2026-02-27 |
| 2. Parser Unit Tests | 2/2 | Complete    | 2026-02-27 |
| 3. Graph Unit Tests | 2/2 | Complete    | 2026-02-27 |
| 4. E2E Tests | 3/3 | Complete   | 2026-02-27 |
