# Phase 1: Infrastructure - Research

**Researched:** 2026-02-27
**Domain:** Vitest + Playwright + SheetJS fixture generator setup for a Vite 7 / React 19 / TypeScript 5.9 SPA
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Vitest installed and configured with jsdom environment and `test.server.deps.inline: ['xlsx']` | Stack section: vitest@4.x config pattern; Pitfall 2 (SheetJS ESM fix) |
| INFRA-02 | `vitest.config.ts` exists as a separate file from `vite.config.ts` (no TS context conflicts) | Architecture section: separate config pattern; Pitfall documented in STACK.md |
| INFRA-03 | Fixture generator script at `tests/fixtures/generate.ts` creates verified `.xlsx` files via SheetJS | Architecture section: Pattern 2 (programmatic fixture generation); Pitfall 12 (formula round-trip) |
| INFRA-04 | Fixture coverage: simple cross-sheet refs, external file refs, named ranges, empty workbook, malformed file, large workbook, circular refs | Architecture section: fixture catalog; Code Examples section |
| INFRA-05 | Coverage reporting via `@vitest/coverage-v8` with HTML output | Stack section: `@vitest/coverage-v8@4.x`; vitest.config.ts snippet |
| INFRA-06 | Playwright installed and configured for E2E against `http://localhost:5173` | Stack section: `@playwright/test@1.58.x`; playwright.config.ts snippet |
| INFRA-07 | `npm test`, `npm run test:e2e`, `npm run test:coverage` scripts registered and working | Architecture section: npm scripts pattern; package.json script shapes |
</phase_requirements>

---

## Summary

Phase 1 installs and configures three distinct infrastructure pieces: Vitest (unit test runner), Playwright (E2E runner), and the SheetJS fixture generator script. None of these exist in the project today — no test runner, no config files, no fixtures, no test directories, no test scripts in `package.json`. Everything must be created from scratch.

The project already has Vite 7.3.1 and Node 24.13.0, which are fully compatible with Vitest 4.x (requires Vite 6+ and Node 20+). SheetJS is already in `dependencies` at version 0.18.5. TypeScript is 5.9.3 with `erasableSyntaxOnly: true`, which means the project's TypeScript is deliberately constrained to be compatible with Node's native type-stripping — the fixture generator can run via `node tests/fixtures/generate.ts` without requiring `tsx` to be installed. The existing tsconfig uses project references (`tsconfig.app.json` + `tsconfig.node.json`), which means `vitest.config.ts` must NOT be merged into `vite.config.ts` or TypeScript will complain about mixed context types.

There are five critical pitfalls that can produce silently-passing tests — tests that return green but cover nothing. All five must be resolved in this phase before any test is written. The most dangerous is the SheetJS ESM/CJS import issue: `xlsx@0.18.5` is CJS, Vitest resolves modules differently from Vite's pre-bundler, and the fix is one line in vitest.config.ts (`test.server.deps.inline: ['xlsx']`). A second dangerous pitfall is SheetJS fixture formulas: `aoa_to_sheet(['=Sheet2!A1'])` may not preserve the formula string in the `cell.f` property; cells must be constructed explicitly with `{ t: 'n', v: 0, f: 'Sheet2!A1' }`, and the generator must verify formula count on read-back before saving.

