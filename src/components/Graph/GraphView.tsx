import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  MarkerType,
  type Connection,
  type Node,
  type Edge,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { WorkbookFile } from '../../types';
import { buildGraph, computeClusterNodes, type NodeData, type EdgeData, type LayoutMode } from '../../lib/graph';
import { C } from './constants';
import { edgeStrokeWidth, edgeAccentColor, edgeRestColor } from './edge-helpers';
import { WeightedEdge } from './WeightedEdge';
import { SheetNode } from './SheetNode';
import { ClusterNode } from './ClusterNode';
import { DetailPanel } from './DetailPanel';
import { Toolbar } from './Toolbar';
import { EdgeKindFilterBar, type EdgeKindFilterState } from './EdgeKindFilterBar';
import { Legend } from './Legend';
import { EmptyState } from './EmptyState';

// ── Node & edge type registries ──────────────────────────────────────────────

const nodeTypes = { sheet: SheetNode, cluster: ClusterNode };
const edgeTypes = { weighted: WeightedEdge };

// ── Main Component ────────────────────────────────────────────────────────────

interface GraphViewProps {
  workbooks: WorkbookFile[];
  highlightedFile?: string | null;
  onHighlightClear?: () => void;
  hiddenFiles?: Set<string>;
  onToggleHidden?: (workbookName: string) => void;
}

