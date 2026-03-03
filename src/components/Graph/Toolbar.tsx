import type { LayoutMode } from '../../lib/graph';
import { C } from './constants';

const LAYOUT_OPTIONS: { mode: LayoutMode; label: string; icon: string }[] = [
  { mode: 'graph',    label: 'Graph',    icon: '→' },
  { mode: 'grouped',  label: 'Grouped',  icon: '⊞' },
  { mode: 'overview', label: 'Overview', icon: '◈' },
];

export function Toolbar({ layoutMode, onLayoutChange }: {
  layoutMode: LayoutMode;
  onLayoutChange: (m: LayoutMode) => void;
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
    </div>
  );
}
