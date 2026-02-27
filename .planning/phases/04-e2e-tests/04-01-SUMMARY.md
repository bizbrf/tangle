---
phase: 04-e2e-tests
plan: 01
subsystem: testing
tags: [playwright, react, data-testid, e2e, test-instrumentation]

# Dependency graph
requires:
  - phase: 03-graph-unit-tests
    provides: completed unit test coverage confirming graph logic is correct
provides:
  - data-testid="upload-error" on FilePanel error paragraph
  - data-testid="file-list-item" on file row outer div
  - data-testid="eye-toggle" on hide/show toggle button
  - data-testid="sheet-list-item" on sheet row divs
  - data-testid="sheet-node" on all 3 SheetNode render branches
  - data-testid="detail-panel" on DetailPanel outer div
  - data-testid="detail-panel-title" on header span
  - data-testid="workload-metrics" on workload stats grid
  - data-testid="layout-${mode}" template literal on layout buttons
  - data-testid="edge-filter-${kind}" template literal on edge filter buttons
  - data-testid="focus-panel" on focus mode controls div
  - tests/fixtures/not-excel.txt plain-text fixture for upload rejection test
affects:
  - 04-e2e-tests (plans 02+)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - data-testid attributes added only to interactive/visible elements — no logic/style changes
    - Template literal data-testid (layout-${mode}, edge-filter-${kind}) enables enumerated button targeting without hardcoding each variant

key-files:
  created:
    - tests/fixtures/not-excel.txt
  modified:
    - src/components/FilePanel/FilePanel.tsx
    - src/components/Graph/GraphView.tsx

key-decisions:
  - "data-testid added inline alongside existing attributes — no wrapper elements, no structural changes"
  - "Template literal testids (layout-${mode}, edge-filter-${kind}) auto-generate stable selectors for all button variants from existing map() iterations"
  - "All 3 SheetNode branches get identical data-testid='sheet-node' — tests query by testid, differentiate by content if needed"

patterns-established:
  - "data-testid placement: attribute goes first on the element, before className/style, for visual scannability"
  - "Fixture files in tests/fixtures/ — plain-text for rejection paths, .xlsx files for graph rendering paths"

requirements-completed: [E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, E2E-07, E2E-08, E2E-09, E2E-10, E2E-11, E2E-12, E2E-13, E2E-14, E2E-15]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 4 Plan 01: Test Instrumentation Summary

**data-testid attributes on all 11 E2E-targetable elements in FilePanel and GraphView, plus not-excel.txt fixture — zero logic or style changes**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-27T18:16:17Z
- **Completed:** 2026-02-27T18:19:01Z
- **Tasks:** 3
- **Files modified:** 3 (FilePanel.tsx, GraphView.tsx, tests/fixtures/not-excel.txt created)

## Accomplishments
- Added 4 data-testid attributes to FilePanel.tsx covering the upload-error message, file-list-item rows, eye-toggle button, and sheet-list-item rows
- Added 9 data-testid attributes to GraphView.tsx: sheet-node (3 branches), detail-panel, detail-panel-title, workload-metrics, layout-${mode} (3 buttons), edge-filter-${kind} (4 buttons), focus-panel
- Created tests/fixtures/not-excel.txt plain-text fixture for the E2E-13 upload rejection path
- Build passes cleanly (npm run build) with no TypeScript errors after all additions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add data-testid attributes to FilePanel.tsx** - `50914bc` (feat)
2. **Task 2: Add data-testid attributes to GraphView.tsx** - `2fe20d2` (feat)
3. **Task 3: Create not-excel.txt fixture** - `c602093` (feat)

## Files Created/Modified
- `src/components/FilePanel/FilePanel.tsx` - 4 data-testid attributes added (upload-error, file-list-item, eye-toggle, sheet-list-item)
- `src/components/Graph/GraphView.tsx` - 9 data-testid attributes added across SheetNode branches, DetailPanel, Toolbar, EdgeKindFilterBar, and focus panel
- `tests/fixtures/not-excel.txt` - Plain-text fixture file for upload error E2E test

## Decisions Made
- Attributes added inline on existing elements — no wrapper divs, no structural changes. Keeps the diff minimal and reviewable.
- Template literal testids (layout-${mode}, edge-filter-${kind}) auto-generate all variants from existing map() iterations without enumerating each individually.
- All 3 SheetNode render branches share the same data-testid="sheet-node" — E2E tests locate by testid first, then use text content or other attributes to differentiate named-range vs file-node vs regular branches if needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 11 DOM selectors required by E2E specs are now in place
- tests/fixtures/not-excel.txt is ready for E2E-13
- Ready to write Playwright spec files in plan 04-02
- No blockers

---
*Phase: 04-e2e-tests*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: src/components/FilePanel/FilePanel.tsx
- FOUND: src/components/Graph/GraphView.tsx
- FOUND: tests/fixtures/not-excel.txt
- FOUND: .planning/phases/04-e2e-tests/04-01-SUMMARY.md
- FOUND commit: 50914bc (FilePanel.tsx data-testid)
- FOUND commit: 2fe20d2 (GraphView.tsx data-testid)
- FOUND commit: c602093 (not-excel.txt fixture)
