import Dagre from '@dagrejs/dagre';
import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { WorkbookFile, EdgeReference, SheetWorkload } from '../types';
import { EXCEL_EXT_RE } from './parser';

/** Strip any known Excel extension from a filename */
export function stripExcelExt(name: string): string {
  return name.replace(EXCEL_EXT_RE, '');
}

export type NodeData = {
  label: string;
  workbookName: string;
  sheetName: string;
  isExternal: boolean;
  isFileNode: boolean;
  isNamedRange: boolean;
  namedRangeName?: string;
  namedRangeRef?: string;
  namedRangeScope?: 'workbook' | 'sheet';
  namedRangeScopeSheet?: string;
  isTable: boolean;
  tableName?: string;
  tableRef?: string;
  tableColumns?: string[];
  sheetCount?: number;
  outgoingCount: number;
  incomingCount: number;
  workload: SheetWorkload | null;
  [key: string]: unknown;
};

export type EdgeKind = 'internal' | 'cross-file' | 'external' | 'named-range' | 'table';

export type EdgeData = {
  references: EdgeReference[];
  refCount: number;
  edgeKind: EdgeKind;
  [key: string]: unknown;
};

export type LayoutMode = 'graph' | 'grouped' | 'overview';
export type LayoutDirection = 'LR' | 'TB';
export type GroupingMode = 'off' | 'by-type' | 'by-table';
export type LayoutAlgorithm = 'structured' | 'classic' | 'organic' | 'radial';
type LayoutOptions = {
  preserveInputOrder?: boolean;
  compactRanks?: boolean;
};

const NODE_W = 190;
const NODE_H = 88;

// Normalize a workbook name for fuzzy matching:
// - Extract filename from bracket notation: "[FileB.xlsx]" → "FileB.xlsx"
// - Strip .xlsx extension
// - Lowercase for case-insensitive comparison
function normWb(name: string): string {
  let n = name;
  // Extract from bracket notation if present
  const bracketMatch = n.match(/\[([^\]]+)\]/);
  if (bracketMatch) n = bracketMatch[1];
  return stripExcelExt(n.toLowerCase());
}

function registerWorkbookAlias(map: Map<string, WorkbookFile[]>, alias: string | undefined, workbook: WorkbookFile) {
  if (!alias) return;
  const key = normWb(alias);
  const existing = map.get(key) ?? [];
  if (!existing.some((candidate) => candidate.name === workbook.name)) {
    existing.push(workbook);
    map.set(key, existing);
  }
}

function getMatchedWorkbooks(map: Map<string, WorkbookFile[]>, rawWorkbookName: string): WorkbookFile[] {
  return map.get(normWb(rawWorkbookName)) ?? [];
}

