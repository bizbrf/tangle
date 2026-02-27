# Architecture

**Analysis Date:** 2026-02-27

## Pattern Overview

**Overall:** Single-page application (SPA) with client-side Excel parsing and interactive graph visualization. Data flows from file upload → parsing → graph building → visualization.

**Key Characteristics:**
- Frontend-only: no backend server required
- Real-time reactivity: state changes immediately update graph
- Three layout modes: standard graph, grouped (per-file clusters), overview (file-level)
- Custom node/edge types with semantic styling based on reference kind
- Support for internal (same-workbook), cross-file (between uploaded), and external file references

## Layers

**Presentation Layer:**
- Purpose: Render interactive UI components and handle user interactions
- Location: `src/components/`
- Contains: React components (FilePanel, GraphView, custom nodes/edges), UI primitives
- Depends on: Graph layer (buildGraph, computeClusterNodes), Types
- Used by: Browser/Tauri runtime

**Graph Visualization Layer:**
- Purpose: Compute node/edge layouts, manage visual state, render React Flow canvas
- Location: `src/components/Graph/GraphView.tsx`
- Contains: React Flow setup, custom node/edge components (SheetNode, WeightedEdge), layout switching
- Depends on: Graph building layer, design tokens
- Used by: Presentation layer (App → GraphView)

**Graph Building Layer:**
- Purpose: Transform parsed Excel data into React Flow nodes/edges; compute layouts
- Location: `src/lib/graph.ts`
- Contains: buildGraph(), applyLayout(), dagreLayout(), groupedLayout(), buildOverviewGraph(), computeClusterNodes()
- Depends on: Parser (for data structure), Dagre (layout engine)
- Used by: GraphView component

**Parser Layer:**
- Purpose: Extract references, formulas, and named ranges from Excel files
- Location: `src/lib/parser.ts`
- Contains: parseWorkbook(), extractReferences(), extractNamedRanges(), buildExternalLinkMap()
- Depends on: SheetJS (xlsx), Types
- Used by: FilePanel component

**Type Definition Layer:**
- Purpose: Shared TypeScript interfaces for data contracts
- Location: `src/types.ts`
- Contains: WorkbookFile, ParsedSheet, SheetReference, SheetWorkload, NamedRange, EdgeReference, NodeData, EdgeData, EdgeKind
- Depends on: Nothing
- Used by: All layers

## Data Flow

**File Upload → Parse → Graph Build → Render:**

1. **File Upload**
   - User drops/clicks to select Excel files
   - `FilePanel` validates file types (EXCEL_EXTENSIONS: .xlsx, .xls, .xlsm, .xlsb)
   - `parseWorkbook()` reads file via FileReader API

2. **Parsing**
   - SheetJS reads workbook: `XLSX.read(data, { type: 'array', cellFormula: true, bookFiles: true })`
   - `buildExternalLinkMap()` resolves numeric external link indices ([1], [2]) to filenames
   - `extractNamedRanges()` collects workbook/sheet-scoped named ranges
   - `extractReferences()` scans all formulas for references:
     - Detects cross-sheet: `SheetName!A1`, `'Sheet Name'!A1:B2`
     - Detects external: `[Workbook.xlsx]Sheet!A1`
     - Detects named ranges: matches by name in formula
     - Counts within-sheet, cross-sheet, cross-file references per sheet
   - Returns: `WorkbookFile` with sheets, namedRanges, workload metrics

3. **Graph Building**
   - `buildGraph(workbooks, layoutMode, hiddenFiles, showNamedRanges)` creates nodes/edges
   - Pass 1: Register all uploaded sheet nodes (from visible workbooks)
   - Pass 2: For each reference:
     - Create data SOURCE node: sheet (if visible) or file (if hidden/external)
     - Create edge from source → consuming sheet
     - If named range toggle ON: insert intermediate named range node + split into 2 edges
   - Classify edges: internal (same workbook), cross-file (both uploaded), external (file not uploaded), named-range
   - Compute out/in degree for each node
   - Apply layout: dagreLayout (left-to-right), groupedLayout (per-workbook clusters), or buildOverviewGraph (file-level)

4. **Layout Strategies**
   - **dagreLayout()**: Dagre hierarchical layout, left-to-right direction, spacing tuned for node size
   - **groupedLayout()**: File-level Dagre + intra-file column layout
     - Groups nodes by workbook
     - Positions groups via Dagre based on inter-file edges
     - Positions sheets within group in vertical columns
   - **buildOverviewGraph()**: One node per uploaded workbook, inter-file edges only

5. **Rendering**
   - GraphView sets up ReactFlowProvider + ReactFlow canvas
   - Renders computed nodes (SheetNode for sheets/files/named-ranges, ClusterNode for groups)
   - Renders edges (WeightedEdge with stroke width scaled to reference count)
   - Draws count badges for multi-reference edges
   - Handles zoom, pan, selection, highlighting

**State Management:**

