---
phase: 02-parser-unit-tests
plan: 01
subsystem: testing
tags: [vitest, sheetjs, xlsx, parser, unit-tests, named-ranges, cross-sheet, external-refs]

# Dependency graph
requires:
  - phase: 01-infrastructure
    provides: Vitest config with server.deps.inline for xlsx, test fixtures (cross-sheet.xlsx, external-ref.xlsx, named-ranges.xlsx), fixture index with FIXTURES map
provides:
  - extractReferences, extractNamedRanges, buildExternalLinkMap exported from parser.ts for direct unit testing
  - 12 unit tests covering all 8 PARSE requirements (PARSE-01 through PARSE-08)
  - Pattern for inline workbook construction with formula cells for test isolation
affects: [03-graph-unit-tests, 04-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline workbook construction: XLSX.write() + XLSX.read() round-trip to preserve cell.f strings in test-only workbooks"
    - "Mock linkMap pattern: pass Map([['1', 'filename.xlsx']]) directly to extractReferences to test numeric index resolution without real OOXML zip entries"
    - "Named range map construction: new Map(namedRanges.map(nr => [nr.name.toLowerCase(), nr])) mirrors parser.ts internal pattern"

key-files:
  created:
    - tests/unit/parser.test.ts
  modified:
    - src/lib/parser.ts

key-decisions:
  - "Add export keyword only — no other changes to parser.ts; readFileEntry remains private"
  - "Inline workbooks via XLSX.write/read round-trip for PARSE-03 and PARSE-06/07 — fixture files lack the specific formula shapes needed"
  - "Mock linkMap for PARSE-04 — SheetJS programmatic writes do not produce xl/externalLinks/_rels/ entries, so numeric index format cannot come from a fixture"

patterns-established:
  - "Formula round-trip pattern: ws['A1'] = { t: 'n', v: 0, f: '...' } then XLSX.write + XLSX.read preserves cell.f"
  - "Avoid the word 'annotation' in test file comments — Vitest scans for @vitest-environment and trips on false matches"

requirements-completed: [PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06, PARSE-07, PARSE-08]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 2 Plan 01: Parser Unit Tests Summary

**Three internal parser functions exported and covered by 12 unit tests verifying cross-sheet refs (unquoted/quoted), external file refs (bracketed filename and numeric index), named range detection/dedup, and workload metrics**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-27T10:44:50Z
- **Completed:** 2026-02-27T10:46:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Exported `buildExternalLinkMap`, `extractNamedRanges`, `extractReferences` from `parser.ts` (3 new exports, no other changes)
- Created `tests/unit/parser.test.ts` with 12 tests covering all 8 PARSE requirements
- 15 total tests pass (3 pre-existing smoke tests + 12 new): zero failures, exit code 0
- TypeScript compiles cleanly (`npx tsc --noEmit` exits 0) after adding exports

## Task Commits

Each task was committed atomically:

1. **Task 1: Export three internal functions from parser.ts** - `195dda3` (feat)
2. **Task 2: Write parser.test.ts covering PARSE-01 through PARSE-08** - `f765cfa` (feat)

**Plan metadata:** (docs commit — see final commit below)

## Files Created/Modified
- `src/lib/parser.ts` - Added `export` keyword to 3 internal functions (buildExternalLinkMap, extractNamedRanges, extractReferences)
- `tests/unit/parser.test.ts` - 206-line unit test file; 12 tests across 5 describe blocks; node environment (no jsdom)

## Decisions Made
- Added `export` to exactly 3 functions; `readFileEntry` helper remains private (tests never call it directly)
- Used XLSX.write/read round-trip pattern for PARSE-03 and PARSE-06/07 inline workbooks — this is the only way to preserve cell.f in programmatically built sheets
- Passed mock linkMap directly for PARSE-04 because SheetJS write-path does not generate xl/externalLinks/_rels/ entries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed false @vitest-environment trigger from comment**
- **Found during:** Task 2 (parser.test.ts initial run)
- **Issue:** Test file comment contained the word "annotation" (`no @vitest-environment annotation`). Vitest scans all test files for `@vitest-environment` directives; it found a false match and tried to load `annotation` as a module path, crashing the worker before any tests ran.
- **Fix:** Changed comment from `no @vitest-environment annotation` to `no environment override needed` — removed the trigger word
- **Files modified:** tests/unit/parser.test.ts (comment line 3 only)
- **Verification:** `npm test` passed all 15 tests with exit code 0 after fix
- **Committed in:** f765cfa (Task 2 commit, single commit covers both the file creation and the fix)

---

**Total deviations:** 1 auto-fixed (Rule 1 - comment caused Vitest environment resolution failure)
**Impact on plan:** Minimal — single comment line change. No scope change, no logic change.

## Issues Encountered
- Vitest `@vitest-environment` comment scanning is more aggressive than expected — any occurrence of the annotation pattern in any comment can trigger module resolution. This is now documented in `patterns-established` to avoid recurrence in future test files.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 8 PARSE requirements are covered and passing
- `extractReferences`, `extractNamedRanges`, `buildExternalLinkMap` are now fully testable in isolation
- Pattern for inline workbook construction established and proven
- Ready for Phase 3 (graph unit tests) — `buildGraph()` is the next function to test

---
*Phase: 02-parser-unit-tests*
*Completed: 2026-02-27*
