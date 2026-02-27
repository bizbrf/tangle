# Stack Research

**Domain:** Testing — Vite/React/TypeScript SPA (Tangle)
**Researched:** 2026-02-27
**Confidence:** HIGH (versions npm-verified; configuration patterns verified via official docs)

---

## Recommended Stack

### Unit + Integration Testing Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| vitest | ^4.0.18 | Test runner for `parser.ts` and `graph.ts` unit tests | Same Vite transform pipeline — no separate Babel/TypeScript config needed. Zero config for Vite 7 projects. ESM, TypeScript, and JSX work out of the box. Fastest option for this stack by a significant margin over Jest. |
| @vitest/coverage-v8 | ^4.0.18 | Code coverage reports | V8 coverage is the Vitest default and is now AST-remapped (since Vitest 3.2.0), giving Istanbul-equivalent accuracy with ~30% better performance. No extra transpile step. |
| jsdom | ^28.1.0 | DOM environment for React component tests | More complete browser API coverage than happy-dom — critical for SheetJS (xlsx) which exercises FileReader, ArrayBuffer, Blob APIs that happy-dom does not fully implement. |
| @testing-library/react | ^16.3.2 | React component test utilities | Standard library for testing React components from the user's perspective. Fully compatible with React 19 (peer dep: `react ^18 \|\| ^19`). Avoids testing implementation details. |
| @testing-library/user-event | ^14.6.1 | Realistic user interaction simulation | Simulates real browser events (pointer events, keyboard events) rather than synthetic fire events. Required for drag-and-drop file upload tests. |
| @testing-library/jest-dom | ^6.9.1 | DOM assertion matchers | Provides `.toBeInTheDocument()`, `.toHaveClass()`, etc. Vitest-native via `import "@testing-library/jest-dom/vitest"`. Eliminates verbose `expect(el).not.toBeNull()` patterns. |

### E2E Testing Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @playwright/test | ^1.58.2 | End-to-end browser automation | TypeScript-native, fastest E2E runner in 2026 by download volume (20-30M/week, surpassed Cypress mid-2024). `webServer` config launches `npm run dev` automatically — clean Vite integration. Out-of-process architecture enables file upload, download, and complex UI interactions that Cypress cannot do inside the browser event loop. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| xlsx (SheetJS) | ^0.18.5 (already installed) | Programmatic `.xlsx` fixture generation | Use in fixture scripts (`tests/fixtures/generate.ts`) to create test workbooks — cross-sheet refs, external links, named ranges, malformed inputs. Do NOT ship binary `.xlsx` files in the repo. |
| @types/node | ^24.10.1 (already installed) | Node.js type definitions for fixture scripts | Needed for `fs`, `path`, and `Buffer` in fixture generation scripts. Already present. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| vitest UI (`@vitest/ui`) | Interactive test browser for unit tests | Optional but useful during development. Run with `npx vitest --ui`. Version must match vitest exactly (4.0.18). |
| Playwright Inspector | Interactive Playwright test debugger | Built into `@playwright/test`. Run with `npx playwright test --debug`. No separate install. |
| Playwright HTML reporter | Test result reports | Built-in. Run with `npx playwright show-report` after test run. |

---

## Installation

```bash
# Unit test stack
npm install -D vitest @vitest/coverage-v8 jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom

# E2E stack
npm install -D @playwright/test
npx playwright install chromium
```

