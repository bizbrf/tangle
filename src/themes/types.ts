export type ThemeId = 'refined' | 'dense' | 'cinematic';

export interface Theme {
  id: ThemeId;
  label: string;
  description: string;

  font: {
    sans: string;
    mono: string;
  };

  node: {
    radius: number;
    borderWidth: number;
  };

  edge: {
    type: 'default' | 'smoothstep' | 'straight';
    animated: boolean;
  };

  canvas: {
    pattern: 'dots' | 'lines' | 'cross' | 'stars';
    gap: number;
    size: number;
  };

  chrome: {
    layout: 'columns' | 'floating';
    panelBlur: boolean;
    panelRadius: number;
    gutter: boolean;
    statusStrip: boolean;
  };
}

export const THEME_IDS: readonly ThemeId[] = ['refined', 'dense', 'cinematic'] as const;
