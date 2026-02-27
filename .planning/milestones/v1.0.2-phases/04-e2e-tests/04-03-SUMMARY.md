---
phase: 04-e2e-tests
plan: 03
subsystem: testing
tags: [playwright, e2e, react-flow, detail-panel, focus-mode, error-handling]

# Dependency graph
requires:
  - phase: 04-e2e-tests/04-02
    provides: helpers.ts upload helpers and E2E-01 through E2E-04 upload tests
provides:
  - interactions.spec.ts with E2E-05 through E2E-09 (layout, edge filter, hide/show, focus mode)
  - detail-panel.spec.ts with E2E-10 through E2E-12 (node click, workload metrics, edge click)
  - errors.spec.ts with E2E-13 through E2E-15 (txt upload error, corrupt xlsx, resilience)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use cross-sheet.xlsx (2 sheets, no external refs) for layout mode count assertions — external-ref.xlsx has same count in graph and overview mode"
    - "Edge click: try .react-flow__edge-label first (multi-ref), fall back to .react-flow__edge path with force:true"
    - "Eye toggle: fileRow.hover() required before .getByTestId('eye-toggle').click() due to opacity-0 until hover"

key-files:
  created:
    - tests/e2e/interactions.spec.ts
    - tests/e2e/detail-panel.spec.ts
    - tests/e2e/errors.spec.ts
  modified: []

key-decisions:
  - "E2E-05 uses cross-sheet.xlsx not external-ref.xlsx — external-ref has same node count in graph and overview modes (both = 2: Sheet1 + external file node)"
  - "E2E-05 asserts overviewCount === 1 with toHaveCount(1) — cross-sheet.xlsx has no external refs so overview shows exactly 1 node"
  - "E2E-06 edge filter toggle verified via not.toHaveCount(edgesBefore) then toHaveCount(edgesBefore) — no fixed timeouts"

patterns-established:
  - "E2E-05 fixture selection: use cross-sheet.xlsx for layout mode tests requiring count reduction to 1"
  - "E2E-06 toggle restore: capture edgesBefore, toggle off (not.toHaveCount), toggle back on (toHaveCount) — full round-trip verification"
  - "E2E-12 edge click: conditional on label badge presence avoids brittle SVG path click in all cases"

requirements-completed: [E2E-05, E2E-06, E2E-07, E2E-08, E2E-09, E2E-10, E2E-11, E2E-12, E2E-13, E2E-14, E2E-15]

# Metrics
duration: 5min
completed: 2026-02-27
---

# Phase 04 Plan 03: E2E Tests — Interactions, Detail Panel, and Errors Summary

**11 Playwright tests covering layout mode switching, edge filters, hide/show, focus mode, detail panel node/edge clicks, and upload error resilience — all 17 E2E tests passing**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-27T18:25:23Z
- **Completed:** 2026-02-27T18:30:00Z
- **Tasks:** 3
- **Files modified:** 3 (all created)

## Accomplishments
- 5 interaction tests: layout mode overview (E2E-05), edge filter toggle/restore (E2E-06), hide file nodes (E2E-07), restore hidden nodes (E2E-08), focus panel activation (E2E-09)
- 3 detail panel tests: node click opens panel with Sheet title (E2E-10), workload metrics grid visible (E2E-11), edge click opens References mode (E2E-12)
- 3 error handling tests: txt upload shows Excel error (E2E-13), corrupt xlsx shows error (E2E-14), good file survives subsequent failed upload (E2E-15)
- Full E2E suite now covers all 15 requirements E2E-01 through E2E-15 with 17 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tests/e2e/interactions.spec.ts** - `f9f7866` (feat)
2. **Task 2: Create tests/e2e/detail-panel.spec.ts** - `c55f30c` (feat)
3. **Task 3: Create tests/e2e/errors.spec.ts** - `23073c7` (feat)

## Files Created/Modified
- `tests/e2e/interactions.spec.ts` - E2E-05 through E2E-09 feature interaction tests
- `tests/e2e/detail-panel.spec.ts` - E2E-10 through E2E-12 detail panel tests
- `tests/e2e/errors.spec.ts` - E2E-13 through E2E-15 error handling tests

## Decisions Made
- E2E-05 uses `cross-sheet.xlsx` instead of `external-ref.xlsx` per plan — plan's note that external-ref overview count = 1 was incorrect; external-ref has 2 nodes in both graph and overview modes (Sheet1 + External.xlsx file node). cross-sheet.xlsx has 2 nodes in graph mode and 1 node in overview mode, making the count reduction assertion accurate.
- E2E-06 toggle verification uses Playwright's auto-retry `toHaveCount`/`not.toHaveCount` — no fixed timeouts.
- E2E-12 edge click uses conditional approach: edge label badge first (multi-ref edges), SVG path with force:true as fallback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect fixture selection for E2E-05 overview mode assertion**
- **Found during:** Task 1 (interactions.spec.ts)
- **Issue:** Plan specified `external-ref.xlsx` with assertion `toHaveCount(1)` in overview mode, but external-ref.xlsx has only 1 sheet (Sheet1) + 1 external file node, resulting in 2 nodes in both graph and overview modes — graphCount === overviewCount === 2
- **Fix:** Changed fixture to `cross-sheet.xlsx` (2 sheets, no external refs) — graph mode = 2 nodes, overview mode = 1 node; assertion `toHaveCount(1)` is accurate
- **Files modified:** tests/e2e/interactions.spec.ts
- **Verification:** E2E-05 passes with cross-sheet.xlsx; all 5 interaction tests pass
- **Committed in:** f9f7866 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - incorrect fixture causing wrong count assertion)
**Impact on plan:** Fix was necessary for test correctness. Changed only the fixture file, not the test structure or assertion pattern.

## Issues Encountered
- Plan's assumption about external-ref.xlsx fixture shape was incorrect (1 sheet not multi-sheet). The fixture was verified against generate.ts — external-ref.xlsx has a single Sheet1 referencing [External.xlsx]Prices!C3, producing exactly 2 nodes in all layout modes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 15 E2E requirements (E2E-01 through E2E-15) are now covered by passing tests
- Full test suite: 17 tests total (2 smoke + 4 upload + 5 interactions + 3 detail-panel + 3 errors) — all passing
- Phase 04 complete — entire project test coverage delivered

---
*Phase: 04-e2e-tests*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: tests/e2e/interactions.spec.ts
- FOUND: tests/e2e/detail-panel.spec.ts
- FOUND: tests/e2e/errors.spec.ts
- FOUND: .planning/phases/04-e2e-tests/04-03-SUMMARY.md
- FOUND: f9f7866 (Task 1 commit)
- FOUND: c55f30c (Task 2 commit)
- FOUND: 23073c7 (Task 3 commit)
