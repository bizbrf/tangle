import { C, alpha } from './constants';
import { edgeAccentColor } from './edge-helpers';

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
          background: alpha(color, 13),
          border: `1.5px solid ${color}`,
          boxShadow: `0 0 5px ${alpha(color, 40)}`,
        }} />
      )}
      <span style={{ fontSize: 11, color: C.textSecondary }}>{label}</span>
    </div>
  );
}

export function Legend({ showNamedRanges, showTables }: { showNamedRanges?: boolean; showTables?: boolean }) {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16, zIndex: 10,
      background: C.bgPanel,
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
      {showTables && <LegendRow color={C.violet} label="Table" />}

      {/* Edges */}
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted, marginTop: 4, marginBottom: 1 }}>Edges</div>
      <LegendRow color={edgeAccentColor('internal')} label="Same workbook" isEdge />
      <LegendRow color={edgeAccentColor('cross-file')} label="Cross-file" isEdge />
      <LegendRow color={edgeAccentColor('external')} label="External" isEdge />
      {showNamedRanges && <LegendRow color={edgeAccentColor('named-range')} label="Named range" isEdge />}
      {showTables && <LegendRow color={edgeAccentColor('table')} label="Table ref" isEdge />}

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
