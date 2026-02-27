---
phase: 04-e2e-tests
verified: 2026-02-27T19:00:00Z
status: human_needed
score: 19/19 automated checks verified
re_verification: false
human_verification:
  - test: "Run npm run test:e2e and confirm all 16 tests pass (15 E2E + 1 smoke)"
    expected: "Playwright exits 0 with output '16 passed'"
    why_human: "E2E tests require a live Vite dev server and Chromium browser — cannot run programmatically in this environment"
  - test: "E2E-09 focus depth filtering — after clicking Focus in the detail panel, verify that the graph actually filters to neighborhood nodes only (not just that the focus-panel div appears)"
    expected: "Nodes outside the focus neighborhood become visually dimmed or hidden; the graph shows a subset of nodes"
    why_human: "The spec only asserts focus-panel visibility, not that neighborhood filtering is applied to the graph canvas — requires visual inspection or additional DOM assertion"
  - test: "E2E-06 edge toggle restore — verify the round-trip: edgesBefore > 0, after toggle edges decrease, after re-toggle edges return to edgesBefore"
    expected: "Edge DOM count matches original count after toggling off and back on"
    why_human: "The assertion relies on React Flow removing and re-adding DOM elements, which can only be confirmed with a running browser"
  - test: "E2E-12 edge click — verify clicking an edge (or edge label badge) actually opens the detail panel with 'References' in the header (not 'Sheet')"
    expected: "data-testid='detail-panel-title' contains text 'References' after edge click"
    why_human: "SVG edge click behavior with force:true in React Flow can be unreliable; requires a running browser to confirm the conditional label-badge vs SVG-path fallback works correctly"
---

# Phase 4: E2E Tests Verification Report

**Phase Goal:** The full upload-to-graph pipeline works end-to-end in a real browser — users can upload files, see nodes, interact with features, and receive meaningful errors when uploads fail
**Verified:** 2026-02-27T19:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Uploading a valid .xlsx fixture causes filename in sidebar and at least one node in graph canvas | ? HUMAN | upload.spec.ts E2E-01/03 test this; artifacts exist and are wired; requires live browser to confirm |
| 2 | Uploading two files results in both filenames in sidebar and both files' sheets visible | ? HUMAN | upload.spec.ts E2E-02/04 test this; artifacts exist and are wired; requires live browser to confirm |
| 3 | Switching to Overview reduces node count; toggling edge kind filter removes those edges from DOM | ? HUMAN | interactions.spec.ts E2E-05/06 test this; fixtures and selectors correctly wired; requires live browser |
| 4 | Clicking eye icon removes file's nodes; clicking again restores them | ? HUMAN | interactions.spec.ts E2E-07/08 test this; hover-then-click pattern correctly implemented |
| 5 | Clicking sheet node opens detail panel with sheet name and workload metrics | ? HUMAN | detail-panel.spec.ts E2E-10/11 test this; data-testid attributes and panel logic wired correctly |
| 6 | Uploading .txt shows error; corrupt .xlsx shows error and prior files remain visible | ? HUMAN | errors.spec.ts E2E-13/14/15 test this; upload-error testid present; error logic wired |

All 6 success criteria have complete test coverage, correct data-testid instrumentation, and proper spec implementations. No automated check can confirm browser execution.

