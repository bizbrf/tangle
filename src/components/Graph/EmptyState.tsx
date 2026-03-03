import { C } from './constants';

export function EmptyState() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.bg,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: C.surface,
          border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="6" cy="14" r="3" fill={C.border} />
            <circle cx="22" cy="6" r="3" fill={C.border} />
            <circle cx="22" cy="22" r="3" fill={C.border} />
            <line x1="9" y1="13" x2="19" y2="7" stroke={C.border} strokeWidth="1.5" />
            <line x1="9" y1="15" x2="19" y2="21" stroke={C.border} strokeWidth="1.5" />
          </svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 4 }}>
          No files loaded
        </p>
        <p style={{ fontSize: 12, color: C.textMuted }}>
          Upload Excel files to visualize references
        </p>
      </div>
    </div>
  );
}
