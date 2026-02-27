# Tangle

## Current Milestone: v1.1 GitHub Polish

**Goal:** Make the repo professionally presentable — CI/CD, live demo, README, changelog, and repo hygiene.

**Target features:**
- GitHub Actions: unit tests + E2E + lint + build on every push/PR
- GitHub Pages auto-deploy to `bizbrf.github.io/tangle` on merge to `main`
- README overhaul (end-user focused: screenshots/GIF, live demo link, Tauri .exe download, feature list)
- `CHANGELOG.md` following Keep a Changelog format (backfilled from v1.0.0)
- Repo hygiene: issue templates, PR template, contributing guide

## What This Is

Tangle is a web app (with a native Windows desktop wrapper via Tauri) for visualizing references within and between Excel files. Users upload `.xlsx` files and see an interactive node graph of all sheet-to-sheet and external file references. The app is fully client-side — no backend required.

## Core Value

Users can reliably understand how their Excel workbooks reference each other — the graph must always be correct, even with edge-case or malformed files.

## Requirements

### Validated

<!-- Shipped and confirmed working -->

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
- ✓ Unit tests for `parser.ts` — reference extraction, named ranges, external link resolution, error handling — v1.0.2
- ✓ Unit tests for `graph.ts` — buildGraph(), layout functions, edge classification, named range toggle — v1.0.2
- ✓ E2E tests for core upload + graph render flow — v1.0.2
- ✓ E2E tests for feature interactions (focus mode, hide/show, layout switching, edge filters) — v1.0.2
- ✓ E2E tests for error handling (bad file upload, unsupported format) — v1.0.2
- ✓ Test fixtures — 7 `.xlsx` files covering edge cases (circular refs, external refs, named ranges, large workbook) — v1.0.2

### Active

<!-- Next milestone — feature polish and quality improvements -->

- [ ] Named range / table node popout detail options in the detail panel
- [ ] Coverage threshold enforcement (80%+ on parser.ts and graph.ts)
- [ ] CI integration — tests run on every pull request (GitHub Actions)

### Out of Scope

- Backend/server testing — app is fully client-side, no server to test
- Visual regression testing — too brittle for current stage
- Performance benchmarks — deferred, no user-reported perf issues
- Mobile/cross-browser E2E matrix — Windows desktop is primary target
- Tauri E2E via WebdriverIO — complexity not justified yet

## Context

Tangle has 10 shipped features and a complete test suite (v1.0). The parser (`src/lib/parser.ts`) and graph builder (`src/lib/graph.ts`) are covered by Vitest unit tests. The full upload-to-graph pipeline is covered by 17 Playwright E2E tests.

**Current test state:**
- `npm test` — 43 unit tests passing (Vitest)
- `npm run test:e2e` — 17 E2E tests passing (Playwright)
- `npm run test:coverage` — HTML coverage report via @vitest/coverage-v8
- 7 programmatic `.xlsx` fixtures in `tests/fixtures/`

**Tech stack:**
- Vite + React 19 + TypeScript
- Vitest (unit tests, `vitest.config.ts` separate from `vite.config.ts`)
- Playwright (E2E, Chromium, dev server via `webServer` config)
- SheetJS xlsx, @xyflow/react v12, Tailwind CSS v4, Tauri v2

## Constraints

- **Tech stack**: Vitest for unit tests, Playwright for E2E — fits existing Vite toolchain
- **Scope**: Test the app as-is; no feature changes during this milestone
- **Fixtures**: Must create real `.xlsx` test fixtures (programmatically via SheetJS in fixture scripts)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vitest over Jest | Same Vite transform pipeline, faster, zero config for Vite projects | ✓ Good — zero config friction, fast |
| Playwright over Cypress | Better Vite integration, TypeScript-native, supports Tauri WebView if needed | ✓ Good — webServer auto-start worked cleanly |
| Programmatic test fixtures | Create `.xlsx` files via SheetJS scripts rather than shipping binary fixtures | ✓ Good — readable, reproducible, easy to extend |
| `vitest.config.ts` separate from `vite.config.ts` | Avoids TypeScript context conflicts between browser and test (node/jsdom) environments | ✓ Good — resolved TS errors cleanly |
| `server.deps.inline: ['xlsx']` | SheetJS uses CJS dynamic requires that Vite's ESM transform breaks | ✓ Good — the only fix that works reliably |
| `data-testid` attributes for E2E targeting | Decoupled from CSS classes and text content — stable selectors | ✓ Good — zero selector breakage across all 17 tests |

---
*Last updated: 2026-02-27 after v1.0.2 milestone*
