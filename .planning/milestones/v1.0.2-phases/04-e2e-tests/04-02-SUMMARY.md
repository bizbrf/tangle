---
phase: 04-e2e-tests
plan: 02
subsystem: testing
tags: [playwright, e2e, upload, helpers, fixtures, react-flow]

# Dependency graph
requires:
  - phase: 04-e2e-tests/04-01
    provides: data-testid attributes on all targetable DOM elements (sheet-node, file-list-item, sheet-list-item) and not-excel.txt fixture
provides:
  - tests/e2e/helpers.ts with 5 exported helpers: fixturePath, uploadFile, uploadFiles, waitForNodes, waitForDetailPanel
  - tests/e2e/upload.spec.ts with 4 passing E2E tests (E2E-01 through E2E-04)
affects:
  - 04-e2e-tests (plans 03+)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ESM-compatible __dirname via fileURLToPath(import.meta.url) in Playwright test files
    - uploadFile/uploadFiles helpers use setInputFiles() on the hidden input[type="file"] element
    - waitForNodes() and waitForDetailPanel() use Playwright's built-in element waitFor — no fixed timeouts
    - test.beforeEach with page.goto('/') ensures clean state per test (no shared upload state)

key-files:
  created:
    - tests/e2e/helpers.ts
    - tests/e2e/upload.spec.ts
  modified: []

key-decisions:
  - "ESM-compatible __dirname via fileURLToPath(import.meta.url) — Playwright runs tests as ESM modules in this Vite project; CommonJS __dirname would be undefined"
  - "helpers.ts is a pure module — no test() calls, only utility exports — all spec files import from it"
  - "waitForNodes() uses .first().waitFor({ state: 'visible' }) to handle both single and multi-sheet uploads without knowing the exact node count"
  - "E2E-04 uses toHaveCount(2) on file-list-item to verify both filenames appear — Playwright auto-retries until count matches"

patterns-established:
  - "All fixture file resolution goes through fixturePath() — no hardcoded absolute paths in spec files"
  - "uploadFile() / uploadFiles() abstract setInputFiles() — spec files never interact with the hidden input directly"
  - "Element-based waits only: waitForNodes(), .first().toBeVisible(), .waitFor({ state: 'visible' }) — never page.waitForTimeout()"

requirements-completed: [E2E-01, E2E-02, E2E-03, E2E-04]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 4 Plan 02: E2E Helpers and Upload Spec Summary

**Playwright helpers module (fixturePath, uploadFile, uploadFiles, waitForNodes, waitForDetailPanel) and 4 passing upload flow E2E tests covering the core upload-to-graph pipeline**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-27T18:21:52Z
- **Completed:** 2026-02-27T18:24:40Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- Created tests/e2e/helpers.ts with 5 exported utility functions as the shared foundation for all spec files
- Created tests/e2e/upload.spec.ts with 4 upload flow tests (E2E-01 through E2E-04) — all pass
- Used ESM-compatible __dirname via fileURLToPath(import.meta.url) for correct path resolution in Playwright ESM context
- All waits are element-based — no fixed timeouts anywhere

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tests/e2e/helpers.ts** - `9ee416a` (feat)
2. **Task 2: Create tests/e2e/upload.spec.ts** - `531b193` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `tests/e2e/helpers.ts` - Shared E2E helper module: fixturePath(), uploadFile(), uploadFiles(), waitForNodes(), waitForDetailPanel()
- `tests/e2e/upload.spec.ts` - Upload flow E2E tests: E2E-01 (filename in sidebar), E2E-02 (sheet list visible), E2E-03 (node in graph), E2E-04 (two files both present)

## Decisions Made
- ESM-compatible `__dirname` via `fileURLToPath(import.meta.url)` — Playwright runs tests as ESM modules; CommonJS `__dirname` global is undefined in this context.
- `waitForNodes()` targets `.first().waitFor({ state: 'visible' })` so it works for any upload regardless of how many nodes are rendered.
- `toHaveCount(2)` on `file-list-item` for E2E-04 — Playwright's built-in retry logic waits until exactly 2 items appear.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- helpers.ts is the shared foundation — all future spec files import uploadFile, uploadFiles, waitForNodes, waitForDetailPanel from it
- E2E-01 through E2E-04 confirmed passing with real browser automation (Chromium)
- Ready to write interaction, filter, and detail panel specs in plan 04-03
- No blockers

---
*Phase: 04-e2e-tests*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: tests/e2e/helpers.ts
- FOUND: tests/e2e/upload.spec.ts
- FOUND: .planning/phases/04-e2e-tests/04-02-SUMMARY.md
- FOUND commit: 9ee416a (E2E helper module)
- FOUND commit: 531b193 (upload spec E2E-01 through E2E-04)
