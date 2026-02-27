# Phase 3: Graph Unit Tests - Research

**Researched:** 2026-02-27
**Domain:** Vitest unit testing of pure-TypeScript graph builder (`src/lib/graph.ts`)
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GRAPH-01 | `buildGraph()` creates exactly one node per uploaded sheet (standard layout mode) | `buildGraph()` in `graph.ts` iterates `visibleWorkbooks` in Pass 1 and registers each `sheetNodeId(wb.name, sheet.sheetName)` — count assertion is straightforward |
| GRAPH-02 | `buildGraph()` creates edges for each detected cross-sheet reference | Pass 2 in `buildGraph()` iterates `sheet.references` and creates entries in `edgesMap` — edge count assertion works against `edges.length` |
| GRAPH-03 | Edge kind classified correctly: `internal`, `cross-file`, `external`, `named-range` | `EdgeKind` type is exported; classification logic at lines 134–138 is testable by controlling `isSameWb` and `targetIsUploaded` via fixture topology |
| GRAPH-04 | Sheets from hidden files excluded from nodes and edges | `hiddenFiles` Set param to `buildGraph()` filters `visibleWorkbooks` at line 59–61 — pass non-empty Set and assert node/edge absence |
| GRAPH-05 | All three layout modes return non-empty node arrays with valid position coordinates | `applyLayout()` dispatches to `dagreLayout()` or `groupedLayout()`; overview handled separately by `buildOverviewGraph()`. Dagre confirmed to produce non-zero x/y in node env |
| GRAPH-06 | `buildOverviewGraph()` returns exactly one node per uploaded workbook | `buildOverviewGraph()` is called when `layoutMode === 'overview'` inside `buildGraph()` — but it is an unexported private function; test via `buildGraph(..., 'overview', ...)` |
| GRAPH-07 | Named range nodes appear with `showNamedRanges: true`, absent when `false` | `showNamedRanges` flag controls the `if (showNamedRanges && ref.namedRangeName)` branch at line 147 — straightforward boolean toggle test |
</phase_requirements>

---

## Summary

Phase 3 writes `tests/unit/graph.test.ts` covering all 7 GRAPH requirements. The target under test is `buildGraph()` from `src/lib/graph.ts` — a pure TypeScript function that takes `WorkbookFile[]` objects (no DOM, no file I/O) and returns `{ nodes, edges }`. This makes the test surface clean: construct `WorkbookFile` objects inline, call `buildGraph()`, assert the output shape.

The test infrastructure from Phase 1 is complete and working: Vitest 4.0.18 configured with `environment: 'node'`, `server.deps.inline: ['xlsx']`, and `globals: true`. The 22 existing parser tests all pass in 1.73 seconds. No new infrastructure is needed for Phase 3.

The three key dependencies (`@dagrejs/dagre`, `@xyflow/react`, `xlsx`) all load correctly in the node environment. Dagre produces non-zero positions for multi-node graphs. `MarkerType` from `@xyflow/react` is a plain enum object — no DOM required. The graph module imports are pure TypeScript with no browser-only APIs.

**Primary recommendation:** Write a single test file `tests/unit/graph.test.ts` using inline `WorkbookFile` fixture construction (no `.xlsx` files needed) and the existing Vitest node environment. No new packages, no config changes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 | Test runner | Already configured, all parser tests green |
| @dagrejs/dagre | ^2.0.4 | Layout engine (graph.ts dependency) | Already in production deps; must work in test env |
| @xyflow/react | ^12.10.1 | `MarkerType` enum (graph.ts dependency) | Already in production deps; no DOM needed for `MarkerType` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest (globals) | configured | `describe`, `it`, `expect` | Already enabled via `globals: true` |
| node:assert | built-in | Not needed — vitest expect is sufficient | N/A |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline `WorkbookFile` construction | Loaded `.xlsx` fixtures | Inline is simpler — `buildGraph()` takes `WorkbookFile[]`, not raw files; no SheetJS needed |
| Single test file | Multiple test files | 7 requirements map naturally to one file with one `describe` per requirement group |

