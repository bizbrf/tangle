import { useEffect, useState, useCallback } from 'react';
import {
  EdgeLabelRenderer,
  getBezierPath,
  useInternalNode,
  type EdgeProps,
} from '@xyflow/react';
import type { EdgeData, NodeData } from '../../lib/graph';
import { C } from './constants';
import { getNodeIntersection, getEdgePosition, edgeAccentColor } from './edge-helpers';

const FLOW_STYLE_ID = 'tangle-edge-flow';

function ensureFlowStyles() {
  if (document.getElementById(FLOW_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = FLOW_STYLE_ID;
  style.textContent = `
    @keyframes tangle-flow-fwd {
      from { stroke-dashoffset: 24; }
      to   { stroke-dashoffset: 0; }
    }
    @keyframes tangle-flow-rev {
      from { stroke-dashoffset: -24; }
      to   { stroke-dashoffset: 0; }
    }
  `;
  document.head.appendChild(style);
}

export function WeightedEdge({
  id,
  source, target,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, style, markerEnd, animated,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const edgeData = data as EdgeData | undefined;
  const refCount = edgeData?.refCount ?? 1;
  const [hovered, setHovered] = useState(false);
  const onEnter = useCallback(() => setHovered(true), []);
  const onLeave = useCallback(() => setHovered(false), []);

  useEffect(() => { ensureFlowStyles(); }, []);

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
  const strokeWidth = (style?.strokeWidth as number) ?? 1.5;

  return (
    <>
      {/* Invisible wide hit area for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        style={{ cursor: 'default' }}
      />

      {/* Base visible edge */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={{ ...style, pointerEvents: 'none' }}
        markerEnd={markerEnd as string}
        fill="none"
      />

      {/* Bidirectional flow animation overlay */}
      {animated && (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray="12 12"
            style={{
              animation: 'tangle-flow-fwd 0.6s linear infinite',
              opacity: 0.45,
            }}
          />
          <path
            d={edgePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray="12 12"
            style={{
              animation: 'tangle-flow-rev 0.6s linear infinite',
              opacity: 0.3,
            }}
          />
        </>
      )}

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
              background: C.bgPanel,
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

      {/* Hover tooltip */}
      {hovered && edgeData && (
        <EdgeLabelRenderer>
          <EdgeTooltip
            labelX={labelX}
            labelY={labelY}
            edgeData={edgeData}
            sourceNode={sourceNode}
            targetNode={targetNode}
            strokeColor={strokeColor}
          />
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/* ── Tooltip sub-component ─────────────────────────────────────────────────── */

function EdgeTooltip({
  labelX, labelY, edgeData, sourceNode, targetNode, strokeColor,
}: {
  labelX: number;
  labelY: number;
  edgeData: EdgeData;
  sourceNode: ReturnType<typeof useInternalNode>;
  targetNode: ReturnType<typeof useInternalNode>;
  strokeColor: string;
}) {
  const srcData = sourceNode?.internals?.userNode?.data as NodeData | undefined;
  const tgtData = targetNode?.internals?.userNode?.data as NodeData | undefined;
  const srcLabel = srcData?.sheetName ?? 'Unknown';
  const tgtLabel = tgtData?.sheetName ?? 'Unknown';
  const kindColor = edgeAccentColor(edgeData.edgeKind);

  // Collect first 3 unique cell references
  const cellRanges: string[] = [];
  for (const ref of edgeData.references) {
    for (const cell of ref.targetCells) {
      if (!cellRanges.includes(cell)) cellRanges.push(cell);
      if (cellRanges.length >= 3) break;
    }
    if (cellRanges.length >= 3) break;
  }
  const totalCells = edgeData.references.reduce((n, r) => n + r.targetCells.length, 0);
  const hasMore = totalCells > 3;

  // First formula, truncated
  const firstFormula = edgeData.references[0]?.formula ?? '';
  const formulaTruncated = firstFormula.length > 60
    ? firstFormula.slice(0, 57) + '...'
    : firstFormula;

  const kindLabel =
    edgeData.edgeKind === 'internal' ? 'Internal' :
    edgeData.edgeKind === 'cross-file' ? 'Cross-File' :
    edgeData.edgeKind === 'named-range' ? 'Named Range' :
    edgeData.edgeKind === 'table' ? 'Table' : 'External';

  return (
    <div
      className="nodrag nopan"
      style={{
        position: 'absolute',
        transform: `translate(-50%, calc(-100% - 12px)) translate(${labelX}px, ${labelY}px)`,
        pointerEvents: 'none',
        zIndex: 200,
      }}
    >
      <div style={{
        background: C.bgPanel,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '10px 14px',
        minWidth: 200,
        maxWidth: 320,
        boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
      }}>
        {/* Source -> Target header */}
        <div style={{
          fontWeight: 700,
          fontSize: 13,
          color: C.textPrimary,
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{srcLabel}</span>
          <span style={{ color: strokeColor, flexShrink: 0 }}>→</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tgtLabel}</span>
        </div>

        {/* Kind badge + ref count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: kindColor,
            background: `${kindColor}18`,
            border: `1px solid ${kindColor}33`,
            borderRadius: 6,
            padding: '1px 7px',
            letterSpacing: '0.02em',
          }}>
            {kindLabel}
          </span>
          <span style={{ fontSize: 11, color: C.textSecondary }}>
            {edgeData.refCount} ref{edgeData.refCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Cell ranges */}
        {cellRanges.length > 0 && (
          <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4 }}>
            <span style={{ color: C.textMuted, marginRight: 4 }}>Cells:</span>
            {cellRanges.join(', ')}{hasMore ? ', ...' : ''}
          </div>
        )}

        {/* First formula */}
        {formulaTruncated && (
          <div style={{
            fontSize: 10,
            color: C.textMuted,
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {formulaTruncated}
          </div>
        )}
      </div>
    </div>
  );
}
