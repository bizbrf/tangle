# Feature Research

**Domain:** Test suite for a React/Vite/TypeScript Excel-reference visualization app
**Researched:** 2026-02-27
**Confidence:** HIGH — based on direct source code analysis of parser.ts, graph.ts, and all UI components

---

## Feature Landscape

This document answers: what test scenarios should a comprehensive test suite cover for Tangle?

The app has two testable layers:
1. **Pure functions** in `src/lib/parser.ts` and `src/lib/graph.ts` — ideal for fast unit tests
2. **Browser UI interactions** across FilePanel, GraphView, focus mode, edge filters, layout modes — requires E2E

---

### Table Stakes (Users Expect These)

Tests a developer expects in any app with this complexity. Missing = test suite is not credible.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Parser: cross-sheet reference detection | Core app value. `SheetName!A1` and `'Sheet Name'!A1:B2` patterns are the main parsing target | LOW | Regex-based. Pure function. `REF_WITH_CELL_RE` in parser.ts. Test quoted and unquoted sheet names, with and without spaces. |
| Parser: external file reference detection | Core app value. `[Workbook.xlsx]Sheet!A1` and numeric index resolution are required for multi-file graphs | MEDIUM | Involves `buildExternalLinkMap()` which reads raw zip XML; unit-testable by constructing mock XLSX WorkBook objects or testing the regex independently |
| Parser: self-sheet reference skipping | Parser must NOT create edges for within-sheet refs; they only count toward `withinSheetRefs` in workload | LOW | Case-insensitive. Also handles the case where workbook name is explicitly spelled out. |
| Parser: workload metric counts | `totalFormulas`, `withinSheetRefs`, `crossSheetRefs`, `crossFileRefs` are shown in detail panel and are correctness signals | LOW | Counts must add up consistently. Pure function, easy to verify numerically. |
| Parser: named range extraction | Named ranges are parsed from `wb.Workbook.Names`; built-in ranges starting with `_xlnm.` must be skipped | LOW | Pure function `extractNamedRanges()`. Test name filtering, ref parsing, scope detection. |
| Parser: named range reference detection in formulas | Formulas that reference a named range name (not via `!` notation) must produce `namedRangeName` on the ref | MEDIUM | Regex-based. Must avoid matching function calls like `SUM(`. Test: formula contains named range name vs. function name match. |
| Graph: buildGraph produces nodes for every uploaded sheet | Each uploaded workbook sheet must appear as a node. No phantom nodes, no missing nodes. | LOW | Direct contract test. `buildGraph([wb]).nodes.length === totalSheets` |
| Graph: buildGraph produces edges for every detected reference | Each cross-sheet and cross-file reference must become an edge. | LOW | Can compare edges to references in the parsed sheet data. |
| Graph: edge kind classification | `internal` (same workbook), `cross-file` (both uploaded), `external` (not uploaded) must be assigned correctly | MEDIUM | Tests the three-way branch in `buildGraph()`. Requires fixtures with different relationship types. |
| Graph: hidden files exclude nodes and edges | When a file name is in `hiddenFiles`, its nodes must not appear and edges to/from it must collapse to a file-level node | MEDIUM | Pure function; test with `buildGraph(workbooks, 'graph', new Set(['FileA.xlsx']))` |
| Graph: overview mode produces one node per file | `buildGraph(workbooks, 'overview')` should produce exactly one node per uploaded workbook plus external file nodes | LOW | Correctness property test. |
| E2E: file upload via file input shows file in sidebar | The foundational UX flow. Upload → sidebar shows workbook name + sheet list | LOW | Playwright — set file on hidden input, check sidebar content |
| E2E: non-Excel file upload shows error message | Uploading a `.txt` or `.csv` shows the expected error in the sidebar | LOW | Playwright — verify error text: "Only Excel files (.xlsx, .xls, .xlsm, .xlsb) are supported." |
| E2E: graph renders nodes after upload | After upload, React Flow canvas must contain node elements | MEDIUM | Playwright — check for `.react-flow__node` elements post-upload |
| E2E: remove file clears it from sidebar and graph | Clicking the close button removes the workbook | LOW | Playwright |
| Error scenario: empty workbook (no sheets) | `parseWorkbook` on a workbook with zero sheets should return a WorkbookFile with empty `sheets: []` | LOW | SheetJS returns empty `SheetNames`; parser must handle gracefully |
| Error scenario: sheet with no formulas | A sheet that has data but no formulas should produce zero references and a workload of all zeros | LOW | Common case — most sheets in real workbooks have no formulas |
| Error scenario: formula with no external references | A formula like `=A1+B1` has no cross-sheet ref. Parser must not emit a reference for it. | LOW | Ensures REF_WITH_CELL_RE does not false-positive on simple formulas |