export function buildGraph(
  workbooks: WorkbookFile[],
  layoutMode: LayoutMode = 'graph',
  hiddenFiles: Set<string> = new Set(),
  showNamedRanges: boolean = false,
  showTables: boolean = false,
  layoutDirection: LayoutDirection = 'LR',
  groupingMode?: GroupingMode,
): { nodes: Node<NodeData>[]; edges: Edge<EdgeData>[] } {
  const visibleWorkbooks = hiddenFiles.size > 0
    ? workbooks.filter((wb) => !hiddenFiles.has(wb.name))
    : workbooks;
  if (layoutMode === 'overview') return buildOverviewGraph(visibleWorkbooks);
  const uploadedSheetIds = new Set<string>();
  const uploadedWorkbookAliases = new Map<string, WorkbookFile[]>();
  const visibleWorkbookAliases = new Map<string, WorkbookFile[]>();
  const nodesMap = new Map<string, Node<NodeData>>();
  const edgesMap = new Map<string, EdgeData>();

  for (const wb of workbooks) {
    registerWorkbookAlias(uploadedWorkbookAliases, wb.name, wb);
    registerWorkbookAlias(uploadedWorkbookAliases, wb.originalName, wb);
  }
  for (const wb of visibleWorkbooks) {
    registerWorkbookAlias(visibleWorkbookAliases, wb.name, wb);
    registerWorkbookAlias(visibleWorkbookAliases, wb.originalName, wb);
  }

  // Build workload lookup from all workbooks (including hidden, for resolution)
  const workloadMap = new Map<string, SheetWorkload>();
  for (const wb of workbooks) {
    for (const sheet of wb.sheets) {
      workloadMap.set(sheetNodeId(wb.name, sheet.sheetName), sheet.workload);
    }
  }

  // Build lookup maps for named range scope and table columns
  const namedRangeMap = new Map<string, { scope: 'workbook' | 'sheet'; scopeSheet?: string }>();
  const tableColumnsMap = new Map<string, string[]>();
  for (const wb of workbooks) {
    for (const nr of wb.namedRanges) {
      namedRangeMap.set(`${wb.name}::${nr.name}`, { scope: nr.scope, scopeSheet: nr.scopeSheet });
    }
    for (const tbl of wb.tables) {
      if (tbl.columns && tbl.columns.length > 0) {
        tableColumnsMap.set(`${wb.name}::${tbl.name}`, tbl.columns);
      }
    }
  }

  // Pass 1 — register all uploaded sheet nodes
  for (const wb of visibleWorkbooks) {
    for (const sheet of wb.sheets) {
      const id = sheetNodeId(wb.name, sheet.sheetName);
      uploadedSheetIds.add(id);
      if (!nodesMap.has(id)) {
        nodesMap.set(id, makeSheetNode(id, wb.name, sheet.sheetName, workloadMap.get(id) ?? null));
      }
    }
  }

  // Pass 2 — build edges
  for (const wb of visibleWorkbooks) {
    for (const sheet of wb.sheets) {
      const consumerId = sheetNodeId(wb.name, sheet.sheetName);

      for (const ref of sheet.references) {
        const visibleTargets = ref.targetWorkbook
          ? getMatchedWorkbooks(visibleWorkbookAliases, ref.targetWorkbook)
          : [wb];
        const uploadedTargets = ref.targetWorkbook
          ? getMatchedWorkbooks(uploadedWorkbookAliases, ref.targetWorkbook)
          : [wb];
        const edgeKind: EdgeKind = ref.targetWorkbook === null
          ? 'internal'
          : uploadedTargets.length > 0
            ? 'cross-file'
            : 'external';

        const edgeRef: EdgeReference = {
          sourceCell: ref.sourceCell,
          targetCells: ref.cells,
          formula: ref.formula,
        };

        const dataSourceIds: string[] = [];
        if (visibleTargets.length > 0) {
          for (const targetWorkbook of visibleTargets) {
            const dataSourceId = sheetNodeId(targetWorkbook.name, ref.targetSheet);
            if (!nodesMap.has(dataSourceId)) {
              nodesMap.set(dataSourceId, makeSheetNode(dataSourceId, targetWorkbook.name, ref.targetSheet, workloadMap.get(dataSourceId) ?? null));
            }
            if (dataSourceId !== consumerId) {
              dataSourceIds.push(dataSourceId);
            }
          }
        } else {
          const fallbackWorkbookName = uploadedTargets[0]?.originalName ?? ref.targetWorkbook ?? wb.originalName;
          const dataSourceId = fileNodeId(fallbackWorkbookName);
          if (!nodesMap.has(dataSourceId)) {
            nodesMap.set(dataSourceId, makeFileNode(dataSourceId, fallbackWorkbookName));
          }
          if (dataSourceId !== consumerId) {
            dataSourceIds.push(dataSourceId);
          }
        }

        if (dataSourceIds.length === 0) continue;

        // Named range: when toggle is ON, create intermediate NR node + two edges
        if (showNamedRanges && ref.namedRangeName) {
          const nrId = `[nr]${wb.name}::${ref.namedRangeName}`;
          if (!nodesMap.has(nrId)) {
            const nrMeta = namedRangeMap.get(`${wb.name}::${ref.namedRangeName}`);
            nodesMap.set(nrId, makeNamedRangeNode(nrId, wb.name, ref.namedRangeName, ref.cells.join(', '), ref.targetSheet, nrMeta?.scope, nrMeta?.scopeSheet));
          }
          for (const dataSourceId of dataSourceIds) {
            // Edge 1: data source → NR node (named-range kind)
            const eid1 = edgeId(dataSourceId, nrId);
            if (!edgesMap.has(eid1)) {
              edgesMap.set(eid1, { references: [], refCount: 0, edgeKind: 'named-range' });
            }
            const ed1 = edgesMap.get(eid1)!;
            ed1.references.push(edgeRef);
            ed1.refCount = ed1.references.length;
          }

          // Edge 2: NR node → consumer (named-range kind)
          const eid2 = edgeId(nrId, consumerId);
          if (!edgesMap.has(eid2)) {
            edgesMap.set(eid2, { references: [], refCount: 0, edgeKind: 'named-range' });
          }
          const ed2 = edgesMap.get(eid2)!;
          ed2.references.push(edgeRef);
          ed2.refCount = ed2.references.length;
        } else if (showTables && ref.tableName) {
          // Table: when toggle is ON, create intermediate table node + two edges
          const tableId = `[table]${wb.name}::${ref.tableName}`;
          if (!nodesMap.has(tableId)) {
            const cols = tableColumnsMap.get(`${wb.name}::${ref.tableName}`);
            nodesMap.set(tableId, makeTableNode(tableId, wb.name, ref.tableName, ref.cells.join(', '), ref.targetSheet, cols));
          }
          for (const dataSourceId of dataSourceIds) {
            // Edge 1: data source → table node (table kind)
            const eid1 = edgeId(dataSourceId, tableId);
            if (!edgesMap.has(eid1)) {
              edgesMap.set(eid1, { references: [], refCount: 0, edgeKind: 'table' });
            }
            const ed1 = edgesMap.get(eid1)!;
            ed1.references.push(edgeRef);
            ed1.refCount = ed1.references.length;
          }

          // Edge 2: table node → consumer (table kind)
          const eid2 = edgeId(tableId, consumerId);
          if (!edgesMap.has(eid2)) {
            edgesMap.set(eid2, { references: [], refCount: 0, edgeKind: 'table' });
          }
          const ed2 = edgesMap.get(eid2)!;
          ed2.references.push(edgeRef);
          ed2.refCount = ed2.references.length;
        } else {
          for (const dataSourceId of dataSourceIds) {
            // Standard direct edge: data SOURCE → data CONSUMER
            const eid = edgeId(dataSourceId, consumerId);
            if (!edgesMap.has(eid)) {
              edgesMap.set(eid, { references: [], refCount: 0, edgeKind });
            }
            const ed = edgesMap.get(eid)!;
            ed.references.push(edgeRef);
            ed.refCount = ed.references.length;
          }
        }
      }
    }
  }

  // Fix isExternal
  for (const [id, node] of nodesMap.entries()) {
    node.data.isExternal = !uploadedSheetIds.has(id);
  }

  // Compute out/in degree
  const outCounts = new Map<string, number>();
  const inCounts = new Map<string, number>();
  for (const eid of edgesMap.keys()) {
    const sep = eid.indexOf('->');
    const src = eid.slice(0, sep);
    const tgt = eid.slice(sep + 2);
    outCounts.set(src, (outCounts.get(src) ?? 0) + 1);
    inCounts.set(tgt, (inCounts.get(tgt) ?? 0) + 1);
  }
  for (const [id, node] of nodesMap.entries()) {
    node.data.outgoingCount = outCounts.get(id) ?? 0;
    node.data.incomingCount = inCounts.get(id) ?? 0;
  }

  const edges: Edge<EdgeData>[] = Array.from(edgesMap.entries()).map(([eid, data]) => {
    const sep = eid.indexOf('->');
    const source = eid.slice(0, sep);
    const target = eid.slice(sep + 2);
    return {
      id: eid,
      source,
      target,
      data,
      type: 'weighted',
      markerEnd: { type: MarkerType.ArrowClosed, width: 7, height: 7 },
    };
  });

  const nodeList = applyLayout(Array.from(nodesMap.values()), edges, layoutMode, layoutDirection, groupingMode, {
    preserveInputOrder: false,
    compactRanks: true,
  });
  return { nodes: nodeList, edges };
}

// ── Layout strategies ─────────────────────────────────────────────────────────

function applyLayout(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  mode: LayoutMode,
  direction: LayoutDirection = 'LR',
  groupingMode?: GroupingMode,
  options: LayoutOptions = {},
): Node<NodeData>[] {
  // groupingMode takes precedence over legacy layoutMode when provided
  if (groupingMode === 'by-type') return groupedLayout(nodes, edges, direction);
  if (groupingMode === 'by-table') return byTableLayout(nodes, edges, direction);
  if (groupingMode === 'off') return dagreLayout(nodes, edges, direction, options);
  if (mode === 'grouped') return groupedLayout(nodes, edges, direction);
  return dagreLayout(nodes, edges, direction, options);
}

