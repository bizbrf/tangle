import { useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { THEMES, DEFAULT_THEME } from './themes';
import type { ThemeId } from './types';
import { THEME_IDS } from './types';
import { ThemeContext, type ThemeContextValue } from './ThemeContext';

const STORAGE_KEY = 'tangle.theme';

function readStored(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (THEME_IDS as readonly string[]).includes(raw)) return raw as ThemeId;
  } catch {
    // localStorage blocked — fall through
  }
  return DEFAULT_THEME;
}

interface ThemeProviderProps {
  children: ReactNode;
  initial?: ThemeId;
}

export function ThemeProvider({ children, initial }: ThemeProviderProps) {
  const [themeId, setThemeId] = useState<ThemeId>(() => initial ?? readStored());

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', themeId);
    try {
      window.localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      // ignore
    }
  }, [themeId]);

  const cycleTheme = useCallback(() => {
    setThemeId((prev) => {
      const i = THEME_IDS.indexOf(prev);
      return THEME_IDS[(i + 1) % THEME_IDS.length];
    });
  }, []);

  // Ctrl+\ (or Cmd+\) cycles themes globally
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        cycleTheme();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cycleTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: THEMES[themeId],
    themeId,
    setTheme: setThemeId,
    cycleTheme,
    themes: THEMES,
  }), [themeId, cycleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
