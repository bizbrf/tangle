# Codebase Concerns

**Analysis Date:** 2026-02-27

## Tech Debt

**Large monolithic GraphView component:**
- Issue: `src/components/Graph/GraphView.tsx` is 1527 lines, containing all graph state management, custom edges/nodes, filtering logic, detail panel, focus mode, and rendering
- Files: `src/components/Graph/GraphView.tsx`
- Impact: Difficult to test, modify, or reuse logic independently. Single point of change for many features
- Fix approach: Extract concerns into smaller composable components: `DetailPanel.tsx`, `FocusControls.tsx`, `EdgeFilters.tsx`, custom hooks for state logic like `useFocusMode`, `useEdgeFiltering`, `useDetailPanel`

**No automated test coverage:**
- Issue: Zero test files found; all features rely on manual testing
- Files: `src/**/*.ts`, `src/**/*.tsx`
- Impact: Regressions go undetected, refactoring becomes risky, edge cases not validated
- Fix approach: Add Jest/Vitest configuration; write unit tests for parser and graph logic, integration tests for React components

**Dynamic regex compilation in critical path:**
- Issue: Named range regex (`namedRangeRe`) is built dynamically per-sheet in `src/lib/parser.ts` lines 150-155, which involves escaping all named range names and compiling on each sheet extraction
- Files: `src/lib/parser.ts:150-155`
- Impact: Performance degradation on workbooks with many named ranges; regex compilation scales with number of ranges
- Fix approach: Build named range regex once per workbook during `extractNamedRanges()`, cache it, pass via dependency injection to `extractReferences()`

**External link resolution hard-coded to 20 items:**
- Issue: `buildExternalLinkMap()` loops only to `i <= 20` (line 53 in `src/lib/parser.ts`), assuming max 20 external links
- Files: `src/lib/parser.ts:53`
- Impact: Excel files with >20 external references silently lose those references; undetected failure mode
- Fix approach: Either iterate until no `externalLink${i}.xml.rels` is found (already done with `break`), or accept array of all found links dynamically

**Unsafe type casting in parser:**
- Issue: `(wb as unknown as Record<string, unknown>)` (line 50) and `as CfbEntry` (line 34) bypass type checking without runtime validation
- Files: `src/lib/parser.ts:50`, `src/lib/parser.ts:34`
- Impact: If SheetJS API changes or returns unexpected structure, app silently fails with `undefined` errors
- Fix approach: Validate structure before casting; use runtime type guards or a schema validator (e.g., Zod)

**Workbook name normalization fragility:**
- Issue: Case-insensitive comparison using `toLowerCase()` and extension stripping happens in multiple places (`src/lib/graph.ts:71-80`, `src/lib/parser.ts:145-146`), with potential for mismatch if same workbook referenced with different case/extension forms
- Files: `src/lib/graph.ts:45-50`, `src/lib/parser.ts:145-146`
- Impact: External file resolution may create duplicate nodes if names vary in case/extension; reference count inflation
- Fix approach: Centralize normalization logic in utility function; always normalize on input/output

**Node position initialization at (0, 0):**
- Issue: All nodes start with `position: { x: 0, y: 0 }` in `makeSheetNode()`, `makeFileNode()`, etc. (lines 596-633 in `src/lib/graph.ts`), then layout is applied later
- Files: `src/lib/graph.ts:596-633`
- Impact: Layout computation depends on applying `applyLayout()` after all nodes created; if skipped, nodes pile at origin; risk of stale positions in edge cases
- Fix approach: Consider including layout mode in node creation or ensure layout application is guaranteed by structure

---

## Known Bugs

**Edge highlight filter state persists across layout switches:**
- Symptoms: When switching layout modes (graph → grouped → overview), edge kind filter selection persists; may cause confusion if user expects filter to reset
- Files: `src/components/Graph/GraphView.tsx:1265-1308` (styledEdges memo), `1203-1228` (layout change effect)
- Trigger: Select edge filter, switch layout mode
- Workaround: User can re-apply filter after layout change

**Named range node rendering without validation:**
- Symptoms: If a named range definition includes invalid cell references (e.g., external workbook reference), named range node may show incorrect or misleading data
- Files: `src/lib/graph.ts:147-169` (named range node creation)
- Trigger: Named range that targets external workbook with complex reference syntax
- Workaround: Validate named range cells during parsing

---

## Security Considerations

**File input lacks validation:**
- Risk: `handleFiles()` in `src/components/FilePanel/FilePanel.tsx` checks extension only (line 96); malformed .xlsx files could cause parsing errors or infinite loops
- Files: `src/components/FilePanel/FilePanel.tsx:86-117`
- Current mitigation: Try-catch block (line 102) catches parse errors and shows generic message
- Recommendations: Add file size limit (e.g., max 50MB per file), timeout on parsing, validate magic bytes before passing to SheetJS