**Primary recommendation:** Install Vitest 4.x, @vitest/coverage-v8 4.x, @playwright/test, and tsx (or rely on Node 24 native TS stripping). Write vitest.config.ts and playwright.config.ts as separate files. Build the fixture generator with explicit formula cells and a read-back verification step. Register all npm scripts. Confirm SheetJS imports correctly in a smoke test.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 | Unit test runner | Same Vite 7 transform pipeline — zero config for ESM/TypeScript/JSX; zero Babel complexity; fastest option for Vite projects |
| @vitest/coverage-v8 | ^4.0.18 | Code coverage with HTML output | V8 provider is the Vitest default; AST-remapped since Vitest 3.2.0 for Istanbul-equivalent accuracy; must match vitest version exactly |
| @playwright/test | ^1.58.2 | E2E browser automation | TypeScript-native; `webServer` config auto-starts Vite dev server; `setInputFiles()` handles file upload cleanly; Chromium-only install is sufficient for Tauri/Windows target |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsdom | ^28.1.0 | DOM environment for Vitest | Needed when any test exercises `FileReader`, `ArrayBuffer`, or `Blob` APIs (i.e., `parseWorkbook()` path). Not needed for pure `extractReferences()` or `buildGraph()` tests. |
| tsx | ^4.x (optional) | TypeScript script runner for fixture generator | Only needed if running `generate.ts` on Node < 22.6 or if the script uses TypeScript features beyond type-stripping (enums, decorators). Node 24.13.0 supports native TS stripping natively — `node generate.ts` works without tsx. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest | Jest | Jest requires separate Babel/SWC chain to handle `xlsx` (CJS in ESM project). `moduleNameMapper` + `transformIgnorePatterns` becomes brittle. Never correct for a Vite project. |
| @vitest/coverage-v8 | @vitest/coverage-istanbul | Istanbul is ~30% slower. V8 is sufficient since Vitest 3.2.0 AST-remapping. Use Istanbul only if V8 misreports a specific complex branch. |
| @playwright/test | Cypress | Cypress runs inside the browser event loop (cannot simulate OS file drops cleanly). No native TypeScript support without a plugin. File upload requires workarounds. |
| node (native TS) for fixtures | tsx | tsx is safer for complex TypeScript (enums, path aliases). Node 24 native stripping only handles erasable syntax. This project uses `erasableSyntaxOnly: true`, so `node` works. |

**Installation:**
```bash
# Unit test stack
npm install -D vitest @vitest/coverage-v8 jsdom

# E2E stack
npm install -D @playwright/test
npx playwright install chromium

# Fixture runner (optional — Node 24 may not need it)
# npm install -D tsx
```

---

## Architecture Patterns

### Recommended Project Structure

```
tests/
├── unit/
│   └── parser.smoke.test.ts     # Phase 1: smoke test — imports XLSX, runs one assertion
├── e2e/
│   └── smoke.spec.ts            # Phase 1: smoke test — app loads at localhost:5173
├── fixtures/
│   ├── generate.ts              # Node script: writes verified .xlsx files via SheetJS
│   ├── index.ts                 # Exports fixture paths as typed constants
│   ├── cross-sheet.xlsx         # (generated) Sheet1 references Sheet2
│   ├── external-ref.xlsx        # (generated) References an external workbook via [1] index
│   ├── named-ranges.xlsx        # (generated) Defines and uses named ranges
│   ├── empty.xlsx               # (generated) No formulas, no sheets with data
│   ├── large.xlsx               # (generated) 100+ sheets
│   └── circular.xlsx            # (generated) Sheet1 -> Sheet2 -> Sheet1
└── helpers/
    └── upload.ts                # (stub) uploadFile() helper for E2E — Phase 4
vitest.config.ts                 # Separate from vite.config.ts
playwright.config.ts             # Separate from vitest.config.ts
```

### Pattern 1: Separate vitest.config.ts (INFRA-02 critical)

**What:** `vitest.config.ts` must be its own file, not merged into `vite.config.ts`. The existing `tsconfig.node.json` only includes `vite.config.ts`; if `vitest.config.ts` is a separate file, it needs to be included in `tsconfig.node.json`.

**Why separate:** The project uses `/// <reference types="vitest/config" />` in `vitest.config.ts` to get Vitest types. If this is merged into `vite.config.ts`, which is under `tsconfig.node.json` that includes `vite/client` types, TypeScript reports conflicting type contexts. The Vitest docs and the existing research both confirm this is a real issue in Vitest 4.x + Vite 7.x.