**Installation:** No new packages required. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
tests/
└── unit/
    ├── parser.test.ts          # Phase 2 (done)
    ├── parser.error.test.ts    # Phase 2 (done)
    ├── parser.smoke.test.ts    # Phase 1 (done)
    └── graph.test.ts           # Phase 3 — NEW (single file covers GRAPH-01 through GRAPH-07)
```

### Pattern 1: Inline WorkbookFile Fixture Construction

**What:** Build `WorkbookFile` objects directly in TypeScript without reading `.xlsx` files. `buildGraph()` accepts `WorkbookFile[]` which is a plain TypeScript interface — no SheetJS dependency in tests.

**When to use:** All graph tests. `buildGraph()` does not accept files or buffers — it accepts already-parsed `WorkbookFile` objects. This is the correct and only approach.

**Example:**
```typescript
// No XLSX import needed — WorkbookFile is a plain TS interface
import type { WorkbookFile } from '../../src/types'
import { buildGraph } from '../../src/lib/graph'

function makeWorkbook(name: string, sheets: { sheetName: string; refs?: SheetReference[] }[]): WorkbookFile {
  return {
    id: name,
    name,
    namedRanges: [],
    sheets: sheets.map(({ sheetName, refs = [] }) => ({
      workbookName: name,
      sheetName,
      references: refs,
      workload: { totalFormulas: 0, withinSheetRefs: 0, crossSheetRefs: 0, crossFileRefs: 0 },
    })),
  }
}
```

### Pattern 2: Topology-Driven Test Cases

**What:** Design fixture topologies that exercise specific edge kinds and paths in `buildGraph()`. Topology A = two workbooks each with two sheets, one cross-sheet ref and one cross-file ref — covers GRAPH-01, GRAPH-02, GRAPH-03 in one setup.

**When to use:** Tests that need multiple edge kinds. Use `beforeAll` to build the fixture once, run multiple `it` assertions against it.

**Example topology for GRAPH-01 through GRAPH-03:**
```
WorkbookA.xlsx:
  Sheet1  →  [cross-sheet ref]  →  Sheet2      (internal edge)
  Sheet1  →  [cross-file ref]   →  WorkbookB.xlsx::Sheet1  (cross-file edge)

WorkbookB.xlsx (also uploaded):
  Sheet1  →  [external ref]  →  ExternalFile.xlsx::Data  (external edge)
```

**Reference construction for cross-sheet ref:**
```typescript
const crossSheetRef: SheetReference = {
  targetWorkbook: null,          // null = same workbook
  targetSheet: 'Sheet2',
  cells: ['A1'],
  formula: 'Sheet2!A1',
  sourceCell: 'A1',
}

const crossFileRef: SheetReference = {
  targetWorkbook: 'WorkbookB.xlsx',  // matches an uploaded workbook name
  targetSheet: 'Sheet1',
  cells: ['C3'],
  formula: '[WorkbookB.xlsx]Sheet1!C3',
  sourceCell: 'B1',
}