function dagreLayout(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  rankdir: 'LR' | 'TB',
  options: LayoutOptions = {},
): Node<NodeData>[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir,
    ranksep: rankdir === 'LR' ? 130 : 90,
    nodesep: rankdir === 'LR' ? 55 : 45,
    marginx: 60,
    marginy: 60,
  });

  const orderedNodes = options.preserveInputOrder
    ? [...nodes]
    : [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const orderedEdges = options.preserveInputOrder
    ? [...edges]
    : [...edges].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  orderedNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  orderedEdges.forEach((e) => g.setEdge(e.source, e.target));

  Dagre.layout(g);

  const positionedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
    };
  });

  if (rankdir === 'TB' && options.compactRanks !== false) {
    return compactVerticalRanks(positionedNodes);
  }

  return positionedNodes;
}

function compactVerticalRanks(nodes: Node<NodeData>[]): Node<NodeData>[] {
  if (nodes.length < 12) return nodes;

  const rankMap = new Map<number, Node<NodeData>[]>();
  for (const node of nodes) {
    const rankKey = Math.round(node.position.y);
    const rank = rankMap.get(rankKey) ?? [];
    rank.push(node);
    rankMap.set(rankKey, rank);
  }

  const sortedRanks = Array.from(rankMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, rankNodes]) => rankNodes.sort((a, b) => a.position.x - b.position.x));
  if (sortedRanks.length < 2) return nodes;

  const targetColumns = Math.max(8, Math.min(16, Math.ceil(Math.sqrt(nodes.length) + sortedRanks.length / 2)));
  const slotX = NODE_W + 52;
  const slotY = NODE_H + 28;
  const rankGap = 76;

  const wrappedRanks = sortedRanks.map((rankNodes) => {
    const rows: Node<NodeData>[][] = [];
    const rowSize = rankNodes.length > targetColumns ? targetColumns : rankNodes.length;
    for (let index = 0; index < rankNodes.length; index += rowSize) {
      rows.push(rankNodes.slice(index, index + rowSize));
    }
    return rows;
  });

  const maxColumns = Math.max(...wrappedRanks.flatMap((rows) => rows.map((row) => row.length)));
  const maxWidth = maxColumns * slotX - (slotX - NODE_W);
  const positionedById = new Map<string, { x: number; y: number }>();
  let cursorY = 60;

  for (const rows of wrappedRanks) {
    rows.forEach((row, rowIndex) => {
      const rowWidth = row.length * slotX - (slotX - NODE_W);
      const rowStartX = Math.max(0, Math.round((maxWidth - rowWidth) / 2));
      row.forEach((node, colIndex) => {
        positionedById.set(node.id, {
          x: rowStartX + colIndex * slotX,
          y: cursorY + rowIndex * slotY,
        });
      });
    });

    const rankHeight = rows.length * NODE_H + (rows.length - 1) * (slotY - NODE_H);
    cursorY += rankHeight + rankGap;
  }

  return nodes.map((node) => ({
    ...node,
    position: positionedById.get(node.id) ?? node.position,
  }));
}

function groupedLayout(nodes: Node<NodeData>[], edges: Edge<EdgeData>[], direction: LayoutDirection = 'LR'): Node<NodeData>[] {
  const INTRA_VGAP = 100;
  const INTRA_PAD_X = 40;
  const INTRA_PAD_Y = 56; // top padding (room for cluster label)
  const INTRA_PAD_BOTTOM = 30;

  // Group nodes by workbook; collect external file nodes separately
  const wbGroups = new Map<string, Node<NodeData>[]>();
  const externalNodes: Node<NodeData>[] = [];

  for (const node of nodes) {
    if (node.data.isExternal) {
      externalNodes.push(node);
    } else {
      const wb = node.data.workbookName;
      if (!wbGroups.has(wb)) wbGroups.set(wb, []);
      wbGroups.get(wb)!.push(node);
    }
  }

  // Compute bounding box size per group
  const groupSizes = new Map<string, { w: number; h: number }>();
  for (const [wb, sheets] of wbGroups.entries()) {
    const w = NODE_W + INTRA_PAD_X * 2;
    const h = INTRA_PAD_Y + sheets.length * NODE_H + (sheets.length - 1) * (INTRA_VGAP - NODE_H) + INTRA_PAD_BOTTOM;
    groupSizes.set(wb, { w, h });
  }

  // Build a file-level Dagre graph to position groups based on inter-file edges
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: 130, nodesep: 80, marginx: 60, marginy: 60 });

  for (const [wb, size] of groupSizes.entries()) {
    g.setNode(wb, { width: size.w, height: size.h });
  }

  // External nodes as a single group for layout purposes
  if (externalNodes.length > 0) {
    const extH = INTRA_PAD_Y + externalNodes.length * NODE_H + (externalNodes.length - 1) * (INTRA_VGAP - NODE_H) + INTRA_PAD_BOTTOM;
    g.setNode('__external__', { width: NODE_W + INTRA_PAD_X * 2, height: extH });
  }

  // Add inter-file edges to the group-level graph
  const nodeToWb = new Map<string, string>();
  for (const [wb, sheets] of wbGroups.entries()) {
    for (const n of sheets) nodeToWb.set(n.id, wb);
  }
  for (const n of externalNodes) nodeToWb.set(n.id, '__external__');

  const addedGroupEdges = new Set<string>();
  for (const edge of edges) {
    const srcWb = nodeToWb.get(edge.source);
    const tgtWb = nodeToWb.get(edge.target);
    if (srcWb && tgtWb && srcWb !== tgtWb) {
      const key = `${srcWb}->${tgtWb}`;
      if (!addedGroupEdges.has(key)) {
        addedGroupEdges.add(key);
        g.setEdge(srcWb, tgtWb);
      }
    }
  }

  Dagre.layout(g);

  // Position individual nodes inside each group's bounding area
  const result: Node<NodeData>[] = [];

  for (const [wb, sheets] of wbGroups.entries()) {
    const pos = g.node(wb);
    const size = groupSizes.get(wb)!;
    const groupX = pos.x - size.w / 2;
    const groupY = pos.y - size.h / 2;

    sheets.forEach((node, row) => {
      result.push({
        ...node,
        position: {
          x: groupX + INTRA_PAD_X,
          y: groupY + INTRA_PAD_Y + row * INTRA_VGAP,
        },
      });
    });
  }

  // Position external nodes
  if (externalNodes.length > 0) {
    const pos = g.node('__external__');
    const extSize = g.node('__external__');
    const groupX = pos.x - extSize.width / 2;
    const groupY = pos.y - extSize.height / 2;

    externalNodes.forEach((node, row) => {
      result.push({
        ...node,
        position: {
          x: groupX + INTRA_PAD_X,
          y: groupY + INTRA_PAD_Y + row * INTRA_VGAP,
        },
      });
    });
  }

  return result;
}

