# Tangle — Architecture Overview

This document describes the high-level architecture of Tangle: the data flow from file upload to rendered graph, the module boundaries, and the key design decisions.

---

## Table of contents

1. [High-level data flow](#high-level-data-flow)
2. [Module map](#module-map)
3. [Key types](#key-types)
4. [Parsing pipeline](#parsing-pipeline)
5. [Graph build pipeline](#graph-build-pipeline)
6. [React component tree](#react-component-tree)
7. [URL state persistence](#url-state-persistence)
8. [Error taxonomy](#error-taxonomy)
9. [Filename handling](#filename-handling)

---

## High-level data flow

```
 User drops / selects .xlsx files
           │
           ▼
  FilePanel.handleFiles()
    ├─ parseWorkbook()  ──► WorkbookFile[]
    └─ resolveCollision()   (storageName deduplication)
           │
           ▼
  App state: workbooks: WorkbookFile[]
           │
           ▼
  GraphView (ReactFlow canvas)
    ├─ buildGraph()  ──────► nodes + edges
    ├─ layout algorithm     (dagre / grouped / overview)
    └─ ReactFlow render
```

Everything is **client-side only** — no data ever leaves the browser.

---

## Module map

```
src/lib/
  identity.ts          Canonical normalization & ID construction
                        normalizeWorkbookName(), makeSheetId(), makeEdgeId(), makeFileId()
  filenameSanitizer.ts OS-safe filename sanitization + collision resolution
  parser.ts            Excel → WorkbookFile (SheetJS wrapper)
  resolver.ts          Reference resolution helpers (named ranges, tables, cross-file links)
  graph.ts             Graph data model + layout (buildGraph, reorganizeLayout, computeClusterNodes)

src/components/
  FilePanel/
    FilePanel.tsx       Upload zone + file/sheet list sidebar

  Graph/
    GraphView.tsx       Main ReactFlow orchestration component
    hooks/
      useUrlGraphState.ts      URL-persisted graph control state (view, direction, grouping, fit)
      useFocusNeighborhood.ts  Focus mode BFS — computes N-hop neighbor set
    Toolbar.tsx         View / direction / grouping / fit controls
    DetailPanel.tsx     Right-side node + edge inspector
    SheetNode.tsx       Custom node renderer
    ClusterNode.tsx     Workbook cluster bounding box
    WeightedEdge.tsx    Custom edge renderer (thickness scales with refCount)
    EdgeKindFilterBar.tsx  Per-kind edge visibility toggles
    Legend.tsx          Edge colour legend
    edge-helpers.ts     Edge colour and stroke-width utilities
    constants.ts        Design tokens (colours, sizes)

  ui/
    TangleLogo.tsx
```

---

## Key types

Defined in `src/types.ts`:

| Type | Purpose |
|------|---------|
| `WorkbookFile` | Parsed workbook with identity fields (`name`, `originalName`, `storageName`), sheets, named ranges, and tables |
| `ParsedSheet` | One worksheet: `references[]` + `workload` metrics |
| `SheetReference` | Single cross-sheet / cross-file formula reference |
| `NamedRange` | Excel named range definition |
| `ExcelTable` | Excel structured table definition |
| `ParseError` | Structured parse failure (see [Error taxonomy](#error-taxonomy)) |
| `FormulaRefError` | Formula-level reference issue (missing table, circular dep, …) |
| `NodeData` / `EdgeData` | ReactFlow node/edge data payloads (defined in `src/lib/graph.ts`) |

### WorkbookFile identity fields

| Field | Meaning |
|-------|---------|
| `id` | Stable UUID assigned at import time |
| `name` | Canonical internal key — equals `storageName` after collision resolution. Used for node IDs, hide/highlight state, reference resolution. |
| `originalName` | Raw `File.name` from the browser — displayed in the sidebar |
| `storageName` | Sanitized, OS-safe name (may differ from `originalName` for unusual filenames) |

---

## Parsing pipeline

`parseWorkbook(file, fileId)` in `src/lib/parser.ts`:

1. Read the file as `ArrayBuffer` via `FileReader`.
2. Decode with SheetJS (`XLSX.read`). On failure, throw `ParseError` with `kind: 'MALFORMED_WORKBOOK'`.
3. `buildExternalLinkMap(wb)` — resolve `[1]`, `[2]`, … Excel external link indices to filenames by reading `xl/externalLinks/_rels/` entries.
4. `extractNamedRanges(wb)` — parse `wb.Workbook.Names` into `NamedRange[]`.
5. `extractTables(wb)` — scan each sheet's `!tables` metadata into `ExcelTable[]`.
6. For each sheet: `extractReferences(sheet, …)` — scan every cell formula with regex to find cross-sheet / cross-file / named-range / table references.
7. Return a `WorkbookFile` with `name = originalName` and `storageName = sanitizeFilename(originalName)`.

After parsing, `FilePanel.handleFiles` calls `resolveCollision` to ensure `storageName` and `name` are unique across already-loaded workbooks and the current batch.

---

## Graph build pipeline

`buildGraph(workbooks, layoutMode, …)` in `src/lib/graph.ts`:

1. Filter out hidden workbooks.
2. Build a `normalizedWbName` map (via `normalizeWorkbookName` from `identity.ts`) for fuzzy cross-file reference matching.
3. **Pass 1** — create a `Node` for every visible sheet.
4. **Pass 2** — iterate all sheet references; for each reference create or accumulate an `Edge` keyed by `makeEdgeId(dataSourceId, consumerId)`.
   - Edge direction: `dataSource → consumer` (dependency → dependent).
   - `edgeKind` is one of `'internal' | 'cross-file' | 'external' | 'named-range' | 'table'`.
5. Layout: dispatch to `dagreLayout`, `groupedLayout`, or `byTableLayout` depending on `layoutMode` / `groupingMode`.
6. For overview mode, `buildOverviewGraph` collapses all sheets into one file-level node per workbook.

### ID conventions (all from `src/lib/identity.ts`)

| ID type | Format |
|---------|--------|
| Sheet node | `{workbookName}::{sheetName}` |
| File node | `[file]{workbookName}` |
| Edge | `{sourceId}->{targetId}` |

---

## React component tree

```
App
├── FilePanel
│   └── (file list items)
└── GraphView (wrapped in ReactFlowProvider)
    └── GraphViewInner
        ├── useUrlGraphState()       ← URL-persisted control state
        ├── useFocusNeighborhood()   ← focus mode BFS
        ├── ReactFlow
        │   ├── SheetNode (×N)
        │   ├── ClusterNode (×M, grouped modes only)
        │   ├── WeightedEdge (×K)
        │   ├── Background / Controls / MiniMap
        ├── Toolbar
        ├── EdgeKindFilterBar
        ├── Legend
        ├── Focus mode controls
        └── DetailPanel
```

---

## URL state persistence

`useUrlGraphState` (in `src/components/Graph/hooks/useUrlGraphState.ts`) reads initial state from the URL search string on mount and writes back on every state change via `window.history.replaceState`.

| Parameter | Values |
|-----------|--------|
| `view` | `graph` \| `overview` |
| `dir` | `LR` \| `TB` |
| `group` | `off` \| `by-type` \| `by-table` |
| `fit` | `true` \| `false` |

This allows users to share or bookmark a specific view configuration.

---

## Error taxonomy

### Workbook-level parse errors (`ParseError` in `src/types.ts`)

| `kind` | Meaning |
|--------|---------|
| `UNSUPPORTED_FILE` | Extension / format not supported |
| `MALFORMED_WORKBOOK` | SheetJS could not decode the file |
| `FORMULA_PARSE_ERROR` | Unexpected error during formula scanning |
| `EXTERNAL_LINK_RESOLVE_ERROR` | External-link index entry could not be resolved |
| `FILE_READ_ERROR` | `FileReader` failed to read the raw bytes |

`ParseError` extends `Error` and carries `kind`, `workbook`, optional `sheet`, and `cause` fields.

### Formula-level reference errors (`FormulaRefError` in `src/types.ts`)

| `kind` | Meaning |
|--------|---------|
| `MISSING_TABLE` | Referenced table name not found |
| `MISSING_COLUMN` | Referenced column not found in table |
| `AMBIGUOUS_NAME` | Name matches multiple tables or named ranges |
| `CIRCULAR_DEP` | Circular dependency detected |
| `INVALID_REF` | Reference token could not be parsed |

---

## Filename handling

The flow from raw `File.name` to the stable internal key:

```
File.name  ──► sanitizeFilename()  ──► storageName (OS-safe)
                                            │
                                   resolveCollision()
                                            │
                                     unique storageName
                                            │
                              name = storageName (canonical key)
```

`sanitizeFilename` and `resolveCollision` are implemented in `src/lib/filenameSanitizer.ts`. The sanitized, collision-resolved name is used as the `name` field on `WorkbookFile`, which is the key used for:

- React Flow node IDs (`makeSheetId(wb.name, sheetName)`)
- Hide/highlight state sets in `App.tsx`
- Cross-file reference resolution in `graph.ts`
