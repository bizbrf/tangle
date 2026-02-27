# Requirements: Tangle Test Suite

**Defined:** 2026-02-27
**Core Value:** Users can reliably understand how their Excel workbooks reference each other — the graph must always be correct, even with edge-case or malformed files.

## v1 Requirements

### Infrastructure

- [x] **INFRA-01**: Vitest is installed and configured with jsdom environment and SheetJS inline dependency fix (`test.server.deps.inline: ['xlsx']`)
- [x] **INFRA-02**: `vitest.config.ts` exists as a separate file from `vite.config.ts` to avoid TypeScript context conflicts
- [ ] **INFRA-03**: A programmatic fixture generator script (`tests/fixtures/generate.ts`) creates verified `.xlsx` test files via SheetJS
- [ ] **INFRA-04**: Test fixtures cover: simple cross-sheet refs, external file refs, named ranges, empty workbook, malformed/corrupt file, large workbook (100+ sheets), circular references
- [x] **INFRA-05**: Coverage reporting is configured via `@vitest/coverage-v8` with HTML output
- [x] **INFRA-06**: Playwright is installed and configured to run E2E tests against the Vite dev server (`http://localhost:5173`)
- [x] **INFRA-07**: `npm test` runs unit tests; `npm run test:e2e` runs E2E tests; `npm run test:coverage` generates coverage report

### Parser Unit Tests

- [ ] **PARSE-01**: `extractReferences()` is exported from `src/lib/parser.ts` and testable in isolation
- [ ] **PARSE-02**: Cross-sheet references with unquoted names (`SheetName!A1`) are detected correctly
- [ ] **PARSE-03**: Cross-sheet references with quoted names (`'Sheet Name'!A1:B2`) are detected correctly
- [ ] **PARSE-04**: External file references with numeric link indices (`[1]Sheet!A1`) are resolved to actual filenames via `buildExternalLinkMap()`
- [ ] **PARSE-05**: External file references with bracketed filenames (`[File.xlsx]Sheet!A1`) are detected correctly
- [ ] **PARSE-06**: Named ranges are detected and distinguished from function calls (e.g., `SUM(...)` is not a named range)
- [ ] **PARSE-07**: Named range references in formulas do not appear as duplicate edges
- [ ] **PARSE-08**: Workload metrics (totalFormulas, withinSheetRefs, crossSheetRefs, crossFileRefs) are counted correctly
- [ ] **PARSE-09**: Empty workbooks (no formulas) return empty reference arrays with zero workload metrics
- [ ] **PARSE-10**: Malformed or corrupt `.xlsx` files are handled gracefully — `parseWorkbook()` rejects with an error, not a crash
- [ ] **PARSE-11**: Circular references between sheets (A → B → A) do not cause infinite loops or crashes

### Graph Unit Tests

- [ ] **GRAPH-01**: `buildGraph()` creates exactly one node per uploaded sheet (in standard layout mode)
- [ ] **GRAPH-02**: `buildGraph()` creates edges for each detected cross-sheet reference
- [ ] **GRAPH-03**: Edge kind is classified correctly: `internal` (same workbook), `cross-file` (both uploaded), `external` (target not uploaded), `named-range`
- [ ] **GRAPH-04**: Sheets from hidden files are excluded from nodes and their edges removed
- [ ] **GRAPH-05**: All three layout modes (graph, grouped, overview) return non-empty node arrays with valid position coordinates
- [ ] **GRAPH-06**: `buildOverviewGraph()` returns exactly one node per uploaded workbook
- [ ] **GRAPH-07**: Named range nodes appear when `showNamedRanges` is true and disappear when false

### E2E Tests — Core Upload Flow

- [ ] **E2E-01**: User can upload a `.xlsx` file via the file input; the filename appears in the sidebar
- [ ] **E2E-02**: Uploaded file's sheets are listed under the filename in the sidebar (expandable)
- [ ] **E2E-03**: Graph canvas renders at least one node after upload
- [ ] **E2E-04**: User can upload multiple files; all appear in sidebar and graph

### E2E Tests — Feature Interactions

