/**
 * resolver.ts — Structured reference resolver and dependency graph utilities.
 *
 * Provides:
 *  - Parsing of structured Excel references (TableName[Col], [@Col], QueryName.Result[Col])
 *  - Validation against known tables and query results
 *  - Cycle detection in the sheet dependency graph
 *  - Dependency graph construction from parsed workbooks
 *  - Formula rename support (table/column rename propagation)
 *  - Memoized resolution cache with manual invalidation
 */

import type {
  WorkbookFile,
  ExcelTable,
  FormulaRefError,
  StructuredRef,
} from '../types';

// ── Structured reference regex patterns ────────────────────────────────────────

/**
 * Matches QueryName.Result[ColumnName] — Power Query result table references.
 * Group 1: query name, Group 2: column name.
 * Must be checked BEFORE TABLE_COL_RE to avoid partial match of the query name.
 */
const QUERY_RESULT_RE =
  /\b([A-Za-z_\u00C0-\u024F][A-Za-z0-9_\u00C0-\u024F]*)\.Result\[([^\]]*)\]/g;

/**
 * Matches TableName[ColumnName] structured references.
 * Group 1: table name, Group 2: column content inside brackets.
 * Skips special Excel specifiers like [#Headers], [#Data], [#All], [#Totals].
 */
const TABLE_COL_RE =
  /\b([A-Za-z_\u00C0-\u024F][A-Za-z0-9_. \u00C0-\u024F]*)(?=\[([^\]]*)\])/g;

/**
 * Matches [@ColumnName] — relative row-level structured references used inside
 * a table formula to refer to the current row's value for a column.
 * Group 1: column name.
 */
const RELATIVE_REF_RE = /\[@([^\]]+)\]/g;

// ── Structured reference parser ────────────────────────────────────────────────

/**
 * Parse all structured references from a formula string.
 *
 * Recognises:
 *  1. `QueryName.Result[ColumnName]` → kind: 'query-result'
 *  2. `TableName[ColumnName]`        → kind: 'table-column'
 *  3. `[@ColumnName]`               → kind: 'relative'
 *
 * Validates each reference against `tableMap` (and optionally `queryMap`) and
 * returns structured errors for missing tables/columns.
 *
 * @param formula   The formula string to inspect.
 * @param tableMap  Normalised (lowercase) table name → ExcelTable.
 * @param queryMap  Normalised (lowercase) query name → target sheet name.
 * @returns         Parsed refs and any resolution errors found.
 */