**Score:** 19/19 static checks pass (see artifact and key link tables below)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/FilePanel/FilePanel.tsx` | data-testid on upload-error, file-list-item, sheet-list-item, eye-toggle | VERIFIED | 4 data-testid attributes confirmed present at correct DOM locations |
| `src/components/Graph/GraphView.tsx` | data-testid on sheet-node (3 branches), detail-panel, detail-panel-title, workload-metrics, layout-*, edge-filter-*, focus-panel | VERIFIED | 9 data-testid attribute locations confirmed; template literals produce layout-graph/grouped/overview and edge-filter-internal/cross-file/external/named-range |
| `tests/fixtures/not-excel.txt` | Plain-text file for E2E-13 upload rejection test | VERIFIED | File exists with content "This is not an Excel file." |
| `tests/e2e/helpers.ts` | fixturePath, uploadFile, uploadFiles, waitForNodes, waitForDetailPanel exports | VERIFIED | All 5 functions exported; ESM-compatible `__dirname` via `fileURLToPath(import.meta.url)` |
| `tests/e2e/upload.spec.ts` | E2E-01 through E2E-04 tests | VERIFIED | 4 tests present, named with E2E-0N prefix, using helpers correctly |
| `tests/e2e/interactions.spec.ts` | E2E-05 through E2E-09 tests | VERIFIED | 5 tests present; hover-before-click pattern for eye-toggle; no waitForTimeout used |
| `tests/e2e/detail-panel.spec.ts` | E2E-10 through E2E-12 tests | VERIFIED | 3 tests present; force:true on node clicks; conditional edge-label vs SVG fallback for E2E-12 |
| `tests/e2e/errors.spec.ts` | E2E-13 through E2E-15 tests | VERIFIED | 3 tests present; waitFor({ state: 'visible' }) on upload-error element |
| `playwright.config.ts` | testDir ./tests/e2e, baseURL http://localhost:5173, webServer npm run dev | VERIFIED | Config present with correct settings; reuseExistingServer for non-CI |
| `tests/fixtures/cross-sheet.xlsx` | 2-sheet xlsx fixture for upload/layout/detail tests | VERIFIED | File exists; generate.ts confirms Sheet1 + Sheet2 with cross-sheet formula |
| `tests/fixtures/external-ref.xlsx` | Single-sheet xlsx with external file reference | VERIFIED | File exists; generate.ts confirms Sheet1 with [External.xlsx]Prices!C3 formula |
| `tests/fixtures/malformed.xlsx` | Corrupt xlsx for E2E-14/15 error tests | VERIFIED | File exists in fixtures directory |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| FilePanel.tsx error paragraph | data-testid="upload-error" | `{error && <p data-testid="upload-error"...>}` | WIRED | Conditional render on `error` state; handleFiles sets error for non-Excel and parse failure |
| FilePanel.tsx file row div | data-testid="file-list-item" | `<div data-testid="file-list-item" className="group..."` | WIRED | Present on outer div of each workbook row in map() |
| FilePanel.tsx eye-toggle button | data-testid="eye-toggle" | `{onToggleHidden && (<button data-testid="eye-toggle"...>)}` | WIRED | Conditionally rendered; App.tsx passes onToggleHidden prop — button is in DOM |
| FilePanel.tsx sheet row | data-testid="sheet-list-item" | `<div key={sheet.sheetName} data-testid="sheet-list-item"...>` | WIRED | Present on each sheet div within expanded workbook |
| GraphView.tsx SheetNode (named-range branch) | data-testid="sheet-node" | `if (data.isNamedRange) { return (<div data-testid="sheet-node"...>` | WIRED | First branch in SheetNode, before isFileNode check |
| GraphView.tsx SheetNode (file-node branch) | data-testid="sheet-node" | `if (data.isFileNode) { return (<div data-testid="sheet-node"...>` | WIRED | Second branch in SheetNode |
| GraphView.tsx SheetNode (regular branch) | data-testid="sheet-node" | `return (<div data-testid="sheet-node" style={containerStyle}...>` | WIRED | Final return in SheetNode |
| GraphView.tsx DetailPanel outer div | data-testid="detail-panel" | `return (<div data-testid="detail-panel" style={panelStyle}>` | WIRED | DetailPanel conditionally rendered (null when nothing selected) |
| GraphView.tsx detail-panel-title span | data-testid="detail-panel-title" | `<span data-testid="detail-panel-title"...>{...isNamedRange ? 'Named Range' : 'Sheet'} : 'References'}` | WIRED | Shows 'Sheet' for regular nodes (cross-sheet.xlsx), 'References' for edge selection |
| GraphView.tsx workload-metrics grid | data-testid="workload-metrics" | `{node.data.workload && (<><div data-testid="workload-metrics" style={{display:'grid'...}}>` | WIRED | Inside workload guard; cross-sheet.xlsx has formulas so workload is non-null |
| GraphView.tsx layout buttons | data-testid=`layout-${mode}` | `LAYOUT_OPTIONS.map(({mode...}) => <button data-testid={\`layout-${mode}\`}...>` | WIRED | Template literal produces layout-graph, layout-grouped, layout-overview |
| GraphView.tsx edge filter buttons | data-testid=`edge-filter-${kind}` | `visibleOptions.map(({kind...}) => <button data-testid={\`edge-filter-${kind}\`}...>` | WIRED | Template literal produces edge-filter-internal, edge-filter-cross-file, edge-filter-external, edge-filter-named-range |
| GraphView.tsx focus panel | data-testid="focus-panel" | `{focusNodeId && (<div data-testid="focus-panel"...>` | WIRED | Conditionally rendered when focusNodeId is non-null; set by onFocus handler |
| helpers.ts uploadFile → file input | `input[type="file"]`.setInputFiles() | `page.locator('input[type="file"]').setInputFiles(fixturePath(filename))` | WIRED | File input is hidden but accessible via setInputFiles; FilePanel onChange triggers handleFiles |
| upload.spec.ts E2E-01 → file-list-item | getByTestId('file-list-item').filter({hasText}) | Import from ./helpers + page.getByTestId call | WIRED | Imports present; filter narrows to specific filename |
| interactions.spec.ts E2E-07 → eye-toggle | fileRow.hover() then fileRow.getByTestId('eye-toggle').click() | Hover removes opacity-0 CSS; click fires onToggleHidden | WIRED | hover() call present before eye-toggle click; onToggleHidden passed from App.tsx |
| detail-panel.spec.ts E2E-10 → detail-panel | waitForDetailPanel() after node click | `page.getByTestId('detail-panel').waitFor({state:'visible'})` | WIRED | Helper imported; detail-panel conditionally rendered when node selected |
| errors.spec.ts E2E-13 → upload-error | `page.getByTestId('upload-error').waitFor({state:'visible'})` | Conditional render fires when error state set | WIRED | upload-error testid present; handleFiles sets error for .txt files |
| graph.ts hiddenFiles → node exclusion | `workbooks.filter((wb) => !hiddenFiles.has(wb.name))` | Called in buildGraph() before layout | WIRED | When eye-toggle fires, App.tsx updates hiddenFiles set, triggering graph rebuild without hidden workbook |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| E2E-01 | 04-01 (instrumentation), 04-02 (spec) | User uploads .xlsx; filename appears in sidebar | VERIFIED | upload.spec.ts E2E-01; file-list-item testid in FilePanel.tsx |
| E2E-02 | 04-01 (instrumentation), 04-02 (spec) | Uploaded file's sheets listed under filename | VERIFIED | upload.spec.ts E2E-02; sheet-list-item testid in FilePanel.tsx; auto-expand on upload confirmed in source |
| E2E-03 | 04-01 (instrumentation), 04-02 (spec) | Graph canvas renders at least one node after upload | VERIFIED | upload.spec.ts E2E-03; sheet-node testid on all 3 SheetNode branches |
| E2E-04 | 04-01 (instrumentation), 04-02 (spec) | Multiple files upload; all appear in sidebar and graph | VERIFIED | upload.spec.ts E2E-04; uploadFiles() helper; toHaveCount(2) assertion |
| E2E-05 | 04-01 (instrumentation), 04-03 (spec) | Switching layout mode updates graph node count for Overview | VERIFIED | interactions.spec.ts E2E-05; layout-overview testid; cross-sheet.xlsx (2 sheets) → 1 overview node |
| E2E-06 | 04-01 (instrumentation), 04-03 (spec) | Toggling edge kind filter removes those edges from graph | VERIFIED | interactions.spec.ts E2E-06; edge-filter-external testid; not.toHaveCount/toHaveCount pattern |
| E2E-07 | 04-01 (instrumentation), 04-03 (spec) | Eye icon on file hides its nodes from graph | VERIFIED | interactions.spec.ts E2E-07; eye-toggle testid; hover() before click; hiddenFiles filter in graph.ts |
| E2E-08 | 04-01 (instrumentation), 04-03 (spec) | Eye icon again restores hidden nodes | VERIFIED | interactions.spec.ts E2E-08; second hover() + click restores; toHaveCount(nodesBefore) |
| E2E-09 | 04-01 (instrumentation), 04-03 (spec) | Focus mode — clicking node and setting focus filters to neighborhood | PARTIAL | interactions.spec.ts E2E-09 verifies focus-panel appears; does NOT assert neighborhood filtering applied to graph |
| E2E-10 | 04-01 (instrumentation), 04-03 (spec) | Clicking sheet node opens detail panel showing sheet name | VERIFIED | detail-panel.spec.ts E2E-10; detail-panel + detail-panel-title testids; 'Sheet' text for regular nodes |
| E2E-11 | 04-01 (instrumentation), 04-03 (spec) | Detail panel shows workload metrics (formula count) | VERIFIED | detail-panel.spec.ts E2E-11; workload-metrics testid; containsText('formulas') assertion |
| E2E-12 | 04-01 (instrumentation), 04-03 (spec) | Clicking edge opens detail panel showing source and target | PARTIAL | detail-panel.spec.ts E2E-12; conditional edge-label vs SVG fallback; 'References' text asserted — requires live browser to confirm SVG click reliability |
| E2E-13 | 04-01 (instrumentation), 04-03 (spec) | .txt upload shows error without crash | VERIFIED | errors.spec.ts E2E-13; upload-error testid; handleFiles sets error for non-Excel; 'Excel' text assertion |
| E2E-14 | 04-01 (instrumentation), 04-03 (spec) | Corrupt .xlsx upload shows error message | VERIFIED | errors.spec.ts E2E-14; upload-error testid; handleFiles catches parse rejection |
| E2E-15 | 04-01 (instrumentation), 04-03 (spec) | App remains usable after failed upload; prior files visible | VERIFIED | errors.spec.ts E2E-15; sheet-node and file-list-item assertions after failed malformed.xlsx upload |

**All 15 E2E requirement IDs from phase PLAN frontmatter are accounted for.** No orphaned requirements found (REQUIREMENTS.md maps E2E-01 through E2E-15 to Phase 4, all have corresponding spec coverage).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No waitForTimeout, no placeholder implementations, no TODO/FIXME, no empty handlers found in any spec file |

Scan result: All 5 spec/helper files are free of anti-patterns. No fixed timeouts, no stub implementations. All waits are element-based (waitFor, toBeVisible, toHaveCount, not.toHaveCount).

### Human Verification Required

#### 1. Full E2E Suite Pass

**Test:** From the project root, run `npm run test:e2e` with Vite dev server not already running
**Expected:** Playwright starts Vite dev server automatically, runs all 16 tests (1 smoke + 4 upload + 5 interactions + 3 detail-panel + 3 errors) against Chromium, exits 0 with "16 passed"
**Why human:** Requires a running browser (Chromium) and live Vite server; cannot be confirmed by static analysis

#### 2. E2E-09 Focus Graph Filtering

**Test:** Upload cross-sheet.xlsx, click a node, wait for detail panel, click 'Focus', observe the graph canvas
**Expected:** Nodes NOT in the immediate neighborhood of the focused node should be visually dimmed or removed from view (not just that the focus-panel control appears)
**Why human:** The spec (E2E-09) only asserts `focus-panel` visibility. The requirement (E2E-09 in REQUIREMENTS.md) specifies "filters graph to neighborhood only." Whether the graph canvas actually filters is only verifiable visually.

#### 3. E2E-12 Edge Click Reliability

**Test:** Upload cross-sheet.xlsx, wait for nodes, attempt to click an edge in the React Flow graph canvas
**Expected:** detail-panel opens with 'References' in the header title
**Why human:** SVG edge clicking with `force: true` in React Flow can be unreliable depending on edge path geometry and canvas z-index. The conditional label-badge-first fallback may not work if cross-sheet.xlsx generates only edges without refCount > 1 labels. Confirm by running the test and observing whether E2E-12 passes or fails.

### Gaps Summary

No gaps blocking goal achievement were found in static analysis. All 15 requirements have corresponding spec tests. All data-testid attributes are present and wired correctly in source files. All helper functions are substantive (not stubs). All fixture files exist.

Three items require human verification:
1. The full test suite must be executed against a live browser to confirm all 16 tests actually pass
2. E2E-09 tests only focus-panel appearance — the neighborhood filtering behavior is not programmatically asserted in the spec
3. E2E-12 edge clicking reliability requires browser confirmation

These are expected limitations of static verification for E2E tests — the tests themselves are correctly written and instrumented. The only open question is whether they pass when Playwright runs them.

---

_Verified: 2026-02-27T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