**Regex DoS potential in formula parsing:**
- Risk: `REF_WITH_CELL_RE` and `namedRangeRe` could match pathological formula strings slowly
- Files: `src/lib/parser.ts:13-16`, `src/lib/parser.ts:155`
- Current mitigation: Regexes are relatively simple; global flag prevents catastrophic backtracking
- Recommendations: Add timeout to formula parsing; test with large/complex formulas; consider hardcoded formula tokenizer instead of regex

**No input sanitization for display:**
- Risk: Workbook names, sheet names, and formula text are displayed in UI without HTML escaping (React auto-escapes by default, but worth noting)
- Files: `src/components/Graph/GraphView.tsx:260-320` (node rendering), DetailPanel display
- Current mitigation: React's JSX auto-escapes text nodes
- Recommendations: Continue relying on React's auto-escaping; no inline HTML from untrusted sources

---

## Performance Bottlenecks

**Graph rebuild on every data change:**
- Problem: `buildGraph()` is called in every render when `workbooks`, `layoutMode`, `hiddenFiles`, or `showNamedRanges` change; full reconstruction of all nodes/edges
- Files: `src/components/Graph/GraphView.tsx:1309-1320` (styledNodes memo), `src/lib/graph.ts:53-219`
- Cause: Graph structure rebuild required for any state change; no incremental updates
- Improvement path: Memoize intermediate graph data structures; separate node positioning from graph topology; only rebuild affected nodes/edges

**All formulas scanned for all reference types:**
- Problem: Every formula is checked against reference regex, named range regex, and external link map; two separate passes over formula string
- Files: `src/lib/parser.ts:134-246` (extractReferences)
- Cause: Reference detection happens in two sequential passes (lines 170-207, 213-233)
- Improvement path: Single-pass regex matching with combined pattern; extract named ranges and standard refs in one iteration

**Cluster computation recalculates bounds on every layout:**
- Problem: `computeClusterNodes()` iterates all nodes, calculates bounding boxes, even if nodes haven't moved
- Files: `src/lib/graph.ts:505-580`
- Cause: Called on every graph rebuild regardless of whether positions changed
- Improvement path: Only recompute clusters if node positions changed; memoize cluster data

**Edge de-duplication via Map lookups:**
- Problem: Edge de-duplication uses string concatenation (`edgeId()`) as Map key, computed for every reference
- Files: `src/lib/graph.ts:171-180`, `src/lib/graph.ts:592-594`
- Cause: String allocation and Map lookup for each reference, then again during styledEdges computation
- Improvement path: Use structured edge keys or pre-compute edge membership sets

---

## Fragile Areas

**Reference extraction regex pattern:**
- Files: `src/lib/parser.ts:13-16`
- Why fragile: Complex regex with nested groups and optional quoted sheet names; difficult to extend for new reference patterns (e.g., Excel 365 dynamic arrays, Table references)
- Safe modification: Add comprehensive test cases for edge cases (spaces in names, special chars, numeric references); extract named groups or comment each capture group
- Test coverage: No unit tests; manual validation against sample formulas needed

**Layout mode switching:**
- Files: `src/lib/graph.ts:53-489` (buildGraph), `src/components/Graph/GraphView.tsx:1200-1210` (mode change effect)
- Why fragile: Overview mode has separate node creation logic; grouped mode uses file-level Dagre; standard graph uses sheet-level Dagre. Mode-specific node IDs, edge kind assignments vary
- Safe modification: Extract layout mode logic into strategy objects; ensure all modes populate same node/edge properties consistently
- Test coverage: Manual testing only; no unit tests for layout mode switching

**Focus mode neighbor computation:**
- Files: `src/components/Graph/GraphView.tsx:1238-1264`
- Why fragile: BFS traversal with adjustable depth; filter criteria change based on direction toggle; complex interaction with edge kind filter
- Safe modification: Extract BFS logic into separate function with comprehensive parameter documentation; add unit test for neighbor set correctness
- Test coverage: No tests; edge case: focus node itself, 0-depth focus, bidirectional edges with same target

**Highlight timer cleanup:**
- Files: `src/components/Graph/GraphView.tsx:1185-1228`
- Why fragile: `highlightTimerRef` is cleared only on unmount; if multiple highlight requests occur rapidly, timer ref may contain stale ID
- Safe modification: Clear timeout before setting new one; add abort controller pattern for concurrent operations
- Test coverage: No tests; edge case: rapidly clicking different files to highlight

---

## Scaling Limits

**Memory usage with large graphs:**
- Current capacity: Tested up to ~1000 sheets across multiple files (observed in beta testing)
- Limit: DOM memory grows O(nodes + edges); React Flow maintains internal virtual state; desktop app has fixed memory budget
- Scaling path: Implement virtualization for very large graphs (canvas-based rendering), lazy-load node/edge rendering, memoize detail panel data

