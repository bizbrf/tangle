// @vitest-environment jsdom
// tests/unit/theme-provider.test.tsx
// Covers ThemeProvider: localStorage round-trip, cycleTheme order,
// invalid stored value fallback, document data-theme attribute.
//
// Uses react-dom/client + act directly (no @testing-library/react dependency).

// Tells React this is an act-aware test env so it stops warning on render.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from '../../src/themes/ThemeProvider';
import { useTheme } from '../../src/themes/useTheme';
import { THEME_IDS, type ThemeId } from '../../src/themes/types';

const STORAGE_KEY = 'tangle.theme';

interface CapturedHookValue {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  cycleTheme: () => void;
  themeLabel: string;
  themesById: Record<string, { id: string }>;
}

const ref: { value: CapturedHookValue | null } = { value: null };

function Capture() {
  const t = useTheme();
  // Capture in an effect to avoid mutating module state during render.
  useEffect(() => {
    ref.value = {
      themeId: t.themeId,
      setTheme: t.setTheme,
      cycleTheme: t.cycleTheme,
      themeLabel: t.theme.label,
      themesById: t.themes,
    };
  });
  return null;
}

function captured(): CapturedHookValue {
  if (!ref.value) throw new Error('component not mounted');
  return ref.value;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <ThemeProvider>
        <Capture />
      </ThemeProvider>,
    );
  });
}

function unmount() {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
}

describe('THEME-01: ThemeProvider — defaults & localStorage', () => {
  beforeEach(() => {
    ref.value = null;
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => unmount());

  it('defaults to "refined" when no value is stored', () => {
    mount();
    expect(captured().themeId).toBe('refined');
  });

  it('reads a valid stored theme on mount', () => {
    window.localStorage.setItem(STORAGE_KEY, 'cinematic');
    mount();
    expect(captured().themeId).toBe('cinematic');
  });

  it('falls back to "refined" when an invalid theme is stored', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-a-real-theme');
    mount();
    expect(captured().themeId).toBe('refined');
  });

  it('persists the theme to localStorage on change', () => {
    mount();
    act(() => captured().setTheme('dense'));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dense');
  });

  it('sets the document data-theme attribute on mount and on change', () => {
    mount();
    expect(document.documentElement.getAttribute('data-theme')).toBe('refined');
    act(() => captured().setTheme('cinematic'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('cinematic');
  });
});

describe('THEME-02: cycleTheme — order', () => {
  beforeEach(() => {
    ref.value = null;
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => unmount());

  it('advances refined → dense → cinematic → refined', () => {
    mount();
    expect(captured().themeId).toBe('refined');
    act(() => captured().cycleTheme());
    expect(captured().themeId).toBe('dense');
    act(() => captured().cycleTheme());
    expect(captured().themeId).toBe('cinematic');
    act(() => captured().cycleTheme());
    expect(captured().themeId).toBe('refined');
  });

  it('cycles back to the starting theme after THEME_IDS.length steps', () => {
    mount();
    const start = captured().themeId;
    for (let i = 0; i < THEME_IDS.length; i++) {
      act(() => captured().cycleTheme());
    }
    expect(captured().themeId).toBe(start);
  });

  it('every cycle step lands on a registered theme id', () => {
    mount();
    const seen = new Set<string>();
    for (let i = 0; i < THEME_IDS.length; i++) {
      seen.add(captured().themeId);
      act(() => captured().cycleTheme());
    }
    expect(seen.size).toBe(THEME_IDS.length);
    for (const id of seen) expect(THEME_IDS).toContain(id);
  });
});

describe('THEME-03: theme object exposure', () => {
  beforeEach(() => {
    ref.value = null;
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => unmount());

  it('exposes a non-empty label for the active theme', () => {
    mount();
    expect(captured().themeLabel).toBeTruthy();
  });

  it('exposes the full themes record keyed by id', () => {
    mount();
    for (const id of THEME_IDS) {
      expect(captured().themesById[id]).toBeDefined();
      expect(captured().themesById[id].id).toBe(id);
    }
  });
});
