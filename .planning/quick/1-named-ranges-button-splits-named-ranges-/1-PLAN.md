---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types.ts
  - src/lib/parser.ts
  - src/lib/graph.ts
  - src/components/Graph/GraphView.tsx
autonomous: true
requirements: [TABLES-01]

must_haves:
  truths:
    - "When Tables toggle is ON, Excel table nodes appear as separate nodes between their sheet and consuming sheets"
    - "When Tables toggle is OFF, table nodes collapse back — no separate nodes, direct edges restored"
    - "Tables toggle is only visible when at least one uploaded workbook contains Excel tables"
    - "Tables toggle is hidden in Overview mode (same behavior as Named Ranges toggle)"
    - "Named Ranges toggle continues to work exactly as before"
  artifacts:
    - path: "src/types.ts"
      provides: "ExcelTable type and WorkbookFile.tables field"
      contains: "ExcelTable"
    - path: "src/lib/parser.ts"
      provides: "extractTables() function parsing SheetJS ws['!tables']"
      exports: ["extractTables"]
    - path: "src/lib/graph.ts"
      provides: "buildGraph() accepts showTables param, inserts table nodes when true"
      contains: "showTables"
    - path: "src/components/Graph/GraphView.tsx"
      provides: "Tables toggle button, hasTables computed flag"
      contains: "showTables"
  key_links:
    - from: "src/lib/parser.ts"
      to: "src/types.ts"
      via: "ExcelTable type import"
      pattern: "ExcelTable"
    - from: "src/lib/graph.ts"
      to: "buildGraph showTables param"
      via: "makeTableNode + table edges"
      pattern: "showTables"
    - from: "src/components/Graph/GraphView.tsx"
      to: "src/lib/graph.ts"
      via: "buildGraph(workbooks, layoutMode, hiddenFiles, showNamedRanges, showTables)"
      pattern: "showTables"
---

<objective>
Add a "Tables" toggle to the graph view that works identically to the existing "Named Ranges" toggle. When ON, Excel table nodes appear as intermediate nodes between their defining sheet and any sheet that references cells within that table. When OFF, they collapse back to direct edges.

Purpose: Named ranges and Excel tables are both named structures that act as data sources — surfacing them as graph nodes helps users understand data topology.
Output: ExcelTable type + parser extraction + graph builder support + UI toggle button, following the exact same pattern as the existing Named Ranges feature.
</objective>

<execution_context>
@C:/Users/chase/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/chase/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Users/chase/projects/tangle/CLAUDE.md
@C:/Users/chase/projects/tangle/src/types.ts
@C:/Users/chase/projects/tangle/src/lib/parser.ts
@C:/Users/chase/projects/tangle/src/lib/graph.ts
@C:/Users/chase/projects/tangle/src/components/Graph/GraphView.tsx

<interfaces>
<!-- Key existing interfaces the executor must use. -->

From src/types.ts:
```typescript
export interface NamedRange {
  name: string;
  ref: string;
  targetSheet: string;
  targetWorkbook: string | null;
  cells: string;
  scope: 'workbook' | 'sheet';
  scopeSheet?: string;
}

export interface WorkbookFile {
  id: string;
  name: string;
  sheets: ParsedSheet[];
  namedRanges: NamedRange[];
  // tables field to be added
}
```

From src/lib/graph.ts — existing buildGraph signature:
```typescript
export function buildGraph(
  workbooks: WorkbookFile[],
  layoutMode: LayoutMode = 'graph',
  hiddenFiles: Set<string> = new Set(),
  showNamedRanges: boolean = false,
): { nodes: Node<NodeData>[]; edges: Edge<EdgeData>[] }
```

From src/lib/graph.ts — existing NodeData:
```typescript
export type NodeData = {
  label: string;
  workbookName: string;
  sheetName: string;
  isExternal: boolean;
  isFileNode: boolean;
  isNamedRange: boolean;
  namedRangeName?: string;
  namedRangeRef?: string;
  sheetCount?: number;
  outgoingCount: number;
  incomingCount: number;
  workload: SheetWorkload | null;
  [key: string]: unknown;
};
```

From src/components/Graph/GraphView.tsx — existing Named Ranges pattern to mirror:
- `const hasNamedRanges = useMemo(() => workbooks.some((wb) => wb.namedRanges.length > 0), [workbooks]);`
- `const [showNamedRanges, setShowNamedRanges] = useState(false);`
- Toggle button is rendered at `top: 92` when `hasNamedRanges && layoutMode !== 'overview'`
- `EdgeKindFilterBar` receives `showNamedRanges` and filters out `'named-range'` entries when false
- `buildGraph(workbooks, layoutMode, hiddenFiles, showNamedRanges)` call in useEffect

