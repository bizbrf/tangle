import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { EdgeReference } from '../../types';
import type { NodeData, EdgeData, EdgeKind } from '../../lib/graph';
import { C } from './constants';

interface DetailPanelProps {
  selectedNodes: Node<NodeData>[];
  selectedEdge: Edge<EdgeData> | null;
  onClose: () => void;
  onFocus: (nodeId: string) => void;
  focusNodeId: string | null;
  onToggleHidden?: (workbookName: string) => void;
  hiddenFiles?: Set<string>;
  allEdges: Edge<EdgeData>[];
  onTogglePin?: (nodeId: string) => void;
}

export function DetailPanel({ selectedNodes, selectedEdge, onClose, onFocus, focusNodeId, onToggleHidden, hiddenFiles, allEdges, onTogglePin }: DetailPanelProps) {
  const node = selectedNodes.length === 1 ? selectedNodes[0] : null;

  // Compute edge kind breakdown for single-node selection (must be before early return)
  const edgeBreakdown = useMemo(() => {
    if (!node) return null;
    const counts: Record<EdgeKind, number> = { internal: 0, 'cross-file': 0, external: 0, 'named-range': 0, table: 0 };
    for (const edge of allEdges) {
      if (edge.source === node.id || edge.target === node.id) {
        const kind = (edge.data as EdgeData | undefined)?.edgeKind ?? 'internal';
        counts[kind]++;
      }
    }
    return counts;
  }, [node, allEdges]);

  if (selectedNodes.length === 0 && !selectedEdge) return null;
  const isMulti = selectedNodes.length > 1;

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 16, right: 16,
    zIndex: 10,
    width: 300,
    maxHeight: 'calc(100% - 32px)',
    overflowY: 'auto',
    background: C.bgPanel,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
    fontSize: 13,
  };

  const actionBtnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 8, border: 'none', cursor: active ? 'default' : 'pointer',
    fontSize: 11, fontWeight: 600,
    background: active ? `${C.accent}22` : C.surface,
    color: active ? C.accent : C.textSecondary,
    transition: 'all 0.15s',
    opacity: active ? 0.6 : 1,
    flex: 1, justifyContent: 'center',
  });

  return (
    <div data-testid="detail-panel" style={panelStyle}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: `1px solid ${C.border}`,
        background: C.surface,
        position: 'sticky', top: 0, zIndex: 1,
      }}>
        <span data-testid="detail-panel-title" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted }}>
          {isMulti ? `${selectedNodes.length} selected` : node ? (node.data.isTable ? 'Table' : node.data.isNamedRange ? 'Named Range' : 'Sheet') : 'References'}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.textMuted, padding: 3, borderRadius: 6, display: 'flex',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = C.textPrimary)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = C.textMuted)}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div style={{ padding: 14 }}>
        {/* Multi-select */}
        {isMulti && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selectedNodes.map((n) => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '8px 10px',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 99, flexShrink: 0,
                  background: n.data.isTable ? C.violet : n.data.isNamedRange ? C.emerald : n.data.isExternal ? C.amber : C.accent,
                  boxShadow: `0 0 6px ${n.data.isTable ? C.violetGlow : n.data.isNamedRange ? C.emeraldGlow : n.data.isExternal ? C.amberGlow : C.accentGlow}`,
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: C.textPrimary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.data.sheetName}
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.data.workbookName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Single node */}
        {node && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Name card */}
            <div style={{
              background: C.surface,
              border: `1px solid ${node.data.isTable ? `${C.violet}44` : node.data.isNamedRange ? `${C.emerald}44` : node.data.isExternal ? `${C.amber}44` : `${C.accent}33`}`,
              borderLeft: `3px solid ${node.data.isTable ? C.violet : node.data.isNamedRange ? C.emerald : node.data.isExternal ? C.amber : C.accent}`,
              borderRadius: 10, padding: '10px 12px',
              boxShadow: `0 0 16px ${node.data.isTable ? C.violetGlow.replace('0.3', '0.1') : node.data.isNamedRange ? C.emeraldGlow.replace('0.3', '0.1') : node.data.isExternal ? C.amberGlow.replace('0.3', '0.1') : C.accentGlow.replace('0.3', '0.1')}`,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.textMuted, marginBottom: 3 }}>
                {node.data.workbookName}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>
                {node.data.sheetName}
              </div>
            </div>

            {/* Named range details */}
            {node.data.isNamedRange && node.data.namedRangeRef && (
              <div style={{
                background: `${C.emerald}0a`, border: `1px solid ${C.emerald}33`,
                borderRadius: 8, padding: '8px 10px',
                fontSize: 11, color: C.emerald,
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                </svg>
                <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{node.data.namedRangeRef}</span>
              </div>
            )}

            {/* Edge stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'outgoing', value: node.data.outgoingCount, color: node.data.isNamedRange ? C.emerald : C.accent },
                { label: 'incoming', value: node.data.incomingCount, color: C.textSecondary },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '10px 12px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Workload stats */}
            {node.data.workload && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted }}>
                  Workload
                </div>
                <div data-testid="workload-metrics" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'formulas', value: node.data.workload.totalFormulas, color: C.textPrimary },
                    { label: 'within-sheet', value: node.data.workload.withinSheetRefs, color: C.textSecondary },
                    { label: 'cross-sheet', value: node.data.workload.crossSheetRefs, color: C.accent },
                    { label: 'cross-file', value: node.data.workload.crossFileRefs, color: '#818cf8' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      background: C.surface, border: `1px solid ${C.border}`,
                      borderRadius: 10, padding: '8px 10px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>
                        {value}
                      </div>
                      <div style={{ fontSize: 9, color: C.textMuted, marginTop: 3 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Edge kind breakdown */}
            {edgeBreakdown && (edgeBreakdown.internal > 0 || edgeBreakdown['cross-file'] > 0 || edgeBreakdown.external > 0 || edgeBreakdown['named-range'] > 0 || edgeBreakdown.table > 0) && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted }}>
                  Edges by kind
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {([
                    { kind: 'internal' as const, label: 'Internal', color: '#e8445a' },
                    { kind: 'cross-file' as const, label: 'Cross-file', color: '#818cf8' },
                    { kind: 'external' as const, label: 'External', color: '#f59e0b' },
                    { kind: 'named-range' as const, label: 'Named Range', color: '#10b981' },
                    { kind: 'table' as const, label: 'Table', color: '#a78bfa' },
                  ] as const).filter(({ kind }) => edgeBreakdown[kind] > 0).map(({ kind, label, color }) => (
                    <div key={kind} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: `${color}11`, border: `1px solid ${color}33`,
                      borderRadius: 8, padding: '5px 9px',
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color }}>{edgeBreakdown[kind]}</span>
                      <span style={{ fontSize: 9, color: C.textMuted }}>{label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => { if (focusNodeId !== node.id) onFocus(node.id); }}
                disabled={focusNodeId === node.id}
                style={actionBtnStyle(focusNodeId === node.id)}
                onMouseEnter={(e) => { if (focusNodeId !== node.id) (e.currentTarget as HTMLElement).style.color = C.textPrimary; }}
                onMouseLeave={(e) => { if (focusNodeId !== node.id) (e.currentTarget as HTMLElement).style.color = C.textSecondary; }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="3" />
                  <path strokeLinecap="round" d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                </svg>
                {focusNodeId === node.id ? 'Focused' : 'Focus'}
              </button>
              {onTogglePin && (
                <button
                  data-testid="pin-toggle"
                  onClick={() => onTogglePin(node.id)}
                  style={actionBtnStyle(!!node.data.pinned)}
                  onMouseEnter={(e) => { if (!node.data.pinned) (e.currentTarget as HTMLElement).style.color = C.textPrimary; }}
                  onMouseLeave={(e) => { if (!node.data.pinned) (e.currentTarget as HTMLElement).style.color = C.textSecondary; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 3l5 5-7.5 7.5M16 3l-2.5 7.5M16 3l5 5M8 21l-5 0 5-5 5 5-5 0z" />
                  </svg>
                  {node.data.pinned ? 'Pinned' : 'Pin'}
                </button>
              )}
              {onToggleHidden && (() => {
                const isHidden = !!hiddenFiles?.has(node.data.workbookName);
                return (
                  <button
                    onClick={() => onToggleHidden(node.data.workbookName)}
                    style={actionBtnStyle(false)}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = C.textPrimary)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = C.textSecondary)}
                  >
                    {isHidden ? (
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    )}
                    {isHidden ? 'Show' : 'Hide'}
                  </button>
                );
              })()}
            </div>

            {node.data.isExternal && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 8, padding: '8px 10px',
                fontSize: 11, color: C.amber,
              }}>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                External file — not uploaded
              </div>
            )}
          </div>
        )}

        {/* Edge */}
        {selectedEdge && selectedEdge.data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>
              {selectedEdge.data.references.length} formula reference{selectedEdge.data.references.length !== 1 ? 's' : ''}
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedEdge.data.references.map((ref: EdgeReference, i: number) => (
                <div key={i} style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 11,
                    color: C.accent, wordBreak: 'break-all', lineHeight: 1.5,
                    marginBottom: 6,
                  }}>
                    {ref.formula}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.textMuted }}>
                    {[ref.sourceCell, '→', ref.targetCells.join(', ')].map((seg, j) =>
                      seg === '→' ? (
                        <span key={j}>{seg}</span>
                      ) : (
                        <span key={j} style={{
                          fontFamily: 'monospace',
                          background: '#1e2535', borderRadius: 4,
                          padding: '2px 5px', color: C.textSecondary,
                        }}>
                          {seg}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
