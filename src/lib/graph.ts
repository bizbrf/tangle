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
  isTable: boolean;
  tableName?: string;
  tableRef?: string;
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

const NODE_W = 190;
const NODE_H = 88;
const DEFAULT_LAYOUT_SEED = 'tangle';

export type LayoutOptions = {
  layoutSeed?: string | number;
  snapshotHash?: string;
};

function hashString(input: string): number {
  // FNV-1a 32-bit hash for deterministic seeding
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function combineSeeds(seed: string | number, snapshotHash?: string): string {
  if (!snapshotHash) return String(seed);
  return `${seed}|${snapshotHash}`;
}

export function graphSnapshotKey(
  workbooks: WorkbookFile[],
  hiddenFiles: Set<string> = new Set(),
  showNamedRanges: boolean = false,
  showTables: boolean = false,
): string {
  const parts: string[] = [`nr:${showNamedRanges ? 1 : 0}`, `tbl:${showTables ? 1 : 0}`];
  const visible = workbooks.filter((wb) => !hiddenFiles.has(wb.name));
  const sorted = [...visible].sort((a, b) => a.name.localeCompare(b.name));
  for (const wb of sorted) {
    parts.push(stripExcelExt(wb.name));
    const sortedSheets = [...wb.sheets].sort((a, b) => a.sheetName.localeCompare(b.sheetName));
    for (const sheet of sortedSheets) {
      parts.push(`${sheet.sheetName}:${sheet.references.length}`);
    }
  }
  return parts.join('|');
}

function seededScore(value: string, seed: string | number): number {
  return hashString(`${seed}:${value}`);
}

function orderNodesBySeed<T extends { id: string }>(nodes: T[], seed: string | number): T[] {
  return [...nodes].sort((a, b) => {
    const diff = seededScore(a.id, seed) - seededScore(b.id, seed);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

function orderEdgesBySeed<T extends { source: string; target: string }>(edges: T[], seed: string | number): T[] {
  return [...edges].sort((a, b) => {
    const aKey = `${a.source}->${a.target}`;
    const bKey = `${b.source}->${b.target}`;
    const diff = seededScore(aKey, seed) - seededScore(bKey, seed);
    if (diff !== 0) return diff;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.target.localeCompare(b.target);
  });
}

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

export function buildGraph(
  workbooks: WorkbookFile[],
  layoutMode: LayoutMode = 'graph',
  hiddenFiles: Set<string> = new Set(),
  showNamedRanges: boolean = false,
  showTables: boolean = false,
  layoutDirection: LayoutDirection = 'LR',
  layoutOptions: LayoutOptions = {},
): { nodes: Node<NodeData>[]; edges: Edge<EdgeData>[] } {
  const { layoutSeed = DEFAULT_LAYOUT_SEED, snapshotHash } = layoutOptions;
  const visibleWorkbooks = hiddenFiles.size > 0
    ? workbooks.filter((wb) => !hiddenFiles.has(wb.name))
    : workbooks;
  const graphHash = snapshotHash ?? graphSnapshotKey(visibleWorkbooks, hiddenFiles, showNamedRanges, showTables);
  const effectiveSeed = combineSeeds(layoutSeed, graphHash);

  if (layoutMode === 'overview') return buildOverviewGraph(visibleWorkbooks, effectiveSeed);
  const uploadedSheetIds = new Set<string>();
  const uploadedWbNames = new Set<string>();
  const nodesMap = new Map<string, Node<NodeData>>();
  const edgesMap = new Map<string, EdgeData>();

  // Normalized name → canonical uploaded filename (uses ALL workbooks for resolution)
  const normalizedWbName = new Map<string, string>();
  for (const wb of workbooks) {
    const key = normWb(wb.name);
    normalizedWbName.set(key, wb.name);
    uploadedWbNames.add(key);
  }
  // Track visible workbook names for node visibility
  const visibleWbNames = new Set<string>(visibleWorkbooks.map((wb) => normWb(wb.name)));

  function resolveWbName(raw: string): string {
    return normalizedWbName.get(normWb(raw)) ?? raw;
  }

  // Build workload lookup from all workbooks (including hidden, for resolution)
  const workloadMap = new Map<string, SheetWorkload>();
  for (const wb of workbooks) {
    for (const sheet of wb.sheets) {
      workloadMap.set(sheetNodeId(wb.name, sheet.sheetName), sheet.workload);
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
        const resolvedTargetWb = ref.targetWorkbook
          ? resolveWbName(ref.targetWorkbook)
          : wb.name;

        const isSameWb =
          ref.targetWorkbook === null ||
          normWb(resolvedTargetWb) === normWb(wb.name);

        const targetIsUploaded = uploadedWbNames.has(normWb(resolvedTargetWb));
        const targetIsVisible = visibleWbNames.has(normWb(resolvedTargetWb));

        // Data SOURCE node: sheet-level for uploaded+visible files, file-level for external/hidden
        let dataSourceId: string;
        if (!targetIsUploaded || !targetIsVisible) {
          dataSourceId = fileNodeId(resolvedTargetWb);
          if (!nodesMap.has(dataSourceId)) {
            nodesMap.set(dataSourceId, makeFileNode(dataSourceId, resolvedTargetWb));
          }
        } else {
          dataSourceId = sheetNodeId(resolvedTargetWb, ref.targetSheet);
          if (!nodesMap.has(dataSourceId)) {
            nodesMap.set(dataSourceId, makeSheetNode(dataSourceId, resolvedTargetWb, ref.targetSheet, workloadMap.get(dataSourceId) ?? null));
          }
        }

        if (dataSourceId === consumerId) continue;

        const edgeKind: EdgeKind = isSameWb
          ? 'internal'
          : targetIsUploaded
            ? 'cross-file'
            : 'external';

        const edgeRef: EdgeReference = {
          sourceCell: ref.sourceCell,
          targetCells: ref.cells,
          formula: ref.formula,
        };

        // Named range: when toggle is ON, create intermediate NR node + two edges
        if (showNamedRanges && ref.namedRangeName) {
          const nrId = `[nr]${wb.name}::${ref.namedRangeName}`;
          if (!nodesMap.has(nrId)) {
            nodesMap.set(nrId, makeNamedRangeNode(nrId, wb.name, ref.namedRangeName, ref.cells.join(', '), ref.targetSheet));
          }
          // Edge 1: data source → NR node (named-range kind)
          const eid1 = edgeId(dataSourceId, nrId);
          if (!edgesMap.has(eid1)) {
            edgesMap.set(eid1, { references: [], refCount: 0, edgeKind: 'named-range' });
          }
          const ed1 = edgesMap.get(eid1)!;
          ed1.references.push(edgeRef);
          ed1.refCount = ed1.references.length;

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
            nodesMap.set(tableId, makeTableNode(tableId, wb.name, ref.tableName, ref.cells.join(', '), ref.targetSheet));
          }
          // Edge 1: data source → table node (table kind)
          const eid1 = edgeId(dataSourceId, tableId);
          if (!edgesMap.has(eid1)) {
            edgesMap.set(eid1, { references: [], refCount: 0, edgeKind: 'table' });
          }
          const ed1 = edgesMap.get(eid1)!;
          ed1.references.push(edgeRef);
          ed1.refCount = ed1.references.length;

          // Edge 2: table node → consumer (table kind)
          const eid2 = edgeId(tableId, consumerId);
          if (!edgesMap.has(eid2)) {
            edgesMap.set(eid2, { references: [], refCount: 0, edgeKind: 'table' });
          }
          const ed2 = edgesMap.get(eid2)!;
          ed2.references.push(edgeRef);
          ed2.refCount = ed2.references.length;
        } else {
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

  const nodeList = applyLayout(Array.from(nodesMap.values()), edges, layoutMode, layoutDirection, effectiveSeed);
  return { nodes: nodeList, edges };
}

// ── Layout strategies ─────────────────────────────────────────────────────────

function applyLayout(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  mode: LayoutMode,
  direction: LayoutDirection = 'LR',
  layoutSeed: string | number = DEFAULT_LAYOUT_SEED,
): Node<NodeData>[] {
  if (mode === 'grouped') return groupedLayout(nodes, edges, direction, layoutSeed);
  return dagreLayout(nodes, edges, direction, layoutSeed);
}

function dagreLayout(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  rankdir: 'LR' | 'TB',
  layoutSeed: string | number,
): Node<NodeData>[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir,
    ranksep: rankdir === 'LR' ? 130 : 90,
    nodesep: rankdir === 'LR' ? 55 : 45,
    marginx: 60,
    marginy: 60,
  });

  const orderedNodes = orderNodesBySeed(nodes, layoutSeed);
  const orderedEdges = orderEdgesBySeed(edges, layoutSeed);

  orderedNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  orderedEdges.forEach((e) => g.setEdge(e.source, e.target));

  Dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
    };
  });
}

function groupedLayout(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  direction: LayoutDirection = 'LR',
  layoutSeed: string | number = DEFAULT_LAYOUT_SEED,
): Node<NodeData>[] {
  const INTRA_VGAP = 100;
  const INTRA_PAD_X = 40;
  const INTRA_PAD_Y = 56; // top padding (room for cluster label)
  const INTRA_PAD_BOTTOM = 30;

  // Group nodes by workbook; collect external file nodes separately
  const wbGroups = new Map<string, Node<NodeData>[]>();
  const externalNodes: Node<NodeData>[] = [];

  const orderedNodes = orderNodesBySeed(nodes, layoutSeed);

  for (const node of orderedNodes) {
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

  const groupedEntries = orderNodesBySeed(
    Array.from(groupSizes.entries()).map(([wb, size]) => ({ id: wb, size })),
    layoutSeed,
  );
  for (const { id: wb, size } of groupedEntries) {
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
  const orderedGroupEdges = orderEdgesBySeed(edges, layoutSeed);
  for (const edge of orderedGroupEdges) {
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

// ── Overview graph (file-level) ───────────────────────────────────────────────

function buildOverviewGraph(
  workbooks: WorkbookFile[],
  layoutSeed: string | number,
): { nodes: Node<NodeData>[]; edges: Edge<EdgeData>[] } {
  const uploadedWbNames = new Set<string>();
  const normalizedWbName = new Map<string, string>();
  for (const wb of workbooks) {
    const key = normWb(wb.name);
    normalizedWbName.set(key, wb.name);
    uploadedWbNames.add(key);
  }
  function resolveWbName(raw: string): string {
    return normalizedWbName.get(normWb(raw)) ?? raw;
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

        const resolvedTargetWb = resolveWbName(ref.targetWorkbook);
        if (normWb(resolvedTargetWb) === normWb(wb.name)) continue; // same file

        const targetIsUploaded = uploadedWbNames.has(normWb(resolvedTargetWb));
        const targetFileId = fileNodeId(resolvedTargetWb);

        if (!nodesMap.has(targetFileId)) {
          const displayName = stripExcelExt(resolvedTargetWb);
          nodesMap.set(targetFileId, {
            id: targetFileId,
            type: 'sheet',
            position: { x: 0, y: 0 },
            data: {
              label: displayName,
              workbookName: resolvedTargetWb,
              sheetName: displayName,
              isExternal: !targetIsUploaded,
              isFileNode: true,
              isNamedRange: false,
              isTable: false,
              outgoingCount: 0,
              incomingCount: 0,
              workload: null,
            },
          });
        }

        const edgeKind: EdgeKind = targetIsUploaded ? 'cross-file' : 'external';
        const eid = edgeId(targetFileId, sourceFileId);
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

  const nodeList = dagreLayout(Array.from(nodesMap.values()), edges, 'LR', layoutSeed);
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

// ── Quality metrics ─────────────────────────────────────────────────────────

function nodeCenter(node: Node<NodeData>): { x: number; y: number } {
  return { x: node.position.x + NODE_W / 2, y: node.position.y + NODE_H / 2 };
}

function segmentsIntersect(a1: { x: number; y: number }, a2: { x: number; y: number }, b1: { x: number; y: number }, b2: { x: number; y: number }): boolean {
  const det = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = det(a1, a2, b1);
  const d2 = det(a1, a2, b2);
  const d3 = det(b1, b2, a1);
  const d4 = det(b1, b2, a2);
  return (d1 * d2 < 0) && (d3 * d4 < 0);
}

export function countNodeOverlaps(nodes: Node<NodeData>[]): number {
  let overlaps = 0;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const ax2 = a.position.x + NODE_W;
    const ay2 = a.position.y + NODE_H;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const bx2 = b.position.x + NODE_W;
      const by2 = b.position.y + NODE_H;
      const overlap = a.position.x < bx2 && ax2 > b.position.x && a.position.y < by2 && ay2 > b.position.y;
      if (overlap) overlaps++;
    }
  }
  return overlaps;
}

export function countEdgeCrossings(nodes: Node<NodeData>[], edges: Edge<EdgeData>[]): number {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const segments = edges
    .map((e) => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (!src || !tgt) return null;
      return { a: nodeCenter(src), b: nodeCenter(tgt), id: e.id, srcId: e.source, tgtId: e.target };
    })
    .filter((s): s is { a: { x: number; y: number }; b: { x: number; y: number }; id: string; srcId: string; tgtId: string } => s !== null);

  let crossings = 0;
  for (let i = 0; i < segments.length; i++) {
    const segA = segments[i];
    for (let j = i + 1; j < segments.length; j++) {
      const segB = segments[j];
      // Ignore edges that share endpoints — crossing there is expected
      if (segA.srcId === segB.srcId || segA.srcId === segB.tgtId || segA.tgtId === segB.srcId || segA.tgtId === segB.tgtId) continue;
      if (segmentsIntersect(segA.a, segA.b, segB.a, segB.b)) crossings++;
    }
  }
  return crossings;
}

export function edgeLengthVariance(nodes: Node<NodeData>[], edges: Edge<EdgeData>[]): number {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const lengths: number[] = [];
  for (const e of edges) {
    const src = nodeMap.get(e.source);
    const tgt = nodeMap.get(e.target);
    if (!src || !tgt) continue;
    const c1 = nodeCenter(src);
    const c2 = nodeCenter(tgt);
    const len = Math.hypot(c1.x - c2.x, c1.y - c2.y);
    lengths.push(len);
  }
  if (lengths.length === 0) return 0;
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  return lengths.reduce((acc, len) => acc + (len - mean) ** 2, 0) / lengths.length;
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

function makeNamedRangeNode(id: string, workbookName: string, name: string, cells: string, targetSheet: string): Node<NodeData> {
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
      isTable: false,
      outgoingCount: 0,
      incomingCount: 0,
      workload: null,
    },
  };
}

function makeTableNode(id: string, workbookName: string, tableName: string, cells: string, targetSheet: string): Node<NodeData> {
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
      outgoingCount: 0,
      incomingCount: 0,
      workload: null,
    },
  };
}
