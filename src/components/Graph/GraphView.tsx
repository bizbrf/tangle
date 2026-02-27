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
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  MarkerType,
  useInternalNode,
  type Connection,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeProps,
  type OnSelectionChangeParams,
  type InternalNode,
  Handle,
  Position,
} from '@xyflow/react';

// Compute the intersection point of a line from the center of `node` toward
// the center of `otherNode` with `node`'s bounding rectangle.
function getNodeIntersection(node: InternalNode, otherNode: InternalNode): { x: number; y: number } {
  const w = node.measured?.width ?? 190;
  const h = node.measured?.height ?? 88;
  const nx = node.internals.positionAbsolute.x + w / 2;
  const ny = node.internals.positionAbsolute.y + h / 2;

  const ow = otherNode.measured?.width ?? 190;
  const oh = otherNode.measured?.height ?? 88;
  const ox = otherNode.internals.positionAbsolute.x + ow / 2;
  const oy = otherNode.internals.positionAbsolute.y + oh / 2;

  const dx = ox - nx;
  const dy = oy - ny;

  if (dx === 0 && dy === 0) return { x: nx, y: ny };

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const hw = w / 2;
  const hh = h / 2;

  // Which edge of the rectangle does the line cross first?
  if (absDx / hw > absDy / hh) {
    // Exits left or right
    const sign = dx > 0 ? 1 : -1;
    return { x: nx + sign * hw, y: ny + (dy * hw) / absDx };
  } else {
    // Exits top or bottom
    const sign = dy > 0 ? 1 : -1;
    return { x: nx + (dx * hh) / absDy, y: ny + sign * hh };
  }
}
import '@xyflow/react/dist/style.css';
import type { WorkbookFile, EdgeReference } from '../../types';
import { buildGraph, computeClusterNodes, stripExcelExt, type NodeData, type EdgeData, type ClusterData, type EdgeKind, type LayoutMode } from '../../lib/graph';

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  accent: '#e8445a',
  accentDim: 'rgba(232,68,90,0.15)',
  accentGlow: 'rgba(232,68,90,0.3)',
  amber: '#f59e0b',
  amberDim: 'rgba(245,158,11,0.15)',
  amberGlow: 'rgba(245,158,11,0.3)',
  emerald: '#10b981',
  emeraldDim: 'rgba(16,185,129,0.15)',
  emeraldGlow: 'rgba(16,185,129,0.3)',
  surface: '#131720',
  surfaceRaised: '#191e28',
  border: '#1e2535',
  borderHover: '#2a3347',
  textPrimary: '#edf0f5',
  textSecondary: '#7b8799',
  textMuted: '#3d4a5c',
} as const;

// ── Edge helpers ─────────────────────────────────────────────────────────────

// Stroke width scales with ref count using a log curve: thin for 1, moderate for 20+
function edgeStrokeWidth(refCount: number): number {
  return Math.min(1.2 + Math.log2(refCount + 1) * 0.8, 4.5);
}

// Full accent color per edge kind (used when highlighted)
function edgeAccentColor(kind: EdgeKind): string {
  if (kind === 'internal')     return '#e8445a'; // coral-red — same workbook
  if (kind === 'cross-file')   return '#818cf8'; // indigo    — both uploaded
  if (kind === 'named-range')  return '#10b981'; // emerald   — named range
  return '#f59e0b';                              // amber     — external file
}

// Resting color: a subtle tint of the kind's accent, scaled slightly by ref count
function edgeRestColor(kind: EdgeKind, refCount: number): string {
  const opacity = Math.min(0.2 + Math.log2(refCount + 1) * 0.07, 0.55).toFixed(2);
  if (kind === 'internal')     return `rgba(232, 68,  90,  ${opacity})`;
  if (kind === 'cross-file')   return `rgba(129, 140, 248, ${opacity})`;
  if (kind === 'named-range')  return `rgba(16,  185, 129, ${opacity})`;
  return                              `rgba(245, 158, 11,  ${opacity})`;
}

// ── Floating edge helper ───────────────────────────────────────────────────────

