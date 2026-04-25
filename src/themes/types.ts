/**
 * Theme contract — only fields actually consumed at runtime live here.
 *
 * Per-theme typography, node/panel radii, and chrome behaviour are encoded as
 * CSS custom properties on `:root[data-theme="..."]` in `src/index.css`. The
 * runtime fields below drive things React Flow can't reach via CSS:
 *  - `canvas.pattern` selects the React Flow `<Background>` variant or the
 *    custom `<StarfieldBackground>` overlay.
 *  - `edge.type` is the default React Flow edge routing (currently overridden
 *    per-edge by `WeightedEdge`, but kept here for non-weighted edge types
 *    that may be added later).
 */

// Single source of truth for theme ids — derive the union from the array so
// adding a theme to one place adds it everywhere.
export const THEME_IDS = ['refined', 'dense', 'cinematic'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export interface Theme {
  id: ThemeId;
  label: string;
  description: string;
  edge: {
    type: 'default' | 'smoothstep' | 'straight';
  };
  canvas: {
    pattern: 'dots' | 'lines' | 'cross' | 'stars';
    gap: number;
    size: number;
  };
  chrome: {
    /** Render coordinate-style ruler strips on the canvas edges (Dense). */
    gutter: boolean;
    /** Render a hotkey reference strip pinned to the canvas bottom (Dense). */
    statusStrip: boolean;
  };
}
