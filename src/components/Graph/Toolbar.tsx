import type { LayoutMode, LayoutDirection } from '../../lib/graph';
import { C } from './constants';

const LAYOUT_OPTIONS: { mode: LayoutMode; label: string; icon: string }[] = [
  { mode: 'graph',    label: 'Graph',    icon: '→' },
  { mode: 'grouped',  label: 'Grouped',  icon: '⊞' },
  { mode: 'overview', label: 'Overview', icon: '◈' },
];

const DIRECTION_OPTIONS: { dir: LayoutDirection; label: string; icon: string }[] = [
  { dir: 'LR', label: 'LR', icon: '⟶' },
  { dir: 'TB', label: 'TB', icon: '⟱' },
];

export function Toolbar({ layoutMode, onLayoutChange, layoutDirection, onDirectionChange, onFitView, onReorganize }: {
  layoutMode: LayoutMode;
  onLayoutChange: (m: LayoutMode) => void;
  layoutDirection: LayoutDirection;
  onDirectionChange: (d: LayoutDirection) => void;
  onFitView: () => void;
  onReorganize: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, display: 'flex', gap: 3, padding: 4,
      background: C.bgPanel,
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

      {/* Direction toggle — hidden in overview mode */}
      {layoutMode !== 'overview' && (
        <>
          <div style={{ width: 1, alignSelf: 'stretch', background: C.border, margin: '4px 2px' }} />
          {DIRECTION_OPTIONS.map(({ dir, label, icon }) => {
            const active = layoutDirection === dir;
            return (
              <button
                data-testid={`direction-${dir}`}
                key={dir}
                onClick={() => onDirectionChange(dir)}
                title={dir === 'LR' ? 'Left → Right layout' : 'Top → Bottom layout'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 9px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600,
                  background: active ? C.accentDim : 'transparent',
                  color: active ? C.accent : C.textSecondary,
                  boxShadow: active ? `0 0 8px ${C.accentGlow}` : 'none',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = C.textPrimary; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = C.textSecondary; }}
              >
                <span style={{ fontSize: 13 }}>{icon}</span>
                {label}
              </button>
            );
          })}
        </>
      )}

      {/* Fit View button */}
      <div style={{ width: 1, alignSelf: 'stretch', background: C.border, margin: '4px 2px' }} />
      <button
        data-testid="fit-view"
        onClick={onFitView}
        title="Fit graph to view"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 9px', borderRadius: 7, border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 600,
          background: 'transparent',
          color: C.textSecondary,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.textPrimary; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.textSecondary; }}
      >
        <span style={{ fontSize: 13 }}>⊡</span>
        Fit
      </button>

      {/* Reorganize button */}
      <div style={{ width: 1, alignSelf: 'stretch', background: C.border, margin: '4px 2px' }} />
      <button
        data-testid="reorganize"
        onClick={onReorganize}
        title="Reorganize graph layout"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 9px', borderRadius: 7, border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 600,
          background: 'transparent',
          color: C.textSecondary,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.textPrimary; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.textSecondary; }}
      >
        <span style={{ fontSize: 13 }}>⟳</span>
        Reorganize
      </button>
    </div>
  );
}