- [ ] **E2E-05**: Switching layout mode (Graph → Grouped → Overview) updates the graph — node count changes for Overview mode
- [ ] **E2E-06**: Toggling edge kind filter (e.g., hiding external edges) removes those edges from the graph
- [ ] **E2E-07**: Clicking the eye icon on a file hides its nodes from the graph
- [ ] **E2E-08**: Clicking the eye icon again (re-show) restores the hidden nodes
- [ ] **E2E-09**: Focus mode — clicking a node and setting focus depth filters graph to neighborhood only

### E2E Tests — Detail Panel

- [ ] **E2E-10**: Clicking a sheet node opens the detail panel showing the sheet name
- [ ] **E2E-11**: Detail panel shows workload metrics (formula count, reference counts)
- [ ] **E2E-12**: Clicking an edge opens the detail panel showing source and target sheet names

### E2E Tests — Error Handling

- [ ] **E2E-13**: Uploading a non-Excel file (e.g., `.txt`) shows an error message and does not crash the app
- [ ] **E2E-14**: Uploading a corrupt/malformed `.xlsx` file shows an error message in the UI
- [ ] **E2E-15**: App remains usable (other files still visible in graph) after a failed upload

## v2 Requirements

### Advanced Coverage

- **COV-01**: Coverage threshold enforcement (e.g., 80% line coverage gate on `parser.ts` and `graph.ts`)
- **COV-02**: CI integration — tests run on every pull request (GitHub Actions)
- **COV-03**: Tauri E2E tests via WebdriverIO (native `.exe` path)
- **COV-04**: Visual regression tests for graph snapshots

### Performance Tests

- **PERF-01**: Parser benchmarks for large workbooks (1000+ formulas) with performance budgets

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visual regression / pixel snapshot tests | Brittle, high maintenance, explicitly avoided |
| Tauri native E2E (`.exe` path) | Different tooling (WebdriverIO); out of scope for this milestone |
| Backend / API testing | App is fully frontend-only, no server |
| Cross-browser E2E matrix | Windows desktop (Chromium) is the primary target |
| JSDOM component tests for React Flow | React Flow requires 4+ DOM mocks; testing `buildGraph()` as pure TS is correct approach |
| Performance benchmarks | Noted concern but separate milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 1 | Complete |
| INFRA-07 | Phase 1 | Complete |
| PARSE-01 | Phase 2 | Pending |
| PARSE-02 | Phase 2 | Pending |
| PARSE-03 | Phase 2 | Pending |
| PARSE-04 | Phase 2 | Pending |
| PARSE-05 | Phase 2 | Pending |
| PARSE-06 | Phase 2 | Pending |
| PARSE-07 | Phase 2 | Pending |
| PARSE-08 | Phase 2 | Pending |
| PARSE-09 | Phase 2 | Pending |
| PARSE-10 | Phase 2 | Pending |
| PARSE-11 | Phase 2 | Pending |
| GRAPH-01 | Phase 3 | Pending |
| GRAPH-02 | Phase 3 | Pending |
| GRAPH-03 | Phase 3 | Pending |
| GRAPH-04 | Phase 3 | Pending |
| GRAPH-05 | Phase 3 | Pending |
| GRAPH-06 | Phase 3 | Pending |
| GRAPH-07 | Phase 3 | Pending |
| E2E-01 | Phase 4 | Pending |
| E2E-02 | Phase 4 | Pending |
| E2E-03 | Phase 4 | Pending |
| E2E-04 | Phase 4 | Pending |
| E2E-05 | Phase 4 | Pending |
| E2E-06 | Phase 4 | Pending |
| E2E-07 | Phase 4 | Pending |
| E2E-08 | Phase 4 | Pending |
| E2E-09 | Phase 4 | Pending |
| E2E-10 | Phase 4 | Pending |
| E2E-11 | Phase 4 | Pending |
| E2E-12 | Phase 4 | Pending |
| E2E-13 | Phase 4 | Pending |
| E2E-14 | Phase 4 | Pending |
| E2E-15 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 40 total (INFRA: 7, PARSE: 11, GRAPH: 7, E2E: 15)
- Mapped to phases: 40
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 — traceability confirmed, coverage count corrected to 40*
