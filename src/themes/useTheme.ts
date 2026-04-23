import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './ThemeContext';
import { THEMES, DEFAULT_THEME } from './themes';

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider (tests, Storybook)
    return {
      theme: THEMES[DEFAULT_THEME],
      themeId: DEFAULT_THEME,
      setTheme: () => undefined,
      cycleTheme: () => undefined,
      themes: THEMES,
    };
  }
  return ctx;
}
