# Tangle

## What This Is

Tangle is a web app (with a native Windows desktop wrapper via Tauri) for visualizing references within and between Excel files. Users upload `.xlsx` files and see an interactive node graph of all sheet-to-sheet and external file references. The app is fully client-side — no backend required.

## Core Value

Users can reliably understand how their Excel workbooks reference each other — the graph must always be correct, even with edge-case or malformed files.

## Requirements

### Validated

<!-- Shipped and confirmed working in v1.0.2 -->

- ✓ Upload `.xlsx`, `.xls`, `.xlsm`, `.xlsb` files via drag-drop or click — existing
- ✓ Parse cross-sheet references (`SheetName!A1`, `'Sheet Name'!A1:B2`) — existing
- ✓ Parse external file references (`[Workbook.xlsx]Sheet!A1`) — existing
- ✓ Parse named ranges and toggle named range nodes in graph — existing
- ✓ Interactive node graph with zoom, pan, click-to-select — existing
- ✓ Three layout modes: Graph (Dagre hierarchical), Grouped (per-file clusters), Overview (file-level) — existing
- ✓ Edge kind filter: toggle internal / cross-file / external / named-range edges — existing
- ✓ Focus mode with hop depth (1-3) and upstream/downstream direction — existing
- ✓ Hide/show files (eye toggle) — existing
- ✓ Highlight file in graph (crosshair pan/zoom) — existing
- ✓ Sheet workload metrics (totalFormulas, withinSheetRefs, crossSheetRefs, crossFileRefs) — existing
- ✓ Enhanced detail panel with workload grid, edge breakdown, Focus/Hide quick actions — existing
- ✓ Tauri v2 native desktop wrapper (.exe) — existing

### Active

<!-- Testing milestone — making the app solid -->

- [ ] Unit tests for `src/lib/parser.ts` — reference extraction, named ranges, external link resolution
- [ ] Unit tests for error scenarios in parser — bad files, circular refs, malformed formulas, external refs
- [ ] Unit tests for `src/lib/graph.ts` — buildGraph(), layout functions, edge classification
- [ ] E2E tests for core upload + graph render flow
- [ ] E2E tests for feature interactions (focus mode, hide/show, layout switching, edge filters)
- [ ] E2E tests for error handling (bad file upload, unsupported format)
- [ ] Test fixtures — sample `.xlsx` files covering edge cases (circular refs, large workbooks, external refs)

### Out of Scope

- Backend/server testing — app is fully client-side, no server to test
- Visual regression testing — too brittle for v1 testing milestone
- Performance benchmarks — noted concern but deferred beyond this milestone
- Mobile/cross-browser E2E matrix — Windows desktop is primary target

## Context

Tangle has 10 shipped features and zero automated tests. The parser (`src/lib/parser.ts`) is the most critical and most complex component — it uses SheetJS and multiple regex patterns to extract references. The graph builder (`src/lib/graph.ts`) has complex logic for three layout modes and edge classification. Both are pure TypeScript functions that are highly testable in isolation.

**Current error handling strategy:** Silent failures with try/catch in `parseWorkbook()`; regex-based extraction degrades gracefully but behavior on truly malformed inputs is unverified.

**Tech implications:**
- Vite is in use → Vitest is the natural unit test runner (zero config, same transform pipeline)
- React 19 + TypeScript → Playwright is the right E2E tool (Vite-aware, excellent TypeScript support)
- No test infrastructure exists yet (no test runner, no fixtures, no CI test step)

## Constraints

- **Tech stack**: Vitest for unit tests, Playwright for E2E — fits existing Vite toolchain
- **Scope**: Test the app as-is; no feature changes during this milestone
- **Fixtures**: Must create real `.xlsx` test fixtures (programmatically via SheetJS in fixture scripts)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vitest over Jest | Same Vite transform pipeline, faster, zero config for Vite projects | — Pending |
| Playwright over Cypress | Better Vite integration, TypeScript-native, supports Tauri WebView if needed | — Pending |
| Programmatic test fixtures | Create `.xlsx` files via SheetJS scripts rather than shipping binary fixtures | — Pending |

---
*Last updated: 2026-02-27 after initialization*
