import type { Node, NodeProps } from '@xyflow/react';
import type { ClusterData } from '../../lib/graph';
import { C, alpha } from './constants';

export function ClusterNode({ data }: NodeProps<Node<ClusterData>>) {
  const borderColor = data.isExternal ? alpha(C.amber, 15) : alpha(C.accent, 12);
  const bgColor = data.isExternal ? alpha(C.amber, 3) : alpha(C.accent, 3);
  const labelColor = data.isExternal ? alpha(C.amber, 53) : alpha(C.accent, 47);
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