const externalRef: SheetReference = {
  targetWorkbook: 'ExternalFile.xlsx',  // NOT in the uploaded workbooks list
  targetSheet: 'Data',
  cells: ['D5'],
  formula: '[ExternalFile.xlsx]Data!D5',
  sourceCell: 'A1',
}
```

### Pattern 3: Named Range Reference Construction

**What:** Named range edges require `ref.namedRangeName` to be set on the `SheetReference`. When `showNamedRanges: true`, `buildGraph()` creates an intermediate NR node and two edges instead of one direct edge.

**Example:**
```typescript
const namedRangeRef: SheetReference = {
  targetWorkbook: null,
  targetSheet: 'Sheet2',
  cells: ['A1:A10'],
  formula: 'MyRange',
  sourceCell: 'A1',
  namedRangeName: 'MyRange',   // triggers NR node creation when showNamedRanges=true
}
```

### Pattern 4: Overview Mode Test (GRAPH-06)

**What:** `buildGraph()` with `layoutMode: 'overview'` calls the private `buildOverviewGraph()` function internally. The test calls `buildGraph()` with `'overview'` and asserts `nodes.length === workbooks.length`.

```typescript
it('GRAPH-06: overview mode returns one node per uploaded workbook', () => {
  const { nodes } = buildGraph([wbA, wbB], 'overview')
  // Only uploaded workbook nodes — external file nodes are added for cross-workbook refs
  // Filter to non-external nodes for the per-workbook assertion
  const uploadedNodes = nodes.filter(n => !n.data.isExternal)
  expect(uploadedNodes).toHaveLength(2)  // one per workbook
})
```

### Anti-Patterns to Avoid

- **Don't load `.xlsx` fixture files in graph tests:** `buildGraph()` takes `WorkbookFile[]` not files. Using SheetJS adds complexity with no benefit.
- **Don't test Dagre internals:** Test that positions are non-zero, not exact coordinate values. Dagre layout coordinates will change with node count changes.
- **Don't test `buildOverviewGraph()` directly:** It is not exported. Test via `buildGraph(..., 'overview', ...)`.
- **Don't use `// @vitest-environment jsdom`:** The graph module uses no DOM APIs. The parser error tests needed jsdom for `FileReader`; graph tests do not.
- **Don't use the word 'annotation' in test comments:** Triggers false `@vitest-environment` module resolution (discovered in Phase 2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fixture factory | Custom `WorkbookFile` builder per test | Shared `makeWorkbook()` helper at top of test file | Reduces boilerplate, prevents inconsistent `workload` null fields |
| Position validation | Manual coordinate checks | `expect(node.position.x).toBeGreaterThan(0)` | Dagre positions are deterministic but should not be hard-coded |
| Edge kind lookup | String matching in test output | `EdgeData.edgeKind` field directly | `EdgeKind` type is exported from `graph.ts` — use it |

**Key insight:** `buildGraph()` is a pure function with no side effects. Every test is: construct input → call function → assert output. No mocking, no async, no environment setup beyond the inline workbook factory.

## Common Pitfalls

### Pitfall 1: Asserting Exact Node Count Without Accounting for External File Nodes

**What goes wrong:** Test expects `nodes.length === 2` (one per sheet) but gets 3 because an external file node was created for a cross-workbook reference.

**Why it happens:** `buildGraph()` creates a file-level external node for any reference whose target workbook is not uploaded. GRAPH-01 says "one node per uploaded sheet" — external nodes are additional.

**How to avoid:** Separate assertions: `const uploadedSheetNodes = nodes.filter(n => !n.data.isExternal && !n.data.isFileNode)` for GRAPH-01. Or design the GRAPH-01 topology to have zero external refs (same-workbook only).

**Warning signs:** Node count in test is higher than `sheets.length`.

### Pitfall 2: Cross-File Edge Kind Requires Both Workbooks to Be Uploaded

**What goes wrong:** Test expects `edgeKind === 'cross-file'` but gets `'external'` because the target workbook name doesn't match an uploaded workbook.

**Why it happens:** `normWb()` normalizes names (lowercase, strip extension). If `targetWorkbook: 'FileB.xlsx'` but the uploaded workbook is named `'fileB.xlsx'`, normalization handles it — but if it's `'FileB'` (no extension), the match fails.

**How to avoid:** When constructing cross-file refs, use the EXACT same filename string as the uploaded workbook's `name` field. Or verify normalization behavior first.

**Warning signs:** `edgeKind` is `'external'` when you expected `'cross-file'`.

### Pitfall 3: Hidden Files — Node Resolution Uses ALL Workbooks, Not Just Visible

**What goes wrong:** Test hides FileB, then constructs a ref from FileA that targets FileB, and expects the edge to be absent — but the node resolution logic uses `normalizedWbName` built from ALL workbooks including hidden ones.