**Example:**
```typescript
// vitest.config.ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',           // parser.ts and graph.ts need no DOM for unit tests
    globals: true,                 // enables describe/it/expect without explicit import
    include: ['tests/unit/**/*.test.ts'],
    server: {
      deps: {
        inline: ['xlsx'],          // CRITICAL: forces SheetJS through Vite bundler (INFRA-01)
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/lib/**/*.ts'],
    },
  },
})
```

```jsonc
// tsconfig.node.json — add vitest.config.ts to include
{
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

### Pattern 2: Playwright Config with url (INFRA-06)

**What:** `playwright.config.ts` with `webServer.url` (not `webServer.port` — port is deprecated as of Playwright 1.57+).

**Example:**
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,            // single test file in Phase 1
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
    url: 'http://localhost:5173',  // url, not port (port is deprecated)
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
```

### Pattern 3: SheetJS Fixture Generator with Formula Read-Back Verification (INFRA-03, INFRA-04)

**What:** A Node script that creates `.xlsx` files with explicit formula cells and verifies formula strings are readable after the write-read round-trip.

**Critical detail:** `XLSX.utils.aoa_to_sheet([['=Sheet2!A1']])` does NOT reliably set `cell.f`. The formula is stored as a string value, not a formula property. You MUST set `ws['A1'] = { t: 'n', v: 0, f: 'Sheet2!A1' }` explicitly, or `extractReferences()` will see no formulas.

