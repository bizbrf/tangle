import type { EdgeKind } from '../../lib/graph';
import { C } from './constants';

export type EdgeKindFilterState = Record<EdgeKind, boolean>;

const EDGE_KIND_OPTIONS: { kind: EdgeKind; label: string; color: string }[] = [
  { kind: 'internal',     label: 'Internal',      color: '#e8445a' },
  { kind: 'cross-file',   label: 'Cross-file',    color: '#818cf8' },
  { kind: 'external',     label: 'External',      color: '#f59e0b' },
  { kind: 'named-range',  label: 'Named Range',   color: '#10b981' },
  { kind: 'table',        label: 'Table',         color: '#a78bfa' },
];

export function EdgeKindFilterBar({ filter, onFilterChange, showNamedRanges, showTables }: {
  filter: EdgeKindFilterState;
  onFilterChange: (f: EdgeKindFilterState) => void;
  showNamedRanges?: boolean;
  showTables?: boolean;
}) {
  const crossOnly = !filter.internal && filter['cross-file'] && !filter.external;
  const visibleOptions = EDGE_KIND_OPTIONS.filter((o) => {
    if (o.kind === 'named-range' && !showNamedRanges) return false;
    if (o.kind === 'table' && !showTables) return false;
    return true;
  });

  function toggleKind(kind: EdgeKind) {
    onFilterChange({ ...filter, [kind]: !filter[kind] });
  }

  function setCrossFileOnly() {
    onFilterChange({ internal: false, 'cross-file': true, external: false, 'named-range': false, table: false });
  }

  function setAll() {
    onFilterChange({ internal: true, 'cross-file': true, external: true, 'named-range': filter['named-range'], table: filter['table'] });
  }

  return (
    <div style={{
      position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, display: 'flex', alignItems: 'center', gap: 3, padding: 4,
      background: C.bgPanel,
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
