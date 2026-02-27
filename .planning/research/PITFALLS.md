# Pitfalls Research

**Domain:** Adding Vitest + Playwright test suite to a React/Vite/TypeScript app (SheetJS parsing, React Flow visualization, file upload via FileReader)
**Researched:** 2026-02-27
**Confidence:** HIGH (React Flow official docs, Vitest official docs, Playwright official docs, SheetJS official docs, GitHub issue tracker verification)

---

## Critical Pitfalls

### Pitfall 1: Vitest Environment Mismatch — `parser.ts` Silently Tests Nothing

**What goes wrong:**
`parser.ts` calls `FileReader`, `ArrayBuffer`, `TextDecoder`, and `Uint8Array` — all browser APIs. If Vitest is configured with `environment: 'node'` (the default), these globals are absent or incomplete. Tests appear to pass because SheetJS falls back or the fixture never reaches the parsing path, but the actual `parseWorkbook()` function is never exercised. You end up with 100% pass rate and 0% real coverage.

**Why it happens:**
Vitest defaults to the `node` environment. New projects often copy a minimal `vitest.config.ts` without considering that parsing code depends on browser globals. The error is silent — `FileReader` is `undefined` and the promise rejects silently rather than throwing visibly.

**How to avoid:**
Set `environment: 'jsdom'` (not `happy-dom`) in `vitest.config.ts` for all tests that exercise `parser.ts`. `jsdom` provides `FileReader`, `TextDecoder`, `ArrayBuffer`, and `Uint8Array`. `happy-dom` is faster but incomplete — it is missing APIs that SheetJS relies on. Alternatively, bypass `FileReader` entirely in unit tests: call `XLSX.read(buffer, { type: 'array' })` directly in tests, passing a Node `Buffer` or `Uint8Array` built from `fs.readFileSync`, which avoids `FileReader` altogether and lets tests run without a DOM environment.

**Warning signs:**
- Tests pass instantly (< 1ms) when they should parse a real file
- No `FileReader is not defined` error — check that the test actually reaches the SheetJS call
- Code coverage shows `parser.ts` lines never hit despite passing tests

**Phase to address:** Phase 1 — Vitest setup and unit tests for `parser.ts`

---

### Pitfall 2: SheetJS ESM/CJS Import Fails Under Vitest

