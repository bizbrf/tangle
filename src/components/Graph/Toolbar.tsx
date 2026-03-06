import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LayoutAlgorithm, LayoutDirection } from '../../lib/graph';
import { C } from './constants';
import { toolbarButtonBaseStyle, toolbarDividerStyle, toolbarGroupStyle, toolbarRowStyle } from './toolbarStyles';

export type ViewMode = 'graph' | 'overview';

const VIEW_OPTIONS: { mode: ViewMode; label: string; key: string }[] = [
  { mode: 'graph',    label: 'Graph',    key: 'G' },
  { mode: 'overview', label: 'Overview', key: 'O' },
];

const DIRECTION_OPTIONS: { dir: LayoutDirection; label: string; key: string }[] = [
  { dir: 'LR', label: 'LR', key: '←→' },
  { dir: 'TB', label: 'TB', key: '↑↓' },
];

const ADVANCED_LAYOUT_OPTIONS: { algorithm: LayoutAlgorithm; label: string; description: string }[] = [
  { algorithm: 'classic', label: 'Classic', description: 'The earlier layered random layout' },
  { algorithm: 'structured', label: 'Layered', description: 'Clean hierarchical flow layout' },
  { algorithm: 'organic', label: 'Fruchterman-Reingold', description: 'Force-directed' },
  { algorithm: 'radial', label: 'Radial', description: 'Breadth / concentric' },
];

function ToolbarDivider() {
  return <div aria-hidden="true" style={toolbarDividerStyle} />;
}

function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} style={toolbarGroupStyle}>
      {children}
    </div>
  );
}

function ToolbarBtn({
  active, onClick, title, children, testId, accentStyle, ariaExpanded,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
  testId?: string;
  accentStyle?: boolean;
  ariaExpanded?: boolean;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      aria-expanded={ariaExpanded}
      style={{
        ...toolbarButtonBaseStyle,
        background: active
          ? (accentStyle ? C.accentDim : C.accent)
          : 'transparent',
        color: active
          ? (accentStyle ? C.accent : '#fff')
          : C.textSecondary,
        boxShadow: active ? `0 0 10px ${C.accentGlow}` : 'none',
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
  fitEnabled, onFitToggle,
  layoutAlgorithm,
  onApplyLayoutAlgorithm,
  onResetLayout,
  onRandomizeLayout,
}: {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  layoutDirection: LayoutDirection;
  onDirectionChange: (d: LayoutDirection) => void;
  fitEnabled: boolean;
  onFitToggle: () => void;
  layoutAlgorithm: LayoutAlgorithm;
  onApplyLayoutAlgorithm?: (algorithm: LayoutAlgorithm) => void;
  onResetLayout?: () => void;
  onRandomizeLayout?: () => void;
}) {
  const [reorganizeOpen, setReorganizeOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<'simple' | 'advanced'>('simple');
  const showReorganizeMenu = !!onResetLayout || !!onRandomizeLayout || !!onApplyLayoutAlgorithm;
  const reorganizeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!reorganizeOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!reorganizeRef.current?.contains(event.target as Node)) {
        setReorganizeOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setReorganizeOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [reorganizeOpen]);

  return (
    <div
      role="toolbar"
      aria-label="Graph controls"
      style={toolbarRowStyle}
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

      {/* Layout actions */}
      {showReorganizeMenu && (
        <>
          <ToolbarDivider />
          <div
            ref={reorganizeRef}
            style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
          >
            <ToolbarBtn
              testId="reorganize"
              active={reorganizeOpen}
              onClick={() => {
                setReorganizeOpen((open) => {
                  const next = !open;
                  if (next) setMenuMode('simple');
                  return next;
                });
              }}
              title="Layout actions"
              ariaExpanded={reorganizeOpen}
            >
              ⟳ Reorganize
            </ToolbarBtn>
            {reorganizeOpen && (
              <div
                role="menu"
                aria-label="Reorganize layout"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  minWidth: menuMode === 'advanced' ? 420 : 220,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: 12,
                  background: C.bgPanel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  boxShadow: '0 10px 32px rgba(0,0,0,0.55)',
                  pointerEvents: 'auto',
                }}
              >
                {menuMode === 'simple' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {onResetLayout && (
                      <ToolbarBtn
                        testId="layout-reset"
                        active={layoutAlgorithm === 'structured'}
                        onClick={() => {
                          onResetLayout();
                          setReorganizeOpen(false);
                        }}
                        title="Reset to the default structured layout"
                        accentStyle
                      >
                        Reset
                      </ToolbarBtn>
                    )}
                    {onRandomizeLayout && (
                      <ToolbarBtn
                        testId="layout-randomize"
                        active={layoutAlgorithm === 'classic'}
                        onClick={() => {
                          onRandomizeLayout();
                          setReorganizeOpen(false);
                        }}
                        title="Generate a fresh randomized layout"
                        accentStyle
                      >
                        Randomize
                      </ToolbarBtn>
                    )}
                    {onApplyLayoutAlgorithm && (
                      <button
                        type="button"
                        onClick={() => setMenuMode('advanced')}
                        style={{
                          ...toolbarButtonBaseStyle,
                          justifyContent: 'space-between',
                          width: '100%',
                          border: `1px solid ${C.border}`,
                          color: C.textSecondary,
                        }}
                      >
                        <span>Advanced</span>
                        <span style={{ color: C.textMuted }}>›</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setMenuMode('simple')}
                      style={{
                        ...toolbarButtonBaseStyle,
                        justifyContent: 'space-between',
                        border: `1px solid ${C.border}`,
                        color: C.textSecondary,
                      }}
                    >
                      <span>‹ Simple</span>
                      <span style={{ fontSize: 10, color: C.textMuted }}>Choose algorithm</span>
                    </button>
                    {onApplyLayoutAlgorithm && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        {ADVANCED_LAYOUT_OPTIONS.map(({ algorithm, label, description }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              onApplyLayoutAlgorithm(algorithm);
                              setReorganizeOpen(false);
                            }}
                            title={description}
                            style={{
                              ...toolbarButtonBaseStyle,
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              minWidth: 0,
                              padding: '8px 10px',
                              background: layoutAlgorithm === algorithm ? `${C.accent}22` : 'transparent',
                              color: layoutAlgorithm === algorithm ? C.textPrimary : C.textSecondary,
                              border: `1px solid ${layoutAlgorithm === algorithm ? C.accent : C.border}`,
                              boxShadow: layoutAlgorithm === algorithm ? `0 0 10px ${C.accentGlow}` : 'none',
                            }}
                          >
                            <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
                            <span style={{ fontSize: 10, color: C.textMuted }}>{description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