// Determine which side of the node an intersection point falls on.
function getEdgePosition(node: InternalNode, pt: { x: number; y: number }): Position {
  const cx = node.internals.positionAbsolute.x + (node.measured?.width ?? 190) / 2;
  const cy = node.internals.positionAbsolute.y + (node.measured?.height ?? 88) / 2;
  const dx = pt.x - cx;
  const dy = pt.y - cy;
  const hw = (node.measured?.width ?? 190) / 2;
  const hh = (node.measured?.height ?? 88) / 2;
  if (Math.abs(dx / hw) > Math.abs(dy / hh)) {
    return dx > 0 ? Position.Right : Position.Left;
  }
  return dy > 0 ? Position.Bottom : Position.Top;
}

// ── Custom weighted edge ───────────────────────────────────────────────────────

function WeightedEdge({
  id,
  source, target,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, style, markerEnd,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const edgeData = data as EdgeData | undefined;
  const refCount = edgeData?.refCount ?? 1;

  // Compute floating intersection points when both nodes are available.
  let sx = sourceX, sy = sourceY, sp = sourcePosition;
  let tx = targetX, ty = targetY, tp = targetPosition;
  if (sourceNode && targetNode) {
    const srcPt = getNodeIntersection(sourceNode, targetNode);
    const tgtPt = getNodeIntersection(targetNode, sourceNode);
    sx = srcPt.x; sy = srcPt.y; sp = getEdgePosition(sourceNode, srcPt);
    tx = tgtPt.x; ty = tgtPt.y; tp = getEdgePosition(targetNode, tgtPt);
  }

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sx, sourceY: sy, sourcePosition: sp,
    targetX: tx, targetY: ty, targetPosition: tp,
  });

  const strokeColor = (style?.stroke as string) ?? C.border;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />

      {/* Count badge — only shown when there's more than 1 reference */}
      {refCount > 1 && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 10,
            }}
          >
            <div style={{
              background: '#0d1017',
              border: `1px solid ${strokeColor}`,
              borderRadius: 99,
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 700,
              color: strokeColor,
              letterSpacing: '0.03em',
              boxShadow: `0 2px 8px rgba(0,0,0,0.6), 0 0 8px ${strokeColor}44`,
              whiteSpace: 'nowrap',
            }}>
              {refCount}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ── Custom Node ───────────────────────────────────────────────────────────────

function SheetNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const [hovered, setHovered] = useState(false);
  const isExt = data.isExternal;
  const accent = isExt ? C.amber : C.accent;
  const accentGlow = isExt ? C.amberGlow : C.accentGlow;

  const containerStyle: React.CSSProperties = {
    background: selected ? C.surfaceRaised : hovered ? '#161b25' : C.surface,
    border: `1.5px solid ${selected ? accent : hovered ? C.borderHover : C.border}`,
    borderRadius: 14,
    padding: '10px 14px 10px 18px',
    minWidth: 170,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    position: 'relative',
    boxShadow: selected
      ? `0 0 0 1px ${accent}, 0 0 24px ${accentGlow}, 0 8px 32px rgba(0,0,0,0.5)`
      : hovered
        ? `0 0 16px ${accentGlow.replace('0.3', '0.12')}, 0 4px 16px rgba(0,0,0,0.4)`
        : '0 2px 8px rgba(0,0,0,0.3)',
  };

  const handleStyle: React.CSSProperties = {
    background: accent,
    width: 8,
    height: 8,
    border: `2px solid ${C.surface}`,
    boxShadow: `0 0 6px ${accentGlow}`,
    transition: 'box-shadow 0.15s',
  };

  // ── Named range node ──────────────────────────────────────────────────────
  if (data.isNamedRange) {
    const nrHandleStyle: React.CSSProperties = {
      background: C.emerald,
      width: 8, height: 8,
      border: `2px solid ${C.surface}`,
      boxShadow: `0 0 6px ${C.emeraldGlow}`,
      transition: 'box-shadow 0.15s',
    };
    return (
      <div data-testid="sheet-node"
        style={{
          background: selected ? C.surfaceRaised : hovered ? '#161b25' : C.surface,
          border: `1.5px solid ${selected ? C.emerald : hovered ? `${C.emerald}88` : `${C.emerald}44`}`,
          borderRadius: 14,
          padding: '10px 14px 10px 18px',
          minWidth: 160,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          position: 'relative',
          boxShadow: selected
            ? `0 0 0 1px ${C.emerald}66, 0 0 24px ${C.emeraldGlow}, 0 8px 32px rgba(0,0,0,0.5)`
            : hovered
              ? `0 0 16px ${C.emeraldGlow.replace('0.3', '0.12')}, 0 4px 16px rgba(0,0,0,0.4)`
              : '0 2px 8px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Left emerald accent bar */}
        <div style={{
          position: 'absolute', left: 0, top: 10, bottom: 10,
          width: 3, borderRadius: '0 3px 3px 0',
          background: selected ? C.emerald : hovered ? `${C.emerald}99` : `${C.emerald}55`,
          transition: 'background 0.15s',
          boxShadow: selected ? `0 0 8px ${C.emeraldGlow}` : 'none',
        }} />

        <Handle type="target" position={Position.Left} style={nrHandleStyle} />

        {/* Tag icon + name */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <svg style={{ flexShrink: 0, marginTop: 2 }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.emerald} strokeWidth={1.5} opacity={0.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: selected ? C.textPrimary : hovered ? C.textPrimary : '#cbd5e1',
              maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}>
              {data.namedRangeName ?? data.label}
            </div>
            <div style={{ fontSize: 9, color: C.emerald, marginTop: 2, opacity: 0.8, letterSpacing: '0.06em', fontWeight: 600 }}>
              {data.namedRangeRef ?? 'named range'}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {data.outgoingCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: C.emerald, background: C.emeraldDim,
              border: `1px solid ${C.emerald}33`,
              borderRadius: 99, padding: '2px 7px',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              ↗ {data.outgoingCount}
            </span>
          )}
          {data.incomingCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: C.textSecondary, background: '#1e2535',
              border: `1px solid #2a3347`,
              borderRadius: 99, padding: '2px 7px',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              ↙ {data.incomingCount}
            </span>
          )}
        </div>

        <Handle type="source" position={Position.Right} style={nrHandleStyle} />
      </div>
    );
  }

  // ── External file node (collapsed, not uploaded) ──────────────────────────
  if (data.isFileNode) {
    return (
      <div data-testid="sheet-node"
        style={{
          background: selected ? C.surfaceRaised : hovered ? '#161b25' : C.surface,
          border: `1.5px dashed ${selected ? C.amber : hovered ? `${C.amber}88` : `${C.amber}44`}`,
          borderRadius: 14,
          padding: '10px 14px 10px 18px',
          minWidth: 160,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          position: 'relative',
          boxShadow: selected
            ? `0 0 0 1px ${C.amber}66, 0 0 24px ${C.amberGlow}, 0 8px 32px rgba(0,0,0,0.5)`
            : hovered
              ? `0 0 16px ${C.amberGlow.replace('0.3', '0.12')}, 0 4px 16px rgba(0,0,0,0.4)`
              : '0 2px 8px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Left amber accent bar */}
        <div style={{
          position: 'absolute', left: 0, top: 10, bottom: 10,
          width: 3, borderRadius: '0 3px 3px 0',
          background: selected ? C.amber : hovered ? `${C.amber}99` : `${C.amber}55`,
          transition: 'background 0.15s',
          boxShadow: selected ? `0 0 8px ${C.amberGlow}` : 'none',
        }} />

        <Handle type="target" position={Position.Left} style={handleStyle} />

        {/* File icon + name */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <svg style={{ flexShrink: 0, marginTop: 2 }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.amber} strokeWidth={1.5} opacity={0.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: selected ? C.textPrimary : hovered ? C.textPrimary : '#cbd5e1',
              maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}>
              {data.sheetName}
            </div>
            <div style={{ fontSize: 9, color: C.amber, marginTop: 2, opacity: 0.8, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
              {data.isExternal ? 'external file' : `${data.sheetCount} sheet${data.sheetCount !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>

        {/* Outgoing count badge */}
        {data.outgoingCount > 0 && (
          <div style={{ display: 'flex', marginTop: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: C.amber, background: C.amberDim,
              border: `1px solid ${C.amber}33`,
              borderRadius: 99, padding: '2px 7px',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              ↗ {data.outgoingCount}
            </span>
          </div>
        )}

        <Handle type="source" position={Position.Right} style={handleStyle} />
      </div>
    );
  }

  // ── Regular uploaded sheet node ────────────────────────────────────────────
  return (
    <div data-testid="sheet-node"
      style={containerStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute',
        left: 0, top: 10, bottom: 10,
        width: 3,
        borderRadius: '0 3px 3px 0',
        background: selected
          ? accent
          : hovered
            ? `${accent}99`
            : `${accent}55`,
        transition: 'background 0.15s',
        boxShadow: selected ? `0 0 8px ${accentGlow}` : 'none',
      }} />

      <Handle type="target" position={Position.Left} style={handleStyle} />

      {/* Workbook label */}
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: C.textMuted,
        marginBottom: 2,
        maxWidth: 160,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {stripExcelExt(data.workbookName)}
      </div>

      {/* Sheet name */}
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: selected ? C.textPrimary : hovered ? C.textPrimary : '#cbd5e1',
        maxWidth: 160,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        transition: 'color 0.15s',
      }}>
        {data.sheetName}
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {data.workload && data.workload.totalFormulas > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: C.textPrimary,
            background: '#1a2030',
            border: `1px solid ${C.border}`,
            borderRadius: 99, padding: '2px 7px',
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontFamily: 'monospace',
          }}>
            f(x) {data.workload.totalFormulas}
          </span>
        )}
        {data.outgoingCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: C.accent,
            background: C.accentDim,
            border: `1px solid ${C.accent}33`,
            borderRadius: 99, padding: '2px 7px',
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            ↗ {data.outgoingCount}
          </span>
        )}
        {data.incomingCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: C.textSecondary,
            background: '#1e2535',
            border: `1px solid #2a3347`,
            borderRadius: 99, padding: '2px 7px',
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            ↙ {data.incomingCount}
          </span>
        )}
        {isExt && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: C.amber,
            background: C.amberDim,
            border: `1px solid ${C.amber}33`,
            borderRadius: 99, padding: '2px 7px',
          }}>
            external
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={handleStyle} />

      {/* Hover tooltip */}
      {hovered && !selected && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 200,
          pointerEvents: 'none',
        }}>
          <div style={{
            background: '#0d1017',
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '10px 13px',
            minWidth: 190,
            boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.textPrimary, marginBottom: 2 }}>
              {data.sheetName}
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>
              {data.workbookName}
            </div>
            <div style={{ fontSize: 11, color: C.textSecondary, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.outgoingCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: C.accent }}>↗</span>
                  {data.outgoingCount} outgoing ref{data.outgoingCount !== 1 ? 's' : ''}
                </div>
              )}
              {data.incomingCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: C.textMuted }}>↙</span>
                  {data.incomingCount} incoming ref{data.incomingCount !== 1 ? 's' : ''}
                </div>
              )}
              {data.outgoingCount === 0 && data.incomingCount === 0 && (
                <span style={{ color: C.textMuted }}>No cross-sheet references</span>
              )}
            </div>
            {isExt && (
              <div style={{
                marginTop: 8, paddingTop: 8,
                borderTop: `1px solid ${C.border}`,
                fontSize: 10, color: C.amber,
              }}>
                File not uploaded
              </div>
            )}
          </div>
          {/* Arrow */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: -5 }}>
            <div style={{
              width: 10, height: 10,
              background: '#0d1017',
              border: `1px solid ${C.border}`,
              borderTop: 'none', borderLeft: 'none',
              transform: 'rotate(45deg)',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cluster Node ──────────────────────────────────────────────────────────────

function ClusterNode({ data }: NodeProps<Node<ClusterData>>) {
  const borderColor = data.isExternal ? `${C.amber}25` : `${C.accent}20`;
  const bgColor = data.isExternal ? 'rgba(245,158,11,0.03)' : 'rgba(232,68,90,0.03)';
  const labelColor = data.isExternal ? `${C.amber}88` : `${C.accent}77`;
  return (
    <div style={{
      width: data.width,
      height: data.height,
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 18,
      pointerEvents: 'none',
    }}>
      <div style={{
        padding: '6px 14px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: labelColor,
      }}>
        {data.label}
      </div>
    </div>
  );
}

const nodeTypes = { sheet: SheetNode, cluster: ClusterNode };
const edgeTypes = { weighted: WeightedEdge };

// ── Detail Panel ──────────────────────────────────────────────────────────────

interface DetailPanelProps {
  selectedNodes: Node<NodeData>[];
  selectedEdge: Edge<EdgeData> | null;
  onClose: () => void;
  onFocus: (nodeId: string) => void;
  focusNodeId: string | null;
  onToggleHidden?: (workbookName: string) => void;
  hiddenFiles?: Set<string>;
  allEdges: Edge<EdgeData>[];
}

function DetailPanel({ selectedNodes, selectedEdge, onClose, onFocus, focusNodeId, onToggleHidden, hiddenFiles, allEdges }: DetailPanelProps) {
  const node = selectedNodes.length === 1 ? selectedNodes[0] : null;

  // Compute edge kind breakdown for single-node selection (must be before early return)
  const edgeBreakdown = useMemo(() => {
    if (!node) return null;
    const counts: Record<EdgeKind, number> = { internal: 0, 'cross-file': 0, external: 0, 'named-range': 0 };
    for (const edge of allEdges) {
      if (edge.source === node.id || edge.target === node.id) {
        const kind = (edge.data as EdgeData | undefined)?.edgeKind ?? 'internal';
        counts[kind]++;
      }
    }
    return counts;
  }, [node, allEdges]);

  if (selectedNodes.length === 0 && !selectedEdge) return null;
  const isMulti = selectedNodes.length > 1;

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 16, right: 16,
    zIndex: 10,
    width: 300,
    maxHeight: 'calc(100% - 32px)',
    overflowY: 'auto',
    background: '#0d1017',
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
    fontSize: 13,
  };

  const actionBtnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 8, border: 'none', cursor: active ? 'default' : 'pointer',
    fontSize: 11, fontWeight: 600,
    background: active ? `${C.accent}22` : C.surface,
    color: active ? C.accent : C.textSecondary,
    transition: 'all 0.15s',
    opacity: active ? 0.6 : 1,
    flex: 1, justifyContent: 'center',
  });

  return (
    <div data-testid="detail-panel" style={panelStyle}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: `1px solid ${C.border}`,
        background: C.surface,
        position: 'sticky', top: 0, zIndex: 1,
      }}>
        <span data-testid="detail-panel-title" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted }}>
          {isMulti ? `${selectedNodes.length} selected` : node ? (node.data.isNamedRange ? 'Named Range' : 'Sheet') : 'References'}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.textMuted, padding: 3, borderRadius: 6, display: 'flex',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = C.textPrimary)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = C.textMuted)}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div style={{ padding: 14 }}>
        {/* Multi-select */}
        {isMulti && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selectedNodes.map((n) => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '8px 10px',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 99, flexShrink: 0,
                  background: n.data.isNamedRange ? C.emerald : n.data.isExternal ? C.amber : C.accent,
                  boxShadow: `0 0 6px ${n.data.isNamedRange ? C.emeraldGlow : n.data.isExternal ? C.amberGlow : C.accentGlow}`,
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: C.textPrimary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.data.sheetName}
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.data.workbookName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Single node */}
        {node && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Name card */}
            <div style={{
              background: C.surface,
              border: `1px solid ${node.data.isNamedRange ? `${C.emerald}44` : node.data.isExternal ? `${C.amber}44` : `${C.accent}33`}`,
              borderLeft: `3px solid ${node.data.isNamedRange ? C.emerald : node.data.isExternal ? C.amber : C.accent}`,
              borderRadius: 10, padding: '10px 12px',
              boxShadow: `0 0 16px ${node.data.isNamedRange ? C.emeraldGlow.replace('0.3', '0.1') : node.data.isExternal ? C.amberGlow.replace('0.3', '0.1') : C.accentGlow.replace('0.3', '0.1')}`,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.textMuted, marginBottom: 3 }}>
                {node.data.workbookName}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>
                {node.data.sheetName}
              </div>
            </div>

            {/* Named range details */}
            {node.data.isNamedRange && node.data.namedRangeRef && (
              <div style={{
                background: `${C.emerald}0a`, border: `1px solid ${C.emerald}33`,
                borderRadius: 8, padding: '8px 10px',
                fontSize: 11, color: C.emerald,
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                </svg>
                <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{node.data.namedRangeRef}</span>
              </div>
            )}

            {/* Edge stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'outgoing', value: node.data.outgoingCount, color: node.data.isNamedRange ? C.emerald : C.accent },
                { label: 'incoming', value: node.data.incomingCount, color: C.textSecondary },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '10px 12px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Workload stats */}
            {node.data.workload && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted }}>
                  Workload
                </div>
                <div data-testid="workload-metrics" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'formulas', value: node.data.workload.totalFormulas, color: C.textPrimary },
                    { label: 'within-sheet', value: node.data.workload.withinSheetRefs, color: C.textSecondary },
                    { label: 'cross-sheet', value: node.data.workload.crossSheetRefs, color: C.accent },
                    { label: 'cross-file', value: node.data.workload.crossFileRefs, color: '#818cf8' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      background: C.surface, border: `1px solid ${C.border}`,
                      borderRadius: 10, padding: '8px 10px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>
                        {value}
                      </div>
                      <div style={{ fontSize: 9, color: C.textMuted, marginTop: 3 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Edge kind breakdown */}
            {edgeBreakdown && (edgeBreakdown.internal > 0 || edgeBreakdown['cross-file'] > 0 || edgeBreakdown.external > 0 || edgeBreakdown['named-range'] > 0) && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted }}>
                  Edges by kind
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {([
                    { kind: 'internal' as const, label: 'Internal', color: '#e8445a' },
                    { kind: 'cross-file' as const, label: 'Cross-file', color: '#818cf8' },
                    { kind: 'external' as const, label: 'External', color: '#f59e0b' },
                    { kind: 'named-range' as const, label: 'Named Range', color: '#10b981' },
                  ] as const).filter(({ kind }) => edgeBreakdown[kind] > 0).map(({ kind, label, color }) => (
                    <div key={kind} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: `${color}11`, border: `1px solid ${color}33`,
                      borderRadius: 8, padding: '5px 9px',
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color }}>{edgeBreakdown[kind]}</span>
                      <span style={{ fontSize: 9, color: C.textMuted }}>{label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { if (focusNodeId !== node.id) onFocus(node.id); }}
                disabled={focusNodeId === node.id}
                style={actionBtnStyle(focusNodeId === node.id)}
                onMouseEnter={(e) => { if (focusNodeId !== node.id) (e.currentTarget as HTMLElement).style.color = C.textPrimary; }}
                onMouseLeave={(e) => { if (focusNodeId !== node.id) (e.currentTarget as HTMLElement).style.color = C.textSecondary; }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="3" />
                  <path strokeLinecap="round" d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                </svg>
                {focusNodeId === node.id ? 'Focused' : 'Focus'}
              </button>
              {onToggleHidden && (() => {
                const isHidden = !!hiddenFiles?.has(node.data.workbookName);
                return (
                  <button
                    onClick={() => onToggleHidden(node.data.workbookName)}
                    style={actionBtnStyle(false)}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = C.textPrimary)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = C.textSecondary)}
                  >
                    {isHidden ? (
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    )}
                    {isHidden ? 'Show' : 'Hide'}
                  </button>
                );
              })()}
            </div>

            {node.data.isExternal && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 8, padding: '8px 10px',
                fontSize: 11, color: C.amber,
              }}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                External file — not uploaded
              </div>
            )}
          </div>
        )}

        {/* Edge */}
        {selectedEdge && selectedEdge.data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>
              {selectedEdge.data.references.length} formula reference{selectedEdge.data.references.length !== 1 ? 's' : ''}
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedEdge.data.references.map((ref: EdgeReference, i: number) => (
                <div key={i} style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 11,
                    color: C.accent, wordBreak: 'break-all', lineHeight: 1.5,
                    marginBottom: 6,
                  }}>
                    {ref.formula}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.textMuted }}>
                    {[ref.sourceCell, '→', ref.targetCells.join(', ')].map((seg, j) =>
                      seg === '→' ? (
                        <span key={j}>{seg}</span>
                      ) : (
                        <span key={j} style={{
                          fontFamily: 'monospace',
                          background: '#1e2535', borderRadius: 4,
                          padding: '2px 5px', color: C.textSecondary,
                        }}>
                          {seg}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

// ── Layout Toolbar ────────────────────────────────────────────────────────────

const LAYOUT_OPTIONS: { mode: LayoutMode; label: string; icon: string }[] = [
  { mode: 'graph',    label: 'Graph',    icon: '→' },
  { mode: 'grouped',  label: 'Grouped',  icon: '⊞' },
  { mode: 'overview', label: 'Overview', icon: '◈' },
];

function Toolbar({ layoutMode, onLayoutChange }: {
  layoutMode: LayoutMode;
  onLayoutChange: (m: LayoutMode) => void;
}) {
  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, display: 'flex', gap: 3, padding: 4,
      background: '#0d1017',
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
    }}>
      {LAYOUT_OPTIONS.map(({ mode, label, icon }) => {
        const active = layoutMode === mode;
        return (
          <button
            data-testid={`layout-${mode}`}
            key={mode}
            onClick={() => onLayoutChange(mode)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.01em',
              background: active ? C.accent : 'transparent',
              color: active ? '#fff' : C.textSecondary,
              boxShadow: active ? `0 0 12px ${C.accentGlow}` : 'none',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = C.textPrimary; }}
            onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = C.textSecondary; }}
          >
            <span style={{ fontSize: 12 }}>{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Edge Kind Filter Toolbar ─────────────────────────────────────────────────

export type EdgeKindFilterState = Record<EdgeKind, boolean>;

const EDGE_KIND_OPTIONS: { kind: EdgeKind; label: string; color: string }[] = [
  { kind: 'internal',     label: 'Internal',      color: '#e8445a' },
  { kind: 'cross-file',   label: 'Cross-file',    color: '#818cf8' },
  { kind: 'external',     label: 'External',      color: '#f59e0b' },
  { kind: 'named-range',  label: 'Named Range',   color: '#10b981' },
];

function EdgeKindFilterBar({ filter, onFilterChange, showNamedRanges }: {
  filter: EdgeKindFilterState;
  onFilterChange: (f: EdgeKindFilterState) => void;
  showNamedRanges?: boolean;
}) {
  const crossOnly = !filter.internal && filter['cross-file'] && !filter.external;
  const visibleOptions = showNamedRanges
    ? EDGE_KIND_OPTIONS
    : EDGE_KIND_OPTIONS.filter((o) => o.kind !== 'named-range');

  function toggleKind(kind: EdgeKind) {
    onFilterChange({ ...filter, [kind]: !filter[kind] });
  }

  function setCrossFileOnly() {
    onFilterChange({ internal: false, 'cross-file': true, external: false, 'named-range': false });
  }

  function setAll() {
    onFilterChange({ internal: true, 'cross-file': true, external: true, 'named-range': filter['named-range'] });
  }

  return (
    <div style={{
      position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, display: 'flex', alignItems: 'center', gap: 3, padding: 4,
      background: '#0d1017',
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
    }}>
      {/* Per-kind toggles */}
      {visibleOptions.map(({ kind, label, color }) => {
        const on = filter[kind];
        return (
          <button
            data-testid={`edge-filter-${kind}`}
            key={kind}
            onClick={() => toggleKind(kind)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 10, fontWeight: 600,
              background: on ? `${color}22` : 'transparent',
              color: on ? color : C.textMuted,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { if (!on) (e.currentTarget as HTMLElement).style.color = C.textSecondary; }}
            onMouseLeave={(e) => { if (!on) (e.currentTarget as HTMLElement).style.color = C.textMuted; }}
          >
            <div style={{
              width: 7, height: 7, borderRadius: 2,
              background: on ? color : 'transparent',
              border: `1.5px solid ${on ? color : C.textMuted}`,
              transition: 'all 0.15s',
            }} />
            {label}
          </button>
        );
      })}

      {/* Divider */}
      <div style={{ width: 1, height: 16, background: C.border, margin: '0 2px' }} />

      {/* Presets */}
      <button
        onClick={crossOnly ? setAll : setCrossFileOnly}
        style={{
          padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
          fontSize: 10, fontWeight: 600,
          background: crossOnly ? '#818cf822' : 'transparent',
          color: crossOnly ? '#818cf8' : C.textMuted,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => { if (!crossOnly) (e.currentTarget as HTMLElement).style.color = C.textSecondary; }}
        onMouseLeave={(e) => { if (!crossOnly) (e.currentTarget as HTMLElement).style.color = C.textMuted; }}
      >
        {crossOnly ? 'Show All' : 'Cross-File Only'}
      </button>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function LegendRow({ color, label, isEdge = false }: { color: string; label: string; isEdge?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      {isEdge ? (
        <svg width="22" height="10" viewBox="0 0 22 10" style={{ flexShrink: 0 }}>
          <line x1="0" y1="5" x2="16" y2="5" stroke={color} strokeWidth="2" />
          <polygon points="14,2 22,5 14,8" fill={color} />
        </svg>
      ) : (
        <div style={{
          width: 10, height: 10, borderRadius: 3, flexShrink: 0,
          background: `${color}22`,
          border: `1.5px solid ${color}`,
          boxShadow: `0 0 5px ${color}66`,
        }} />
      )}
      <span style={{ fontSize: 11, color: C.textSecondary }}>{label}</span>
    </div>
  );
}

function Legend({ showNamedRanges }: { showNamedRanges?: boolean }) {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16, zIndex: 10,
      background: '#0d1017',
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 6,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      {/* Nodes */}
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted, marginBottom: 1 }}>Nodes</div>
      <LegendRow color={C.accent} label="Uploaded sheet" />
      <LegendRow color={C.amber} label="External file" />
      {showNamedRanges && <LegendRow color={C.emerald} label="Named range" />}

      {/* Edges */}
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted, marginTop: 4, marginBottom: 1 }}>Edges</div>
      <LegendRow color="#e8445a" label="Same workbook" isEdge />
      <LegendRow color="#818cf8" label="Cross-file" isEdge />
      <LegendRow color="#f59e0b" label="External" isEdge />
      {showNamedRanges && <LegendRow color="#10b981" label="Named range" isEdge />}

      {/* Hint */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 6, marginTop: 2, borderTop: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 5px', fontFamily: 'monospace' }}>
          Shift+click
        </span>
        <span style={{ fontSize: 11, color: C.textMuted }}>multi-select</span>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0b0d11',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: C.surface,
          border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="6" cy="14" r="3" fill={C.border} />
            <circle cx="22" cy="6" r="3" fill={C.border} />
            <circle cx="22" cy="22" r="3" fill={C.border} />
            <line x1="9" y1="13" x2="19" y2="7" stroke={C.border} strokeWidth="1.5" />
            <line x1="9" y1="15" x2="19" y2="21" stroke={C.border} strokeWidth="1.5" />
          </svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 4 }}>
          No files loaded
        </p>
        <p style={{ fontSize: 12, color: C.textMuted }}>
          Upload Excel files to visualize references
        </p>
      </div>
    </div>
  );
}

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
    internal: true, 'cross-file': true, external: true, 'named-range': true,
  });
  const [showNamedRanges, setShowNamedRanges] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [focusDepth, setFocusDepth] = useState(1);
  const [focusDirection, setFocusDirection] = useState<'both' | 'upstream' | 'downstream'>('both');
  const { fitView } = useReactFlow();
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Check if any loaded workbook has named ranges (for showing the toggle)
  const hasNamedRanges = useMemo(() => workbooks.some((wb) => wb.namedRanges.length > 0), [workbooks]);

  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph(workbooks, layoutMode, hiddenFiles, showNamedRanges);
    setNodes(n);
    setEdges(e);
    // Reset selection & focus when graph data changes — intentional synchronization
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedNodes([]);
    setSelectedEdge(null);
    setSelectedNodeIds(new Set());
    setFocusNodeId(null);
  }, [workbooks, layoutMode, hiddenFiles, showNamedRanges, setNodes, setEdges]);

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
        style={{ background: '#0b0d11' }}
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
            if (d.isNamedRange) return C.emerald;
            return d.isExternal ? C.amber : C.accent;
          }}
          maskColor="rgba(11,13,17,0.8)"
          nodeStrokeWidth={0}
        />
      </ReactFlow>

      <Toolbar layoutMode={layoutMode} onLayoutChange={setLayoutMode} />
      <EdgeKindFilterBar filter={edgeKindFilter} onFilterChange={setEdgeKindFilter} showNamedRanges={showNamedRanges} />

      {/* Named Ranges toggle — only shown when workbooks contain named ranges */}
      {hasNamedRanges && layoutMode !== 'overview' && (
        <button
          onClick={() => setShowNamedRanges((v) => !v)}
          style={{
            position: 'absolute', top: 92, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
            background: showNamedRanges ? `${C.emerald}22` : '#0d1017',
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

      <Legend showNamedRanges={showNamedRanges} />

      {/* Focus Mode Controls */}
      {focusNodeId && (
        <div data-testid="focus-panel" style={{
          position: 'absolute', top: 12, right: 16, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          background: '#0d1017',
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