// ── By-Table grouping layout ──────────────────────────────────────────────────
// Groups nodes by their table membership: nodes that reference the same Excel
// table (via tableName) are placed in the same cluster. Nodes without a table
// reference fall into a group keyed by their workbook name.

function byTableLayout(nodes: Node<NodeData>[], edges: Edge<EdgeData>[], direction: LayoutDirection = 'LR'): Node<NodeData>[] {
  const INTRA_VGAP = 100;
  const INTRA_PAD_X = 40;
  const INTRA_PAD_Y = 56;
  const INTRA_PAD_BOTTOM = 30;

  // Assign each node to a group key: prefer tableName, fall back to workbookName
  const groups = new Map<string, Node<NodeData>[]>();
  const externalNodes: Node<NodeData>[] = [];

  for (const node of nodes) {
    if (node.data.isExternal) {
      externalNodes.push(node);
      continue;
    }
    const key = node.data.tableName
      ? `[tbl]${node.data.workbookName}::${node.data.tableName}`
      : `[wb]${node.data.workbookName}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node);
  }

  // Compute bounding sizes per group
  const groupSizes = new Map<string, { w: number; h: number }>();
  for (const [key, members] of groups.entries()) {
    const w = NODE_W + INTRA_PAD_X * 2;
    const h = INTRA_PAD_Y + members.length * NODE_H + (members.length - 1) * (INTRA_VGAP - NODE_H) + INTRA_PAD_BOTTOM;
    groupSizes.set(key, { w, h });
  }

  // Dagre graph to position groups
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: 130, nodesep: 80, marginx: 60, marginy: 60 });

  for (const [key, size] of groupSizes.entries()) {
    g.setNode(key, { width: size.w, height: size.h });
  }
  if (externalNodes.length > 0) {
    const extH = INTRA_PAD_Y + externalNodes.length * NODE_H + (externalNodes.length - 1) * (INTRA_VGAP - NODE_H) + INTRA_PAD_BOTTOM;
    g.setNode('__external__', { width: NODE_W + INTRA_PAD_X * 2, height: extH });
  }

  // Map each node to its group key
  const nodeToGroup = new Map<string, string>();
  for (const [key, members] of groups.entries()) {
    for (const n of members) nodeToGroup.set(n.id, key);
  }
  for (const n of externalNodes) nodeToGroup.set(n.id, '__external__');

  const addedGroupEdges = new Set<string>();
  for (const edge of edges) {
    const srcGrp = nodeToGroup.get(edge.source);
    const tgtGrp = nodeToGroup.get(edge.target);
    if (srcGrp && tgtGrp && srcGrp !== tgtGrp) {
      const key = `${srcGrp}->${tgtGrp}`;
      if (!addedGroupEdges.has(key)) {
        addedGroupEdges.add(key);
        g.setEdge(srcGrp, tgtGrp);
      }
    }
  }

  Dagre.layout(g);

  const result: Node<NodeData>[] = [];

  for (const [key, members] of groups.entries()) {
    const pos = g.node(key);
    const size = groupSizes.get(key)!;
    const groupX = pos.x - size.w / 2;
    const groupY = pos.y - size.h / 2;
    members.forEach((node, row) => {
      result.push({
        ...node,
        position: { x: groupX + INTRA_PAD_X, y: groupY + INTRA_PAD_Y + row * INTRA_VGAP },
      });
    });
  }

  if (externalNodes.length > 0) {
    const pos = g.node('__external__');
    const extSize = g.node('__external__');
    const groupX = pos.x - extSize.width / 2;
    const groupY = pos.y - extSize.height / 2;
    externalNodes.forEach((node, row) => {
      result.push({
        ...node,
        position: { x: groupX + INTRA_PAD_X, y: groupY + INTRA_PAD_Y + row * INTRA_VGAP },
      });
    });
  }

  return result;
}

// ── Overview graph (file-level) ───────────────────────────────────────────────

function buildOverviewGraph(
  workbooks: WorkbookFile[],
): { nodes: Node<NodeData>[]; edges: Edge<EdgeData>[] } {
  const uploadedWorkbookAliases = new Map<string, WorkbookFile[]>();
  for (const wb of workbooks) {
    registerWorkbookAlias(uploadedWorkbookAliases, wb.name, wb);
    registerWorkbookAlias(uploadedWorkbookAliases, wb.originalName, wb);
  }

  const nodesMap = new Map<string, Node<NodeData>>();
  const edgesMap = new Map<string, EdgeData>();

  // Create one file node per uploaded workbook
  for (const wb of workbooks) {
    const id = fileNodeId(wb.name);
    if (!nodesMap.has(id)) {
      const displayName = stripExcelExt(wb.name);
      nodesMap.set(id, {
        id,
        type: 'sheet',
        position: { x: 0, y: 0 },
        data: {
          label: displayName,
          workbookName: wb.name,
          sheetName: displayName,
          sheetCount: wb.sheets.length,
          isExternal: false,
          isFileNode: true,
          isNamedRange: false,
          isTable: false,
          outgoingCount: 0,
          incomingCount: 0,
          workload: null,
        },
      });
    }
  }

  // Build inter-file edges only
  for (const wb of workbooks) {
    const sourceFileId = fileNodeId(wb.name);
    for (const sheet of wb.sheets) {
      for (const ref of sheet.references) {
        if (!ref.targetWorkbook) continue; // skip internal refs

        const targetWorkbooks = getMatchedWorkbooks(uploadedWorkbookAliases, ref.targetWorkbook);
        const targetFileIds = targetWorkbooks.length > 0
          ? targetWorkbooks.map((targetWorkbook) => ({
              id: fileNodeId(targetWorkbook.name),
              workbookName: targetWorkbook.name,
              isExternal: false,
            }))
          : [{
              id: fileNodeId(ref.targetWorkbook),
              workbookName: ref.targetWorkbook,
              isExternal: true,
            }];

        for (const target of targetFileIds) {
          if (!nodesMap.has(target.id)) {
            const displayName = stripExcelExt(target.workbookName);
            nodesMap.set(target.id, {
              id: target.id,
              type: 'sheet',
              position: { x: 0, y: 0 },
              data: {
                label: displayName,
                workbookName: target.workbookName,
                sheetName: displayName,
                isExternal: target.isExternal,
                isFileNode: true,
                isNamedRange: false,
                isTable: false,
                outgoingCount: 0,
                incomingCount: 0,
                workload: null,
              },
            });
          }

          const edgeKind: EdgeKind = target.isExternal ? 'external' : 'cross-file';
          const eid = edgeId(target.id, sourceFileId);
          if (!edgesMap.has(eid)) {
            edgesMap.set(eid, { references: [], refCount: 0, edgeKind });
          }
          const ed = edgesMap.get(eid)!;
          ed.references.push({
            sourceCell: ref.sourceCell,
            targetCells: ref.cells,
            formula: ref.formula,
          });
          ed.refCount = ed.references.length;
        }
      }
    }
  }

  // Compute degrees
  const outCounts = new Map<string, number>();
  const inCounts = new Map<string, number>();
  for (const eid of edgesMap.keys()) {
    const sep = eid.indexOf('->');
    const src = eid.slice(0, sep);
    const tgt = eid.slice(sep + 2);
    outCounts.set(src, (outCounts.get(src) ?? 0) + 1);
    inCounts.set(tgt, (inCounts.get(tgt) ?? 0) + 1);
  }
  for (const [id, node] of nodesMap.entries()) {
    node.data.outgoingCount = outCounts.get(id) ?? 0;
    node.data.incomingCount = inCounts.get(id) ?? 0;
  }

  const edges: Edge<EdgeData>[] = Array.from(edgesMap.entries()).map(([eid, data]) => {
    const sep = eid.indexOf('->');
    const source = eid.slice(0, sep);
    const target = eid.slice(sep + 2);
    return {
      id: eid,
      source,
      target,
      data,
      type: 'weighted',
      markerEnd: { type: MarkerType.ArrowClosed, width: 7, height: 7 },
    };
  });

  const nodeList = dagreLayout(Array.from(nodesMap.values()), edges, 'LR');
  return { nodes: nodeList, edges };
}

// ── Cluster computation ──────────────────────────────────────────────────────

export type ClusterData = {
  label: string;
  workbookName: string;
  width: number;
  height: number;
  isExternal: boolean;
  [key: string]: unknown;
};

const CLUSTER_PAD = 24;
const CLUSTER_LABEL_H = 28;

export function computeClusterNodes(nodes: Node<NodeData>[]): Node<ClusterData>[] {
  const groups = new Map<string, Node<NodeData>[]>();
  const externalNodes: Node<NodeData>[] = [];

  for (const n of nodes) {
    if (n.data.isExternal) {
      externalNodes.push(n);
    } else {
      const wb = n.data.workbookName;
      if (!groups.has(wb)) groups.set(wb, []);
      groups.get(wb)!.push(n);
    }
  }

  const clusters: Node<ClusterData>[] = [];

  for (const [wb, group] of groups.entries()) {
    if (group.length < 1) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of group) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + NODE_W);
      maxY = Math.max(maxY, n.position.y + NODE_H);
    }
    const x = minX - CLUSTER_PAD;
    const y = minY - CLUSTER_PAD - CLUSTER_LABEL_H;
    const w = maxX - minX + CLUSTER_PAD * 2;
    const h = maxY - minY + CLUSTER_PAD * 2 + CLUSTER_LABEL_H;
    clusters.push({
      id: `[cluster]${wb}`,
      type: 'cluster',
      position: { x, y },
      selectable: false,
      draggable: false,
      data: {
        label: stripExcelExt(wb),
        workbookName: wb,
        width: w,
        height: h,
        isExternal: false,
      },
    });
  }

  // External nodes cluster (if more than 1)
  if (externalNodes.length > 1) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of externalNodes) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + NODE_W);
      maxY = Math.max(maxY, n.position.y + NODE_H);
    }
    const x = minX - CLUSTER_PAD;
    const y = minY - CLUSTER_PAD - CLUSTER_LABEL_H;
    const w = maxX - minX + CLUSTER_PAD * 2;
    const h = maxY - minY + CLUSTER_PAD * 2 + CLUSTER_LABEL_H;
    clusters.push({
      id: '[cluster]__external__',
      type: 'cluster',
      position: { x, y },
      selectable: false,
      draggable: false,
      data: {
        label: 'External Files',
        workbookName: '__external__',
        width: w,
        height: h,
        isExternal: true,
      },
    });
  }

  return clusters;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sheetNodeId(workbook: string, sheet: string): string {
  return `${workbook}::${sheet}`;
}

function fileNodeId(workbook: string): string {
  return `[file]${workbook}`;
}

function edgeId(source: string, target: string): string {
  return `${source}->${target}`;
}

function makeSheetNode(id: string, workbookName: string, sheetName: string, workload: SheetWorkload | null): Node<NodeData> {
  return {
    id,
    type: 'sheet',
    position: { x: 0, y: 0 },
    data: { label: sheetName, workbookName, sheetName, isExternal: false, isFileNode: false, isNamedRange: false, isTable: false, outgoingCount: 0, incomingCount: 0, workload },
  };
}

function makeFileNode(id: string, workbookName: string): Node<NodeData> {
  const displayName = stripExcelExt(workbookName);
  return {
    id,
    type: 'sheet',
    position: { x: 0, y: 0 },
    data: { label: displayName, workbookName, sheetName: displayName, isExternal: true, isFileNode: true, isNamedRange: false, isTable: false, outgoingCount: 0, incomingCount: 0, workload: null },
  };
}

function makeNamedRangeNode(id: string, workbookName: string, name: string, cells: string, targetSheet: string, scope?: 'workbook' | 'sheet', scopeSheet?: string): Node<NodeData> {
  return {
    id,
    type: 'sheet',
    position: { x: 0, y: 0 },
    data: {
      label: name,
      workbookName,
      sheetName: name,
      isExternal: false,
      isFileNode: false,
      isNamedRange: true,
      namedRangeName: name,
      namedRangeRef: `${targetSheet}!${cells}`,
      namedRangeScope: scope,
      namedRangeScopeSheet: scopeSheet,
      isTable: false,
      outgoingCount: 0,
      incomingCount: 0,
      workload: null,
    },
  };
}

function makeTableNode(id: string, workbookName: string, tableName: string, cells: string, targetSheet: string, columns?: string[]): Node<NodeData> {
  return {
    id,
    type: 'sheet',
    position: { x: 0, y: 0 },
    data: {
      label: tableName,
      workbookName,
      sheetName: tableName,
      isExternal: false,
      isFileNode: false,
      isNamedRange: false,
      isTable: true,
      tableName,
      tableRef: `${targetSheet}!${cells}`,
      tableColumns: columns,
      outgoingCount: 0,
      incomingCount: 0,
      workload: null,
    },
  };
}

// ── Reorganize layout ─────────────────────────────────────────────────────────

/** Seeded LCG pseudo-random number generator. Returns values in [0, 1). */
function seededPrng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = ((Math.imul(1664525, s) + 1013904223) >>> 0);
    return s / 0x100000000;
  };
}

/**
 * Re-compute layout positions for the current node/edge set without rebuilding
 * the graph from source data. Useful for reflowing a messy graph on demand.
 *
 * - Pinned nodes (ids in `pinnedIds`) keep their existing positions unchanged.
 * - The numeric `seed` controls node ordering fed to the layout engine so that
 *   the same graph + seed always produces the same output (deterministic).
 * - Falls back to the input positions if the layout engine throws.
 */
export function reorganizeLayout(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  mode: LayoutMode,
  direction: LayoutDirection = 'LR',
  pinnedIds: Set<string> = new Set(),
  seed: number = 1,
): Node<NodeData>[] {
  if (nodes.length === 0) return nodes;

  // Separate pinned nodes (keep position) from free nodes (recompute position).
  // Laying out only free nodes avoids the layout engine placing free nodes on top
  // of pinned anchors and prevents grouped-mode group boundaries from shifting
  // to include pinned positions.
  const freeNodes = nodes.filter((n) => !pinnedIds.has(n.id));
  if (freeNodes.length === 0) return nodes; // all pinned — nothing to reflow

  // Seeded Fisher-Yates shuffle to vary Dagre's tie-breaking for equal-rank nodes
  const rng = seededPrng(seed);
  const shuffled = [...freeNodes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Only include edges where both endpoints are free to avoid Dagre errors on
  // missing nodes. (Edges to/from pinned nodes are excluded from the layout graph.)
  const freeIds = new Set(freeNodes.map((n) => n.id));
  const freeEdges = edges.filter((e) => freeIds.has(e.source) && freeIds.has(e.target));

  let laid: Node<NodeData>[];
  try {
    laid = applyLayout(shuffled, freeEdges, mode, direction, undefined, {
      preserveInputOrder: true,
      compactRanks: true,
    });
  } catch {
    return nodes; // fall back to current positions on error
  }

  // Build a fast id→position map
  const posMap = new Map(laid.map((n) => [n.id, n.position]));

  // Pinned nodes keep their original positions; free nodes get the new layout
  return nodes.map((n) => ({
    ...n,
    position: pinnedIds.has(n.id) ? n.position : (posMap.get(n.id) ?? n.position),
  }));
}

export function randomizeLayout(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  mode: LayoutMode = 'graph',
  direction: LayoutDirection = 'LR',
  seed: number = Date.now(),
): Node<NodeData>[] {
  if (nodes.length === 0) return nodes;

  return classicLayout(nodes, edges, mode, direction, seed);
}

export function applyLayoutAlgorithm(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  algorithm: LayoutAlgorithm,
  mode: LayoutMode = 'graph',
  direction: LayoutDirection = 'LR',
  seed: number = 1,
): Node<NodeData>[] {
  if (algorithm === 'structured') return nodes;
  if (algorithm === 'classic') return classicLayout(nodes, edges, mode, direction, seed);
  if (algorithm === 'radial') return radialLayout(nodes, edges, direction, seed);
  return organicLayout(nodes, edges, mode, direction, seed);
}

function classicLayout(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  mode: LayoutMode,
  direction: LayoutDirection,
  seed: number,
): Node<NodeData>[] {
  let baseLayout: Node<NodeData>[];
  try {
    baseLayout = applyLayout(nodes, edges, mode, direction, undefined, {
      preserveInputOrder: false,
      compactRanks: true,
    });
  } catch {
    return nodes;
  }

  const shuffled = shuffleWithinRanks(baseLayout, direction, seed);
  return rotateLayout(shuffled, direction, seed);
}

function organicLayout(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  mode: LayoutMode,
  direction: LayoutDirection,
  seed: number,
): Node<NodeData>[] {
  let baseLayout: Node<NodeData>[];
  try {
    baseLayout = applyLayout(nodes, edges, mode, direction, undefined, {
      preserveInputOrder: false,
      compactRanks: true,
    });
  } catch {
    return nodes;
  }

  const positionedById = new Map<string, { x: number; y: number }>();
  const positions = new Map<string, { x: number; y: number }>(
    baseLayout.map((node) => [node.id, { x: node.position.x, y: node.position.y }]),
  );
  const rng = seededPrng(seed ^ 0x85ebca6b);
  const axis = direction === 'LR' ? 'x' : 'y';
  const crossAxis = direction === 'LR' ? 'y' : 'x';
  const iterations = Math.min(240, Math.max(120, nodes.length * 3));
  const nodeWeights = new Map(baseLayout.map((node) => [node.id, computeNodeWeight(node)]));
  const edgeWeights = edges.map((edge) => ({
    edge,
    weight: computeEdgeWeight(edge),
  }));

  for (const [id, pos] of positions.entries()) {
    pos[axis] += Math.round((rng() - 0.5) * 40);
    pos[crossAxis] += Math.round((rng() - 0.5) * 120);
    positionedById.set(id, pos);
  }

  const area = Math.max(nodes.length, 1) * 90000;
  const k = Math.sqrt(area / Math.max(nodes.length, 1));

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const temperature = (1 - iteration / iterations) * Math.max(24, k * 0.08);
    const disp = new Map<string, { x: number; y: number }>(
      baseLayout.map((node) => [node.id, { x: 0, y: 0 }]),
    );

    for (let i = 0; i < baseLayout.length; i += 1) {
      for (let j = i + 1; j < baseLayout.length; j += 1) {
        const a = baseLayout[i];
        const b = baseLayout[j];
        const posA = positions.get(a.id)!;
        const posB = positions.get(b.id)!;
        let dx = posB.x - posA.x;
        let dy = posB.y - posA.y;
        let distance = Math.hypot(dx, dy);
        if (distance < 1) {
          dx = (rng() - 0.5) * 2;
          dy = (rng() - 0.5) * 2;
          distance = Math.hypot(dx, dy);
        }

        const weightA = nodeWeights.get(a.id) ?? 1;
        const weightB = nodeWeights.get(b.id) ?? 1;
        const repulsive = ((k * k) / distance) * (0.6 + (weightA + weightB) * 0.18);
        const collisionGap = 80 + Math.sqrt(weightA + weightB) * 18;
        const collisionBoost = distance < collisionGap
          ? (collisionGap - distance) * 2.8
          : 0;
        const factor = (repulsive + collisionBoost) / distance;
        const offsetX = dx * factor;
        const offsetY = dy * factor;

        disp.get(a.id)!.x -= offsetX;
        disp.get(a.id)!.y -= offsetY;
        disp.get(b.id)!.x += offsetX;
        disp.get(b.id)!.y += offsetY;
      }
    }

    for (const { edge, weight } of edgeWeights) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const desiredLength = k * (0.85 + 0.18 / weight);
      const spring = ((distance - desiredLength) * 0.08 * weight) / distance;
      const offsetX = dx * spring;
      const offsetY = dy * spring;

      disp.get(edge.source)!.x += offsetX;
      disp.get(edge.source)!.y += offsetY;
      disp.get(edge.target)!.x -= offsetX;
      disp.get(edge.target)!.y -= offsetY;

      const flowGap = NODE_W * 0.9 + weight * 12;
      const flowAxisDelta = direction === 'LR' ? dx : dy;
      if (flowAxisDelta < flowGap) {
        const correction = ((flowGap - flowAxisDelta) * 0.18 * weight);
        if (direction === 'LR') {
          disp.get(edge.source)!.x -= correction;
          disp.get(edge.target)!.x += correction;
        } else {
          disp.get(edge.source)!.y -= correction;
          disp.get(edge.target)!.y += correction;
        }
      }
    }

    const gravityX = average(baseLayout.map((node) => positions.get(node.id)!.x));
    const gravityY = average(baseLayout.map((node) => positions.get(node.id)!.y));
    for (const node of baseLayout) {
      const pos = positions.get(node.id)!;
      const delta = disp.get(node.id)!;
      const weight = nodeWeights.get(node.id) ?? 1;
      delta.x += (gravityX - pos.x) * 0.0025 * weight;
      delta.y += (gravityY - pos.y) * 0.0025 * weight;

      const magnitude = Math.max(1, Math.hypot(delta.x, delta.y));
      pos.x += (delta.x / magnitude) * Math.min(temperature, magnitude);
      pos.y += (delta.y / magnitude) * Math.min(temperature, magnitude);
    }
  }

  const organicNodes = baseLayout.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
  const orderedNodes = enforceFlowOrdering(normalizeLayoutBounds(organicNodes), edgeWeights, direction);
  return rotateLayout(orderedNodes, direction, seed);
}

function shuffleWithinRanks(
  nodes: Node<NodeData>[],
  direction: LayoutDirection,
  seed: number,
): Node<NodeData>[] {
  const rankAxis = direction === 'LR' ? 'x' : 'y';
  const peerAxis = direction === 'LR' ? 'y' : 'x';
  const ranks = new Map<number, Node<NodeData>[]>();

  for (const node of nodes) {
    const rankKey = Math.round(node.position[rankAxis]);
    const rank = ranks.get(rankKey) ?? [];
    rank.push(node);
    ranks.set(rankKey, rank);
  }

  const positionedById = new Map<string, { x: number; y: number }>();
  let rankIndex = 0;

  for (const [, rankNodes] of Array.from(ranks.entries()).sort((a, b) => a[0] - b[0])) {
    const orderedNodes = [...rankNodes].sort((a, b) => a.position[peerAxis] - b.position[peerAxis]);
    const availableSlots = orderedNodes.map((node) => node.position[peerAxis]);
    const rng = seededPrng(seed + rankIndex * 9973);
    const shuffledNodes = [...orderedNodes];

    for (let index = shuffledNodes.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(rng() * (index + 1));
      [shuffledNodes[index], shuffledNodes[swapIndex]] = [shuffledNodes[swapIndex], shuffledNodes[index]];
    }

    shuffledNodes.forEach((node, index) => {
      const nextPeerPos = availableSlots[index];
      positionedById.set(node.id, direction === 'LR'
        ? { x: node.position.x, y: nextPeerPos }
        : { x: nextPeerPos, y: node.position.y });
    });

    rankIndex += 1;
  }

  return nodes.map((node) => ({
    ...node,
    position: positionedById.get(node.id) ?? node.position,
  }));
}

function rotateLayout(
  nodes: Node<NodeData>[],
  direction: LayoutDirection,
  seed: number,
): Node<NodeData>[] {
  if (nodes.length < 2) return nodes;

  const rng = seededPrng(seed ^ 0x9e3779b9);
  const baseAngle = direction === 'LR' ? 0.22 : 0.18;
  const angle = (rng() - 0.5) * 2 * baseAngle;
  if (Math.abs(angle) < 0.02) return nodes;

  const bounds = nodes.reduce((acc, node) => ({
    minX: Math.min(acc.minX, node.position.x),
    minY: Math.min(acc.minY, node.position.y),
    maxX: Math.max(acc.maxX, node.position.x + NODE_W),
    maxY: Math.max(acc.maxY, node.position.y + NODE_H),
  }), {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const margin = 40;

  const rotated = nodes.map((node) => {
    const x = node.position.x - centerX;
    const y = node.position.y - centerY;
    return {
      node,
      x: x * cos - y * sin,
      y: x * sin + y * cos,
    };
  });

  const minRotatedX = Math.min(...rotated.map((entry) => entry.x));
  const minRotatedY = Math.min(...rotated.map((entry) => entry.y));
  const offsetX = margin - minRotatedX;
  const offsetY = margin - minRotatedY;

  return rotated.map(({ node, x, y }) => ({
    ...node,
    position: {
      x: Math.round(x + offsetX),
      y: Math.round(y + offsetY),
    },
  }));
}

export function radialLayout(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  direction: LayoutDirection = 'LR',
  seed: number = 1,
): Node<NodeData>[] {
  if (nodes.length === 0) return nodes;

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  const incomingWeight = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    incoming.set(node.id, 0);
    outgoing.set(node.id, 0);
    incomingWeight.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    const weight = computeEdgeWeight(edge);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    incomingWeight.set(edge.target, (incomingWeight.get(edge.target) ?? 0) + weight);
    adjacency.get(edge.source)?.push(edge.target);
  }

  const roots = nodes
    .filter((node) => (incoming.get(node.id) ?? 0) === 0)
    .sort((a, b) => (outgoing.get(b.id) ?? 0) - (outgoing.get(a.id) ?? 0) || a.id.localeCompare(b.id));
  const traversalStarts = roots.length > 0
    ? roots.map((node) => node.id)
    : [...nodes]
      .sort((a, b) => (outgoing.get(b.id) ?? 0) - (outgoing.get(a.id) ?? 0) || a.id.localeCompare(b.id))
      .map((node) => node.id);

  const levels = new Map<string, number>();
  const queue = traversalStarts.map((id) => ({ id, level: 0 }));
  while (queue.length > 0) {
    const current = queue.shift()!;
    const bestLevel = levels.get(current.id);
    if (bestLevel !== undefined && bestLevel >= current.level) continue;
    levels.set(current.id, current.level);
    for (const next of adjacency.get(current.id) ?? []) {
      queue.push({ id: next, level: current.level + 1 });
    }
  }
  for (const node of nodes) {
    if (!levels.has(node.id)) levels.set(node.id, 0);
  }

  const layers = new Map<number, Node<NodeData>[]>();
  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    const layer = layers.get(level) ?? [];
    layer.push(node);
    layers.set(level, layer);
  }

  const sortedLayers = Array.from(layers.entries()).sort((a, b) => a[0] - b[0]);
  const angleOffset = seededPrng(seed ^ 0xc2b2ae35)() * Math.PI * 2;
  const centerX = 420;
  const centerY = 320;
  const baseRadiusStep = Math.max(NODE_W * 0.9, 170);
  const positions = new Map<string, { x: number; y: number }>();
  const nodeArc = NODE_W + 42;
  let radiusCursor = 0;

  sortedLayers.forEach(([level, layerNodes]) => {
    const sorted = [...layerNodes].sort((a, b) => {
      const weightDiff = (incomingWeight.get(b.id) ?? 0) - (incomingWeight.get(a.id) ?? 0);
      if (weightDiff !== 0) return weightDiff;
      const outDiff = (outgoing.get(b.id) ?? 0) - (outgoing.get(a.id) ?? 0);
      if (outDiff !== 0) return outDiff;
      return a.id.localeCompare(b.id);
    });

    if (level === 0 && sorted.length === 1) {
      positions.set(sorted[0].id, {
        x: Math.round(centerX - NODE_W / 2),
        y: Math.round(centerY - NODE_H / 2),
      });
      radiusCursor = Math.max(radiusCursor, 90);
      return;
    }

    const maxPerRing = Math.max(6, Math.floor((2 * Math.PI * Math.max(baseRadiusStep, radiusCursor + baseRadiusStep)) / nodeArc));
    const chunkSize = Math.max(4, maxPerRing);

    for (let start = 0; start < sorted.length; start += chunkSize) {
      const ringNodes = sorted.slice(start, start + chunkSize);
      const minRadiusForCount = Math.ceil((ringNodes.length * nodeArc) / (2 * Math.PI));
      const radius = Math.max(radiusCursor + baseRadiusStep, minRadiusForCount + 40);
      const ringPhase = angleOffset + level * (direction === 'LR' ? 0.22 : -0.22) + (start / chunkSize) * 0.35;

      ringNodes.forEach((node, index) => {
        const angle = ringPhase + (index / Math.max(ringNodes.length, 1)) * Math.PI * 2;
        const radialX = centerX + Math.cos(angle) * radius;
        const radialY = centerY + Math.sin(angle) * radius;
        positions.set(node.id, {
          x: Math.round(radialX - NODE_W / 2),
          y: Math.round(radialY - NODE_H / 2),
        });
      });

      radiusCursor = radius;
    }
  });

  return normalizeLayoutBounds(nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  })));
}

function enforceFlowOrdering(
  nodes: Node<NodeData>[],
  weightedEdges: Array<{ edge: Edge<EdgeData>; weight: number }>,
  direction: LayoutDirection,
): Node<NodeData>[] {
  const positions = new Map(nodes.map((node) => [node.id, { ...node.position }]));
  const axis = direction === 'LR' ? 'x' : 'y';

  for (let pass = 0; pass < 4; pass += 1) {
    for (const { edge, weight } of weightedEdges) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) continue;
      const gap = NODE_W * 0.75 + weight * 10;
      const delta = target[axis] - source[axis];
      if (delta >= gap) continue;
      const correction = (gap - delta) / 2;
      source[axis] -= correction;
      target[axis] += correction;
    }
  }

  return normalizeLayoutBounds(nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  })));
}

function normalizeLayoutBounds(nodes: Node<NodeData>[]): Node<NodeData>[] {
  if (nodes.length === 0) return nodes;
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const margin = 40;
  const shiftX = minX < margin ? margin - minX : 0;
  const shiftY = minY < margin ? margin - minY : 0;
  if (shiftX === 0 && shiftY === 0) return nodes;
  return nodes.map((node) => ({
    ...node,
    position: {
      x: Math.round(node.position.x + shiftX),
      y: Math.round(node.position.y + shiftY),
    },
  }));
}

function computeNodeWeight(node: Node<NodeData>): number {
  const workload = node.data.workload;
  const formulaWeight = workload
    ? workload.totalFormulas + workload.crossFileRefs * 2 + workload.crossSheetRefs * 1.5
    : 0;
  return 1 + Math.log1p(formulaWeight + node.data.outgoingCount + node.data.incomingCount);
}

function computeEdgeWeight(edge: Edge<EdgeData>): number {
  const refCount = edge.data?.refCount ?? 1;
  const kindBoost = edge.data?.edgeKind === 'cross-file'
    ? 1.25
    : edge.data?.edgeKind === 'external'
      ? 0.9
      : 1;
  return Math.max(1, Math.log2(refCount + 1) * kindBoost + 0.75);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}