**Example:**
```typescript
// tests/fixtures/generate.ts
import * as XLSX from 'xlsx'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT_DIR = 'tests/fixtures'

function verify(buf: Buffer, expectedMinFormulas: number, label: string): void {
  const wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  let count = 0
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name]
    for (const key of Object.keys(sheet)) {
      if (!key.startsWith('!') && sheet[key]?.f) count++
    }
  }
  if (count < expectedMinFormulas) {
    throw new Error(`[${label}] Expected >= ${expectedMinFormulas} formula cells, found ${count}`)
  }
  console.log(`[${label}] OK — ${count} formula cells`)
}

function makeCrossSheetFixture(): void {
  const wb = XLSX.utils.book_new()
  const sheet1 = XLSX.utils.aoa_to_sheet([['placeholder']])
  // Explicit formula cell — do NOT use aoa_to_sheet for formula rows
  sheet1['A1'] = { t: 'n', v: 0, f: 'Sheet2!A1' }
  const sheet2 = XLSX.utils.aoa_to_sheet([['source value']])
  XLSX.utils.book_append_sheet(wb, sheet1, 'Sheet1')
  XLSX.utils.book_append_sheet(wb, sheet2, 'Sheet2')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 1, 'cross-sheet')
  writeFileSync(join(OUT_DIR, 'cross-sheet.xlsx'), buf)
}

function makeExternalRefFixture(): void {
  const wb = XLSX.utils.book_new()
  const sheet1 = XLSX.utils.aoa_to_sheet([['placeholder']])
  // External ref with bracketed filename — numeric index resolution is an xlsx zip concern
  sheet1['A1'] = { t: 'n', v: 0, f: '[External.xlsx]Prices!C3' }
  XLSX.utils.book_append_sheet(wb, sheet1, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 1, 'external-ref')
  writeFileSync(join(OUT_DIR, 'external-ref.xlsx'), buf)
}

function makeEmptyFixture(): void {
  const wb = XLSX.utils.book_new()
  const sheet1 = XLSX.utils.aoa_to_sheet([['value', 'value2']])
  // No formula cells
  XLSX.utils.book_append_sheet(wb, sheet1, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  // Empty fixture: verify 0 formulas (we just confirm it writes cleanly)
  console.log('[empty] OK — 0 formula cells')
  writeFileSync(join(OUT_DIR, 'empty.xlsx'), buf)
}

function makeNamedRangeFixture(): void {
  const wb = XLSX.utils.book_new()
  const sheet1 = XLSX.utils.aoa_to_sheet([['placeholder']])
  sheet1['A1'] = { t: 'n', v: 0, f: 'Sheet2!A1' }
  const sheet2 = XLSX.utils.aoa_to_sheet([['source']])
  XLSX.utils.book_append_sheet(wb, sheet1, 'Sheet1')
  XLSX.utils.book_append_sheet(wb, sheet2, 'Sheet2')
  // Add named range via workbook Names table
  if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
  wb.Workbook.Names = [{ Name: 'MyRange', Ref: 'Sheet2!A1:A10', Sheet: undefined }]
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 1, 'named-ranges')
  writeFileSync(join(OUT_DIR, 'named-ranges.xlsx'), buf)
}

function makeLargeFixture(): void {
  const wb = XLSX.utils.book_new()
  for (let i = 1; i <= 100; i++) {
    const sheet = XLSX.utils.aoa_to_sheet([['placeholder']])
    if (i > 1) {
      sheet['A1'] = { t: 'n', v: 0, f: `Sheet${i - 1}!A1` }
    }
    XLSX.utils.book_append_sheet(wb, sheet, `Sheet${i}`)
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 99, 'large')
  writeFileSync(join(OUT_DIR, 'large.xlsx'), buf)
}

function makeCircularFixture(): void {
  // Circular: Sheet1 -> Sheet2 -> Sheet1
  // Note: SheetJS does not evaluate formulas, just stores strings
  // Parser must not infinite-loop reading these formula strings
  const wb = XLSX.utils.book_new()
  const sheet1 = XLSX.utils.aoa_to_sheet([['placeholder']])
  sheet1['A1'] = { t: 'n', v: 0, f: 'Sheet2!A1' }
  const sheet2 = XLSX.utils.aoa_to_sheet([['placeholder']])
  sheet2['A1'] = { t: 'n', v: 0, f: 'Sheet1!A1' }
  XLSX.utils.book_append_sheet(wb, sheet1, 'Sheet1')
  XLSX.utils.book_append_sheet(wb, sheet2, 'Sheet2')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 2, 'circular')
  writeFileSync(join(OUT_DIR, 'circular.xlsx'), buf)
}

// INFRA-04 requires: malformed/corrupt file
// Cannot generate a corrupt file via SheetJS — write a known-bad buffer manually
function makeMalformedFixture(): void {
  // A file that looks like xlsx but has corrupt content — just write garbage bytes
  const garbage = Buffer.from('PK\x03\x04this is not a valid xlsx file')
  writeFileSync(join(OUT_DIR, 'malformed.xlsx'), garbage)
  console.log('[malformed] OK — corrupt bytes written')
}

// Run all generators
makeCrossSheetFixture()
makeExternalRefFixture()
makeEmptyFixture()
makeNamedRangeFixture()
makeLargeFixture()
makeCircularFixture()
makeMalformedFixture()
console.log('All fixtures generated successfully.')
```

### Pattern 4: npm Script Registration (INFRA-07)

**What:** Add test scripts to `package.json`. These scripts are the success criteria for Phase 1.

**Example:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest",
    "fixtures:generate": "node tests/fixtures/generate.ts"
  }
}
```

**Note on `fixtures:generate`:** Node 24.13.0 supports running `.ts` files natively via type-stripping (no `--experimental-strip-types` flag needed; it is enabled by default from Node 22+ onward, and the `ExperimentalWarning` was removed in v24.11.0). The project's `erasableSyntaxOnly: true` tsconfig setting means the TypeScript used in the generator is already constrained to be compatible with this approach. If `enum` types or decorators are needed in the future, add `tsx` as a devDependency and change the script to `tsx tests/fixtures/generate.ts`.

### Pattern 5: Vitest Smoke Test (validates INFRA-01, INFRA-02, INFRA-05)

**What:** A minimal test that verifies SheetJS imports correctly through Vitest's module resolution.

**Example:**
```typescript
// tests/unit/parser.smoke.test.ts
import * as XLSX from 'xlsx'
import { describe, it, expect } from 'vitest'