**Why it happens:** The `normalizedWbName` map is built from the full `workbooks` array, while `visibleWbNames` is built from `visibleWorkbooks`. A reference to a hidden workbook's sheet resolves to that sheet ID, but since the sheet is not visible, it falls back to a file-level node.

**How to avoid:** For GRAPH-04, the test should assert that nodes for the hidden workbook's SHEETS are absent. File-level external nodes for hidden workbooks may still appear in output (by design — they represent the data source). Check if this is the intended behavior by reading `buildGraph()` lines 116-132.

**Warning signs:** Hidden file test passes node count but fails edge assertion, or vice versa.

### Pitfall 4: Overview Mode and External File Nodes

**What goes wrong:** GRAPH-06 asserts `nodes.length === workbooks.length` but fails because a cross-workbook reference to an external (non-uploaded) file creates an additional external node.

**Why it happens:** `buildOverviewGraph()` creates external file nodes for unrecognized target workbooks (lines 421-440 in graph.ts).

**How to avoid:** Use `nodes.filter(n => !n.data.isExternal).length === workbooks.length` for the GRAPH-06 assertion. Or design the test topology to have no external refs in overview mode.

### Pitfall 5: Self-Edge Skip in buildGraph()

**What goes wrong:** GRAPH-02 edge count is off because a formula referencing the same sheet as the consumer generates a self-edge that gets skipped at line 132 (`if (dataSourceId === consumerId) continue`).

**Why it happens:** Self-sheet refs are filtered during `extractReferences()` as `withinSheetRefs`, but cross-sheet refs that happen to resolve to the same node ID are filtered at the edge-build stage.

**How to avoid:** Ensure fixture topologies have distinct source and target sheets.

### Pitfall 6: Named Range Node IDs

**What goes wrong:** GRAPH-07 assertion checks `nodes.some(n => n.data.isNamedRange)` but it returns false because the NR node was not created.

**Why it happens:** NR node creation requires BOTH `showNamedRanges: true` AND `ref.namedRangeName` being set on the `SheetReference`. If the test reference lacks `namedRangeName`, no NR node appears regardless of the flag.

**How to avoid:** Ensure test references have `namedRangeName` set, and verify the fixture passes it through.

## Code Examples

Verified patterns from source code analysis:

### Minimal Topology for GRAPH-01 and GRAPH-02 (same-workbook only)
```typescript
// Source: analysis of graph.ts lines 91-98 (Pass 1)
const wb = makeWorkbook('FileA.xlsx', [
  { sheetName: 'Sheet1', refs: [crossSheetRef] },
  { sheetName: 'Sheet2' },  // no refs
])

const { nodes, edges } = buildGraph([wb])

// GRAPH-01: exactly 2 sheet nodes (no external refs in this topology)
expect(nodes).toHaveLength(2)
// GRAPH-02: exactly 1 edge
expect(edges).toHaveLength(1)
// GRAPH-03: edge kind is 'internal' (same workbook)
expect(edges[0].data.edgeKind).toBe('internal')
```

### GRAPH-03 — All Four Edge Kinds
```typescript
// cross-file: both workbooks uploaded
const { edges: edges1 } = buildGraph([wbA, wbB])
const crossFileEdge = edges1.find(e => e.data.edgeKind === 'cross-file')
expect(crossFileEdge).toBeDefined()

// external: target workbook not in uploaded list
const { nodes: nodes2, edges: edges2 } = buildGraph([wbA])
const externalEdge = edges2.find(e => e.data.edgeKind === 'external')
expect(externalEdge).toBeDefined()

// named-range: requires showNamedRanges: true
const { edges: edges3 } = buildGraph([wbWithNR], 'graph', new Set(), true)
const nrEdge = edges3.find(e => e.data.edgeKind === 'named-range')
expect(nrEdge).toBeDefined()
```