---

### Differentiators (Competitive Advantage)

Tests that go beyond the obvious and catch harder-to-find bugs. A suite with these has meaningfully higher confidence.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Parser: numeric external link index resolution | Excel stores external refs as `[1]`, `[2]` etc. The `buildExternalLinkMap()` resolves these to real filenames via XML inside the zip. Incorrect resolution produces wrong node identities. | HIGH | Requires constructing a mock `wb.files` object with fake rels XML, or using a real .xlsx fixture. Tests the `readFileEntry()` multiformat path (string, Uint8Array, CFB object). |
| Parser: case-insensitive self-reference detection | `Sheet1!A1` from a sheet named `sheet1` must be treated as within-sheet. Bug here silently adds phantom cross-sheet edges. | LOW | Edge case that's easy to miss. `selfSheet = sheetName.toLowerCase()` is the guard. |
| Parser: deduplication of references per formula | Multiple refs to the same (workbook, sheet) in one formula must produce ONE entry with all cells, not duplicate entries | MEDIUM | The `byTarget` map deduplicates by key. Verify `cells` array has multiple entries for a formula like `=Sheet2!A1 + Sheet2!B1` |
| Parser: named range self-exclusion (same-sheet) | If a named range points to the same sheet as the formula, it should be counted as `withinSheetRefs`, not `crossSheetRefs` | LOW | Easy to miss case in the named range detection path |
| Parser: named range vs function name disambiguation | A formula `=SUM(A1:B1)` must NOT match `SUM` as a named range even if there's a named range called `SUM`. The `(?!\()` lookahead prevents this. | LOW | Regression test for a subtle regex correctness property |
| Graph: normWb fuzzy matching | `[FileB.xlsx]` and `FileB.xlsx` and `fileb` must all resolve to the same canonical uploaded workbook. Bug here creates phantom external nodes for actually-uploaded files. | MEDIUM | Test `normWb()` directly if exported, or via `buildGraph()` with cross-file refs using bracket notation |
| Graph: degree counts (outgoingCount, incomingCount) | The count badges on nodes depend on these. Off-by-one here affects the UI display of "how connected" each sheet is. | LOW | Sum all outgoing and incoming per node after `buildGraph()`, verify against edges |
| Graph: named range intermediate node creation | When `showNamedRanges=true`, each named range ref must produce TWO edges (source→NR, NR→consumer) and one NR node. Off-by-one produces broken graph topology. | MEDIUM | Pure function test — verify node count +1 and edge count +2 per named range ref |
| Graph: grouped layout positions all nodes | `groupedLayout()` must not lose any node (every input node must appear in output). Position should not be `{x:0, y:0}` for all. | LOW | Property test: `result.length === input.length` and not all at origin |
| Graph: computeClusterNodes bounding box | Cluster width/height must encompass all member nodes. Off-by-one here causes visual clipping in the UI. | LOW | Math verification: `cluster.data.width >= maxX - minX` for each cluster |
| E2E: layout mode switching updates graph | Switching between Graph/Grouped/Overview in the toolbar must visibly change the node arrangement. Node count in Overview is N-files, not N-sheets. | MEDIUM | Playwright — click toolbar button, verify node count change |
| E2E: edge kind filter toggles hide/show edges | Toggling internal/cross-file/external/named-range in the filter bar must remove those edge types from the canvas | HIGH | Playwright — count `.react-flow__edge` elements before/after toggle |
| E2E: focus mode neighborhood computation | Clicking "Focus" on a node then adjusting hop depth must dim/hide non-neighbor nodes. Depth 2 should include neighbors-of-neighbors. | HIGH | Playwright — verify node opacity changes. Tests the BFS logic end-to-end. |
| E2E: hide/show file removes nodes from graph | Clicking eye icon on a file in the sidebar must cause its nodes to disappear from the canvas | MEDIUM | Playwright |
| E2E: detail panel appears on node click | Clicking a node must open a side panel showing workload metrics, edge breakdown, and Focus/Hide quick actions | MEDIUM | Playwright — click node, assert panel visible with expected fields |
| Error scenario: malformed XLSX (corrupt file) | Uploading a file that is not a valid XLSX (e.g., a renamed .txt) must show the error message, not crash | MEDIUM | Playwright — the try/catch in `parseWorkbook()` must produce the error UI state |
| Error scenario: formula with mixed quoted/unquoted refs | A formula containing both `'Sheet Name'!A1` (quoted, with space) and `Sheet2!B2` (unquoted) in the same cell must extract BOTH references correctly | MEDIUM | The regex handles both forms; this tests them coexisting in one formula string |
| Error scenario: circular reference (A→B→A) | While Excel itself handles circular refs, the graph must not crash or produce infinite loops. Since reference data comes from parsed formulas (not evaluated), cycles are possible in the edge data. | MEDIUM | Verify `buildGraph()` completes without hanging. BFS in focus mode must handle cycles (visited-set guard on `focusNeighborIds` computation). |
| Fixture strategy: programmatic .xlsx creation | All `.xlsx` test fixtures are created via SheetJS in fixture scripts (not committed binary blobs). This ensures fixtures are readable, diff-able, and reproducible. | MEDIUM | Depends on: ScriptRunner or `vitest globalSetup` to generate fixtures once. Key fixtures: (1) minimal cross-sheet, (2) external file ref with numeric index, (3) named ranges, (4) no-formula, (5) malformed/corrupt. |

