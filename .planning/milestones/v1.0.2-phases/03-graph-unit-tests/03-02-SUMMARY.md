---
phase: 03-graph-unit-tests
plan: 02
subsystem: testing
tags: [vitest, graph, buildGraph, layout, overview, named-range, unit-tests, typescript]

# Dependency graph
requires:
  - phase: 03-graph-unit-tests
    plan: 01
    provides: tests/unit/graph.test.ts with GRAPH-01 through GRAPH-04, makeWorkbook() factory
  - phase: 01-infrastructure
    provides: Vitest configured with node environment, test infrastructure in place

provides:
  - tests/unit/graph.test.ts with all 7 GRAPH describe blocks (GRAPH-01 through GRAPH-07)
  - GRAPH-05: position validation tests for graph/grouped/overview layout modes
  - GRAPH-06: overview mode one-node-per-workbook count tests
  - GRAPH-07: named range node toggle tests with showNamedRanges flag
  - Complete Phase 3 coverage — 43 total tests passing

affects:
  - 04-e2e-tests: all graph unit tests green, confidence in buildGraph() correctness

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-workbook cross-file topology for layout position tests — isolated single node may get position (0,0), edges drive Dagre"
    - "Overview mode assertion: filter !n.data.isExternal to count only uploaded workbook nodes"
    - "Named range toggle: verify both nodes.some(n => n.data.isNamedRange) and edges.every(e => e.data.edgeKind === 'named-range')"

key-files:
  created: []
  modified:
    - tests/unit/graph.test.ts

key-decisions:
  - "Two-workbook topology with cross-file ref used for GRAPH-05 layout position tests — ensures Dagre assigns non-zero coordinates via inter-group edges"
  - "GRAPH-06 uses !n.data.isExternal filter defensively even when topology has no external refs — future-proofed for topologies that do"
  - "GRAPH-07 edge count assertion: expects exactly 2 edges (source->NR + NR->consumer) replacing 1 direct edge when showNamedRanges=true"

patterns-established:
  - "Layout position test: use 2 workbooks + cross-file ref, assert node.position.x > 0 and node.position.y > 0 (not exact coordinates)"
  - "Overview count test: nodes.filter(n => !n.data.isExternal).length === workbooks.length"
  - "Named range toggle: same fixture, different showNamedRanges arg, compare isNamedRange presence"

requirements-completed: [GRAPH-05, GRAPH-06, GRAPH-07]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 3 Plan 02: Graph Unit Tests (GRAPH-05 through GRAPH-07) Summary

**`buildGraph()` layout mode position correctness, overview one-node-per-workbook guarantee, and named range node toggle — 16 graph tests passing, Phase 3 complete with 43 total tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T11:19:31Z
- **Completed:** 2026-02-27T11:22:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- GRAPH-05: proved all three layout modes (graph/grouped/overview) return nodes with non-zero position.x and position.y when a cross-file edge drives Dagre positioning
- GRAPH-06: proved overview mode returns exactly one non-external node per uploaded workbook (2-workbook and 3-workbook topologies)
- GRAPH-07: proved named range nodes appear/disappear correctly with showNamedRanges flag, including correct namedRangeName field and edge count assertions
- Phase 3 complete — all 7 GRAPH requirement describe blocks green, 43 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GRAPH-05 and GRAPH-06** - `8904375` (test)
2. **Task 2: Add GRAPH-07, verify full suite** - `78f5b03` (test)

## Files Created/Modified
- `tests/unit/graph.test.ts` — 3 additional describe blocks appended (GRAPH-05, GRAPH-06, GRAPH-07); 16 graph tests total

## Decisions Made
- Two-workbook cross-file topology chosen for GRAPH-05 position tests because isolated single-node graphs may receive position (0,0) from Dagre; edges between groups drive non-trivial layout coordinates.
- GRAPH-07 edge count asserts exactly 2 edges with `edgeKind === 'named-range'` to verify the direct edge replacement semantics of the named range feature.
- All tests written in direct append style — no separate RED/GREEN phases needed since all passed green on first run.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all 16 new graph tests (across both tasks) passed on first run. No TypeScript errors. All 43 tests green after Task 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 3 (Graph Unit Tests) fully complete — all 7 GRAPH requirements covered
- 43 total tests passing: 25 parser/smoke tests + 16 graph unit tests + 2 smoke tests
- `makeWorkbook()` factory pattern well-established; all topology-driven test conventions documented
- Phase 4 (E2E tests) can proceed with full confidence in both parser and graph unit test coverage

---
*Phase: 03-graph-unit-tests*
*Completed: 2026-02-27*

## Self-Check: PASSED

- tests/unit/graph.test.ts: FOUND
- .planning/phases/03-graph-unit-tests/03-02-SUMMARY.md: FOUND
- Commit 8904375 (GRAPH-05, GRAPH-06): FOUND
- Commit 78f5b03 (GRAPH-07): FOUND