Notes:
- `jsdom` is a peer dep of `vitest` — install explicitly to lock the version.
- `npx playwright install chromium` installs only Chromium (sufficient for this app; Tangle targets Windows desktop, and Chrome/Edge share the same engine).
- `@types/node` and `xlsx` are already in `package.json`.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vitest 4.x | Jest 30 | Never for a Vite project. Jest requires a separate Babel/SWC transform chain to handle Vite's ESM + TypeScript + JSX. Results in double-transpilation, config complexity, and incompatibility with Vite plugins. SheetJS (xlsx) uses ESM which Jest's CJS transform struggles with. |
| Vitest 4.x | Bun test | Bun is not production-ready for Windows (Windows support incomplete as of Feb 2026). This is a Windows-primary app (Tauri .exe). |
| jsdom | happy-dom | If test suite becomes slow and no SheetJS/FileReader tests are needed. happy-dom is faster but lacks FileReader, Blob, and typed array APIs that SheetJS depends on. |
| @testing-library/user-event | fireEvent | Only for tests where realistic event propagation doesn't matter. `user-event` more accurately reflects how drag-and-drop upload works. |
| Playwright | Cypress | If the team strongly prefers Cypress DX. Cypress is easier to get started with for simple click-through flows. However: (1) Playwright has native TypeScript support without a plugin, (2) Playwright `webServer` integration with Vite is more reliable, (3) Playwright handles file uploads via `setInputFiles()` without workarounds, (4) Cypress runs inside the browser event loop which complicates testing file system events. |
| Playwright | WebdriverIO + Tauri WebDriver | Only if E2E tests must run against the native Tauri .exe (not the browser-based dev server). WebdriverIO is Tauri's officially recommended WebDriver tool. However: Tauri WebDriver requires a different build configuration, is Windows/Linux only (no macOS), and is significantly more complex. For this milestone, testing against `npm run dev` (the browser) is sufficient. |
| @vitest/coverage-v8 | @vitest/coverage-istanbul | Only if V8 coverage misreports branches in a specific complex conditional. Istanbul is more accurate for edge cases in complex boolean expressions but ~30% slower. V8 AST-remapping (introduced in Vitest 3.2.0) closes the accuracy gap for most real-world cases. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Jest | Requires CJS-to-ESM shims for SheetJS (`xlsx`) which uses ESM. Needs separate Babel/SWC transform chain that duplicates Vite's pipeline. `moduleNameMapper` and `transformIgnorePatterns` configs become complex and brittle. | Vitest |
| Cypress | Runs tests inside the browser event loop — cannot intercept native file system events or test real file uploads without workarounds. E2E test runs are slower (proxy-based architecture). TypeScript support requires plugin. Free plan limits parallelism. | Playwright |
| `@playwright/experimental-ct-react` | Component testing in Playwright is still experimental as of 1.58.x. Requires a separate Playwright-specific Vite config and `playwright/index.tsx` setup file. Adds complexity without clear benefit when Vitest already handles component tests better. | Vitest + @testing-library/react |
| Enzyme | Unmaintained for React 18+. No React 19 support. Tests implementation details (component internal state/methods) rather than behavior. | @testing-library/react |
| happy-dom (for this project) | Does not implement FileReader or Blob APIs. SheetJS uses both when parsing ArrayBuffer data. Tests involving `parseWorkbook()` will silently fail or throw with happy-dom. | jsdom |
| Visual regression testing (Percy, Chromatic, etc.) | Explicitly out of scope per `PROJECT.md`. Too brittle for v1. React Flow canvas is non-deterministic in layout — small graph changes cause false positives. | — |

---

## Stack Patterns by Variant

**For testing pure TypeScript functions (`parser.ts`, `graph.ts`):**
- Use Vitest with `environment: 'node'` (override per file via `@vitest-environment node` docblock)
- No jsdom needed — these are pure functions, no DOM
- Fastest execution path

**For testing React components (FilePanel, GraphView, DetailPanel):**
- Use Vitest with `environment: 'jsdom'` (project default)
- Use @testing-library/react + @testing-library/user-event
- Mock React Flow hooks (`useReactFlow`, `useNodes`, etc.) — they require a canvas context not available in jsdom

**For E2E upload-and-graph workflows:**
- Use Playwright with `webServer` pointing to `npm run dev` (port 5173)
- Use `page.setInputFiles()` for file uploads — no workarounds needed
- Use programmatically generated `.xlsx` fixtures (not binary blobs)