export function parseStructuredRefs(
  formula: string,
  tableMap: Map<string, ExcelTable>,
  queryMap: Map<string, string> = new Map(),
): { refs: StructuredRef[]; errors: FormulaRefError[] } {
  const refs: StructuredRef[] = [];
  const errors: FormulaRefError[] = [];
  // Track raw ref strings already processed to avoid double-counting
  const seen = new Set<string>();

  // ── Pass 1: QueryName.Result[ColumnName] ───────────────────────────────────
  QUERY_RESULT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QUERY_RESULT_RE.exec(formula)) !== null) {
    const rawRef = m[0];
    const queryName = m[1];
    const columnName = m[2];
    if (seen.has(rawRef)) continue;
    seen.add(rawRef);

    const normName = queryName.toLowerCase();
    const tableEntry = tableMap.get(normName);
    const knownAsQuery = queryMap.has(normName);

    if (!tableEntry && !knownAsQuery) {
      errors.push({
        kind: 'MISSING_TABLE',
        message: `Query "${queryName}" not found`,
        detail: `No table or query named "${queryName}" is registered. Referenced in formula: ${formula}`,
        formula,
        ref: rawRef,
      });
    } else if (tableEntry?.columns && columnName) {
      const normCol = columnName.toLowerCase();
      if (!tableEntry.columns.some((c) => c.toLowerCase() === normCol)) {
        errors.push({
          kind: 'MISSING_COLUMN',
          message: `Column "${columnName}" not found in query result "${queryName}"`,
          detail: `Available columns: ${tableEntry.columns.join(', ')}`,
          formula,
          ref: rawRef,
        });
      }
    }

    refs.push({ kind: 'query-result', tableName: queryName, columnName: columnName || undefined, rawRef });
  }

  // ── Pass 2: TableName[ColumnName] ─────────────────────────────────────────
  TABLE_COL_RE.lastIndex = 0;
  while ((m = TABLE_COL_RE.exec(formula)) !== null) {
    const rawTableName = m[1];
    const tableName = rawTableName.trimEnd();
    // Re-read the bracket content now that we have the table name position
    const bracketStart = m.index + rawTableName.length;
    const bracketEnd = formula.indexOf(']', bracketStart + 1);
    if (bracketEnd === -1) continue;
    const columnContent = formula.slice(bracketStart + 1, bracketEnd);
    const rawRef = formula.slice(m.index, bracketEnd + 1);

    // Skip already-matched query-result refs
    if (seen.has(rawRef)) continue;
    // Skip Excel special selectors: [#Headers], [#Data], [#All], [#Totals]
    if (columnContent.startsWith('#')) continue;
    seen.add(rawRef);

    const normName = tableName.toLowerCase();
    const tableEntry = tableMap.get(normName);

    if (!tableEntry) {
      errors.push({
        kind: 'MISSING_TABLE',
        message: `Table "${tableName}" not found`,
        detail: `No table named "${tableName}" is registered. Referenced in formula: ${formula}`,
        formula,
        ref: rawRef,
      });
    } else if (tableEntry.columns && columnContent) {
      const normCol = columnContent.toLowerCase();
      if (!tableEntry.columns.some((c) => c.toLowerCase() === normCol)) {
        errors.push({
          kind: 'MISSING_COLUMN',
          message: `Column "${columnContent}" not found in table "${tableName}"`,
          detail: `Available columns: ${tableEntry.columns.join(', ')}`,
          formula,
          ref: rawRef,
        });
      }
    }

    refs.push({
      kind: 'table-column',
      tableName,
      columnName: columnContent || undefined,
      rawRef,
    });
  }

  // ── Pass 3: [@ColumnName] — relative row references ────────────────────────
  RELATIVE_REF_RE.lastIndex = 0;
  while ((m = RELATIVE_REF_RE.exec(formula)) !== null) {
    const rawRef = m[0];
    const columnName = m[1];
    if (seen.has(rawRef)) continue;
    seen.add(rawRef);
    refs.push({ kind: 'relative', tableName: '', columnName, rawRef });
  }

  return { refs, errors };
}

// ── Memoization cache for structured ref parsing ───────────────────────────────

type ParseResult = { refs: StructuredRef[]; errors: FormulaRefError[] };
const _parseCache = new Map<string, ParseResult>();

/**
 * Compute a deterministic signature for the current table schema.
 *
 * The signature is based on:
 *  - Sorted table names
 *  - For each table, a sorted list of column names if available
 *
 * This is intentionally lightweight (string concatenation rather than hashing)
 * but sufficient to invalidate cache entries when table columns change.
 */
function computeTableSchemaSignature(
  tableMap: Map<string, ExcelTable>,
  schemaVersion?: string,
): string {
  const parts: string[] = [];

  const sortedEntries = [...tableMap.entries()].sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB),
  );

  for (const [tableName, table] of sortedEntries) {
    const anyTable = table as any;
    const columnsValue = anyTable && anyTable.columns;

    let columnNames: string[] = [];

    if (Array.isArray(columnsValue)) {
      columnNames = columnsValue
        .map((c: unknown) => String(c))
        .sort((a: string, b: string) => a.localeCompare(b));
    } else if (columnsValue && typeof columnsValue === 'object') {
      columnNames = Object.keys(columnsValue).sort((a, b) =>
        a.localeCompare(b),
      );
    }

    parts.push(`${tableName}|${columnNames.join(';')}`);
  }

  if (schemaVersion) {
    parts.push(`v:${schemaVersion}`);
  }

  return parts.join('\x1f');
}

/**
 * Cached version of `parseStructuredRefs`.
 *
 * Results are memoized by:
 *  - formula
 *  - current table schema (table names + columns) and optional schemaVersion
 *  - sorted query keys
 *
 * Call `clearParseCache()` after broad schema changes if you need to ensure
 * complete invalidation beyond what the schema signature captures.
 */