describe('SheetJS import smoke test', () => {
  it('xlsx module resolves correctly via Vitest', () => {
    const wb = XLSX.utils.book_new()
    expect(wb.SheetNames).toEqual([])
  })

  it('can read a buffer without throwing', () => {
    // Minimal xlsx: just the header bytes — enough to test module resolution
    // A real fixture test belongs in Phase 2
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['test']]), 'Sheet1')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const wb2 = XLSX.read(buf, { type: 'buffer', cellFormula: true })
    expect(wb2.SheetNames).toHaveLength(1)
  })
})
```

### Anti-Patterns to Avoid

- **Merging vitest.config.ts into vite.config.ts:** TypeScript will complain about `/// <reference types="vitest/config" />` conflicting with `vite/client` types from `tsconfig.app.json`. Keep them separate.
- **Using `aoa_to_sheet` with formula strings:** `aoa_to_sheet([['=Sheet2!A1']])` may not set `cell.f`. Always construct formula cells explicitly with `{ t: 'n', v: 0, f: 'Sheet2!A1' }`.
- **Using `webServer.port` in playwright.config.ts:** `port` is deprecated as of Playwright 1.57+. Use `webServer.url` instead.
- **Using `environment: 'jsdom'` for all tests:** jsdom adds startup overhead. Parser and graph unit tests need no DOM. Use `environment: 'node'` as the default; reserve jsdom for the future if component tests are added.
- **Using `happy-dom` instead of `jsdom`:** If jsdom is later needed for component tests, use jsdom — not happy-dom. happy-dom lacks `FileReader`, `Blob`, and typed array APIs that SheetJS requires.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel file generation for tests | Custom binary writer | `XLSX.utils.book_new()` + `XLSX.write()` | SheetJS handles zip structure, XML escaping, and all xlsx format subtleties |
| TypeScript execution for Node scripts | Babel/esbuild wrapper | `node` (native TS stripping in Node 24) or `tsx` | Node 24 natively strips types; tsx provides esbuild transform for edge cases |
| Test running | Custom mocha/tap harness | vitest | Vitest handles TypeScript, ESM, coverage, mocking, and watch mode out of the box |
| Browser automation | puppeteer + custom wait helpers | Playwright `expect(locator).toBeVisible()` | Playwright's auto-retry assertions eliminate manual sleep/poll loops |
| Corrupt fixture generation | SheetJS write with bad options | `Buffer.from('garbage bytes')` | SheetJS always writes valid files — the only way to get a corrupt file is to write bad bytes directly |

**Key insight:** The entire Phase 1 stack is well-covered by existing tools. The only custom code is the fixture generator script itself, and even that uses SheetJS's public API — there is no need to write binary xlsx format code.

---

## Common Pitfalls

### Pitfall 1: SheetJS ESM/CJS Import Fails in Vitest (INFRA-01 critical)

**What goes wrong:** `import * as XLSX from 'xlsx'` in a Vitest test file throws `Cannot find module 'xlsx'` or `ERR_REQUIRE_ESM`. `npm run dev` works fine — only Vitest breaks.

**Why it happens:** `xlsx@0.18.5` ships as CommonJS. Vite pre-bundles it during dev/build. Vitest resolves modules through Node module resolution, not Vite's pre-bundler, so it cannot handle the package's missing `exports` field correctly.

**How to avoid:** Add `xlsx` to `test.server.deps.inline` in `vitest.config.ts`:
```typescript
test: {
  server: {
    deps: {
      inline: ['xlsx']
    }
  }
}
```

**Warning signs:** Tests fail with module errors but `npm run dev` works. The fix is one line.

---

### Pitfall 2: Fixture Formula Cells Have No `f` Property After Write-Read

**What goes wrong:** `extractReferences()` returns empty results on a "formula" fixture because the cells have no `f` property. Tests pass vacuously.

