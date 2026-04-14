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
  allNodes: Node<NodeData>[];
  onNavigateToNode?: (nodeId: string) => void;
  pathActive?: boolean;
  onShowPaths?: () => void;
  onClearPaths?: () => void;
}

/** Style for clickable sheet-name links in the detail panel */
const navLinkStyle: React.CSSProperties = {
  cursor: 'pointer',
  color: C.accent,
  textDecoration: 'underline',
  textDecorationColor: `${C.accent}55`,
  textUnderlineOffset: 2,
  transition: 'color 0.15s, text-decoration-color 0.15s',
};

export function DetailPanel({ selectedNodes, selectedEdge, onClose, onFocus, focusNodeId, onToggleHidden, hiddenFiles, allEdges, allNodes, onNavigateToNode, pathActive, onShowPaths, onClearPaths }: DetailPanelProps) {
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

  // Compute connected sheets for named range / table nodes (with node IDs for navigation)
  const connectedSheets = useMemo(() => {
    if (!node || (!node.data.isNamedRange && !node.data.isTable)) return null;
    const incomingSeen = new Set<string>();
    const outgoingSeen = new Set<string>();
    const incoming: { id: string; label: string }[] = [];
    const outgoing: { id: string; label: string }[] = [];
    for (const edge of allEdges) {
      if (edge.target === node.id && edge.source !== node.id) {
        if (!incomingSeen.has(edge.source)) {
          incomingSeen.add(edge.source);
          const label = edge.source.replace(/^\[(?:nr|table)\]/, '').replace(/::/g, ' \u203A ');
          incoming.push({ id: edge.source, label });
        }
      }
      if (edge.source === node.id && edge.target !== node.id) {
        if (!outgoingSeen.has(edge.target)) {
          outgoingSeen.add(edge.target);
          const label = edge.target.replace(/^\[(?:nr|table)\]/, '').replace(/::/g, ' \u203A ');
          outgoing.push({ id: edge.target, label });
        }
      }
    }
    return { incoming, outgoing };
  }, [node, allEdges]);

  // Build a lookup map from node ID to display info
  const nodeDisplayMap = useMemo(() => {
    const map = new Map<string, { sheetName: string; workbookName: string }>();
    for (const n of allNodes) {
      map.set(n.id, { sheetName: n.data.sheetName, workbookName: n.data.workbookName });
    }
    return map;
  }, [allNodes]);

  if (selectedNodes.length === 0 && !selectedEdge) return null;
  const isMulti = selectedNodes.length > 1;

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 16, right: 16,
    zIndex: 20,
    width: 300,
    maxHeight: 'calc(100% - 32px)',
    overflowY: 'auto',
    pointerEvents: 'auto',
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
          data-testid="detail-panel-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.textMuted, padding: 3, borderRadius: 6, display: 'flex',
            pointerEvents: 'auto',
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
              <div
                key={n.id}
                role="link"
                tabIndex={0}
                onClick={() => onNavigateToNode?.(n.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') onNavigateToNode?.(n.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '8px 10px',
                  cursor: onNavigateToNode ? 'pointer' : 'default',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { if (onNavigateToNode) (e.currentTarget as HTMLElement).style.borderColor = C.accent; }}
                onMouseLeave={(e) => { if (onNavigateToNode) (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: 99, flexShrink: 0,
                  background: n.data.isTable ? C.violet : n.data.isNamedRange ? C.emerald : n.data.isExternal ? C.amber : C.accent,
                  boxShadow: `0 0 6px ${n.data.isTable ? C.violetGlow : n.data.isNamedRange ? C.emeraldGlow : n.data.isExternal ? C.amberGlow : C.accentGlow}`,
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: onNavigateToNode ? C.accent : C.textPrimary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.data.sheetName}
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.data.workbookName}
                  </div>
                </div>
              </div>
            ))}
            {selectedNodes.length === 2 && onShowPaths && onClearPaths && (
              <button
                data-testid="show-paths-btn"
                onClick={pathActive ? onClearPaths : onShowPaths}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600,
                  background: pathActive ? `${C.accent}22` : C.surface,
                  color: pathActive ? C.accent : C.textSecondary,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (!pathActive) (e.currentTarget as HTMLElement).style.color = C.textPrimary; }}
                onMouseLeave={(e) => { if (!pathActive) (e.currentTarget as HTMLElement).style.color = C.textSecondary; }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {pathActive ? 'Clear Paths' : 'Show Paths'}
              </button>
            )}
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

            {/* Named range enhanced details */}
            {node.data.isNamedRange && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Scope indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.textMuted }}>
                  <span style={{
                    background: `${C.emerald}15`, border: `1px solid ${C.emerald}33`,
                    borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 600, color: C.emerald,
                  }}>
                    {node.data.namedRangeScope === 'sheet' ? 'Sheet-scoped' : 'Workbook-scoped'}
                  </span>
                  {node.data.namedRangeScope === 'sheet' && node.data.namedRangeScopeSheet && (
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.textSecondary }}>
                      {node.data.namedRangeScopeSheet}
                    </span>
                  )}
                </div>
                {/* Address breakdown */}
                {node.data.namedRangeRef && (() => {
                  const bangIdx = node.data.namedRangeRef!.indexOf('!');
                  const sheet = bangIdx >= 0 ? node.data.namedRangeRef!.slice(0, bangIdx) : undefined;
                  const range = bangIdx >= 0 ? node.data.namedRangeRef!.slice(bangIdx + 1) : node.data.namedRangeRef!;
                  return (
                    <div style={{ display: 'flex', gap: 6, fontSize: 10, color: C.textMuted }}>
                      {sheet && (
                        <span>Sheet: <span style={{ fontFamily: 'monospace', color: C.textSecondary }}>{sheet}</span></span>
                      )}
                      <span>Range: <span style={{ fontFamily: 'monospace', color: C.textSecondary }}>{range}</span></span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Table enhanced details */}
            {node.data.isTable && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Table reference */}
                {node.data.tableRef && (
                  <div style={{
                    background: `${C.violet}0a`, border: `1px solid ${C.violet}33`,
                    borderRadius: 8, padding: '8px 10px',
                    fontSize: 11, color: C.violet,
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h-7.5c-.621 0-1.125.504-1.125 1.125" />
                    </svg>
                    <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{node.data.tableRef}</span>
                  </div>
                )}
                {/* Data range breakdown */}
                {node.data.tableRef && (() => {
                  const bangIdx = node.data.tableRef!.indexOf('!');
                  const sheet = bangIdx >= 0 ? node.data.tableRef!.slice(0, bangIdx) : undefined;
                  const range = bangIdx >= 0 ? node.data.tableRef!.slice(bangIdx + 1) : node.data.tableRef!;
                  return (
                    <div style={{ display: 'flex', gap: 6, fontSize: 10, color: C.textMuted }}>
                      {sheet && (
                        <span>Sheet: <span style={{ fontFamily: 'monospace', color: C.textSecondary }}>{sheet}</span></span>
                      )}
                      <span>Range: <span style={{ fontFamily: 'monospace', color: C.textSecondary }}>{range}</span></span>
                    </div>
                  );
                })()}
                {/* Columns list */}
                {node.data.tableColumns && node.data.tableColumns.length > 0 && (
                  <>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted }}>
                      Columns ({node.data.tableColumns.length})
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {node.data.tableColumns.map((col: string) => (
                        <span key={col} style={{
                          background: `${C.violet}15`, border: `1px solid ${C.violet}33`,
                          borderRadius: 4, padding: '2px 6px',
                          fontSize: 10, fontFamily: 'monospace', color: C.violet,
                        }}>
                          {col}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Connected sheets for named range / table nodes */}
            {connectedSheets && (connectedSheets.incoming.length > 0 || connectedSheets.outgoing.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted }}>
                  Connected sheets
                </div>
                {connectedSheets.incoming.length > 0 && (
                  <div style={{ fontSize: 10, color: C.textMuted }}>
                    <span style={{ fontWeight: 600 }}>From: </span>
                    {connectedSheets.incoming.map((item, idx) => (
                      <span key={item.id}>
                        {idx > 0 && ', '}
                        <span
                          role="link"
                          tabIndex={0}
                          style={{ ...navLinkStyle, fontSize: 10 }}
                          onClick={() => onNavigateToNode?.(item.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') onNavigateToNode?.(item.id); }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecorationColor = C.accent; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecorationColor = `${C.accent}55`; }}
                        >
                          {item.label}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                {connectedSheets.outgoing.length > 0 && (
                  <div style={{ fontSize: 10, color: C.textMuted }}>
                    <span style={{ fontWeight: 600 }}>To: </span>
                    {connectedSheets.outgoing.map((item, idx) => (
                      <span key={item.id}>
                        {idx > 0 && ', '}
                        <span
                          role="link"
                          tabIndex={0}
                          style={{ ...navLinkStyle, fontSize: 10 }}
                          onClick={() => onNavigateToNode?.(item.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') onNavigateToNode?.(item.id); }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecorationColor = C.accent; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecorationColor = `${C.accent}55`; }}
                        >
                          {item.label}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
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
            <div style={{ display: 'flex', gap: 8 }}>
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
        {selectedEdge && selectedEdge.data && (() => {
          const srcInfo = nodeDisplayMap.get(selectedEdge.source);
          const tgtInfo = nodeDisplayMap.get(selectedEdge.target);
          return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Source → Target header with clickable names */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '8px 10px',
            }}>
              {srcInfo && (
                <span
                  role="link"
                  tabIndex={0}
                  style={{ ...navLinkStyle, fontSize: 11, fontWeight: 600 }}
                  onClick={() => onNavigateToNode?.(selectedEdge.source)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onNavigateToNode?.(selectedEdge.source); }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecorationColor = C.accent; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecorationColor = `${C.accent}55`; }}
                >
                  {srcInfo.sheetName}
                </span>
              )}
              <span style={{ fontSize: 11, color: C.textMuted }}>&#8594;</span>
              {tgtInfo && (
                <span
                  role="link"
                  tabIndex={0}
                  style={{ ...navLinkStyle, fontSize: 11, fontWeight: 600 }}
                  onClick={() => onNavigateToNode?.(selectedEdge.target)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onNavigateToNode?.(selectedEdge.target); }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecorationColor = C.accent; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecorationColor = `${C.accent}55`; }}
                >
                  {tgtInfo.sheetName}
                </span>
              )}
            </div>
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
          );
        })()}
      </div>
    </div>
  );
}
