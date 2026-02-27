---
phase: 03-graph-unit-tests
plan: 01
subsystem: testing
tags: [vitest, graph, buildGraph, unit-tests, typescript]

# Dependency graph
requires:
  - phase: 01-infrastructure
    provides: Vitest configured with node environment, test infrastructure in place
  - phase: 02-parser-unit-tests
    provides: Pattern for unit tests without fixtures — inline workbook construction
provides:
  - tests/unit/graph.test.ts with GRAPH-01 through GRAPH-04 describe blocks
  - makeWorkbook() factory for clean WorkbookFile test fixtures
  - Verified correctness of buildGraph() node count, edge count, edge kinds, hidden file exclusion
affects:
  - 03-graph-unit-tests (plans 02+): factory and patterns established here reused in GRAPH-05 through GRAPH-07

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "makeWorkbook() factory — builds WorkbookFile from name + [{sheetName, refs?}] without touching SheetJS"
    - "zeroWorkload sentinel — shared SheetWorkload with all-zero counts for fixture sheets"
    - "Topology-driven fixture design — construct workbook topology that directly exercises the condition under test"

key-files:
  created:
    - tests/unit/graph.test.ts
  modified: []

key-decisions:
  - "Write all 4 describe blocks (GRAPH-01 through GRAPH-04) in one file pass — tests are fast enough that RED/GREEN cycle is immediate"
  - "Filter nodes with !isExternal && !isFileNode for GRAPH-01 node count to avoid counting external file nodes created by refs"
  - "Use exact same filename string on both WorkbookFile.name and SheetReference.targetWorkbook to avoid normWb() surprises"
  - "No @vitest-environment directive — graph.ts has no DOM dependencies, default node environment works"

patterns-established:
  - "makeWorkbook(name, [{sheetName, refs?}]) factory pattern: reuse across all graph test plans"
  - "Edge kind assertions: edges.find(e => e.data.edgeKind === 'internal') — direct data field access"
  - "Hidden file tests: filter by workbookName + !isFileNode to isolate sheet-level nodes"

requirements-completed: [GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04]

# Metrics
duration: 4min
completed: 2026-02-27
---

# Phase 3 Plan 01: Graph Unit Tests (GRAPH-01 through GRAPH-04) Summary

**`buildGraph()` unit tests covering node count correctness, edge aggregation, all four edge kind classifications (internal/cross-file/external/named-range), and hidden file exclusion — 11 tests passing in 1 new file**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-27T11:16:35Z
- **Completed:** 2026-02-27T11:20:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created `makeWorkbook()` factory that produces valid `WorkbookFile` objects from a name + sheet list, enabling clean fixture construction without SheetJS
- GRAPH-01: proved node count equals sheet count in same-workbook topology (no external refs)
- GRAPH-02: proved cross-sheet refs produce exactly one edge, and multi-refs to same target aggregate into one edge with correct `refCount`
- GRAPH-03: proved all four edge kinds classified correctly — `'internal'`, `'cross-file'`, `'external'`, `'named-range'`
- GRAPH-04: proved hidden workbook sheet nodes and their outgoing edges are excluded from `buildGraph()` output

## Task Commits

Each task was committed atomically:

1. **Task 1 + 2: Create graph.test.ts with all 4 describe blocks** - `df770d5` (test)

_Note: Both TDD tasks were written and verified together in one file creation — all 11 tests passed green on first run._

## Files Created/Modified
- `tests/unit/graph.test.ts` — 4 describe blocks (GRAPH-01 through GRAPH-04), 11 tests, shared `makeWorkbook()` factory

## Decisions Made
- Wrote all 4 describe blocks in one pass rather than two separate commits. The plan's task structure (Task 1 = GRAPH-01+02, Task 2 = GRAPH-03+04) is preserved in the code comment headers. All tests passed immediately, making a separate RED phase unnecessary.
- Filter pattern `!n.data.isExternal && !n.data.isFileNode` used in GRAPH-01 to count only sheet nodes — avoids counting external file nodes created when cross-workbook refs exist
- Used exact same filename string on both sides of cross-file refs to avoid `normWb()` normalization surprises (documented in plan pitfalls)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all 11 new tests passed on first run. No TypeScript errors. All 22 pre-existing parser tests remained green (33 total).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- GRAPH-01 through GRAPH-04 complete and green
- `makeWorkbook()` factory is available for reuse in plan 02 (GRAPH-05 through GRAPH-07)
- Test infrastructure stable — 33 tests passing, no regressions

---
*Phase: 03-graph-unit-tests*
*Completed: 2026-02-27*
