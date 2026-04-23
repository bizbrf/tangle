import { createContext } from 'react';
import type { Theme, ThemeId } from './types';
import type { THEMES } from './themes';

export interface ThemeContextValue {
  theme: Theme;
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  cycleTheme: () => void;
  themes: typeof THEMES;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