---

### Anti-Features (Things to Deliberately NOT Test)

Tests that seem useful but create more problems than they solve for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Visual regression / screenshot diffing | React Flow graph positions are non-deterministic across runs (Dagre layout is stable, but node rendering timing varies). Screenshots will flicker and create false failures. The project explicitly deferred this. | Test DOM presence and count (nodes visible, edges visible) not pixel-level layout |
| Testing Dagre layout pixel positions | Exact x/y coordinates from Dagre are an internal implementation detail. Testing them makes layout improvements break tests. | Test properties: `position.x !== 0 || position.y !== 0` (nodes were positioned at all), not exact coordinates |
| Testing React Flow internal structure | Asserting on `.react-flow__viewport` transform values or internal RF state is brittle. RF may update class names or DOM structure. | Test visible user-facing elements: node labels, edge presence, panel content |
| Testing Tauri-specific behavior | The Tauri native wrapper is not a test-milestone concern. Playwright targets the Vite dev server, not the Tauri window. | Keep E2E focused on `localhost:5173`. Tauri integration test is a separate concern. |
| Mocking SheetJS internals | Mocking `XLSX.read()` to return canned data skips the actual parsing which is where bugs live. | Use programmatic fixture files + real `XLSX.read()` calls. Only mock `FileReader` in unit tests where a real File API isn't available. |
| Cross-browser E2E matrix | Windows desktop is the primary target. Multi-browser testing adds CI cost with minimal additional coverage for this app. | Run Playwright on Chromium only for this milestone. |
| Performance benchmarks | A 10,000-row Excel file parse time is a real concern but not this milestone's scope. | Note as a future concern. Add benchmark fixtures but defer assertions. |
| Testing every permutation of focus direction × depth | 3 depths × 3 directions = 9 combinations. Most combinations share the same BFS code path. | Test 2-3 representative combinations. Test BFS logic directly in a unit test for edge cases. |
| Testing React component rendering in isolation (JSDOM) | SheetJS uses `FileReader` and `ArrayBuffer` which have poor JSDOM support. React component tests for FilePanel/GraphView in JSDOM are fragile. | Use Playwright for UI tests. Use pure function unit tests for parser/graph (no DOM needed). |

---

## Feature Dependencies

```
[Fixture strategy: programmatic .xlsx creation]
    └──required by──> [Parser: numeric external link index resolution]
    └──required by──> [Parser: cross-sheet reference detection]
    └──required by──> [E2E: file upload via file input shows file in sidebar]
    └──required by──> [E2E: edge kind filter toggles hide/show edges]
    └──required by──> [E2E: focus mode neighborhood computation]

[Parser: cross-sheet reference detection]
    └──enables──> [Graph: buildGraph produces edges for every detected reference]
    └──enables──> [Graph: edge kind classification]

[Graph: edge kind classification]
    └──enables──> [E2E: edge kind filter toggles hide/show edges]

[Parser: named range extraction]
    └──requires──> [Parser: named range reference detection in formulas]
    └──enables──> [Graph: named range intermediate node creation]

[Graph: buildGraph produces nodes for every uploaded sheet]
    └──enables──> [E2E: graph renders nodes after upload]
    └──enables──> [E2E: layout mode switching updates graph]

[E2E: graph renders nodes after upload]
    └──enables──> [E2E: focus mode neighborhood computation]
    └──enables──> [E2E: detail panel appears on node click]
    └──enables──> [E2E: edge kind filter toggles hide/show edges]
```

### Dependency Notes

