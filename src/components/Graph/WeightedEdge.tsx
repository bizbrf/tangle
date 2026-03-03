import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useInternalNode,
  type EdgeProps,
} from '@xyflow/react';
import type { EdgeData } from '../../lib/graph';
import { C } from './constants';
import { getNodeIntersection, getEdgePosition } from './edge-helpers';

export function WeightedEdge({
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
    </>
  );
}