**What goes wrong:**
SheetJS (`xlsx@0.18.5`) ships as CommonJS. Vite resolves it fine in dev/build mode because Vite pre-bundles CJS deps. Vitest resolves modules differently (it follows Node module resolution, not Vite's resolution), so `import * as XLSX from 'xlsx'` can fail with `ERR_REQUIRE_ESM` or `Cannot find module 'xlsx'` depending on Node version and Vitest version.

**Why it happens:**
Vitest does not run through Vite's pre-bundler for test files by default. The `xlsx` package lacks proper `exports` field declaration in older versions and relies on Vite's special CJS handling. Vitest's Node-based resolution doesn't get the same treatment.

**How to avoid:**
Add `xlsx` to `test.server.deps.inline` (Vitest v2+) or `test.deps.inline` (Vitest v1) in `vitest.config.ts`. This forces Vitest to bundle `xlsx` through Vite's transform pipeline, matching how it works in the browser:

```typescript
// vitest.config.ts
test: {
  server: {
    deps: {
      inline: ['xlsx']
    }
  }
}
```

Verify the fix by running a single import-only test that just calls `XLSX.read(new Uint8Array(0), { type: 'array' })` and confirms it doesn't throw a module error.

**Warning signs:**
- `Cannot find module 'xlsx'` in test output but `npm run dev` works fine
- `require() of ES Module` error in test but not in build
- SheetJS import works in isolation but fails inside a larger test file

**Phase to address:** Phase 1 — Vitest setup (must resolve before any parser tests)

---

### Pitfall 3: React Flow Requires Four DOM Mocks in Vitest — Missing Any Causes Silent Edge Failures

**What goes wrong:**
React Flow v12 (`@xyflow/react`) depends on `ResizeObserver`, `DOMMatrixReadOnly`, `HTMLElement.offsetHeight/offsetWidth`, and `SVGElement.getBBox()` to measure nodes and render edges. `jsdom` does not implement any of these. Without mocks, edges do not render in unit tests — but the test does not throw, so tests appear to pass while asserting on an empty or incorrectly structured graph.

The specific mocks required (from official React Flow testing documentation):
- `ResizeObserver` — must be shimmed in `setupFiles` with a no-op that immediately calls the callback
- `DOMMatrixReadOnly` — must parse `scale(...)` CSS transforms and return an `m22` property
- `HTMLElement.offsetHeight` / `offsetWidth` — must return a non-zero value (parsing from inline style, or returning a constant like `200`)
- `SVGElement.getBBox()` — must return `{ x: 0, y: 0, width: 0, height: 0 }`

**Why it happens:**
`jsdom` intentionally omits layout-dependent APIs because layout requires a real rendering engine. React Flow's internal node measurement and edge routing depends on these at runtime. Teams assume the graph renders as expected in unit tests; it does not without the mocks.

**How to avoid:**
Copy the exact mock setup from the official React Flow testing guide into a `vitest.setup.ts` file referenced by `setupFiles`. Do not try to test edge rendering in unit tests at all — treat `buildGraph()` (a pure TS function) as the unit, and test its output data structure, not its visual rendering. Reserve visual/DOM testing for Playwright E2E.

**Warning signs:**
- `ResizeObserver is not defined` error in test output
- Tests involving `<ReactFlow>` render without errors but `edges` array is empty when it should not be
- `getBBox is not a function` in stack traces

**Phase to address:** Phase 1 — Vitest setup (configure `setupFiles` before any component tests)

---

### Pitfall 4: Duplicate React Version Breaks React Flow in Vitest — Hard to Diagnose

**What goes wrong:**
When `@xyflow/react` is tested in Vitest with `jsdom`, an `Invalid hook call. Hooks can only be called inside of the body of a function component` error appears, originating from inside React Flow's own `useColorModeClass` hook. This is not a hook-usage mistake in test code — it is a symptom of duplicate React instances in the module graph.

**Why it happens:**
Vitest's module resolution can result in `react` being loaded twice: once from the project's `node_modules/react` and once from `node_modules/@xyflow/react/node_modules/react` if the versions don't deduplicate correctly. React checks that hooks are called from the same React instance; two instances = always fails this check.

**How to avoid:**
Before writing any React component tests, verify deduplication: run `npm ls react` and confirm only one version appears (no nested copy under `@xyflow/react`). Add `resolve.dedupe: ['react', 'react-dom']` to `vite.config.ts` (this is shared by Vitest since Vitest extends the Vite config). If a duplicate appears, add a `resolutions` field to `package.json` (if using a compatible package manager) or use `npm dedupe`.

**Warning signs:**
- `Invalid hook call` errors that appear only in Vitest, not in `npm run dev`
- Errors originate inside library code, not your own hooks
- `npm ls react` shows multiple installed versions

**Phase to address:** Phase 1 — dependency audit before writing any component tests

---

### Pitfall 5: Drag-and-Drop File Upload Cannot Be Tested with `locator.dragTo()` — Requires dataTransfer Workaround

**What goes wrong:**
Tangle's file upload uses a drag-and-drop zone (not a visible `<input type="file">`). Playwright's `locator.dragTo()` performs element-to-element drags but does not simulate OS-level file drops. The `dragover`/`drop` events dispatched by `dragTo()` do not carry a `dataTransfer.files` payload, so the app's `onDrop` handler receives an empty file list and the test passes (no error) but no file is parsed.

**Why it happens:**
Browser security prevents JavaScript from constructing a `DataTransfer` with real `File` objects that came from the "filesystem" during a drag, except via the native OS drag flow. Playwright must inject files by constructing a `DataTransfer` via `page.evaluateHandle`, populating it via `setInputFiles` on a hidden input, then dispatching a synthetic `drop` event. This is non-obvious and not the documented `dragTo()` path.

**How to avoid:**
Use the following E2E pattern for drag-drop upload:
1. Listen for `page.on('filechooser')` if the app falls back to a file chooser, OR
2. Use `page.setInputFiles(hiddenInputSelector, filePath)` if a hidden `<input type="file">` exists in the DOM (inspect — React's file upload components typically render one)
3. For pure drag-drop without any input: dispatch a synthetic drop event with a `DataTransfer` populated from a buffer using `page.evaluateHandle(() => new DataTransfer())` combined with a file payload

For binary `.xlsx` fixtures: use `fileChooser.setFiles({ name: 'test.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fs.readFileSync(fixturePath) })`.

**Warning signs:**
- E2E test clicks upload zone but the graph never renders
- `page.waitForSelector('[data-testid="graph-node"]')` times out after drop
- No network requests or console errors — the file drop event fired but with empty `files`

**Phase to address:** Phase 2 — E2E test setup (before writing any upload tests)

---

## Moderate Pitfalls

### Pitfall 6: Vitest `globals: true` Not Enabled — `describe`/`it`/`expect` Undefined

**What goes wrong:**
Without `globals: true` in `vitest.config.ts`, test files must explicitly `import { describe, it, expect } from 'vitest'`. Projects that skip this config spend time debugging `describe is not defined` errors at the start of each new test file.

**Prevention:**
Add `globals: true` to the `test` block in `vitest.config.ts`. Add `"types": ["vitest/globals"]` to `tsconfig.json`'s `compilerOptions.types` so TypeScript recognizes the globals. Do this in the initial config setup, not discovered file by file.

---

### Pitfall 7: `@testing-library/jest-dom` Matchers Not Extended — `toBeInTheDocument` Fails

**What goes wrong:**
`expect(element).toBeInTheDocument()` throws `TypeError: expect(...).toBeInTheDocument is not a function` because `@testing-library/jest-dom` matchers must be explicitly registered with Vitest's `expect`. This is a one-time setup step that is easy to miss.

**Prevention:**
In the `setupFiles` file, add `import '@testing-library/jest-dom/vitest'` (for `@testing-library/jest-dom` v6+). Do not use the old `extend-expect` import — it was removed in v6. Verify by writing a single test that asserts `toBeInTheDocument()` before writing any real test suite.

---

### Pitfall 8: `parser.ts` Cannot Be Tested as-is — `parseWorkbook()` Requires `File` + `FileReader`

**What goes wrong:**
`parseWorkbook(file: File, fileId: string)` wraps everything in a `FileReader` callback. In a `node` environment, `FileReader` is absent. In `jsdom`, `FileReader` is present but asynchronous and requires constructing a real `File` object. Tests that pass a plain object fail with "file.name is not a function" or the promise never resolves.

**Prevention:**
Extract the pure parsing logic out of `parseWorkbook()` into a separate testable function that accepts `ArrayBuffer | Uint8Array` directly — this is the testable surface. In unit tests, bypass `FileReader` entirely: read the fixture with `fs.readFileSync(fixturePath)` and pass the result as a `Buffer` (which is a `Uint8Array` subclass) directly to `XLSX.read()`. The `buildExternalLinkMap()`, `extractNamedRanges()`, and `extractReferences()` functions are already pure and testable without `FileReader`. Test `parseWorkbook()` itself in E2E tests where a real browser provides `FileReader`.

---

### Pitfall 9: React Flow Position Assertions Are Brittle — Dagre Layout Is Non-Deterministic Across Environments

**What goes wrong:**
`buildGraph()` calls Dagre to compute node `x`/`y` positions. Dagre's output can differ slightly across platforms (Windows vs. Linux) and Node versions due to floating-point math. Tests that assert exact `position.x` values will fail in CI even when the graph is logically correct.

**Prevention:**
Test graph structure (node count, edge count, node `id` values, `data.edgeKind`, `data.isExternal`) rather than pixel positions. If position tests are needed, assert topology (node A is left of node B: `nodeA.position.x < nodeB.position.x`) rather than exact values. In E2E tests, assert that the graph renders visible nodes rather than checking pixel coordinates.

---

### Pitfall 10: Playwright `webServer` with Full URL Instead of Port Causes Indefinite Timeout

**What goes wrong:**
When `playwright.config.ts` specifies `webServer: { url: 'http://localhost:5173', ... }`, Playwright can hang indefinitely waiting for the server, even when Vite is running. This is a documented Playwright bug when using a full URL string instead of a port number.

**Prevention:**
Use `webServer: { command: 'npm run dev', port: 5173, reuseExistingServer: !process.env.CI }` (port, not url). Pair with `use: { baseURL: 'http://localhost:5173' }`. The `reuseExistingServer` flag allows local development runs to reuse an already-running dev server, saving startup time.

---

### Pitfall 11: E2E Tests Are Flaky Because React Flow Animation Isn't Awaited

**What goes wrong:**
After file upload, React Flow runs layout computation, triggers `fitView()`, and animates the viewport transition. E2E tests that immediately assert on node visibility after upload fail intermittently because nodes are positioned at `{x:0, y:0}` during the layout tick before Dagre output is applied.

**Prevention:**
Use Playwright's `waitForSelector` or `expect(locator).toBeVisible()` with proper `timeout` settings rather than fixed `waitForTimeout()` sleeps. Define a `data-testid="graph-canvas"` attribute on the React Flow container and a `data-testid="graph-node"` on `SheetNode` components. Gate assertions on `expect(page.getByTestId('graph-node').first()).toBeVisible()` which auto-retries.

---

### Pitfall 12: Programmatic `.xlsx` Fixture Script Produces Files SheetJS Can't Read Back

**What goes wrong:**
When creating test fixtures programmatically with SheetJS (`XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })`), formulas must be stored as strings with `cellFormula: true` in the read options. If the fixture is written without proper formula strings, `extractReferences()` sees no `cell.f` properties and returns empty references — tests pass vacuously.

**Prevention:**
When building fixtures with SheetJS, set cells using the full cell object with `f` (formula) explicitly: `ws['A1'] = { t: 'n', v: 0, f: "Sheet2!B1" }`. Verify the fixture is correct by reading it back in the fixture script itself and logging the formula count before saving. Store fixtures in `tests/fixtures/` as committed binary `.xlsx` files (generated once by a `scripts/generate-fixtures.ts` script) rather than regenerating them at test time — this makes failures reproducible.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Mock XLSX.read entirely in parser tests | Tests run without any .xlsx fixtures | Tests no longer verify actual parsing logic — only the data transformation around it | Never — the regex and external link resolution logic is exactly what needs testing |
| Use `waitForTimeout(2000)` in E2E instead of smart waits | Quick to write | Flaky on slow CI, unnecessarily slow locally | Never — use `expect(locator).toBeVisible()` instead |
| Test `buildGraph()` output by snapshotting the entire JSON | Fast to write | Snapshot contains positions that break on any Dagre version bump; giant diffs are unreadable | Acceptable only for edge `data` fields, not for position values |
| Single `environment: 'jsdom'` for all tests | Zero config overhead | Pure-Node tests (graph.ts logic) pay jsdom startup cost unnecessarily | Acceptable for a small test suite; use per-file `@vitest-environment node` comments for node-only files as the suite grows |
| Commit binary .xlsx fixtures without a generation script | Simple | No way to know what the fixture contains or reproduce it | Only if the fixture is a real-world sample that can't be reconstructed programmatically |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SheetJS in Vitest | Importing `xlsx` fails with module resolution error | Add `xlsx` to `test.server.deps.inline` in `vitest.config.ts` |
| React Flow in Vitest | Missing `ResizeObserver`, `DOMMatrixReadOnly`, `getBBox` mocks | Copy official mock setup into `vitest.setup.ts` from reactflow.dev/learn/advanced-use/testing |
| Playwright + drag-drop upload | `locator.dragTo()` drops with empty `dataTransfer.files` | Use `fileChooser.setFiles()` or find the hidden `<input type="file">` and use `setInputFiles()` |
| Playwright + Vite dev server | `webServer.url` causes indefinite timeout | Use `webServer.port` instead of `webServer.url` |
| SheetJS fixture generation | Formula cells have no `f` property after write/read | Set the `f` property explicitly on cell objects; verify by reading the fixture back before saving |
| `@testing-library/jest-dom` v6+ | Old `extend-expect` import path removed | Use `import '@testing-library/jest-dom/vitest'` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| All tests use `jsdom` even pure-logic tests | Test suite startup is slower than necessary | Use `@vitest-environment node` per-file for `graph.ts` pure logic tests | Not a hard break — matters when suite exceeds ~200 tests |
| Regenerating `.xlsx` fixtures in `beforeAll` hooks | Each test file that needs fixtures regenerates them | Generate once in a script, commit binary files | Breaks CI time when >10 test files each regenerate the same fixtures |
| Playwright runs all 3 browser engines (chromium, firefox, webkit) | CI takes 3x longer | Start with chromium only; add firefox/webkit only if cross-browser parity is a requirement (it isn't for a Tauri app) | N/A for Tangle — Tauri uses system WebView (Chromium on Windows) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Parser unit tests:** Verify that `cell.f` (formula) fields are actually present in fixture cells — add a sanity assertion counting total formulas found, not just that the function returned without error
- [ ] **Edge kind tests:** Verify that `'internal'`, `'cross-file'`, and `'external'` edge kinds all appear in test output — it's easy to write fixtures that only produce internal edges
- [ ] **External link resolution:** Verify that numeric external link indices (`[1]`, `[2]`) are resolved to real filenames — tests with only internal references never exercise `buildExternalLinkMap()`
- [ ] **Named range toggle:** `buildGraph()` has a `showNamedRanges` flag — ensure tests cover both `true` and `false` paths; the named-range node insertion path is easy to miss
- [ ] **Hidden files:** `buildGraph()` accepts `hiddenFiles: Set<string>` — tests that don't exercise this will miss bugs in the visibility filtering logic
- [ ] **Playwright upload test:** Confirm the graph actually renders nodes after upload, not just that the drop event fired — assert on `data-testid="graph-node"` count > 0
- [ ] **Vitest setup file:** Confirm `ResizeObserver` mock fires immediately (synchronously calls the callback with empty entries) — a mock that never calls the callback breaks React Flow's initial render silently

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong environment — tests pass vacuously | MEDIUM | Add `environment: 'jsdom'`, re-run, fix failures that now surface |
| SheetJS import broken in Vitest | LOW | Add `inline: ['xlsx']` to config; no test rewrites needed |
| Missing React Flow mocks | LOW | Add mock setup file, reference in `setupFiles`; no test logic changes |
| Drag-drop E2E tests never upload | MEDIUM | Inspect DOM for hidden `<input type="file">`, switch to `setInputFiles()` approach |
| Brittle position assertions | MEDIUM | Replace exact position checks with structural assertions; rewrite ~5-10 assertions per affected test file |
| Fixtures with no formula data | HIGH | Rebuild fixture generation script with explicit `f` properties; all parser tests must be re-verified |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Vitest environment mismatch | Phase 1: Vitest config | Run a parser test that asserts `workload.totalFormulas > 0` |
| SheetJS ESM/CJS import failure | Phase 1: Vitest config | `import * as XLSX from 'xlsx'` in a smoke test file |
| React Flow missing DOM mocks | Phase 1: Vitest setupFiles | Render `<ReactFlow nodes={[]} edges={[]} />` without error |
| Duplicate React version | Phase 1: Dependency audit | `npm ls react` shows exactly one version |
| Drag-drop E2E upload failure | Phase 2: E2E upload test | E2E test asserts node count > 0 after file drop |
| Playwright webServer timeout | Phase 2: Playwright config | Playwright starts without hanging; `npm run test:e2e` reaches the app |
| React Flow animation flakiness | Phase 2: E2E assertions | Tests pass 10/10 runs locally without `waitForTimeout` |
| Brittle position assertions | Phase 1: unit test design | No test asserts exact `position.x` or `position.y` values |
| Vacuous fixture cells (no formulas) | Phase 1: fixture generation | Fixture sanity check script reads back and prints formula count |
| `jest-dom` matchers not registered | Phase 1: Vitest setupFiles | `toBeInTheDocument()` works in a smoke test |

---

## Sources

- React Flow official testing guide: https://reactflow.dev/learn/advanced-use/testing
- Vitest common errors guide: https://vitest.dev/guide/common-errors
- Vitest test environments: https://vitest.dev/guide/environment
- Playwright file upload docs: https://playwright.dev/docs/api/class-filechooser
- Playwright webServer config: https://playwright.dev/docs/test-webserver
- SheetJS Vite integration: https://docs.sheetjs.com/docs/demos/frontend/bundler/vitejs/
- React Flow Vitest issue (duplicate React): https://github.com/xyflow/xyflow/issues/4483
- Vitest jsdom vs happy-dom discussion: https://github.com/vitest-dev/vitest/discussions/1607
- Playwright drag-drop file issue: https://github.com/microsoft/playwright/issues/10667
- SheetJS unit test patterns: https://github.com/SheetJS/sheetjs/issues/1880
- Playwright flaky test prevention: https://betterstack.com/community/guides/testing/avoid-flaky-playwright-tests/
- React Testing Library + Vitest mistakes: https://medium.com/@samueldeveloper/react-testing-library-vitest-the-mistakes-that-haunt-developers-and-how-to-fight-them-like-ca0a0cda2ef8

---
*Pitfalls research for: Vitest + Playwright test suite on React/Vite/TypeScript app with SheetJS and React Flow*
*Researched: 2026-02-27*
