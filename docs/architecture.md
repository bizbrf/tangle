# Tangle Architecture

This document describes the high-level architecture of Tangle: how Excel files are parsed, how the dependency graph is built, and how the React layer renders and interacts with it.

---

## Contents

1. [Overview](#overview)
2. [Data flow](#data-flow)
3. [Layer responsibilities](#layer-responsibilities)
4. [Key data structures](#key-data-structures)
5. [Graph modes](#graph-modes)
6. [State management](#state-management)
7. [CI/CD pipeline](#cicd-pipeline)

---

## Overview

Tangle is a **fully client-side** application. No data ever leaves the user's browser or desktop.

```
User drops .xlsx files
        |
        v
  FilePanel (React)
        |  File API (ArrayBuffer)
        v
   parser.ts  -->  filenameSanitizer.ts (validation, collision resolution)
        |  WorkbookFile[]
        v
   graph.ts
        |  nodes[], edges[], layout positions
        v
   GraphView (React / React Flow)
        |
        v
  Interactive graph in browser
```

---

## Data flow

### Step 1 — File ingestion (`FilePanel.tsx`)

The user drops or selects one or more `.xlsx` files. `FilePanel` reads each file as an `ArrayBuffer` using the browser `File` API and calls `parseWorkbook()`.

Before parsing, `handleFiles` runs **collision resolution** using `resolveStorageName()` from `filenameSanitizer.ts` to ensure every loaded file has a unique, sanitized internal name (`WorkbookFile.name`). The raw file name is preserved in `WorkbookFile.originalName` for display purposes.

### Step 2 — Excel parsing (`parser.ts`)

`parseWorkbook(buffer, name)` uses **SheetJS** (`xlsx`) to decode the workbook and returns a `WorkbookFile`:

- Iterates every worksheet; for each cell it inspects formulas.
- Classifies each formula reference into one of: cross-sheet, cross-file, external (file not uploaded), named range, or table (structured reference).
- Extracts named range definitions and Excel table definitions.
- Returns structured `ExcelSheet[]` and `SheetReference[]` arrays.

All work is synchronous and runs on the main thread (Web Worker migration is a future improvement).

### Step 3 — Graph construction (`graph.ts`)

`buildGraph(workbooks, options)` translates `WorkbookFile[]` into React Flow nodes and edges:

- One **SheetNode** per worksheet.
- One **ClusterNode** per workbook (used in `grouped` layout mode).
- One **WeightedEdge** per unique (`source`, `target`, `kind`) triple; the edge weight reflects how many cell references share that connection.
- Layout positions are computed by **Dagre** (`@dagrejs/dagre`). Inputs are sorted lexicographically to ensure deterministic output.

`buildOverviewGraph(workbooks, options)` produces a condensed view with one node per uploaded file.

### Step 4 — React rendering (`GraphView.tsx`)

React Flow renders the nodes and edges. `GraphView` manages:

- URL-based persistence of toolbar state (view mode, direction, layout direction).
- Focus-mode neighborhood calculation (BFS up to *n* hops from the selected node).
- Edge kind filtering (show/hide specific reference categories).
- `fit-to-bounds` behavior after layout changes.

---

## Layer responsibilities

### Parsing layer — `src/lib/parser.ts`

| Responsibility | Key export |
|---------------|-----------|
| Decode an `ArrayBuffer` into a `WorkbookFile` | `parseWorkbook(buffer, name)` |
| Extract cross-sheet and cross-file formula references | (internal) |
| Resolve external workbook links from the `xl/externalLinks/` part | (internal) |
| Parse structured references (`Table[Column]`, `[@Column]`) | `parseStructuredRefsCached()` |
| Extract named range definitions | (internal) |
| Extract Excel table definitions | (internal) |

The parser makes **no assumptions about the React layer**. It is a pure function that takes raw bytes and returns typed objects.

### Graph construction layer — `src/lib/graph.ts`

| Responsibility | Key export |
|---------------|-----------|
| Build full node/edge graph from parsed workbooks | `buildGraph(workbooks, options)` |
| Build condensed overview graph (one node per file) | `buildOverviewGraph(workbooks, options)` |
| Compute Dagre layout positions | (internal, wraps `@dagrejs/dagre`) |
| Aggregate edge weights | (internal) |

Graph construction is **pure** — same inputs produce the same output. Nodes and edges are sorted before layout to guarantee determinism.

### Reference resolution layer — `src/lib/resolver.ts`

| Responsibility | Key export |
|---------------|-----------|
| Resolve which sheet a formula reference points to | `resolveReference()` |
| Detect reference cycles | `detectCycles()` |
| Topological sort of sheets | `topoSort()` |
| Propagate renames across references | `propagateRename()` |

### Filename sanitization — `src/lib/filenameSanitizer.ts`

| Responsibility | Key export |
|---------------|-----------|
| Sanitize a raw filename for safe internal use | `sanitizeFilename(name)` |
| Resolve a storage name and avoid collisions | `resolveStorageName(name, existing)` |
| NFC-normalize Unicode, strip illegal characters, protect reserved names | (internal) |

### Shared types — `src/types.ts`

Single source of truth for all shared interfaces:

| Type | Purpose |
|------|---------|
| `WorkbookFile` | One uploaded workbook: sheets, named ranges, tables, and identity fields |
| `ExcelSheet` | One worksheet: name, formulas, reference counts |
| `ExcelTable` | Excel table definition |
| `SheetReference` | A directed reference edge between two sheets |
| `ReferenceKind` | Enum: `cross-sheet`, `cross-file`, `external`, `named-range`, `table` |

### React components — `src/components/`

```
src/components/
  FilePanel/
    FilePanel.tsx          # Sidebar: upload zone, per-file controls, sheet list
  Graph/
    GraphView.tsx          # React Flow wrapper: layout, focus mode, URL state
    Toolbar.tsx            # View mode, direction, grouping, fit toggles
    EdgeKindFilterBar.tsx  # Per-kind edge visibility toggles
    DetailPanel.tsx        # Node/edge inspector: formula list, workload grid
    SheetNode.tsx          # Custom React Flow node for a worksheet
    ClusterNode.tsx        # Custom React Flow node for a workbook group boundary
    WeightedEdge.tsx       # Custom React Flow edge with weight badge
    Legend.tsx             # Color legend for edge kinds
    EmptyState.tsx         # Placeholder when no files are loaded
    constants.ts           # Edge color palette and other UI constants
    edge-helpers.ts        # Edge style utilities
  ui/
    TangleLogo.tsx         # Logo component
```

`src/lib/` modules have **no React dependencies**. Only `src/components/` files import from React.

---

## Key data structures

### `WorkbookFile`

```ts
interface WorkbookFile {
  id: string;           // Stable UUID assigned on import
  name: string;         // Canonical internal identifier (sanitized, collision-resolved)
  originalName: string; // Raw filename as uploaded (for UI display)
  sheets: ExcelSheet[];
  namedRanges: NamedRange[];
  tables: ExcelTable[];
}
```

`name` is used as the key for node IDs, hidden-file sets, and reference resolution. It must remain stable for the lifetime of a session.

### `SheetReference`

```ts
interface SheetReference {
  sourceWorkbook: string;  // WorkbookFile.name
  sourceSheet: string;
  targetWorkbook: string;  // WorkbookFile.name (may be external)
  targetSheet: string;
  kind: ReferenceKind;
  formulas: FormulaEntry[];
}
```

### Graph node ID format

Sheet node IDs follow the pattern `<workbookName>::<sheetName>`. This guarantees uniqueness across multiple uploaded workbooks without requiring a UUID lookup.

---

## Graph modes

The toolbar lets the user switch between three layout modes:

| Mode | Node per | Edges shown | Dagre graph type |
|------|----------|-------------|-----------------|
| **Graph** | Worksheet | All reference kinds | `digraph` with `LR` or `TB` direction |
| **Grouped** | Worksheet + cluster bounds per workbook | All reference kinds | `digraph` with compound nodes |
| **Overview** | Uploaded file | Cross-file only | `digraph` |

The **direction** toggle (`LR` / `TB`) controls Dagre's `rankdir` setting.

---

## State management

Tangle uses React's built-in `useState` / `useCallback` for all state. There is no Redux or Zustand.

Key state in `App.tsx`:

| State | Type | Purpose |
|-------|------|---------|
| `workbooks` | `WorkbookFile[]` | Loaded workbooks |
| `hiddenFiles` | `Set<string>` | Files hidden from graph view |
| `highlightedFile` | `string \| null` | File being highlighted/located |

Key state in `GraphView.tsx`:

| State | Purpose |
|-------|---------|
| `viewMode` | `'graph' \| 'grouped' \| 'overview'` |
| `direction` | Dagre `rankdir`: `'LR' \| 'TB'` |
| `focusNodeId` | Node in focus mode (`null` = no focus) |
| `focusDepth` | Hop depth for focus mode neighborhood (1–3) |
| `edgeKindFilter` | Which `ReferenceKind` values are visible |

Toolbar state (`viewMode`, `direction`, `groupMode`) is persisted in URL query parameters so it survives page reloads.

---

## CI/CD pipeline

A single workflow (`.github/workflows/ci.yml`) handles everything:

```
Push / PR to main
      |
      v
    ci.yml
    |-- build (ubuntu)
    |     |-- npm ci
    |     |-- ESLint
    |     |-- tsc --noEmit (type check)
    |     |-- Vitest unit tests
    |     |-- Vite build
    |     |-- Upload Pages artifact
    |     |-- Playwright E2E
    |
    |-- release (ubuntu, needs: build, main only)
    |     |-- Read version from package.json
    |     |-- Create GitHub tag + release if new
    |
    |-- tauri-build (windows, needs: release, if release created)
    |     |-- Build Rust/Tauri installer
    |     |-- Upload Tangle-Setup.exe and Tangle-Setup.msi
    |
    |-- deploy (ubuntu, needs: build, main only)
          |-- Deploy to GitHub Pages
```

**Important:** There is only one workflow file. Never create additional workflow files. See `CLAUDE.md` for CI rules.