- **Fixture strategy is the critical path:** Nearly all tests that exercise real reference detection require at least one `.xlsx` fixture. Unit tests for `extractReferences()` can be driven from synthetic `XLSX.WorkSheet` objects, but the external link resolution tests need real zip-embedded XML — which means real (or programmatically generated) `.xlsx` files.
- **Graph tests depend on parser types but not parser execution:** `buildGraph()` takes `WorkbookFile[]` as input. Graph unit tests can construct this input manually without calling `parseWorkbook()`, so parser and graph unit tests are independent.
- **E2E tests depend on both parser and graph:** Playwright tests go through the full stack (file → parser → graph → UI), so they catch integration failures that unit tests miss.
- **Focus mode E2E requires a multi-node graph:** Focus mode is meaningless with one sheet. E2E fixtures must include workbooks with at least 2-3 cross-referencing sheets.

---

## MVP Definition (for the test milestone)

This is not a product MVP — it is the minimum test suite that constitutes "real coverage" for this milestone.

### Must Ship (non-negotiable for milestone completion)

- [x] Parser unit tests: cross-sheet detection, external ref detection, workload counts, self-ref skipping — all with synthetic WorkSheet inputs
- [x] Parser unit tests: named range extraction and filtering
- [x] Graph unit tests: `buildGraph()` node/edge counts, edge kind classification, `hiddenFiles` filtering
- [x] Graph unit tests: overview mode, grouped layout (node completeness property only)
- [x] Programmatic fixture script: generates at minimum 3 `.xlsx` files (simple cross-sheet, external ref, named range)
- [x] E2E: upload valid file → sidebar shows file → graph shows nodes
- [x] E2E: upload invalid file → error message shown
- [x] E2E: remove file → sidebar and graph clear

### Add After Core Unit Tests Are Stable

- [ ] Parser edge cases: deduplication, case-insensitive self-ref, mixed quoted/unquoted in same formula
- [ ] Graph edge cases: normWb fuzzy matching, degree counts, cluster bounding boxes
- [ ] E2E: layout mode switching, edge kind filter toggle
- [ ] E2E: detail panel content on node click
- [ ] Error scenario: corrupt file upload

### Future Consideration

- [ ] E2E: focus mode depth/direction interactions — high value but requires stable graph fixture with complex topology
- [ ] E2E: named range toggle — requires fixture with actual named ranges and a way to verify intermediate node appearance
- [ ] Circular reference handling — verify no hangs; lower priority since the app does not evaluate formulas

---

## Feature Prioritization Matrix

| Test Feature | User (Bug) Value | Implementation Cost | Priority |
|---|---|---|---|
| Parser: cross-sheet ref detection | HIGH | LOW | P1 |
| Parser: workload metric counts | HIGH | LOW | P1 |
| Graph: buildGraph node/edge output | HIGH | LOW | P1 |
| Graph: edge kind classification | HIGH | LOW | P1 |
| E2E: upload → graph renders | HIGH | LOW | P1 |
| E2E: invalid file → error | HIGH | LOW | P1 |
| Fixture: programmatic .xlsx creation | HIGH | MEDIUM | P1 |
| Parser: external link index resolution | HIGH | HIGH | P1 |
| Parser: named range extraction | MEDIUM | LOW | P2 |
| Graph: hidden files filtering | HIGH | LOW | P2 |
| Graph: overview mode | MEDIUM | LOW | P2 |
| E2E: layout mode switching | MEDIUM | MEDIUM | P2 |
| E2E: edge kind filter toggle | HIGH | MEDIUM | P2 |
| Graph: normWb fuzzy matching | HIGH | LOW | P2 |
| E2E: detail panel on node click | MEDIUM | MEDIUM | P2 |
| E2E: corrupt file → error | MEDIUM | LOW | P2 |
| Graph: named range intermediate nodes | MEDIUM | LOW | P3 |
| E2E: focus mode (BFS) | HIGH | HIGH | P3 |
| Graph: cluster bounding boxes | LOW | LOW | P3 |
| Parser: circular ref no-crash | MEDIUM | LOW | P3 |

**Priority key:**
- P1: Must have for milestone to be credible
- P2: Should have, add in same milestone after P1s are green
- P3: Nice to have, add if time allows or in a follow-up

---

## Sources

- Direct source analysis: `C:/Users/chase/projects/tangle/src/lib/parser.ts`
- Direct source analysis: `C:/Users/chase/projects/tangle/src/lib/graph.ts`
- Direct source analysis: `C:/Users/chase/projects/tangle/src/types.ts`
- Direct source analysis: `C:/Users/chase/projects/tangle/src/components/FilePanel/FilePanel.tsx`
- Direct source analysis: `C:/Users/chase/projects/tangle/src/components/Graph/GraphView.tsx`
- Project context: `C:/Users/chase/projects/tangle/.planning/PROJECT.md`
- No competitor test suite analysis applicable — this is bespoke domain logic

---
*Feature research for: Test suite coverage for Tangle (Excel reference visualizer)*
*Researched: 2026-02-27*
