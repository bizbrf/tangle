import Dagre from '@dagrejs/dagre';
import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { WorkbookFile, EdgeReference, SheetWorkload } from '../types';

export type NodeData = {
  label: string;
  workbookName: string;
  sheetName: string;
  isExternal: boolean;
  isFileNode: boolean;
  sheetCount?: number;
  outgoingCount: number;
  incomingCount: number;
  workload: SheetWorkload | null;
  [key: string]: unknown;
};

export type EdgeKind = 'internal' | 'cross-file' | 'external';

export type EdgeData = {
  references: EdgeReference[];
  refCount: number;
  edgeKind: EdgeKind;
  [key: string]: unknown;
};

export type LayoutMode = 'graph' | 'grouped' | 'overview';

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
  return n.toLowerCase().replace(/\.xlsx$/i, '');
}

export function buildGraph(
  workbooks: WorkbookFile[],
  layoutMode: LayoutMode = 'graph',
  hiddenFiles: Set<string> = new Set(),
): { nodes: Node<NodeData>[]; edges: Edge<EdgeData>[] } {
  const visibleWorkbooks = hiddenFiles.size > 0
    ? workbooks.filter((wb) => !hiddenFiles.has(wb.name))
    : workbooks;
  if (layoutMode === 'overview') return buildOverviewGraph(visibleWorkbooks);
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

        // Edge: data SOURCE → data CONSUMER (arrow points toward the consumer)
        const eid = edgeId(dataSourceId, consumerId);
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

  const nodeList = applyLayout(Array.from(nodesMap.values()), edges, layoutMode);
  return { nodes: nodeList, edges };
}

// ── Layout strategies ─────────────────────────────────────────────────────────

function applyLayout(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  mode: LayoutMode,
): Node<NodeData>[] {
  if (mode === 'grouped') return groupedLayout(nodes, edges);
  return dagreLayout(nodes, edges, 'LR');
}

function dagreLayout(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  rankdir: 'LR' | 'TB',
): Node<NodeData>[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir,
    ranksep: rankdir === 'LR' ? 130 : 90,
    nodesep: rankdir === 'LR' ? 55 : 45,
    marginx: 60,
    marginy: 60,
  });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  Dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
    };
  });
}

function groupedLayout(nodes: Node<NodeData>[], edges: Edge<EdgeData>[]): Node<NodeData>[] {
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
  g.setGraph({ rankdir: 'LR', ranksep: 130, nodesep: 80, marginx: 60, marginy: 60 });

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

// ── Overview graph (file-level) ───────────────────────────────────────────────

function buildOverviewGraph(
  workbooks: WorkbookFile[],
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
      const displayName = wb.name.replace(/\.xlsx$/i, '');
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
          const displayName = resolvedTargetWb.replace(/\.xlsx$/i, '');
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
        label: wb.replace(/\.xlsx$/i, ''),
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
    data: { label: sheetName, workbookName, sheetName, isExternal: false, isFileNode: false, outgoingCount: 0, incomingCount: 0, workload },
  };
}

function makeFileNode(id: string, workbookName: string): Node<NodeData> {
  const displayName = workbookName.replace(/\.xlsx$/i, '');
  return {
    id,
    type: 'sheet',
    position: { x: 0, y: 0 },
    data: { label: displayName, workbookName, sheetName: displayName, isExternal: true, isFileNode: true, outgoingCount: 0, incomingCount: 0, workload: null },
  };
}
