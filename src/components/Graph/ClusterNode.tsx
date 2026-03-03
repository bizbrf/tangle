import type { Node, NodeProps } from '@xyflow/react';
import type { ClusterData } from '../../lib/graph';
import { C } from './constants';

export function ClusterNode({ data }: NodeProps<Node<ClusterData>>) {
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
