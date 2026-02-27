---
phase: 01-infrastructure
plan: 03
subsystem: testing
tags: [vitest, sheetjs, xlsx, fixtures, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: Vitest runner with server.deps.inline xlsx fix and fixtures:generate npm script
provides:
  - Seven verified .xlsx test fixtures covering cross-sheet, external ref, named ranges, empty, large (100 sheets), circular, and malformed scenarios
  - tests/fixtures/generate.ts — programmatic fixture generator with read-back verify()
  - tests/fixtures/index.ts — typed FIXTURES constant and FixtureName type for all test imports
  - tests/unit/parser.smoke.test.ts — Vitest smoke test confirming SheetJS resolves through Vitest pipeline
  - .gitattributes marking .xlsx fixtures as binary
affects:
  - 02-parser-tests
  - 02-graph-tests
  - 03-e2e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Explicit formula cell construction via ws['A1'] = { t:'n', v:0, f:'...' } (aoa_to_sheet does NOT set cell.f)
    - Read-back verify() pattern: write buffer, re-read with cellFormula:true, count .f cells before writing to disk
    - Malformed fixture via raw Buffer.from() with PK header — SheetJS always writes valid xlsx so corrupt bytes must be crafted manually

key-files:
  created:
    - tests/fixtures/generate.ts
    - tests/fixtures/index.ts
    - tests/unit/parser.smoke.test.ts
    - .gitattributes
    - tests/fixtures/cross-sheet.xlsx
    - tests/fixtures/external-ref.xlsx
    - tests/fixtures/named-ranges.xlsx
    - tests/fixtures/empty.xlsx
    - tests/fixtures/large.xlsx
    - tests/fixtures/circular.xlsx
    - tests/fixtures/malformed.xlsx
  modified: []

key-decisions:
  - "Explicit cell construction over aoa_to_sheet for formula fixtures — aoa_to_sheet treats strings as values, never sets cell.f property"
  - "Read-back verify() in generator — catches SheetJS formula pitfalls before files are written to disk; fail-fast at generation time, not test time"
  - "Malformed fixture uses raw Buffer.from() with PK header — SheetJS.write() always produces valid xlsx; corrupt bytes must be written directly"
  - "Node 24.13.0 native TypeScript stripping used — no tsx or ts-node needed; node tests/fixtures/generate.ts works directly"

patterns-established:
  - "Formula cell pattern: ws['A1'] = { t: 'n', v: 0, f: 'SheetName!A1' } — must be used in all future formula-bearing test data"
  - "FIXTURES import pattern: import { FIXTURES } from '../fixtures/index' — typed, absolute paths, works in Vitest and Node"

requirements-completed: [INFRA-03, INFRA-04]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 1 Plan 03: Test Fixtures and Smoke Test Summary

**Seven SheetJS-generated .xlsx test fixtures with read-back verification and a Vitest smoke test confirming the server.deps.inline xlsx fix works end-to-end**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T10:10:49Z
- **Completed:** 2026-02-27T10:13:00Z
- **Tasks:** 2
- **Files modified:** 11 (4 source files created, 7 .xlsx fixtures generated)

## Accomplishments
- Created programmatic fixture generator (generate.ts) with read-back verify() that catches formula cell pitfalls before files are written
- Generated all seven .xlsx fixtures: cross-sheet, external-ref, named-ranges, empty, large (100 sheets/99 formula cells), circular, malformed
- Created typed FIXTURES index with FixtureName type for safe test imports
- Vitest smoke test passes all 3 assertions: xlsx import, formula round-trip, fixture file read

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the fixture generator and generate all seven .xlsx files** - `79400f5` (feat)
2. **Task 2: Write Vitest smoke test and run the full unit test suite** - `7639916` (feat)

## Files Created/Modified
- `tests/fixtures/generate.ts` - Programmatic fixture generator; uses XLSX.write() + verify() for 5 of 7 fixtures
- `tests/fixtures/index.ts` - Typed FIXTURES constant (7 paths) and FixtureName type
- `tests/unit/parser.smoke.test.ts` - Three smoke tests: import, formula round-trip, fixture read
- `.gitattributes` - Marks tests/fixtures/*.xlsx as binary for clean git diffs
- `tests/fixtures/cross-sheet.xlsx` - Sheet1!A1 = Sheet2!A1 (1 formula cell)
- `tests/fixtures/external-ref.xlsx` - Sheet1!A1 = [External.xlsx]Prices!C3 (1 formula cell)
- `tests/fixtures/named-ranges.xlsx` - Cross-sheet ref + named range MyRange (1 formula cell)
- `tests/fixtures/empty.xlsx` - Plain values only, no formulas (0 formula cells, intentional)
- `tests/fixtures/large.xlsx` - 100 sheets, each referencing previous (99 formula cells)
- `tests/fixtures/circular.xlsx` - Sheet1!A1 -> Sheet2!A1 -> Sheet1!A1 (2 formula cells)
- `tests/fixtures/malformed.xlsx` - 57-byte corrupt file (PK header + garbage)

## Decisions Made
- Used explicit cell construction `ws['A1'] = { t: 'n', v: 0, f: 'Sheet2!A1' }` for all formula-bearing fixtures. `aoa_to_sheet()` only sets cell values, never `cell.f`, which would cause parser tests to find zero references.
- Added `verify()` read-back in generator — write buffer, re-read, count `.f` cells. Catches the formula pitfall at generation time with a clear error message.
- Malformed fixture crafted with raw `Buffer.from()` — SheetJS always produces structurally valid xlsx, so a corrupt file must be written directly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All seven test fixtures ready for Phase 2 parser unit tests
- FIXTURES typed import works from any test file via `import { FIXTURES } from '../fixtures/index'`
- `npm run fixtures:generate` can be re-run at any time to regenerate all files
- `npm test` and `npm run test:coverage` both pass and are ready for Phase 2 additions

---
*Phase: 01-infrastructure*
*Completed: 2026-02-27*

## Self-Check: PASSED

- tests/fixtures/generate.ts: FOUND
- tests/fixtures/index.ts: FOUND
- tests/unit/parser.smoke.test.ts: FOUND
- .gitattributes: FOUND
- tests/fixtures/cross-sheet.xlsx: FOUND
- tests/fixtures/malformed.xlsx: FOUND
- 01-03-SUMMARY.md: FOUND
- Commit 79400f5 (Task 1): FOUND
- Commit 7639916 (Task 2): FOUND