**Why it happens:** `XLSX.utils.aoa_to_sheet([['=Sheet2!A1']])` creates a cell with `t: 's'` (string) containing `'=Sheet2!A1'` as a value — it does not set `cell.f`. The only reliable way to create a formula cell is to set `ws['A1'] = { t: 'n', v: 0, f: 'Sheet2!A1' }` explicitly.

**How to avoid:** Use explicit cell construction. Add a read-back `verify()` call in the generator that counts cells where `cell.f` is set and throws if the count is below the expected minimum.

**Warning signs:** Generator script completes without error but `verify()` logs `0 formula cells`. Parser tests pass instantly with zero assertions failing.

---

### Pitfall 3: `vitest.config.ts` Not Included in `tsconfig.node.json`

**What goes wrong:** TypeScript reports errors in `vitest.config.ts` when running `tsc -b` (the build step), even though tests pass. The `build` script fails after adding the test config.

**Why it happens:** `tsconfig.node.json` explicitly includes only `vite.config.ts`. A new `vitest.config.ts` file is outside its scope.

**How to avoid:** Add `"vitest.config.ts"` to the `include` array in `tsconfig.node.json`. Also add `"playwright.config.ts"` and `"tests/**/*.ts"` to ensure the test files are type-checked.

**Warning signs:** `npm run build` fails with `error TS6196: File 'vitest.config.ts' is not under 'rootDir'`. All tests pass but the build is broken.

---

### Pitfall 4: Playwright `webServer.url` vs `webServer.port`