function GraphViewInner({ workbooks, highlightedFile, onHighlightClear, hiddenFiles, onToggleHidden }: GraphViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<EdgeData>>([]);
  const [selectedNodes, setSelectedNodes] = useState<Node<NodeData>[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<Edge<EdgeData> | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('graph');
  const [edgeKindFilter, setEdgeKindFilter] = useState<EdgeKindFilterState>({
    internal: true, 'cross-file': true, external: true, 'named-range': true, table: true,
  });
  const [showNamedRanges, setShowNamedRanges] = useState(false);
  const [showTables, setShowTables] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [focusDepth, setFocusDepth] = useState(1);
  const [focusDirection, setFocusDirection] = useState<'both' | 'upstream' | 'downstream'>('both');
  const { fitView } = useReactFlow();
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Check if any loaded workbook has named ranges / Excel tables (for showing toggles)
  const hasNamedRanges = useMemo(() => workbooks.some((wb) => wb.namedRanges.length > 0), [workbooks]);
  const hasTables = useMemo(() => workbooks.some((wb) => wb.tables.length > 0), [workbooks]);

  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph(workbooks, layoutMode, hiddenFiles, showNamedRanges, showTables);
    setNodes(n);
    setEdges(e);
    // Reset selection & focus when graph data changes — intentional synchronization
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedNodes([]);
    setSelectedEdge(null);
    setSelectedNodeIds(new Set());
    setFocusNodeId(null);
  }, [workbooks, layoutMode, hiddenFiles, showNamedRanges, showTables, setNodes, setEdges]);

  // Highlight file: select its nodes and fit view to them
  useEffect(() => {
    if (!highlightedFile) return;
    const matchIds = nodes
      .filter((n) => n.data.workbookName === highlightedFile)
      .map((n) => n.id);
    if (matchIds.length === 0) return;

    // Sync selection to highlighted file — intentional synchronization
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedNodeIds(new Set(matchIds));
    setSelectedNodes(nodes.filter((n) => matchIds.includes(n.id)));
    setSelectedEdge(null);

    // fitView after a frame so React Flow has updated
    requestAnimationFrame(() => {
      fitView({ nodes: matchIds.map((id) => ({ id })), padding: 0.4, duration: 400 });
    });

    // Auto-clear highlight after 3 seconds
    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      onHighlightClear?.();
    }, 3000);

    return () => clearTimeout(highlightTimerRef.current);
  }, [highlightedFile, nodes, fitView, onHighlightClear]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  // Focus mode: directional BFS to find N-hop neighbors
  // Edge direction: source → target (source provides data, target consumes)
  // Upstream = follow edges backward to sources, Downstream = follow forward to consumers
  const focusNeighborIds = useMemo(() => {
    if (!focusNodeId) return null;
    const neighbors = new Set<string>([focusNodeId]);
    let frontier = [focusNodeId];
    const dir = focusDirection;
    for (let hop = 0; hop < focusDepth; hop++) {
      const next: string[] = [];
      for (const nid of frontier) {
        for (const edge of edges) {
          // Downstream: follow source→target (nid is source, find targets)
          if ((dir === 'both' || dir === 'downstream') && edge.source === nid && !neighbors.has(edge.target)) {
            neighbors.add(edge.target);
            next.push(edge.target);
          }
          // Upstream: follow target→source (nid is target, find sources)
          if ((dir === 'both' || dir === 'upstream') && edge.target === nid && !neighbors.has(edge.source)) {
            neighbors.add(edge.source);
            next.push(edge.source);
          }
        }
      }
      frontier = next;
    }
    return neighbors;
  }, [focusNodeId, focusDepth, focusDirection, edges]);

  // Apply edge filter + styles: kind-based color + ref-count weight, accent glow when highlighted
  const styledEdges = useMemo(() => {
    return edges.filter((edge) => {
      const kind = (edge.data as EdgeData | undefined)?.edgeKind ?? 'internal';
      return edgeKindFilter[kind];
    }).map((edge) => {
      const adjacent = selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target);
      const isSelectedEdge = selectedEdge?.id === edge.id;
      const highlight = adjacent || isSelectedEdge;
      const hasSelection = selectedNodeIds.size > 0 || selectedEdge !== null;
      const inFocus = !focusNeighborIds || (focusNeighborIds.has(edge.source) && focusNeighborIds.has(edge.target));

      const edgeData = edge.data as EdgeData | undefined;
      const refCount = edgeData?.refCount ?? 1;
      const kind = edgeData?.edgeKind ?? 'internal';
      const baseWidth = edgeStrokeWidth(refCount);
      const strokeColor = highlight ? edgeAccentColor(kind) : edgeRestColor(kind, refCount);
      const glowColor = edgeAccentColor(kind);
      const arrowSize = Math.max(6, Math.min(6 + (baseWidth - 1.2) * 0.3, 8));

      const dimmedBySelection = hasSelection && !highlight;
      const dimmedByFocus = !inFocus;

      return {
        ...edge,
        type: 'weighted',
        style: {
          stroke: strokeColor,
          strokeWidth: highlight ? baseWidth + 1 : baseWidth,
          opacity: dimmedByFocus ? 0.04 : dimmedBySelection ? 0.12 : 1,
          filter: highlight ? `drop-shadow(0 0 ${baseWidth + 2}px ${glowColor}88)` : 'none',
          transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s, filter 0.2s',
        },
        animated: highlight,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: arrowSize,
          height: arrowSize,
        },
      };
    });
  }, [edges, selectedNodeIds, selectedEdge, edgeKindFilter, focusNeighborIds]);

  // Apply focus dimming to nodes + add cluster background nodes
  const styledNodes = useMemo((): Node<NodeData>[] => {
    const result: Node<NodeData>[] = [];

    // Compute clusters: only in 'grouped' layout mode
    if (layoutMode === 'grouped') {
      const clusters = computeClusterNodes(nodes);
      const styledClusters = focusNeighborIds
        ? clusters.map((c) => {
            const hasFocusedMember = nodes.some(
              (n) => n.data.workbookName === c.data.workbookName && focusNeighborIds.has(n.id),
            );
            return {
              ...c,
              style: { ...c.style, opacity: hasFocusedMember ? 1 : 0.08, transition: 'opacity 0.2s' },
            };
          })
        : clusters;
      result.push(...(styledClusters as unknown as Node<NodeData>[]));
    }

    const mapped = focusNeighborIds
      ? nodes.map((node) => ({
          ...node,
          style: {
            ...node.style,
            opacity: focusNeighborIds.has(node.id) ? 1 : 0.08,
            transition: 'opacity 0.2s',
          },
        }))
      : nodes;
    result.push(...mapped);
    return result;
  }, [nodes, focusNeighborIds, layoutMode]);

  const onSelectionChange = useCallback(
    ({ nodes: sNodes, edges: sEdges }: OnSelectionChangeParams) => {
      const typedNodes = sNodes as Node<NodeData>[];
      const typedEdges = sEdges as Edge<EdgeData>[];
      setSelectedNodes(typedNodes);
      setSelectedNodeIds(new Set(typedNodes.map((n) => n.id)));
      setSelectedEdge(typedNodes.length === 0 && typedEdges.length > 0 ? typedEdges[0] : null);
    },
    [],
  );

  function onPaneClick() {
    setSelectedNodes([]);
    setSelectedEdge(null);
    setSelectedNodeIds(new Set());
    setFocusNodeId(null);
  }

  if (workbooks.length === 0) return <EmptyState />;

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        multiSelectionKeyCode="Shift"
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.15}
        maxZoom={2.5}
        style={{ background: C.bg }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: C.border, strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: C.border, width: 8, height: 8 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#1a2030"
          gap={28}
          size={1.5}
        />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as NodeData;
            if (d.isTable) return C.violet;
            if (d.isNamedRange) return C.emerald;
            return d.isExternal ? C.amber : C.accent;
          }}
          maskColor="rgba(11,13,17,0.8)"
          nodeStrokeWidth={0}
        />
      </ReactFlow>

      <Toolbar layoutMode={layoutMode} onLayoutChange={setLayoutMode} />
      <EdgeKindFilterBar filter={edgeKindFilter} onFilterChange={setEdgeKindFilter} showNamedRanges={showNamedRanges} showTables={showTables} />

      {/* Named Ranges toggle — only shown when workbooks contain named ranges */}
      {hasNamedRanges && layoutMode !== 'overview' && (
        <button
          onClick={() => setShowNamedRanges((v) => !v)}
          style={{
            position: 'absolute', top: 92, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
            background: showNamedRanges ? `${C.emerald}22` : C.bgPanel,
            border: `1px solid ${showNamedRanges ? `${C.emerald}55` : C.border}`,
            borderRadius: 10, cursor: 'pointer',
            boxShadow: showNamedRanges ? `0 4px 20px rgba(0,0,0,0.6), 0 0 8px ${C.emeraldGlow}` : '0 4px 20px rgba(0,0,0,0.6)',
            transition: 'all 0.15s',
          }}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={showNamedRanges ? C.emerald : C.textMuted} strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 600, color: showNamedRanges ? C.emerald : C.textMuted }}>
            Named Ranges
          </span>
        </button>
      )}

      {/* Tables toggle — only shown when workbooks contain Excel tables */}
      {hasTables && layoutMode !== 'overview' && (
        <button
          onClick={() => setShowTables((v) => !v)}
          style={{
            position: 'absolute', top: 132, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
            background: showTables ? C.violetDim : C.bgPanel,
            border: `1px solid ${showTables ? `${C.violet}55` : C.border}`,
            borderRadius: 10, cursor: 'pointer',
            boxShadow: showTables ? `0 4px 20px rgba(0,0,0,0.6), 0 0 8px ${C.violetGlow}` : '0 4px 20px rgba(0,0,0,0.6)',
            transition: 'all 0.15s',
          }}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={showTables ? C.violet : C.textMuted} strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18M9 3v18M15 3v18" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 600, color: showTables ? C.violet : C.textMuted }}>
            Tables
          </span>
        </button>
      )}

      <Legend showNamedRanges={showNamedRanges} showTables={showTables} />

      {/* Focus Mode Controls */}
      {focusNodeId && (
        <div data-testid="focus-panel" style={{
          position: 'absolute', top: 12, right: 16, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          background: C.bgPanel,
          border: `1px solid ${C.accent}44`,
          borderRadius: 10,
          boxShadow: `0 4px 20px rgba(0,0,0,0.6), 0 0 12px ${C.accentGlow}`,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Focus
          </span>
          <div style={{ width: 1, height: 16, background: C.border }} />
          <span style={{ fontSize: 11, color: C.textSecondary }}>Hops:</span>
          {[1, 2, 3].map((d) => (
            <button
              key={d}
              onClick={() => setFocusDepth(d)}
              style={{
                width: 24, height: 24, borderRadius: 6,
                border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 700,
                background: focusDepth === d ? C.accent : 'transparent',
                color: focusDepth === d ? '#fff' : C.textMuted,
                transition: 'all 0.15s',
              }}
            >
              {d}
            </button>
          ))}
          <div style={{ width: 1, height: 16, background: C.border }} />
          {/* Direction toggle */}
          {(['upstream', 'both', 'downstream'] as const).map((dir) => {
            const active = focusDirection === dir;
            const labels = { upstream: '↑ Up', both: '↕ Both', downstream: '↓ Down' };
            return (
              <button
                key={dir}
                onClick={() => setFocusDirection(dir)}
                style={{
                  padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 10, fontWeight: 600,
                  background: active ? C.accent : 'transparent',
                  color: active ? '#fff' : C.textMuted,
                  transition: 'all 0.15s',
                }}
              >
                {labels[dir]}
              </button>
            );
          })}
          <div style={{ width: 1, height: 16, background: C.border }} />
          <button
            onClick={() => setFocusNodeId(null)}
            style={{
              padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 10, fontWeight: 600,
              background: 'transparent', color: C.textMuted,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = C.textPrimary)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = C.textMuted)}
          >
            Exit
          </button>
        </div>
      )}

      <DetailPanel
        selectedNodes={selectedNodes}
        selectedEdge={selectedEdge}
        onClose={() => {
          setSelectedNodes([]);
          setSelectedEdge(null);
          setSelectedNodeIds(new Set());
        }}
        onFocus={setFocusNodeId}
        focusNodeId={focusNodeId}
        onToggleHidden={onToggleHidden}
        hiddenFiles={hiddenFiles}
        allEdges={edges}
      />
    </div>
  );
}

export function GraphView(props: GraphViewProps) {
  return (
    <ReactFlowProvider>
      <GraphViewInner {...props} />
    </ReactFlowProvider>
  );
}