Global state (App.tsx):
- `workbooks`: Parsed WorkbookFile[] — source of truth
- `hiddenFiles`: Set<string> of workbook names to exclude from graph
- `highlightedFile`: workbook name to pan/zoom to

Graph state (GraphView):
- `nodes`, `edges`: React Flow state from buildGraph()
- `layoutMode`: 'graph' | 'grouped' | 'overview'
- `edgeKindFilter`: { internal, crossFile, external, namedRange } — which edge types visible
- `focusNodeId`, `focusDepth`, `focusDirection`: Neighborhood focus mode (hop-based filtering)
- `selectedNode/Edge`: Selection state for detail panel

## Key Abstractions

**Reference Kind (EdgeKind):**
- Purpose: Classify edges by source/target relationship
- Examples: 'internal' (same workbook), 'cross-file' (both uploaded), 'external' (one uploaded, one not), 'named-range'
- Pattern: String literal type in `src/lib/graph.ts`, checked to determine edge color/visibility

**Workload Metrics (SheetWorkload):**
- Purpose: Aggregate formula and reference counts per sheet for analysis
- Contained in: `ParsedSheet.workload`
- Fields: totalFormulas, withinSheetRefs, crossSheetRefs, crossFileRefs
- Pattern: Populated during parsing, displayed in detail panel, used for complexity assessment

**Node ID Scheme:**
- Sheet node: `{workbookName}::{sheetName}` (from `sheetNodeId()`)
- File node: `[file]{workbookName}` (from `fileNodeId()`)
- Named range node: `[nr]{workbookName}::{rangeName}` (from buildGraph line 148)
- Cluster node: `[cluster]{workbookName}` (from computeClusterNodes())
- Purpose: Stable, unique identification across builds

**NodeData vs ClusterData:**
- NodeData: Metadata for sheet/file/named-range nodes (isExternal, isFileNode, isNamedRange, workload, degree counts)
- ClusterData: Metadata for bounding box nodes (label, workbookName, width, height, isExternal)
- Pattern: Keyed by node.type ('sheet' vs 'cluster') or node.data properties

## Entry Points

**App (Root Component):**
- Location: `src/App.tsx`
- Triggers: Browser load (via main.tsx → Vite)
- Responsibilities:
  - Manage global state (workbooks, hiddenFiles, highlightedFile)
  - Route state changes to children (FilePanel, GraphView)
  - Coordinate file upload/removal and graph highlighting

**FilePanel:**
- Location: `src/components/FilePanel/FilePanel.tsx`
- Triggers: User uploads files or manages file list
- Responsibilities:
  - Handle drag-drop and click-to-upload
  - Parse files (async)
  - Manage expanded/collapsed state per workbook
  - Show workload badges (reference count per sheet)

**GraphView:**
- Location: `src/components/Graph/GraphView.tsx`
- Triggers: workbooks, hiddenFiles, or layout settings change
- Responsibilities:
  - Build graph from workbooks
  - Render React Flow canvas with custom nodes/edges
  - Manage graph-level state (selection, focus, filters)
  - Respond to user interactions (click, pan, zoom)

**parseWorkbook() API:**
- Location: `src/lib/parser.ts` line 251
- Triggers: File upload in FilePanel
- Responsibilities:
  - Read file via FileReader
  - Parse Excel via SheetJS
  - Extract references and named ranges
  - Return WorkbookFile with full metadata

**buildGraph() API:**
- Location: `src/lib/graph.ts` line 53
- Triggers: WorkbookFile data changes or layout mode changes
- Responsibilities:
  - Create nodes and edges from workbooks
  - Apply filters (hiddenFiles, named range toggle)
  - Compute layout (dagre, grouped, or overview)
  - Return React Flow node/edge arrays

## Error Handling

**Strategy:** Silent failures with user feedback for critical errors; console-logged for debugging.

**Patterns:**
- File parsing failures: Try/catch in parseWorkbook; error message shown in FilePanel UI
- Invalid Excel files: Pre-filter by extension + XLSX library validation
- Reference extraction: Graceful handling of malformed formulas (regex lookahead/NR deduplication)
- Named range resolution: Case-insensitive matching, fallback to raw reference if not found
- External link resolution: Numeric index → filename mapping; fallback to raw index if not found

## Cross-Cutting Concerns

**Logging:** Console usage for debugging; no persistent logging to server (frontend-only app)

**Validation:**
- File type: Extension check in FilePanel (EXCEL_EXT_RE)
- Cell references: Regex pattern validation (CELL_RE)
- Named ranges: Skip built-in names (_xlnm.*)

**Authentication:** Not applicable (frontend-only, no backend)

**Styling:** Design tokens in GraphView (C object: accent, surface, border, text colors); Tailwind for UI components; React Flow dark theme overrides in index.css

**State Cleanup:**
- Workbook removal: Stale hidden state cleaned in App.tsx handleWorkbooksChange()
- Expanded state: File list expand/collapse cleaned on removal
- Selection: React Flow manages internally

---

*Architecture analysis: 2026-02-27*
