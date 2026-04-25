import type { Theme, ThemeId } from './types';

export const THEMES: Record<ThemeId, Theme> = {
  refined: {
    id: 'refined',
    label: 'Refined',
    description: 'Polished dark with curved edges and dot grid. Tangle’s original look.',
    edge: { type: 'default' },
    canvas: { pattern: 'dots', gap: 24, size: 1 },
    chrome: { gutter: false, statusStrip: false },
  },
  dense: {
    id: 'dense',
    label: 'Dense',
    description: 'Mono-forward, sharp corners, denser line grid for power users.',
    edge: { type: 'smoothstep' },
    canvas: { pattern: 'lines', gap: 40, size: 1 },
    chrome: { gutter: true, statusStrip: true },
  },
  cinematic: {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Full-bleed starfield with floating glass panels and edges colored by reference kind.',
    edge: { type: 'default' },
    canvas: { pattern: 'stars', gap: 48, size: 1 },
    chrome: { gutter: false, statusStrip: false },
  },
};

export const DEFAULT_THEME: ThemeId = 'refined';
