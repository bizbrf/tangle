import { memo, useState, type CSSProperties, type ReactNode } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { NodeData } from '../../lib/graph';
import { stripExcelExt } from '../../lib/graph';
import { C, alpha } from './constants';

type NodeKind = 'sheet' | 'table' | 'named-range' | 'file';

interface AccentTokens {
  color: string;
  dim: string;
  glow: string;
  glowFaint: string;
}

const ACCENT_TOKENS: Record<NodeKind, AccentTokens> = {
  sheet:         { color: C.accent,  dim: C.accentDim,  glow: C.accentGlow,  glowFaint: C.accentGlowFaint  },
  table:         { color: C.violet,  dim: C.violetDim,  glow: C.violetGlow,  glowFaint: C.violetGlowFaint  },
  'named-range': { color: C.emerald, dim: C.emeraldDim, glow: C.emeraldGlow, glowFaint: C.emeraldGlowFaint },
  file:          { color: C.amber,   dim: C.amberDim,   glow: C.amberGlow,   glowFaint: C.amberGlowFaint   },
};

function nodeKind(data: NodeData): NodeKind {
  if (data.isTable) return 'table';
  if (data.isNamedRange) return 'named-range';
  if (data.isFileNode) return 'file';
  return 'sheet';
}

const TABLE_ICON = (
  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18M9 3v18M15 3v18" />
);
const NAMED_RANGE_ICON = (
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
  </>
);
const FILE_ICON = (
  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
);

function HeaderIcon({ kind, accent }: { kind: NodeKind; accent: string }) {
  if (kind === 'sheet') return null;
  return (
    <svg style={{ flexShrink: 0, marginTop: 2 }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={accent} strokeWidth={1.5} opacity={0.75}>
      {kind === 'table' ? TABLE_ICON : kind === 'named-range' ? NAMED_RANGE_ICON : FILE_ICON}
    </svg>
  );
}

function CountBadge({ outgoing, incoming, accent, accentDim }: {
  outgoing: number;
  incoming: number;
  accent: string;
  accentDim: string;
}) {
  if (outgoing === 0 && incoming === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      {outgoing > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: accent, background: accentDim,
          border: `1px solid ${alpha(accent, 20)}`,
          borderRadius: 99, padding: '2px 7px',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          ↗ {outgoing}
        </span>
      )}
      {incoming > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: C.textSecondary, background: C.surfaceHi,
          border: `1px solid ${C.borderHover}`,
          borderRadius: 99, padding: '2px 7px',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          ↙ {incoming}
        </span>
      )}
    </div>
  );
}