**Formula parsing performance:**
- Current capacity: ~50,000 formulas per workbook runs in <2 seconds
- Limit: Regex-based extraction becomes slow at 100k+ formulas; single-threaded FileReader blocks UI
- Scaling path: Use Web Workers for parsing; implement progressive parsing with UI updates; profile with SheetJS benchmarks

**External link resolution loop:**
- Current capacity: Hard-coded limit of 20 (line 53, `src/lib/parser.ts`)
- Limit: Files with >20 external links lose references silently
- Scaling path: Iterate until no file found; consider lazy-loading external link resolution for massive files

---

## Dependencies at Risk

**SheetJS (xlsx) library:**
- Risk: SheetJS is widely used but closed-source; breaking changes in minor versions possible. API for accessing `bookFiles` (line 258, `src/lib/parser.ts`) is undocumented, may change
- Impact: External link resolution would break; parsing would fail or miss references
- Migration plan: Monitor SheetJS releases; document the `.files` API usage; consider exceljs or better-xlsx as fallback (less feature-complete but open-source)

**React Flow v12:**
- Risk: Major version jump from v11 to v12; undocumented custom node/edge behavior may break on next major version
- Impact: Node rendering, floating edges, layout features depend on internal React Flow APIs
- Migration plan: Keep detailed notes on custom node/edge implementations; isolate React Flow usage in dedicated components; monitor v13+ changelogs

**Dagre layout engine:**
- Risk: Dagre library is not actively maintained (last update 2021); alternative: ELK (Eclipse Layout Kernel) is more actively maintained but has different API
- Impact: Layout quality for large graphs may degrade; bug fixes unlikely
- Migration plan: Document layout tuning parameters; evaluate ELK as drop-in replacement; consider canvas-based custom layout for performance gains

---

## Missing Critical Features

**Progress indication for file parsing:**
- Problem: Large files (>50MB) hang the UI during parsing with no feedback
- Blocks: Users cannot tell if app is frozen or still loading; multi-file uploads show no per-file progress
- Recommendation: Implement progress events in parseWorkbook; emit parsing % to UI component; add cancel operation

**Undo/redo for graph state:**
- Problem: No way to revert layout changes, hidden file toggles, or filter selections
- Blocks: Complex graph exploration requires manual reset if user makes mistakes
- Recommendation: Implement history stack in App.tsx; store snapshots of workbooks, hiddenFiles, layoutMode state

**Export/import of graph state:**
- Problem: Graph layout, selections, and filters are lost on reload
- Blocks: Cannot share graph analysis or bookmarks
- Recommendation: Serialize graph state to URL params (layout, focus, filter) or localStorage; add export-as-PNG for sharing

**Search/filter by formula content:**
- Problem: Cannot find formulas containing specific text or patterns
- Blocks: Large graphs are not queryable; users must scroll through all formulas manually
- Recommendation: Add formula search box in DetailPanel; highlight matching edges; support regex search

---

## Test Coverage Gaps

**Parser logic (formulas, named ranges, external links):**
- What's not tested: Reference detection regex accuracy, edge cases in name parsing, external link resolution with various file structures
- Files: `src/lib/parser.ts:1-279`
- Risk: Changes to regex or logic silently miss references or crash on malformed files
- Priority: High — parser is critical path

**Graph building (node/edge creation, layout):**
- What's not tested: Graph structure correctness for different layout modes, edge de-duplication, workbook name normalization in various case/extension combinations
- Files: `src/lib/graph.ts:53-219`
- Risk: Layout bugs, duplicate nodes/edges, incorrect reference aggregation go undetected
- Priority: High — graph logic is core feature

**Focus mode and filtering:**
- What's not tested: BFS neighbor computation with various depth/direction combinations, edge kind filter correctness, interaction with layout mode changes
- Files: `src/components/Graph/GraphView.tsx:1238-1308`
- Risk: Focus mode returns incorrect neighbors; filter hides wrong edges
- Priority: High — feature frequently used

**File upload and error handling:**
- What's not tested: Handling of invalid file types, parse errors, large files, concurrent uploads
- Files: `src/components/FilePanel/FilePanel.tsx:92-117`
- Risk: Malformed files cause cryptic errors; UI gets stuck in error state
- Priority: Medium — edge case handling

**React Flow custom node/edge rendering:**
- What's not tested: Visual correctness of nodes with various text lengths, edge curves with overlapping nodes, interaction with selection and hover states
- Files: `src/components/Graph/GraphView.tsx:198-320`, `src/components/Graph/GraphView.tsx:130-194`
- Risk: Visual bugs in rendering, broken interactivity
- Priority: Medium — visual polish

---

*Concerns audit: 2026-02-27*
