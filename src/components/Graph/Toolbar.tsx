import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LayoutAlgorithm, LayoutDirection } from '../../lib/graph';
import { C } from './constants';
import { toolbarButtonBaseStyle, toolbarDividerStyle, toolbarGroupStyle, toolbarRowStyle } from './toolbarStyles';

// ── Circular Reference Warning Badge ─────────────────────────────────────────

function CycleWarningBadge({
  cycles,
  onSelectCycle,
  selectedCycleIndex,
}: {
  cycles: string[][];
  onSelectCycle: (index: number | null) => void;
  selectedCycleIndex: number | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (cycles.length === 0) return null;

  return (
    <>
      <div aria-hidden="true" style={toolbarDividerStyle} />
      <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          data-testid="cycle-warning-badge"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title={`${cycles.length} circular reference${cycles.length !== 1 ? 's' : ''} detected`}
          style={{
            ...toolbarButtonBaseStyle,
            background: open ? C.amberDim : 'transparent',
            color: C.amber,
            boxShadow: open ? `0 0 10px ${C.amberGlow}` : 'none',
            position: 'relative',
          }}
        >
          {/* Warning triangle icon */}
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.amber} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700 }}>{cycles.length}</span>
        </button>

        {open && (
          <div
            data-testid="cycle-warning-panel"
            role="menu"
            aria-label="Circular references"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              minWidth: 280,
              maxWidth: 420,
              maxHeight: 320,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: 10,
              background: C.bgPanel,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              boxShadow: '0 10px 32px rgba(0,0,0,0.55)',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, padding: '0 4px' }}>
              Circular References ({cycles.length})
            </div>
            {cycles.map((cycle, i) => {
              const isActive = selectedCycleIndex === i;
              // Format: "Sheet1 -> Sheet2 -> Sheet3 -> Sheet1"
              const chain = [...cycle, cycle[0]]
                .map((id) => {
                  // Node IDs are "Workbook::Sheet" — show just the sheet part for brevity
                  const parts = id.split('::');
                  return parts.length > 1 ? parts[1] : id;
                })
                .join(' \u2192 ');

              return (
                <button
                  key={i}
                  role="menuitem"
                  data-testid={`cycle-item-${i}`}
                  onClick={() => {
                    onSelectCycle(isActive ? null : i);
                  }}
                  style={{
                    ...toolbarButtonBaseStyle,
                    width: '100%',
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    background: isActive ? C.amberDim : 'transparent',
                    color: isActive ? C.amber : C.textSecondary,
                    border: `1px solid ${isActive ? `${C.amber}44` : 'transparent'}`,
                    boxShadow: isActive ? `0 0 8px ${C.amberGlow}` : 'none',
                    padding: '6px 8px',
                    fontSize: 11,
                    fontWeight: 500,
                    lineHeight: 1.4,
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = C.textPrimary; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = C.textSecondary; }}
                >
                  <span style={{ color: C.amberDim.replace('0.15', '0.7'), marginRight: 6, fontWeight: 700, fontSize: 10, flexShrink: 0 }}>
                    {i + 1}.
                  </span>
                  {chain}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

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
  onExportPng,
  cycles = [],
  onSelectCycle,
  selectedCycleIndex = null,
  statsOpen,
  onStatsToggle,
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
  onExportPng?: () => void;
  cycles?: string[][];
  onSelectCycle?: (index: number | null) => void;
  selectedCycleIndex?: number | null;
  statsOpen?: boolean;
  onStatsToggle?: () => void;
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

      {/* Circular Reference Warning */}
      {cycles.length > 0 && onSelectCycle && (
        <CycleWarningBadge
          cycles={cycles}
          onSelectCycle={onSelectCycle}
          selectedCycleIndex={selectedCycleIndex ?? null}
        />
      )}

      {/* Export PNG */}
      {onExportPng && (
        <>
          <ToolbarDivider />
          <ToolbarBtn
            testId="export-png"
            active={false}
            onClick={onExportPng}
            title="Export graph as PNG image"
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export
          </ToolbarBtn>
        </>
      )}

      {/* Stats */}
      {onStatsToggle && (
        <>
          <ToolbarDivider />
          <ToolbarBtn
            testId="stats-toggle"
            active={statsOpen ?? false}
            onClick={onStatsToggle}
            title="Show summary statistics"
            accentStyle
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Stats
          </ToolbarBtn>
        </>
      )}
    </div>
  );
}
