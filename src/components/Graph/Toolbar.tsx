import type { ReactNode } from 'react';
import type { LayoutDirection } from '../../lib/graph';
import type { GroupingMode } from '../../lib/graph';
import { C } from './constants';

export type ViewMode = 'graph' | 'overview';

const VIEW_OPTIONS: { mode: ViewMode; label: string; key: string }[] = [
  { mode: 'graph',    label: 'Graph',    key: 'G' },
  { mode: 'overview', label: 'Overview', key: 'O' },
];

const DIRECTION_OPTIONS: { dir: LayoutDirection; label: string; key: string }[] = [
  { dir: 'LR', label: 'LR', key: '←→' },
  { dir: 'TB', label: 'TB', key: '↑↓' },
];

const GROUPING_OPTIONS: { mode: GroupingMode; label: string }[] = [
  { mode: 'off',      label: 'Off' },
  { mode: 'by-type',  label: 'By Type' },
  { mode: 'by-table', label: 'By Table' },
];

function ToolbarDivider() {
  return <div aria-hidden="true" style={{ width: 1, alignSelf: 'stretch', background: C.border, margin: '4px 2px' }} />;
}

function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {children}
    </div>
  );
}

function ToolbarBtn({
  active, onClick, title, children, testId, accentStyle,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
  testId?: string;
  accentStyle?: boolean;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
        fontSize: 11, fontWeight: 600, letterSpacing: '0.01em',
        background: active
          ? (accentStyle ? C.accentDim : C.accent)
          : 'transparent',
        color: active
          ? (accentStyle ? C.accent : '#fff')
          : C.textSecondary,
        boxShadow: active ? `0 0 10px ${C.accentGlow}` : 'none',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = C.textPrimary; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = C.textSecondary; }}
    >
      {children}
    </button>
  );
}

export function Toolbar({
  viewMode, onViewModeChange,
  layoutDirection, onDirectionChange,
  groupingMode, onGroupingChange,
  fitEnabled, onFitToggle,
  onReorganize,
}: {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  layoutDirection: LayoutDirection;
  onDirectionChange: (d: LayoutDirection) => void;
  groupingMode: GroupingMode;
  onGroupingChange: (g: GroupingMode) => void;
  fitEnabled: boolean;
  onFitToggle: () => void;
  onReorganize?: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Graph controls"
      style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', alignItems: 'center', gap: 3, padding: 4,
        background: C.bgPanel,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
      }}
    >
      {/* View Mode */}
      <ToolbarGroup label="View mode">
        {VIEW_OPTIONS.map(({ mode, label }) => (
          <ToolbarBtn
            key={mode}
            testId={`view-${mode}`}
            active={viewMode === mode}
            onClick={() => onViewModeChange(mode)}
            title={`${label} view`}
          >
            {label}
          </ToolbarBtn>
        ))}
      </ToolbarGroup>

      {/* Layout direction — hidden in overview mode */}
      {viewMode !== 'overview' && (
        <>
          <ToolbarDivider />
          <ToolbarGroup label="Layout direction">
            {DIRECTION_OPTIONS.map(({ dir, label }) => (
              <ToolbarBtn
                key={dir}
                testId={`direction-${dir}`}
                active={layoutDirection === dir}
                onClick={() => onDirectionChange(dir)}
                title={dir === 'LR' ? 'Left → Right layout' : 'Top → Bottom layout'}
                accentStyle
              >
                {label}
              </ToolbarBtn>
            ))}
          </ToolbarGroup>
        </>
      )}

      {/* Grouping — hidden in overview mode */}
      {viewMode !== 'overview' && (
        <>
          <ToolbarDivider />
          <ToolbarGroup label="Grouping">
            {GROUPING_OPTIONS.map(({ mode, label }) => (
              <ToolbarBtn
                key={mode}
                testId={`group-${mode}`}
                active={groupingMode === mode}
                onClick={() => onGroupingChange(mode)}
                title={`Group: ${label}`}
                accentStyle
              >
                {label}
              </ToolbarBtn>
            ))}
          </ToolbarGroup>
        </>
      )}

      {/* Fit toggle */}
      <ToolbarDivider />
      <ToolbarBtn
        testId="fit-toggle"
        active={fitEnabled}
        onClick={onFitToggle}
        title={fitEnabled ? 'Auto-fit: on (click to disable)' : 'Auto-fit: off (click to enable)'}
        accentStyle
      >
        Fit
      </ToolbarBtn>

      {/* Reorganize button */}
      {onReorganize && (
        <>
          <ToolbarDivider />
          <ToolbarBtn
            testId="reorganize"
            active={false}
            onClick={onReorganize}
            title="Reorganize graph layout"
          >
            ⟳ Reorganize
          </ToolbarBtn>
        </>
      )}
    </div>
  );
}