### GRAPH-04 — Hidden Files
```typescript
// Source: analysis of graph.ts lines 59-61
const hiddenFiles = new Set(['FileB.xlsx'])
const { nodes, edges } = buildGraph([wbA, wbB], 'graph', hiddenFiles)

// FileB sheets should not appear as sheet nodes
const fileBSheetNodes = nodes.filter(
  n => n.data.workbookName === 'FileB.xlsx' && !n.data.isFileNode
)
expect(fileBSheetNodes).toHaveLength(0)

// Edges originating from FileB sheets should not appear
// (edges from FileA that TARGET FileB may appear as external-like nodes)
```

### GRAPH-05 — Layout Position Validation
```typescript
// Source: analysis of dagreLayout() in graph.ts lines 232-258
const { nodes } = buildGraph([wb1, wb2], 'graph')
for (const node of nodes) {
  expect(node.position.x).toBeGreaterThan(0)
  expect(node.position.y).toBeGreaterThan(0)
}
```

### GRAPH-05 — Grouped Layout
```typescript
// Source: analysis of groupedLayout() in graph.ts lines 260-363
// Grouped layout requires at least 2 workbooks to create inter-group edges
const { nodes: groupedNodes } = buildGraph([wbA, wbB], 'grouped')
expect(groupedNodes.length).toBeGreaterThan(0)
for (const node of groupedNodes) {
  expect(node.position.x).toBeGreaterThan(0)
  expect(node.position.y).toBeGreaterThan(0)
}
```

### GRAPH-07 — Named Range Toggle
```typescript
// Source: analysis of graph.ts lines 147-178
const wbWithNR = makeWorkbook('FileA.xlsx', [
  {
    sheetName: 'Sheet1',
    refs: [{
      targetWorkbook: null,
      targetSheet: 'Sheet2',
      cells: ['A1:A10'],
      formula: 'MyRange',
      sourceCell: 'A1',
      namedRangeName: 'MyRange',
    }],
  },
  { sheetName: 'Sheet2' },
])

// NR OFF
const { nodes: nodesOff } = buildGraph([wbWithNR], 'graph', new Set(), false)
expect(nodesOff.some(n => n.data.isNamedRange)).toBe(false)

// NR ON
const { nodes: nodesOn } = buildGraph([wbWithNR], 'graph', new Set(), true)
expect(nodesOn.some(n => n.data.isNamedRange)).toBe(true)
const nrNode = nodesOn.find(n => n.data.isNamedRange)
expect(nrNode?.data.namedRangeName).toBe('MyRange')
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest with JSDOM for all tests | Vitest with `environment: 'node'` | Phase 1 decision | No DOM setup needed; graph.ts has no DOM deps |
| Loading `.xlsx` files via SheetJS for graph tests | Inline `WorkbookFile` construction | Phase 3 design | Graph tests need no SheetJS; cleaner, faster |

**Exported from graph.ts (verified by code reading):**
- `buildGraph()` — the primary function under test
- `stripExcelExt()` — utility, not under test in this phase
- `computeClusterNodes()` — NOT under test (GRAPH requirements don't cover clusters)
- `NodeData`, `EdgeData`, `EdgeKind`, `LayoutMode` types — used in assertions
- `ClusterData` type — not needed

**Not exported (private):**
- `buildOverviewGraph()` — test via `buildGraph(..., 'overview', ...)`
- `applyLayout()`, `dagreLayout()`, `groupedLayout()` — test indirectly via `buildGraph()`

## Open Questions

1. **Does GRAPH-04 test expect edge exclusion or just node exclusion?**
   - What we know: `hiddenFiles` filters `visibleWorkbooks` before Pass 1. Edges are only built for visible workbooks in Pass 2. So edges FROM hidden sheets are excluded.
   - What's unclear: Edges TO hidden files may still appear as external edges (file-level node pointing to the hidden file). The GRAPH-04 requirement says "sheets' nodes and all their edges being absent" — this is about the hidden sheet's own nodes and edges, not about what other sheets reference.
   - Recommendation: Test that (a) no sheet-level node for the hidden workbook exists, and (b) no edge has `source` or `target` equal to a hidden sheet's node ID.

2. **GRAPH-05 grouped layout — does it require at least 2 workbooks to produce non-zero positions?**
   - What we know: `groupedLayout()` uses Dagre for inter-group positioning. With a single workbook, there are no inter-group edges.
   - What's unclear: Whether Dagre assigns non-zero positions to isolated nodes.
   - Recommendation: Use 2 workbooks for the grouped layout test to ensure inter-group edges drive positioning. Verified: Dagre assigns non-zero positions even to connected nodes (A and B both get non-zero x/y).

3. **Named range node and self-edge**
   - What we know: A named range ref with `targetSheet` matching the source sheet would be filtered as within-sheet. The NR node creation code at line 147 runs for any `ref.namedRangeName` that's truthy.
   - What's unclear: If named range target sheet equals source sheet, does `buildGraph()` skip the NR node or still create it?
   - Recommendation: Use a named range ref where `targetSheet` differs from the source sheet (e.g., Sheet1 has a named range pointing to Sheet2). This is the standard case.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (already exists) |
| Quick run command | `npm test` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAPH-01 | `buildGraph()` returns one node per uploaded sheet | unit | `npm test -- --reporter=verbose` | ❌ Wave 0: `tests/unit/graph.test.ts` |
| GRAPH-02 | `buildGraph()` returns correct edge count for known topology | unit | `npm test` | ❌ Wave 0: `tests/unit/graph.test.ts` |
| GRAPH-03 | Edge kinds: `internal`, `cross-file`, `external`, `named-range` | unit | `npm test` | ❌ Wave 0: `tests/unit/graph.test.ts` |
| GRAPH-04 | Hidden files → absent nodes and edges | unit | `npm test` | ❌ Wave 0: `tests/unit/graph.test.ts` |
| GRAPH-05 | All layout modes return non-empty nodes with non-zero positions | unit | `npm test` | ❌ Wave 0: `tests/unit/graph.test.ts` |
| GRAPH-06 | Overview mode returns one node per uploaded workbook | unit | `npm test` | ❌ Wave 0: `tests/unit/graph.test.ts` |
| GRAPH-07 | Named range nodes toggle with `showNamedRanges` flag | unit | `npm test` | ❌ Wave 0: `tests/unit/graph.test.ts` |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` all green before phase complete