export function parseStructuredRefsCached(
  formula: string,
  tableMap: Map<string, ExcelTable>,
  queryMap: Map<string, string> = new Map(),
  schemaVersion?: string,
): ParseResult {
  const schemaSignature = computeTableSchemaSignature(tableMap, schemaVersion);
  const cacheKey = `${formula}\x00${schemaSignature}\x00${[...queryMap.keys()]
    .sort()
    .join(',')}`;
  if (_parseCache.has(cacheKey)) return _parseCache.get(cacheKey)!;
  const result = parseStructuredRefs(formula, tableMap, queryMap);
  _parseCache.set(cacheKey, result);
  return result;
}

/** Invalidate the parse cache. Call after any schema change. */
export function clearParseCache(): void {
  _parseCache.clear();
}

// ── Dependency graph types ────────────────────────────────────────────────────

/** An edge in the dependency graph from node `from` → node `to`. */
export interface DepEdge {
  from: string;
  to: string;
}

/** A lightweight dependency graph: a list of node IDs and directed edges. */
export interface DepGraph {
  nodes: string[];
  edges: DepEdge[];
}

// ── Cycle detection ────────────────────────────────────────────────────────────

/**
 * Detect cycles in a directed dependency graph using iterative DFS.
 *
 * @param graph  The dependency graph to inspect.
 * @returns      An array of cycles; each cycle is an ordered list of node IDs
 *               (the last node loops back to the first).  Returns `[]` if the
 *               graph is acyclic.
 */
export function detectCycles(graph: DepGraph): string[][] {
  // Build adjacency list; include all known nodes
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    if (!adjacency.has(node)) adjacency.set(node, []);
  }
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
  }

  // 3-color DFS state: 0 = unvisited, 1 = visiting, 2 = done
  const state = new Map<string, 0 | 1 | 2>();
  const cycles: string[][] = [];
  const cycleSigs = new Set<string>(); // deduplicate cycles

  // Shared path for the current DFS stack and a set for quick membership testing
  const path: string[] = [];
  const pathSet = new Set<string>();

  type Frame = { node: string; index: number };

  // Iterative DFS with an explicit stack to avoid call-stack overflow on large graphs
  for (const startNode of adjacency.keys()) {
    if (state.get(startNode) === 2) continue; // already fully explored

    const stack: Frame[] = [{ node: startNode, index: 0 }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const node = frame.node;
      const nodeState = state.get(node) ?? 0;

      if (nodeState === 2) {
        // Node was fully explored via another path; pop and continue
        stack.pop();
        continue;
      }

      if (nodeState === 0) {
        // First time we see this node on this DFS: mark as visiting and add to path
        state.set(node, 1);
        path.push(node);
        pathSet.add(node);
      }

      const neighbors = adjacency.get(node) ?? [];

      if (frame.index >= neighbors.length) {
        // All neighbors processed: mark node as done and unwind path
        state.set(node, 2);
        path.pop();
        pathSet.delete(node);
        stack.pop();
        continue;
      }

      const neighbor = neighbors[frame.index++];
      const neighborState = state.get(neighbor) ?? 0;

      if (neighborState === 1) {
        // Back-edge → cycle found (neighbor is on current DFS path)
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          const sig = [...cycle].sort().join('\x00');
          if (!cycleSigs.has(sig)) {
            cycleSigs.add(sig);
            cycles.push(cycle);
          }
        }
        continue;
      }

      if (neighborState === 0) {
        // Unvisited neighbor: start exploring it
        stack.push({ node: neighbor, index: 0 });
      }
      // If neighborState === 2, it's already fully explored; skip it.
    }
  }

  return cycles;
}

// ── Dependency graph builder ───────────────────────────────────────────────────

/**
 * Build a dependency graph from a list of parsed workbooks.
 *
 * Each node represents a workbook sheet (`"WorkbookName::SheetName"`).
 * Each directed edge represents a formula reference from the consumer sheet
 * to the data-source sheet.
 *
 * @param workbooks  Parsed workbooks produced by `parseWorkbook()`.
 * @returns          A `DepGraph` suitable for `detectCycles()` or topological sort.
 */
