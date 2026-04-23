import type { Theme, ThemeId } from './types';

const SANS_STACK = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO_STACK = 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace';

export const THEMES: Record<ThemeId, Theme> = {
  refined: {
    id: 'refined',
    label: 'Refined',
    description: 'Polished dark with curved edges and dot grid. Tangle\u2019s original look.',
    font: { sans: SANS_STACK, mono: MONO_STACK },
    node: { radius: 14, borderWidth: 1.5 },
    edge: { type: 'default', animated: false },
    canvas: { pattern: 'dots', gap: 24, size: 1 },
    chrome: {
      layout: 'columns',
      panelBlur: false,
      panelRadius: 10,
      gutter: false,
      statusStrip: false,
    },
  },
  dense: {
    id: 'dense',
    label: 'Dense',
    description: 'Mono-forward, sharp corners, orthogonal edges, rulers and hotkey strip for power users.',
    font: { sans: MONO_STACK, mono: MONO_STACK },
    node: { radius: 2, borderWidth: 1 },
    edge: { type: 'smoothstep', animated: false },
    canvas: { pattern: 'lines', gap: 40, size: 1 },
    chrome: {
      layout: 'columns',
      panelBlur: false,
      panelRadius: 3,
      gutter: true,
      statusStrip: true,
    },
  },
  cinematic: {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Full-bleed starfield with floating glass panels and edges colored by reference kind.',
    font: { sans: SANS_STACK, mono: MONO_STACK },
    node: { radius: 10, borderWidth: 1 },
    edge: { type: 'default', animated: true },
    canvas: { pattern: 'stars', gap: 48, size: 1 },
    chrome: {
      layout: 'floating',
      panelBlur: true,
      panelRadius: 12,
      gutter: false,
      statusStrip: false,
    },
  },
};

export const DEFAULT_THEME: ThemeId = 'refined';