### Wave 0 Gaps
- [ ] `tests/unit/graph.test.ts` — covers GRAPH-01 through GRAPH-07 (the entire phase output)

*(No config gaps — existing `vitest.config.ts` already includes `tests/unit/**/*.test.ts`)*

## Sources

### Primary (HIGH confidence)
- Direct source code reading — `src/lib/graph.ts` (635 lines, complete reading)
- Direct source code reading — `src/lib/parser.ts` (278 lines, complete reading)
- Direct source code reading — `src/types.ts` (46 lines, complete reading)
- Direct source code reading — `vitest.config.ts`, `package.json`
- Direct source code reading — `tests/unit/parser.test.ts`, `tests/unit/parser.error.test.ts`
- Runtime verification — Dagre node position output verified non-zero via node CLI
- Runtime verification — `@xyflow/react` MarkerType loads in node environment
- Runtime verification — existing 22 tests pass in 1.73s with `npm test`

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase 2 decisions about inline workbook construction and vitest environment directives
- `.planning/REQUIREMENTS.md` — requirement text for GRAPH-01 through GRAPH-07

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and verified working
- Architecture: HIGH — `buildGraph()` is a pure function; inline fixture pattern is proven from parser tests
- Pitfalls: HIGH — derived from direct reading of `buildGraph()` implementation, cross-referenced with Phase 2 decisions

**Research date:** 2026-02-27
**Valid until:** 2026-03-29 (30 days — stable codebase, no external API changes expected)
