---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-02-27T10:54:40.648Z"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 7
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Users can reliably understand how their Excel workbooks reference each other — the graph must always be correct, even with edge-case or malformed files.
**Current focus:** Phase 3 — Graph Unit Tests

## Current Position

Phase: 3 of 4 (Graph Unit Tests)
Plan: 1 of 2 in current phase (03-01 complete)
Status: In progress
Last activity: 2026-02-27 — Completed 03-01: Graph unit tests (GRAPH-01 through GRAPH-04)

Progress: [██████░░░░] ~60%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 3 min
- Total execution time: ~14 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-infrastructure | 2 | 6 min | 3 min |
| 02-parser-unit-tests | 2 | 3 min | 1.5 min |
| 03-graph-unit-tests | 1 | 4 min | 4 min |

**Recent Trend:**
- Last 5 plans: 3 min
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-phase]: Vitest over Jest — same Vite transform pipeline, zero config, ESM/TypeScript work out of the box
- [Pre-phase]: Playwright over Cypress — better Vite integration, TypeScript-native, `setInputFiles()` for file upload
- [Pre-phase]: Programmatic test fixtures via SheetJS — readable, reproducible, CI-safe vs. opaque binary blobs
- [Phase 01-infrastructure]: Vitest configured with server.deps.inline: ['xlsx'] for CJS/ESM compat; separate vitest.config.ts from vite.config.ts; node environment (not jsdom)
- [Phase 01-infrastructure, Plan 03]: Explicit cell construction (ws['A1'] = { t:'n', v:0, f:'...' }) required for formula fixtures — aoa_to_sheet() never sets cell.f
- [Phase 01-infrastructure, Plan 03]: Read-back verify() pattern in generate.ts — write buffer, re-read, count formula cells before writing to disk
- [Phase 01-infrastructure, Plan 03]: Malformed fixture uses raw Buffer.from() — SheetJS always writes valid xlsx, corrupt bytes must be crafted manually
- [Phase 01-infrastructure]: webServer.url not webServer.port — url verifies server actually responds; port deprecated in Playwright 1.57+
- [Phase 01-infrastructure]: Smoke test checks empty state text not .react-flow — ReactFlow conditionally renders only when workbooks loaded
- [Phase 02-parser-unit-tests]: Add export keyword only to 3 parser functions — no other changes; readFileEntry remains private
- [Phase 02-parser-unit-tests]: Inline workbooks via XLSX.write/read round-trip for PARSE-03/PARSE-06/07 tests requiring specific formula shapes not in fixture files
- [Phase 02-parser-unit-tests]: Avoid the word 'annotation' in Vitest test comments — triggers false @vitest-environment module resolution
- [Phase 02-parser-unit-tests, Plan 02]: `// @vitest-environment jsdom` on line 1 enables File/FileReader in that test file only — entire file runs jsdom; acceptable for PARSE-09/11 (pure regex, no DOM APIs)
- [Phase 02-parser-unit-tests, Plan 02]: Do not assert SheetJS error message text in PARSE-10 — use .rejects.toThrow() without message arg; error strings vary by SheetJS version
- [Phase 03-graph-unit-tests, Plan 01]: makeWorkbook() factory builds WorkbookFile from name + [{sheetName, refs?}] — no SheetJS needed for graph tests
- [Phase 03-graph-unit-tests, Plan 01]: Filter !isExternal && !isFileNode for GRAPH-01 node count to avoid counting external file nodes created by cross-workbook refs
- [Phase 03-graph-unit-tests, Plan 01]: Use exact same filename string on both WorkbookFile.name and SheetReference.targetWorkbook to avoid normWb() normalization surprises

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 4]: Must verify FilePanel renders a hidden `<input type="file">` in the DOM before writing E2E upload tests. If only a pure div drop zone exists, the `DataTransfer` workaround (Playwright issue #10667) is required — adds complexity.
- [Phase 2 — RESOLVED]: `extractReferences`, `extractNamedRanges`, and `buildExternalLinkMap` are now exported from `parser.ts` and fully covered by unit tests.

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 03-graph-unit-tests/03-01-PLAN.md (Graph unit tests — GRAPH-01 through GRAPH-04)
Resume file: None