SheetJS Excel table structure (ws['!tables']):
```typescript
// SheetJS stores table definitions on each worksheet under ws['!tables']
// Each entry is an object with: name, ref (cell range like "A1:D10"), displayName
interface SjsTableEntry {
  name?: string;        // internal name (e.g. "Table1")
  displayName?: string; // display name shown in Excel
  ref?: string;         // range like "A1:D10"
}
// Access: (wb.Sheets[sheetName] as any)['!tables'] — array or undefined
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add ExcelTable type, extractTables parser, and extend WorkbookFile</name>
  <files>src/types.ts, src/lib/parser.ts</files>
  <action>
In src/types.ts, add the ExcelTable interface (following the NamedRange pattern) and add a `tables` field to WorkbookFile:

```typescript
export interface ExcelTable {
  name: string;         // displayName if available, else name
  ref: string;          // raw range, e.g. "A1:D10"
  targetSheet: string;  // sheet where table is defined
  cells: string;        // same as ref (the cell range)
}
```

Add to WorkbookFile: `tables: ExcelTable[];`

In src/lib/parser.ts, add and export `extractTables(wb: XLSX.WorkBook): ExcelTable[]`. Implementation:
- Iterate over `wb.SheetNames`
- For each sheet, access `(wb.Sheets[sheetName] as Record<string, unknown>)['!tables']`
- If it's an array, map each entry to ExcelTable: use `entry.displayName ?? entry.name ?? 'Table'` for name, `entry.ref ?? ''` for ref, the current sheetName for targetSheet, and `entry.ref ?? ''` for cells
- Skip entries with no ref
- Return the flat array of all tables across all sheets

In parseWorkbook(), after extracting namedRanges, call `const tables = extractTables(wb);` and include `tables` in the resolved WorkbookFile object: `resolve({ id: fileId, name: file.name, sheets, namedRanges, tables });`

TypeScript: cast the !tables array entry as `{ name?: string; displayName?: string; ref?: string }` to avoid `any`.
  </action>
  <verify>npm run build 2>&1 | tail -20</verify>
  <done>Build passes with no TypeScript errors. WorkbookFile type has tables field. extractTables is exported from parser.ts.</done>
</task>

<task type="auto">
  <name>Task 2: Add table node support to graph builder and Tables toggle to GraphView</name>
  <files>src/lib/graph.ts, src/components/Graph/GraphView.tsx</files>
  <action>
In src/lib/graph.ts:

1. Add `isTable: boolean` and `tableRef?: string` to NodeData type (alongside the existing `isNamedRange` fields).

2. Add `showTables: boolean = false` as a 5th parameter to `buildGraph()`.

3. Add `makeTableNode(id, workbookName, tableName, ref, targetSheet)` helper following `makeNamedRangeNode` exactly, but setting `isNamedRange: false, isTable: true, tableRef: ref` (and the label = tableName).

4. In Pass 2 (edge building), after the named-range block, add a table block. A table node should appear when `showTables && ref.tableRef` (add optional `tableRef?: string` to SheetReference, OR — simpler — detect table refs via a separate pass). The simpler approach: after building the edges map, do NOT modify SheetReference. Instead, scan workbook tables directly.

   Better approach: add a new Pass 2b after the main edge pass that adds table intermediate nodes. For each visible workbook, for each table in `wb.tables`:
   - Compute `tableNodeId = [table]${wb.name}::${table.name}`
   - Compute `sheetId = sheetNodeId(wb.name, table.targetSheet)`
   - If `sheetId` exists in nodesMap, create the table node and add edge: sheetId → tableNodeId (edgeKind: 'table')
   - Then scan ALL sheets' references — for any reference whose `targetSheet === table.targetSheet` and `targetWorkbook === null` (same workbook), check if the ref's cells overlap the table range. This overlap check is expensive; skip it.

   Actually, the simplest correct approach that mirrors named ranges: add a `tableName?: string` field to SheetReference (like `namedRangeName`). Then in `extractReferences`, after the named-range detection pass, do a table detection pass: build a table lookup map, scan formulas for structured reference patterns like `TableName[Column]` or `TableName[[#All]]`. Detect via regex `\b(TableName)\[` for each table name.

   In parser.ts extractReferences(), accept a `tableMap: Map<string, ExcelTable>` 5th parameter (or build it inside after receiving namedRangeMap). Add table detection regex parallel to namedRangeRe. When a table name is matched in a formula (pattern: `\bTableName\[` or just `\bTableName\b(?!\()`), set `ref.tableName = table.name`.

   **Revised plan for simplicity**: Follow the named range pattern exactly:

   In `extractReferences()`, add a `tableMap: Map<string, ExcelTable>` parameter. Build a table regex like namedRangeRe. When matched, create a SheetReference with `tableName: table.name` pointing to the table's targetSheet. Add `tableName?: string` to SheetReference in types.ts.

   In `parseWorkbook()`, build `tableMap` from `tables` array (key: lowercase name).

   In `buildGraph()`, in Pass 2, add a table block parallel to the named-range block:
   ```
   if (showTables && ref.tableName) {
     const tableId = `[table]${wb.name}::${ref.tableName}`;
     // create makeTableNode if not exists
     // edge1: dataSourceId → tableId (kind: 'table')
     // edge2: tableId → consumerId (kind: 'table')
   }
   ```

   Add `'table'` to EdgeKind union in graph.ts.

   Add `isTable: boolean` and `tableRef?: string` to NodeData. Add `tableName?: string` to SheetReference in types.ts.

5. In `makeTableNode`: use `isTable: true`, `isNamedRange: false`, `tableRef: \`${targetSheet}!${cells}\``, label = tableName.

In src/components/Graph/GraphView.tsx:

1. Add `'table'` to EDGE_KIND_OPTIONS array: `{ kind: 'table', label: 'Table', color: '#a78bfa' }` (violet).

2. Add `const hasTables = useMemo(() => workbooks.some((wb) => wb.tables.length > 0), [workbooks]);`

3. Add `const [showTables, setShowTables] = useState(false);`

4. Update the `buildGraph` call to pass `showTables` as 5th arg.

5. Add `showTables` to the useEffect dependency array.

6. Render Tables toggle button at `top: 132` (below Named Ranges at 92) when `hasTables && layoutMode !== 'overview'`. Mirror the Named Ranges button exactly but with violet color (`#a78bfa`) and a table icon (use a simple grid SVG: `M3 6h18M3 12h18M3 18h18M9 3v18` or similar).

7. Pass `showTables` to `EdgeKindFilterBar` via a new `showTables?: boolean` prop. In `EdgeKindFilterBar`, filter out `'table'` from visibleOptions when `!showTables` (same pattern as `named-range`).

8. In `Legend`, add `{showTables && <LegendRow color="#a78bfa" label="Table" />}` and `{showTables && <LegendRow color="#a78bfa" label="Table ref" isEdge />}`.

9. In the MiniMap nodeColor callback, add: `if (d.isTable) return '#a78bfa';`

10. In SheetNode component, add a table node render branch (parallel to `if (data.isNamedRange)`): check `data.isTable`. Style it with violet (`#a78bfa`) accent, use a table/grid icon, show `data.tableRef` as the subtitle. Add a `isTable` guard branch before the `isFileNode` guard.

11. In `edgeAccentColor` and `edgeRestColor`, add case for `'table'`: use `#a78bfa` (violet).

12. In `EdgeKindFilterState` type, add `'table': boolean`. Initialize `edgeKindFilter` with `'table': true`.

13. In `DetailPanel`'s edge breakdown, add `'table'` to the counts record and display item.

Note: `setAll()` in EdgeKindFilterBar should preserve the table filter: `onFilterChange({ internal: true, 'cross-file': true, external: true, 'named-range': filter['named-range'], 'table': filter['table'] })`.
  </action>
  <verify>npm run build 2>&1 | tail -30</verify>
  <done>Build passes with no TypeScript errors. Tables toggle appears in UI when workbook has tables. Toggling it adds/removes table intermediate nodes from graph. Named Ranges toggle still works independently.</done>
</task>

</tasks>

<verification>
npm run build passes clean. npm run lint passes (or only pre-existing warnings). Manual smoke test: upload an xlsx with named ranges → Named Ranges toggle appears and works. Upload an xlsx with Excel tables → Tables toggle appears and works.
</verification>

<success_criteria>
- TypeScript build passes with zero new errors
- ExcelTable type exists in types.ts; WorkbookFile has tables field
- extractTables() exported from parser.ts
- buildGraph() accepts showTables param as 5th argument
- Tables toggle button renders conditionally (hasTables && not overview mode)
- Toggling Tables ON inserts violet table intermediate nodes + edges into the graph
- Toggling Tables OFF removes table nodes, restores direct edges
- Named Ranges toggle unaffected by Tables changes
</success_criteria>

<output>
After completion, create `.planning/quick/1-named-ranges-button-splits-named-ranges-/1-SUMMARY.md`
</output>
