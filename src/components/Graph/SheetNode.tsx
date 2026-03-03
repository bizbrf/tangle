import { useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { NodeData } from '../../lib/graph';
import { stripExcelExt } from '../../lib/graph';
import { C } from './constants';

export function SheetNode({ data, selected }: NodeProps<Node<NodeData>>) {
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

  // ── Table node ────────────────────────────────────────────────────────────
  if (data.isTable) {
    const tblHandleStyle: React.CSSProperties = {
      background: C.violet,
      width: 8, height: 8,
      border: `2px solid ${C.surface}`,
      boxShadow: `0 0 6px ${C.violetGlow}`,
      transition: 'box-shadow 0.15s',
    };
    return (
      <div data-testid="sheet-node"
        style={{
          background: selected ? C.surfaceRaised : hovered ? '#161b25' : C.surface,
          border: `1.5px solid ${selected ? C.violet : hovered ? `${C.violet}88` : `${C.violet}44`}`,
          borderRadius: 14,
          padding: '10px 14px 10px 18px',
          minWidth: 160,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          position: 'relative',
          boxShadow: selected
            ? `0 0 0 1px ${C.violet}66, 0 0 24px ${C.violetGlow}, 0 8px 32px rgba(0,0,0,0.5)`
            : hovered
              ? `0 0 16px ${C.violetGlow.replace('0.3', '0.12')}, 0 4px 16px rgba(0,0,0,0.4)`
              : '0 2px 8px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Left violet accent bar */}
        <div style={{
          position: 'absolute', left: 0, top: 10, bottom: 10,
          width: 3, borderRadius: '0 3px 3px 0',
          background: selected ? C.violet : hovered ? `${C.violet}99` : `${C.violet}55`,
          transition: 'background 0.15s',
          boxShadow: selected ? `0 0 8px ${C.violetGlow}` : 'none',
        }} />

        <Handle type="target" position={Position.Left} style={tblHandleStyle} />

        {/* Table icon + name */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <svg style={{ flexShrink: 0, marginTop: 2 }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.violet} strokeWidth={1.5} opacity={0.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18M9 3v18M15 3v18" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: selected ? C.textPrimary : hovered ? C.textPrimary : '#cbd5e1',
              maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}>
              {data.tableName ?? data.label}
            </div>
            <div style={{ fontSize: 9, color: C.violet, marginTop: 2, opacity: 0.8, letterSpacing: '0.06em', fontWeight: 600 }}>
              {data.tableRef ?? 'table'}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {data.outgoingCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: C.violet, background: C.violetDim,
              border: `1px solid ${C.violet}33`,
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

        <Handle type="source" position={Position.Right} style={tblHandleStyle} />
      </div>
    );
  }

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
