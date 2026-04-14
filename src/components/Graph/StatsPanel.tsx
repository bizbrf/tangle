import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { NodeData, EdgeData, EdgeKind } from '../../lib/graph';
import type { WorkbookFile } from '../../types';
import { C } from './constants';

const EDGE_KIND_META: { kind: EdgeKind; label: string; color: string }[] = [
  { kind: 'internal',    label: 'Internal',     color: '#e8445a' },
  { kind: 'cross-file',  label: 'Cross-file',   color: '#818cf8' },
  { kind: 'external',    label: 'External',     color: '#f59e0b' },
  { kind: 'named-range', label: 'Named Range',  color: '#10b981' },
  { kind: 'table',       label: 'Table',        color: '#a78bfa' },
];

interface StatsPanelProps {
  workbooks: WorkbookFile[];
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  onClose: () => void;
}

export function StatsPanel({ workbooks, nodes, edges, onClose }: StatsPanelProps) {
  const stats = useMemo(() => {
    const totalWorkbooks = workbooks.length;
    const totalSheets = workbooks.reduce((sum, wb) => sum + wb.sheets.length, 0);
    const totalFormulas = workbooks.reduce(
      (sum, wb) => sum + wb.sheets.reduce((s, sh) => s + sh.workload.totalFormulas, 0),
      0,
    );

    // Edge breakdown by kind
    const edgeCounts: Record<EdgeKind, number> = {
      internal: 0, 'cross-file': 0, external: 0, 'named-range': 0, table: 0,
    };
    for (const edge of edges) {
      const kind = (edge.data as EdgeData | undefined)?.edgeKind ?? 'internal';
      edgeCounts[kind]++;
    }

    // Busiest sheet (most totalFormulas)
    let busiestSheet: { name: string; workbook: string; count: number } | null = null;
    for (const wb of workbooks) {
      for (const sh of wb.sheets) {
        if (!busiestSheet || sh.workload.totalFormulas > busiestSheet.count) {
          busiestSheet = {
            name: sh.sheetName,
            workbook: wb.originalName,
            count: sh.workload.totalFormulas,
          };
        }
      }
    }

    // Most-referenced sheet (most incoming edges)
    const incomingCounts = new Map<string, number>();
    for (const edge of edges) {
      incomingCounts.set(edge.target, (incomingCounts.get(edge.target) ?? 0) + 1);
    }
    let mostReferenced: { name: string; workbook: string; count: number } | null = null;
    for (const node of nodes) {
      const d = node.data;
      if (d.isFileNode || d.isNamedRange || d.isTable) continue;
      const inc = incomingCounts.get(node.id) ?? 0;
      if (inc > 0 && (!mostReferenced || inc > mostReferenced.count)) {
        mostReferenced = {
          name: d.sheetName,
          workbook: d.workbookName,
          count: inc,
        };
      }
    }

    return { totalWorkbooks, totalSheets, totalFormulas, edgeCounts, busiestSheet, mostReferenced };
  }, [workbooks, nodes, edges]);

  const totalEdges = Object.values(stats.edgeCounts).reduce((a, b) => a + b, 0);

  return (
    <div
      data-testid="stats-panel"
      style={{
        position: 'absolute',
        top: 56,
        right: 16,
        zIndex: 20,
        width: 280,
        pointerEvents: 'auto',
        background: C.bgPanel,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        fontSize: 13,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px 10px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: C.textSecondary,
        }}>
          Statistics
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: C.textMuted,
            fontSize: 16,
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: 4,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = C.textPrimary)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = C.textMuted)}
        >
          x
        </button>
      </div>

      <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Summary metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <MetricCard label="Workbooks" value={stats.totalWorkbooks} color={C.accent} />
          <MetricCard label="Sheets" value={stats.totalSheets} color={C.accent} />
          <MetricCard label="Formulas" value={stats.totalFormulas} color={C.accent} />
        </div>

        {/* Edge breakdown */}
        <div>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: C.textMuted,
            marginBottom: 8,
          }}>
            Edges ({totalEdges})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {EDGE_KIND_META.map(({ kind, label, color }) => {
              const count = stats.edgeCounts[kind];
              if (count === 0) return null;
              const pct = totalEdges > 0 ? (count / totalEdges) * 100 : 0;
              return (
                <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 7,
                    height: 7,
                    borderRadius: 2,
                    background: color,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, color: C.textSecondary, flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                    {count}
                  </span>
                  <div style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    background: C.surface,
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: 2,
                      background: color,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Busiest sheet */}
        {stats.busiestSheet && stats.busiestSheet.count > 0 && (
          <HighlightCard
            title="Busiest Sheet"
            name={stats.busiestSheet.name}
            workbook={stats.busiestSheet.workbook}
            metric={`${stats.busiestSheet.count} formulas`}
            color={C.accent}
          />
        )}

        {/* Most referenced sheet */}
        {stats.mostReferenced && (
          <HighlightCard
            title="Most Referenced"
            name={stats.mostReferenced.name}
            workbook={stats.mostReferenced.workbook}
            metric={`${stats.mostReferenced.count} incoming edges`}
            color="#818cf8"
          />
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      padding: '8px 4px',
      background: C.surface,
      borderRadius: 8,
      border: `1px solid ${C.border}`,
    }}>
      <span style={{
        fontSize: 18,
        fontWeight: 800,
        color,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
      }}>
        {value}
      </span>
      <span style={{
        fontSize: 9,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: C.textMuted,
      }}>
        {label}
      </span>
    </div>
  );
}

function HighlightCard({
  title,
  name,
  workbook,
  metric,
  color,
}: {
  title: string;
  name: string;
  workbook: string;
  metric: string;
  color: string;
}) {
  return (
    <div style={{
      padding: '8px 10px',
      background: C.surface,
      borderRadius: 8,
      border: `1px solid ${C.border}`,
    }}>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: C.textMuted,
        marginBottom: 4,
      }}>
        {title}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, lineHeight: 1.3 }}>
        {name}
      </div>
      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>
        {workbook}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>
        {metric}
      </span>
    </div>
  );
}