function SheetNodeImpl({ data, selected }: NodeProps<Node<NodeData>>) {
  const [hovered, setHovered] = useState(false);
  const kind = nodeKind(data);
  const accent = ACCENT_TOKENS[kind];
  const dashed = kind === 'file';

  const handleStyle: CSSProperties = {
    background: accent.color,
    width: 8, height: 8,
    border: `2px solid ${C.surface}`,
    boxShadow: `0 0 6px ${accent.glow}`,
    transition: 'box-shadow 0.15s',
  };

  const containerStyle: CSSProperties = {
    background: selected ? C.surfaceRaised : hovered ? C.surfaceHi : C.surface,
    border: `1.5px ${dashed ? 'dashed' : 'solid'} ${
      selected ? accent.color : hovered ? alpha(accent.color, 53) : kind === 'sheet' ? C.border : alpha(accent.color, 27)
    }`,
    borderRadius: 'var(--tg-node-radius)',
    padding: '10px 14px 10px 18px',
    minWidth: kind === 'sheet' ? 170 : 160,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    position: 'relative',
    boxShadow: selected
      ? `0 0 0 1px ${alpha(accent.color, 40)}, 0 0 24px ${accent.glow}, 0 8px 32px rgba(0,0,0,0.5)`
      : hovered
        ? `0 0 16px ${accent.glowFaint}, 0 4px 16px rgba(0,0,0,0.4)`
        : '0 2px 8px rgba(0,0,0,0.3)',
  };

  // Header content varies by kind. Sheet shows workbook+sheet stack; others
  // show icon+title+sublabel.
  let header: ReactNode;
  if (kind === 'sheet') {
    header = (
      <>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: C.textMuted, marginBottom: 2, maxWidth: 160,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {stripExcelExt(data.workbookName)}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: selected || hovered ? C.textPrimary : C.textSecondary,
          maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: 'color 0.15s',
        }}>
          {data.sheetName}
        </div>
      </>
    );
  } else {
    const title =
      kind === 'table' ? (data.tableName ?? data.label) :
      kind === 'named-range' ? (data.namedRangeName ?? data.label) :
      data.sheetName;
    const subLabel =
      kind === 'table' ? (data.tableRef ?? 'table') :
      kind === 'named-range' ? (data.namedRangeRef ?? 'named range') :
      (data.isExternal ? 'external file' : `${data.sheetCount} sheet${data.sheetCount !== 1 ? 's' : ''}`);
    header = (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
        <HeaderIcon kind={kind} accent={accent.color} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: selected || hovered ? C.textPrimary : C.textSecondary,
            maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'color 0.15s',
          }}>
            {title}
          </div>
          <div style={{
            fontSize: 9, color: accent.color, marginTop: 2, opacity: 0.8,
            letterSpacing: '0.06em', fontWeight: 600,
            ...(kind === 'file' ? { textTransform: 'uppercase' as const } : {}),
          }}>
            {subLabel}
          </div>
        </div>
      </div>
    );
  }

  // Sheet badges have an extra workload chip + external marker.
  const badges = kind === 'sheet' ? (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      {data.workload && data.workload.totalFormulas > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: C.textPrimary, background: C.surfaceHi,
          border: `1px solid ${C.border}`,
          borderRadius: 99, padding: '2px 7px',
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontFamily: 'var(--tg-font-mono)',
        }}>
          f(x) {data.workload.totalFormulas}
        </span>
      )}
      {data.outgoingCount > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: accent.color, background: accent.dim,
          border: `1px solid ${alpha(accent.color, 20)}`,
          borderRadius: 99, padding: '2px 7px',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          ↗ {data.outgoingCount}
        </span>
      )}
      {data.incomingCount > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: C.textSecondary, background: C.surfaceHi,
          border: `1px solid ${C.borderHover}`,
          borderRadius: 99, padding: '2px 7px',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          ↙ {data.incomingCount}
        </span>
      )}
      {data.isExternal && (
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: C.amber, background: C.amberDim,
          border: `1px solid ${alpha(C.amber, 20)}`,
          borderRadius: 99, padding: '2px 7px',
        }}>
          external
        </span>
      )}
    </div>
  ) : (
    <CountBadge
      outgoing={data.outgoingCount}
      incoming={kind === 'file' ? 0 : data.incomingCount}
      accent={accent.color}
      accentDim={accent.dim}
    />
  );

  return (
    <div data-testid="sheet-node"
      style={containerStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 10, bottom: 10,
        width: 3, borderRadius: '0 3px 3px 0',
        background: selected ? accent.color : hovered ? alpha(accent.color, 60) : alpha(accent.color, 33),
        transition: 'background 0.15s',
        boxShadow: selected ? `0 0 8px ${accent.glow}` : 'none',
      }} />

      <Handle type="target" position={Position.Left} style={handleStyle} />
      {header}
      {badges}
      <Handle type="source" position={Position.Right} style={handleStyle} />

      {/* Hover tooltip — sheet kind only */}
      {kind === 'sheet' && hovered && !selected && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 200,
          pointerEvents: 'none',
        }}>
          <div style={{
            background: C.bgPanel,
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
            {data.isExternal && (
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
              background: C.bgPanel,
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

// Memoized so unchanged nodes skip re-render on selection events.
export const SheetNode = memo(SheetNodeImpl);