export function buildDependencyGraph(workbooks: WorkbookFile[]): DepGraph {
  const nodeSet = new Set<string>();
  const edges: DepEdge[] = [];
  const edgeSeen = new Set<string>();

  for (const wb of workbooks) {
    for (const sheet of wb.sheets) {
      const srcId = `${wb.name}::${sheet.sheetName}`;
      nodeSet.add(srcId);

      for (const ref of sheet.references) {
        const targetWb = ref.targetWorkbook ?? wb.name;
        const targetId = `${targetWb}::${ref.targetSheet}`;
        nodeSet.add(targetId);

        const edgeKey = `${srcId}->${targetId}`;
        if (!edgeSeen.has(edgeKey)) {
          edgeSeen.add(edgeKey);
          // Edge direction: consumer (srcId) depends on data source (targetId)
          edges.push({ from: srcId, to: targetId });
        }
      }
    }
  }

  return { nodes: Array.from(nodeSet), edges };
}

// ── Formula rename support ─────────────────────────────────────────────────────

/**
 * Update a formula string when a table or column is renamed.
 *
 * - `kind: 'table'`  — replaces the table name in `TableName[…]`,
 *                      `TableName\b` (standalone), and `QueryName.Result[…]`.
 * - `kind: 'column'` — replaces the column name in `[ColumnName]` and
 *                      `[@ColumnName]`.
 *
 * Matching is case-insensitive and uses word-boundary anchors to avoid partial
 * replacements (e.g. renaming "Sales" must not alter "SalesTable").
 *
 * @param formula  The original formula string.
 * @param oldName  The name to replace.
 * @param newName  The replacement name.
 * @param kind     Whether renaming a table or a column.
 * @returns        Updated formula string (may be unchanged if no match found).
 */
export function renameReference(
  formula: string,
  oldName: string,
  newName: string,
  kind: 'table' | 'column',
): string {
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (kind === 'table') {
    // Replace occurrences of `OldName[` and `OldName.Result[` and plain `OldName\b`
    const re = new RegExp(`\\b${escaped}(?=\\[|\\.Result\\[|\\b)`, 'gi');
    return formula.replace(re, newName);
  } else {
    // Replace `[OldColumnName]` and `[@OldColumnName]`
    const re = new RegExp(`\\[(@?)${escaped}\\]`, 'gi');
    return formula.replace(re, `[$1${newName}]`);
  }
}

// ── Topological sort (deterministic evaluation order) ─────────────────────────

/**
 * Return a topologically-sorted list of node IDs from the dependency graph.
 * Nodes are returned in data-source-first order (leaves first).
 * Nodes participating in a cycle are collected in `cycleNodes`.
 *
 * @param graph  A `DepGraph` (may contain cycles; they are tolerated).
 * @returns      `{ order, cycleNodes }` — deterministic evaluation order.
 */
export function topoSort(graph: DepGraph): { order: string[]; cycleNodes: Set<string> } {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of graph.nodes) {
    if (!adjacency.has(node)) adjacency.set(node, []);
    if (!inDegree.has(node)) inDegree.set(node, 0);
  }
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    if (!inDegree.has(edge.from)) inDegree.set(edge.from, 0);
  }

  // Kahn's algorithm — processes nodes with in-degree 0 (lexicographic order for determinism)
  const queue: string[] = [...inDegree.entries()]
    .filter(([, d]) => d === 0)
    .map(([n]) => n)
    .sort();
  const order: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    const neighbors = [...(adjacency.get(node) ?? [])].sort();
    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        // Insert in sorted order for determinism
        const insertIdx = queue.findIndex((n) => n > neighbor);
        if (insertIdx === -1) queue.push(neighbor);
        else queue.splice(insertIdx, 0, neighbor);
      }
    }
  }

  // Any node not in `order` is part of a cycle
  const cycleNodes = new Set(
    [...inDegree.entries()].filter(([, d]) => d > 0).map(([n]) => n),
  );

  return { order, cycleNodes };
}
