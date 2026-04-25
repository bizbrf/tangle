// Design tokens — CSS custom properties defined in src/index.css and swapped
// per theme via `:root[data-theme="..."]`. Values are var() strings (not hex)
// so consumers re-theme automatically when the data-theme attribute flips, with
// no React re-render needed.

export const C = {
  accent: 'var(--tg-accent)',
  accentDim: 'var(--tg-accent-dim)',
  accentGlow: 'var(--tg-accent-glow)',
  accentGlowFaint: 'var(--tg-accent-glow-faint)',

  amber: 'var(--tg-amber)',
  amberDim: 'var(--tg-amber-dim)',
  amberGlow: 'var(--tg-amber-glow)',
  amberGlowFaint: 'var(--tg-amber-glow-faint)',

  emerald: 'var(--tg-emerald)',
  emeraldDim: 'var(--tg-emerald-dim)',
  emeraldGlow: 'var(--tg-emerald-glow)',
  emeraldGlowFaint: 'var(--tg-emerald-glow-faint)',

  violet: 'var(--tg-violet)',
  violetDim: 'var(--tg-violet-dim)',
  violetGlow: 'var(--tg-violet-glow)',
  violetGlowFaint: 'var(--tg-violet-glow-faint)',

  indigo: 'var(--tg-indigo)',

  surface: 'var(--tg-surface)',
  surfaceRaised: 'var(--tg-surface-raised)',
  surfaceHi: 'var(--tg-surface-hi)',
  border: 'var(--tg-border)',
  borderHover: 'var(--tg-border-hover)',
  borderStrong: 'var(--tg-border-strong)',

  textPrimary: 'var(--tg-text-primary)',
  textSecondary: 'var(--tg-text-secondary)',
  textMuted: 'var(--tg-text-muted)',
  textFaint: 'var(--tg-text-faint)',

  bg: 'var(--tg-bg)',
  bgDeep: 'var(--tg-bg-deep)',
  bgPanel: 'var(--tg-bg-panel)',

  edgeCrossSheet: 'var(--tg-edge-cross-sheet)',
  edgeCrossFile: 'var(--tg-edge-cross-file)',
  edgeExternal: 'var(--tg-edge-external)',
  edgeNamed: 'var(--tg-edge-named)',
  edgeTable: 'var(--tg-edge-table)',
} as const;

/**
 * Mix `color` with transparent at `pct`%. Uses `color-mix` because rgb()/hsla
 * cannot consume CSS var() inputs and string-concat (`${C.accent}33`) produces
 * `var(--tg-accent)33` — invalid CSS that browsers silently drop.
 */
export function alpha(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}