**For Tauri native .exe testing (out of scope for this milestone):**
- Use WebdriverIO + Tauri's WebDriver integration
- Requires separate `tauri.conf.json` configuration
- Windows-only (macOS not supported by Tauri WebDriver)
- Defer beyond this milestone

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| vitest@^4.0.18 | vite@^7.3.1 | Vitest 4.x requires Vite ^6 or ^7. Current project has Vite 7.3.1 — fully compatible. |
| vitest@^4.0.18 | node@>=20 | Vitest 4 requires Node 20+. Verify with `node --version`. |
| @testing-library/react@^16.3.2 | react@^19.2.0 | Peer dep allows `react ^18 \|\| ^19`. Fully compatible. |
| @testing-library/jest-dom@^6.9.1 | vitest@^4.0.18 | Use `import "@testing-library/jest-dom/vitest"` in setup file (not the default `@testing-library/jest-dom` import which targets Jest). |
| @playwright/test@^1.58.2 | node@>=18 | Playwright requires Node 18+. Compatible with current environment. |
| jsdom@^28.1.0 | vitest@^4.0.18 | Listed as a peer dep of vitest with `*` version range. jsdom 28.x is current and compatible. |
| @vitest/coverage-v8@^4.0.18 | vitest@^4.0.18 | Must match exact vitest major.minor.patch version. Install both at 4.0.18. |

---

## Key Configuration Snippets

### `vitest.config.ts`

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**/*.ts', 'src/components/**/*.tsx'],
      exclude: ['src/test/**', 'src/**/*.d.ts'],
    },
  },
})
```

Note: Use a **separate** `vitest.config.ts` rather than merging into `vite.config.ts`. This avoids the TypeScript triple-slash reference issue documented in the Vitest 4.x + Vite 7.1.x compatibility bug.

### `src/test/setup.ts`

```typescript
import '@testing-library/jest-dom/vitest'
```

### `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
```

---

## Sources

- npm registry (live query via `npm info`) — vitest@4.0.18, @playwright/test@1.58.2, @testing-library/react@16.3.2, @testing-library/user-event@14.6.1, @testing-library/jest-dom@6.9.1, jsdom@28.1.0, @vitest/coverage-v8@4.0.18 — **HIGH confidence** (live npm data)
- [Vitest 4.0 announcement](https://vitest.dev/blog/vitest-4) — breaking changes, browser mode stabilization, new matchers — **HIGH confidence** (official docs)
- [Vitest Getting Started](https://vitest.dev/guide/) — Node.js >=20 requirement, Vite >=6 requirement — **HIGH confidence** (official docs)
- [Playwright Getting Started](https://playwright.dev/docs/intro) — Node.js >=18, Windows 11 support confirmed, `webServer` config pattern — **HIGH confidence** (official docs)
- [Tauri v2 Testing docs](https://v2.tauri.app/develop/tests/) — WebDriver recommended for native E2E, Playwright not recommended for Tauri APIs — **HIGH confidence** (official docs)
- [@testing-library/jest-dom GitHub](https://github.com/testing-library/jest-dom) — Vitest import path `@testing-library/jest-dom/vitest` — **HIGH confidence** (official source)
- [Vitest V8 coverage AST-remapping discussion](https://github.com/vitest-dev/vitest/discussions/7587) — V8 now as accurate as Istanbul since v3.2.0 — **MEDIUM confidence** (GitHub discussion, corroborated by Vitest docs)
- [Cypress vs Playwright 2026 comparison](https://bugbug.io/blog/test-automation-tools/cypress-vs-playwright/) — download volume, architectural comparison — **MEDIUM confidence** (industry source, multiple sources agree)
- [jsdom vs happy-dom Vitest discussion](https://github.com/vitest-dev/vitest/discussions/1607) — API coverage differences — **MEDIUM confidence** (GitHub discussion)

---

*Stack research for: Tangle test suite (Vite 7 / React 19 / TypeScript 5.9)*
*Researched: 2026-02-27*
