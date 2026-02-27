---
gsd_state_version: 1.0
milestone: v1.0.2
milestone_name: milestone
status: unknown
last_updated: "2026-02-27T19:52:15.786Z"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 10
  completed_plans: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27 after v1.0 milestone)

**Core value:** Users can reliably understand how their Excel workbooks reference each other — the graph must always be correct, even with edge-case or malformed files.
**Current focus:** v1.1 GitHub Polish — requirements and roadmap needed

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Milestone v1.1 started — requirements and roadmap pending
Last activity: 2026-02-27 — Milestone v1.1 GitHub Polish initialized

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 3 min
- Total execution time: ~25 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-infrastructure | 2 | 6 min | 3 min |
| 02-parser-unit-tests | 2 | 3 min | 1.5 min |
| 03-graph-unit-tests | 2 | 7 min | 3.5 min |
| 04-e2e-tests | 3/3 | 11 min | 3.7 min |

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
- [Phase 03-graph-unit-tests, Plan 02]: Two-workbook cross-file topology required for GRAPH-05 position tests — isolated single node may get (0,0) from Dagre
- [Phase 03-graph-unit-tests, Plan 02]: GRAPH-06 overview count uses !n.data.isExternal filter defensively even when topology has no external refs
- [Phase 03-graph-unit-tests, Plan 02]: GRAPH-07 edge count asserts exactly 2 named-range edges (source->NR + NR->consumer) replacing 1 direct edge
- [Phase 04-e2e-tests, Plan 01]: data-testid added inline on existing elements — no wrapper divs, no structural changes
- [Phase 04-e2e-tests, Plan 01]: Template literal testids (layout-${mode}, edge-filter-${kind}) auto-generate stable selectors from existing map() iterations
- [Phase 04-e2e-tests, Plan 01]: All 3 SheetNode branches share data-testid="sheet-node" — tests differentiate by content if needed
- [Phase 04-e2e-tests, Plan 02]: ESM-compatible __dirname via fileURLToPath(import.meta.url) — CommonJS __dirname is undefined in Playwright ESM context
- [Phase 04-e2e-tests, Plan 02]: waitForNodes() uses .first().waitFor({ state: 'visible' }) — works for any upload regardless of node count
- [Phase 04-e2e-tests, Plan 02]: toHaveCount(2) on file-list-item for E2E-04 — Playwright auto-retries until count matches
- [Phase 04-e2e-tests, Plan 03]: E2E-05 must use cross-sheet.xlsx not external-ref.xlsx — external-ref has same node count in graph and overview modes (2 each: 1 sheet + 1 external file node)
- [Phase 04-e2e-tests, Plan 03]: E2E-06 toggle round-trip verified via not.toHaveCount(edgesBefore) then toHaveCount(edgesBefore) — no fixed timeouts
- [Phase 04-e2e-tests, Plan 03]: E2E-12 edge click: try .react-flow__edge-label first (multi-ref), fallback to .react-flow__edge with force:true

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 4 — RESOLVED]: FilePanel does render a hidden `<input type="file" class="hidden">` — Playwright setInputFiles() will work directly, no DataTransfer workaround needed.
- [Phase 2 — RESOLVED]: `extractReferences`, `extractNamedRanges`, and `buildExternalLinkMap` are now exported from `parser.ts` and fully covered by unit tests.
- [Phase 3 — RESOLVED]: All 7 GRAPH requirements covered — 43 total unit tests passing.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | named ranges button splits named ranges from sheet; tables same behavior | 2026-02-27 | 9079b7b | [1-named-ranges-button-splits-named-ranges-](./quick/1-named-ranges-button-splits-named-ranges-/) |

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed quick/1-PLAN.md (Excel Tables toggle — violet intermediate nodes following Named Ranges pattern)
Resume file: None