**What goes wrong:** Older documentation (including PITFALLS.md in this project's research) says to use `webServer.port` instead of `webServer.url` to avoid timeouts. **This advice is now incorrect.** `port` is deprecated as of Playwright 1.57 and official docs now recommend `url`.

**Why it matters:** Playwright's `url` approach waits for the server to return a 2xx/3xx response (more reliable). `port` only checks if the port is open. Using the deprecated `port` may trigger deprecation warnings in future Playwright versions.

**How to avoid:** Use `webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI }`. Always pair with `use: { baseURL: 'http://localhost:5173' }`.

**Warning signs:** Playwright config works but emits deprecation warnings in test output.

---

### Pitfall 5: `typescript-eslint` Rejects `vitest.config.ts` Include Pattern

**What goes wrong:** After adding `tests/**/*.ts` to `tsconfig.node.json`, ESLint's TypeScript parser may start linting test files with the wrong tsconfig (the node config instead of the app config), causing false type errors in test files that import from `src/`.

**Why it happens:** `eslint.config.js` may reference a tsconfig that doesn't include the test directory. Alternatively, adding `tests/` to `tsconfig.node.json` is wrong — a dedicated `tsconfig.test.json` is cleaner.

**How to avoid:** Create a `tsconfig.test.json` (extends `tsconfig.node.json`, includes `tests/**/*.ts` and `vitest.config.ts`) and reference it from `eslint.config.js` for the test file glob pattern. This keeps separation clean.

**Warning signs:** ESLint reports type errors in test files about imports from `src/` not being found. `npm run lint` fails after adding test files.

---

### Pitfall 6: `globals: true` Missing — `describe`/`it`/`expect` Undefined

**What goes wrong:** First test file throws `ReferenceError: describe is not defined`.

**Why it happens:** Without `globals: true` in `vitest.config.ts`, Vitest requires explicit `import { describe, it, expect } from 'vitest'` in every test file.

**How to avoid:** Set `globals: true` in the `test` block. Add `"types": ["vitest/globals"]` to `tsconfig.node.json` (or the test tsconfig) so TypeScript recognizes the globals.

**Warning signs:** Every test file fails immediately. Adding the import fixes it, but the global config is the correct long-term fix.

---

## Code Examples

Verified patterns from official sources:

### vitest.config.ts (complete)
```typescript
// Source: vitest.dev/guide/ (official docs) + vitest.dev/config/server (server.deps.inline)
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    server: {
      deps: {
        inline: ['xlsx'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
  },
})
```

### playwright.config.ts (complete)
```typescript
// Source: playwright.dev/docs/test-webserver (official docs)
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
    url: 'http://localhost:5173',          // url, not port (port is deprecated)
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
```

### Explicit formula cell construction (SheetJS)
```typescript
// Source: docs.sheetjs.com/docs/getting-started/examples/export/
// Critical: do NOT use aoa_to_sheet for formula cells
const ws: XLSX.WorkSheet = {}
ws['A1'] = { t: 'n', v: 0, f: 'Sheet2!B5' }      // formula cell
ws['A2'] = { t: 's', v: 'plain string value' }    // non-formula cell
ws['!ref'] = 'A1:A2'
```

### tests/fixtures/index.ts
```typescript
// Source: local convention; typed for IDE completion
import { resolve } from 'node:path'

const FIXTURE_DIR = resolve(__dirname)

export const FIXTURES = {
  crossSheet: resolve(FIXTURE_DIR, 'cross-sheet.xlsx'),
  externalRef: resolve(FIXTURE_DIR, 'external-ref.xlsx'),
  namedRanges: resolve(FIXTURE_DIR, 'named-ranges.xlsx'),
  empty: resolve(FIXTURE_DIR, 'empty.xlsx'),
  large: resolve(FIXTURE_DIR, 'large.xlsx'),
  circular: resolve(FIXTURE_DIR, 'circular.xlsx'),
  malformed: resolve(FIXTURE_DIR, 'malformed.xlsx'),
} as const

export type FixtureName = keyof typeof FIXTURES
```

### Playwright E2E smoke test
```typescript
// Source: playwright.dev/docs/writing-tests (official docs)
// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test'

test('app loads at localhost:5173', async ({ page }) => {
  await page.goto('/')
  // Verify the page loads — check for a recognizable element
  await expect(page.locator('body')).toBeVisible()
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest for Vite/TypeScript projects | Vitest (same pipeline) | 2022 (Vitest 0.x), matured 2024 | Eliminates Babel/SWC double-transpile; SheetJS ESM works |
| Cypress for React E2E | Playwright | 2023-2024 (Playwright overtook Cypress by download volume) | Native TypeScript, `setInputFiles()`, no proxy architecture |
| `webServer.port` in Playwright | `webServer.url` | Playwright 1.57 (port deprecated) | `url` verifies server responds; `port` only checks socket |
| tsx for running `.ts` scripts | `node` (native TS stripping) | Node 22.6.0 (experimental), Node 24+ (stable) | No extra dependency for simple scripts with erasable syntax |
| V8 coverage inaccurate for branches | V8 with AST-remapping | Vitest 3.2.0 | V8 now Istanbul-equivalent; no need for Istanbul provider |

**Deprecated/outdated:**
- `webServer.port` in Playwright: deprecated in 1.57, will be removed in a future version. Use `webServer.url`.
- `import '@testing-library/jest-dom/extend-expect'`: removed in `@testing-library/jest-dom` v6. Use `import '@testing-library/jest-dom/vitest'`.
- Vitest `test.deps.inline` (v1 syntax): replaced by `test.server.deps.inline` in Vitest 2+. The v1 path still works but the canonical path is the nested form.

---

## Open Questions

1. **`tsconfig.test.json` scope**
   - What we know: `tsconfig.node.json` includes only `vite.config.ts`. Test files need a TypeScript context.
   - What's unclear: Whether to add tests to `tsconfig.node.json`, create `tsconfig.test.json`, or use `tsconfig.app.json` (which includes `src/` but not `tests/`).
   - Recommendation: Create `tsconfig.test.json` that extends `tsconfig.node.json` and includes `["tests/**/*.ts", "vitest.config.ts", "playwright.config.ts"]`. Reference it in the ESLint config for test file patterns. This keeps the existing configs clean.

2. **Malformed fixture generation**
   - What we know: SheetJS always writes valid files; a malformed file must be created by writing garbage bytes directly. The `parseWorkbook()` function wraps everything in `try/catch` and rejects, so the test scenario is "parser rejects with an error".
   - What's unclear: Whether Phase 2 tests will need to call `parseWorkbook()` directly (which requires `FileReader`) or can test the rejection path differently.
   - Recommendation: For Phase 1, just write the corrupt bytes file. The Phase 2 plan will decide the testing approach. Document the file's purpose in `tests/fixtures/index.ts`.

3. **Fixture files in git**
   - What we know: The ARCHITECTURE.md research recommends committing generated `.xlsx` files OR gitignoring them and running `fixtures:generate` in CI.
   - What's unclear: The project preference. Gitignoring keeps history clean; committing avoids a CI pre-step.
   - Recommendation: Commit the generated `.xlsx` files. They are small (< 50KB each), reproducible from the script, and committing them means `npm test` works without a pre-step. Add them to `.gitattributes` as binary files. Document that `npm run fixtures:generate` re-creates them if needed.

---

## Sources

### Primary (HIGH confidence)
- `vitest.dev/config/server` — `test.server.deps.inline` API shape for Vitest 4.x
- `vitest.dev/guide/` — Node 20+ requirement, Vite 6+ compatibility, globals config, environment config
- `vitest.dev/guide/coverage.html` — V8 provider config, `reportsDirectory`, reporter options
- `playwright.dev/docs/test-webserver` — `webServer.url` (not port), `reuseExistingServer`, timeout; confirms `port` is deprecated
- `docs.sheetjs.com/docs/getting-started/examples/export/` — `XLSX.write()`, `XLSX.utils.book_new()`, explicit formula cell construction
- `docs.sheetjs.com/docs/demos/static/vitejs/` — SheetJS Vite integration pattern
- `nodejs.org/en/learn/typescript/run-natively` — Node 24+ native TS stripping, `erasableSyntaxOnly` compatibility
- `.planning/research/STACK.md` — version compatibility matrix (all versions npm-verified on 2026-02-27)
- `.planning/research/PITFALLS.md` — 12 documented pitfalls with sources (official docs + GitHub issues)
- `.planning/research/ARCHITECTURE.md` — directory structure, data flow, build order patterns

### Secondary (MEDIUM confidence)
- `github.com/vitest-dev/vitest/issues/5200` — `server.deps.inline` behavior; confirmed it forces Vite transform pipeline
- `github.com/microsoft/playwright/issues/18467` — `webServer.url` timeout behavior (historical; current docs confirm `url` is correct)
- `.planning/research/SUMMARY.md` — executive summary and phase rationale (compiled from primary sources)

### Tertiary (LOW confidence — note disagreement with primary)
- `.planning/research/PITFALLS.md` (Pitfall 10) says "use `port` not `url`" — this is now incorrect per official Playwright docs. The `port` option is deprecated. Use `url`.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions live-verified via npm registry on 2026-02-27; official docs consulted for each package
- Architecture: HIGH — patterns are directly from official Vitest, Playwright, and SheetJS documentation; directory structure is prescribed by the pre-phase research
- Pitfalls: HIGH — sourced from official docs, GitHub issue trackers with confirmed reproduction steps; one correction made (Playwright port vs url)
- Fixture generator: HIGH — based on SheetJS official API docs; formula cell pitfall is well-documented

**One correction from prior research:**
The SUMMARY.md and PITFALLS.md both state "use `webServer.port` not `webServer.url`" to avoid Playwright timeouts. This is outdated. Current official Playwright docs (as of 1.57+) deprecate `port` and recommend `url`. The `url` approach is more reliable because it verifies the server responds, not just that the port is open.

**Research date:** 2026-02-27
**Valid until:** 2026-03-29 (stable ecosystem; Vitest and Playwright release roughly monthly)
