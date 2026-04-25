// tests/unit/constants.test.ts
// Covers `alpha(color, pct)` from src/components/Graph/constants.ts.
// The exact `color-mix` syntax is load-bearing — a typo here produces strings
// browsers silently reject, which manifests as invisible glow effects in v2.
import { describe, it, expect } from 'vitest';
import { alpha, C } from '../../src/components/Graph/constants';

describe('CONST-01: alpha() — color-mix output shape', () => {
  it('emits the exact color-mix(in srgb, <color> <pct>%, transparent) form', () => {
    expect(alpha('var(--tg-accent)', 33)).toBe('color-mix(in srgb, var(--tg-accent) 33%, transparent)');
  });

  it('passes the color argument through unchanged (CSS var)', () => {
    expect(alpha(C.amber, 50)).toContain('var(--tg-amber)');
  });

  it('passes the color argument through unchanged (hex)', () => {
    expect(alpha('#ff0000', 25)).toBe('color-mix(in srgb, #ff0000 25%, transparent)');
  });

  it('inserts the integer percentage as written', () => {
    expect(alpha('var(--x)', 0)).toContain(' 0%');
    expect(alpha('var(--x)', 100)).toContain(' 100%');
  });
});

describe('CONST-02: C tokens — every entry resolves to a CSS var', () => {
  it('every C entry is a var() reference', () => {
    for (const [key, value] of Object.entries(C)) {
      expect(value, `C.${key}`).toMatch(/^var\(--tg-/);
    }
  });
});
