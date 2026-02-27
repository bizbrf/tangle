# Project Research Summary

**Project:** Tangle — Test Suite
**Domain:** Vitest + Playwright test suite for a Vite 7 / React 19 / TypeScript SPA with SheetJS and React Flow
**Researched:** 2026-02-27
**Confidence:** HIGH

## Executive Summary

Tangle is a mature single-page app with two clearly-bounded testable layers: pure TypeScript functions in `parser.ts` and `graph.ts`, and browser-driven UI interactions across FilePanel, GraphView, and focus/filter features. The industry-standard approach for this stack in 2026 is Vitest for unit tests and Playwright for E2E — both with first-class Vite/TypeScript support that Jest and Cypress lack. The critical architectural decision is to test the inner parser functions (`extractReferences`, `extractNamedRanges`, `buildExternalLinkMap`) directly in Node mode, bypassing `FileReader` entirely, and reserve the full upload-to-render pipeline for Playwright E2E tests. This split gives fast, reliable unit tests alongside high-confidence integration coverage.

The recommended test structure has three distinct zones: unit tests in `tests/unit/` running under Vitest node environment (no DOM required), E2E specs in `tests/e2e/` running against the live Vite dev server via Playwright, and a `tests/fixtures/` directory managed by a programmatic SheetJS generator script. The fixture generator is the critical path — nearly all meaningful tests depend on `.xlsx` files with known formula content. Generating them programmatically (rather than committing opaque binary blobs) keeps fixtures readable, reproducible, and CI-safe.

The key risk is configuration correctness before any tests are written. Five critical pitfalls — wrong Vitest environment, SheetJS ESM/CJS import failure, missing React Flow DOM mocks, duplicate React instances, and Playwright drag-drop upload mechanics — can each produce tests that appear to pass while covering nothing. All five must be resolved during initial setup (Phase 1) before test authoring begins. The recovery cost if discovered late ranges from medium to high.

## Key Findings

### Recommended Stack

The unit test layer is Vitest 4.x with jsdom 28.x. Vitest shares the Vite transform pipeline, eliminating the Babel/SWC complexity that makes Jest painful for ESM+TypeScript projects. jsdom (not happy-dom) is required because SheetJS exercises `FileReader`, `ArrayBuffer`, and `Blob` APIs that happy-dom does not implement. The E2E layer is Playwright 1.58.x, which integrates with Vite's dev server via `webServer` config and handles file upload via `setInputFiles()` — a clean native API that Cypress cannot match without workarounds. All versions were verified against the live npm registry.

**Core technologies:**
- `vitest@^4.0.18`: Test runner — shares Vite transform pipeline, zero config for Vite 7, ESM/TypeScript/JSX work out of the box
- `@vitest/coverage-v8@^4.0.18`: Coverage — V8 AST-remapped since Vitest 3.2.0, Istanbul-equivalent accuracy, ~30% faster; version must match vitest exactly
- `jsdom@^28.1.0`: DOM environment — required for SheetJS's FileReader/ArrayBuffer/Blob usage; happy-dom is insufficient
- `@testing-library/react@^16.3.2`: React component testing — behavior-based, fully compatible with React 19
- `@testing-library/user-event@^14.6.1`: Realistic event simulation — required for correct drag-and-drop testing
- `@testing-library/jest-dom@^6.9.1`: DOM matchers — must use `import '@testing-library/jest-dom/vitest'` (not `extend-expect`, which was removed in v6)
- `@playwright/test@^1.58.2`: E2E automation — TypeScript-native, `webServer` Vite integration, `setInputFiles()` for file upload; install Chromium only (`npx playwright install chromium`) since Tauri on Windows uses the Chromium engine

**Critical version note:** Vitest and `@vitest/coverage-v8` must be pinned to the same exact version (4.0.18). Vitest 4.x requires Node 20+ and Vite 6+; current project (Vite 7.3.1) is fully compatible.

### Expected Features

The test suite covers two layers: pure function unit tests (fast, no DOM) and browser E2E tests (full pipeline validation). FEATURES.md categorizes coverage targets into three priority tiers based on bug value and implementation cost.

**Must have (P1 — table stakes for a credible test suite):**
- Parser unit tests: cross-sheet reference detection, external file reference detection, self-sheet reference skipping, workload metric counts — all exercisable with synthetic `XLSX.WorkSheet` objects
- Parser unit tests: named range extraction and built-in range filtering (`_xlnm.` prefix skipping)
- Graph unit tests: `buildGraph()` node/edge output counts, edge kind classification (`internal`/`cross-file`/`external`), `hiddenFiles` filtering, overview mode node count
- Programmatic fixture script: generates at minimum 3 `.xlsx` files (simple cross-sheet, external file ref with numeric index, named ranges)
- E2E: upload valid file → sidebar shows file → graph shows nodes
- E2E: upload invalid file → error message shown
- E2E: remove file → sidebar and graph clear

**Should have (P2 — add after P1 tests are green):**
- Parser edge cases: ref deduplication per formula, case-insensitive self-ref, mixed quoted/unquoted refs in same formula
- Graph edge cases: `normWb()` fuzzy matching for cross-file resolution, degree counts (outgoing/incoming), cluster bounding box containment
- E2E: layout mode switching (Graph/Grouped/Overview), edge kind filter toggle, detail panel content on node click, corrupt file error

**Defer (P3 — future consideration):**
- E2E focus mode depth/direction interactions — high value but requires a complex multi-node fixture topology
- E2E named range intermediate node toggle — requires fixture with actual named ranges
- Circular reference no-hang verification — lower priority since the app does not evaluate formulas

**What not to test:**
- Visual regression / screenshot diffing — React Flow layout is non-deterministic; explicitly out of scope per PROJECT.md
- Exact Dagre pixel positions — internal implementation detail; test structure not coordinates
- React Flow internal DOM structure — brittle to library updates; test user-visible content
- Tauri-specific behavior — defer to a separate WebdriverIO integration; this milestone targets `localhost:5173`
- Cross-browser E2E — Chromium only; Tauri uses Chromium engine on Windows

### Architecture Approach

The test suite is organized into four directories under `tests/`: `unit/` (Vitest, node environment, pure TS functions), `e2e/` (Playwright, full browser), `fixtures/` (SheetJS generator script + generated `.xlsx` outputs), and `helpers/` (shared upload helper, GraphPage object model). Configuration lives in a separate `vitest.config.ts` (not merged into `vite.config.ts` — there is a documented triple-slash reference issue in Vitest 4.x + Vite 7.1.x when configs are merged) and `playwright.config.ts`.

**Major components:**
1. `tests/fixtures/generate.ts` — Node script using SheetJS to write deterministic `.xlsx` fixtures; run once via `npm run fixtures:generate` and on CI before the test step; the critical path for all other tests
2. `tests/unit/parser.test.ts` + `parser.error.test.ts` — Call `extractReferences`, `extractNamedRanges`, `buildExternalLinkMap` directly (requires exporting them from `parser.ts`); use `readFileSync` + `XLSX.read()` to bypass FileReader; `@vitest-environment node` docblock
3. `tests/unit/graph.test.ts` — Call `buildGraph()`, layout functions, `computeClusterNodes()` directly; pure TypeScript, no DOM; already exported from `graph.ts`
4. `tests/e2e/upload.spec.ts` + `features.spec.ts` + `error-handling.spec.ts` — Full pipeline via Playwright; `uploadFile()` helper wraps `setInputFiles()`; assert on `.react-flow__node` DOM presence not pixel positions
5. `tests/helpers/upload.ts` + `graph.ts` — Thin Page Object Model layer; keeps `setInputFiles` boilerplate and React Flow DOM selectors centralized

**Build order (respects dependency chain):**
Fixture generator → Vitest config + graph unit tests → Export parser internals + parser unit tests → Playwright config → E2E upload test → E2E feature tests → E2E error tests → CI integration

### Critical Pitfalls

1. **Vitest environment mismatch — tests pass vacuously** — `parseWorkbook()` uses `FileReader`; in `node` environment it's undefined and the promise silently rejects, producing 100% pass rate with 0% real coverage. Fix: use `@vitest-environment node` and bypass `FileReader` by passing a Buffer directly to `XLSX.read()` in unit tests.

2. **SheetJS ESM/CJS import failure in Vitest** — `xlsx@0.18.5` is CJS; Vitest's module resolution diverges from Vite's pre-bundler. Symptom: `Cannot find module 'xlsx'` in tests but `npm run dev` works. Fix: add `xlsx` to `test.server.deps.inline` in `vitest.config.ts`.

3. **Missing React Flow DOM mocks** — React Flow v12 requires `ResizeObserver`, `DOMMatrixReadOnly`, `HTMLElement.offsetHeight/offsetWidth`, and `SVGElement.getBBox()`. jsdom does not implement any of these. Without mocks, edges silently don't render but no test throws. Fix: copy exact mock setup from official React Flow testing guide into `vitest.setup.ts`; reference in `setupFiles`.

4. **Drag-and-drop upload cannot use `locator.dragTo()`** — Playwright's dragTo does not carry a `dataTransfer.files` payload; the `onDrop` handler receives an empty file list. Fix: locate the hidden `<input type="file">` in the DOM and use `page.locator('input[type="file"]').setInputFiles(path)` — Tangle's FilePanel renders one.

5. **Fixture cells with no formula data** — SheetJS `write/read` round-trips do not preserve formula strings unless `cell.f` is explicitly set. Fixture cells written via `aoa_to_sheet(['=Sheet2!A1'])` may have no `f` property on read-back, causing `extractReferences()` to return empty results and tests to pass vacuously. Fix: set `ws['A1'] = { t: 'n', v: 0, f: 'Sheet2!A1' }` explicitly; add a read-back sanity check in the generator script that logs formula count before saving.

## Implications for Roadmap

Based on combined research, four phases are recommended. The ordering is determined by the dependency chain: configuration must precede authoring, fixtures must precede tests that consume them, unit tests must be green before E2E catches integration failures, and feature E2E tests depend on the core upload flow.

### Phase 1: Infrastructure Setup

**Rationale:** All five critical pitfalls (Vitest environment, SheetJS import, React Flow mocks, duplicate React, fixture formula data) must be resolved before any test is written. Discovering them during authoring adds recovery cost. This phase produces zero tests but makes all subsequent phases reliable.

**Delivers:** Working Vitest config with correct environment and `setupFiles`; confirmed SheetJS import via `inline: ['xlsx']`; React Flow DOM mocks in place; `npm ls react` clean; `vitest.config.ts` and `playwright.config.ts` ready; `npm run test:unit` and `npm run test:e2e` scripts registered in `package.json`; fixture generator script producing verified `.xlsx` files with readable formula data.

**Addresses:** Parser and graph unit tests (depends on fixtures); E2E upload tests (depends on Playwright config + fixtures)

**Avoids:** All 5 critical pitfalls; Pitfall 6 (globals not enabled); Pitfall 7 (jest-dom matchers not registered); Pitfall 10 (Playwright webServer timeout — use `port:` not `url:`); Pitfall 12 (fixture formula data vacuity)

**Research flag:** Standard patterns. No phase research needed — all setup steps are directly documented in official Vitest, Playwright, and React Flow docs.

### Phase 2: Parser Unit Tests

**Rationale:** `parser.ts` contains the most domain-specific logic (regex-based reference extraction, numeric external link index resolution, named range handling). These are the tests where bugs have highest user impact. `extractReferences`, `extractNamedRanges`, and `buildExternalLinkMap` must be exported from `parser.ts` — this is the one code change required before testing. Unit tests here run in milliseconds and are the fastest feedback loop.

**Delivers:** `tests/unit/parser.test.ts` covering cross-sheet detection, external file detection (including numeric index resolution), self-ref skipping, workload counts; `tests/unit/parser.error.test.ts` covering empty workbook, no-formula sheets, simple-formula false positives; named range extraction and `_xlnm.` filtering.

**Addresses:** All P1 parser features from FEATURES.md; deduplication, case-insensitive self-ref, mixed quoted/unquoted (P2 edge cases)

**Avoids:** Pitfall 1 (environment mismatch — use `@vitest-environment node` docblock); Pitfall 8 (parseWorkbook FileReader — test inner functions directly)

**Research flag:** No research needed. Parser logic is already implemented; testing patterns are direct function calls with fixture data.

### Phase 3: Graph Unit Tests

**Rationale:** `graph.ts` is pure TypeScript with no DOM or FileReader dependencies — the fastest tests to write and run. `buildGraph()` and related functions are already exported. These tests validate the data structures that E2E tests depend on, catching logical errors before they become harder-to-debug Playwright failures.

**Delivers:** `tests/unit/graph.test.ts` covering `buildGraph()` node/edge counts, edge kind classification (all three kinds), `hiddenFiles` filtering, overview mode (one node per file), `normWb()` fuzzy matching, degree counts; property tests for `groupedLayout()` (no lost nodes, not all at origin) and `computeClusterNodes()` (bounding box containment); named range intermediate node topology with `showNamedRanges: true/false`.

**Addresses:** All P1 graph features; P2 graph edge cases (normWb, degree counts, cluster bounding boxes)

**Avoids:** Pitfall 9 (brittle position assertions — assert structure, not exact x/y coordinates)

**Research flag:** No research needed. All functions are exported, patterns are pure TypeScript testing.

### Phase 4: E2E Tests

**Rationale:** E2E tests go through the full pipeline (file → FileReader → parser → graph → React Flow DOM) and catch integration failures invisible to unit tests. They must come last because they depend on Phase 1 (Playwright config, fixture files), Phase 2 (parser correctness), and Phase 3 (graph correctness). Start with the core upload flow (gating path for all other E2E tests), then layer on feature interactions.

**Delivers:** `tests/e2e/upload.spec.ts` (upload valid file → sidebar + graph nodes, remove file → cleared); `tests/e2e/error-handling.spec.ts` (non-Excel file → error message, corrupt file → error message); `tests/e2e/features.spec.ts` (layout mode switching, edge kind filter toggle, detail panel on node click); `tests/helpers/upload.ts` + `tests/helpers/graph.ts` Page Object Model; CI pipeline steps.

**Addresses:** All P1 E2E features; P2 E2E features (layout switch, edge filter, detail panel, corrupt file); P3 focus mode if time allows

**Avoids:** Pitfall 5 (drag-drop — use `setInputFiles()` on hidden input); Pitfall 10 (webServer timeout — use port not URL); Pitfall 11 (animation flakiness — use `waitForSelector` / `toBeVisible()` not `waitForTimeout`); Anti-pattern 2 (visual regression — assert on DOM element count and labels, not screenshots)

**Research flag:** May benefit from phase research specifically for the drag-drop upload mechanism. Tangle's FilePanel should be inspected to confirm a hidden `<input type="file">` is present in the DOM — if the drop zone uses a pure drag event without a backing input, Pitfall 5 requires the more complex `DataTransfer` workaround.

### Phase Ordering Rationale

- Phase 1 is non-negotiable first — the five critical pitfalls produce silently-passing tests that provide no coverage; discovering them during Phase 2 or 3 forces rework of already-written tests
- Fixtures are built in Phase 1 (not Phase 2) because both parser unit tests and E2E tests depend on them; parallel work on Phase 2 and Phase 3 is possible once Phase 1 is complete
- Phase 2 before Phase 3 is a convention, not a hard dependency — graph and parser unit tests are independent and can be developed in parallel
- Phase 4 strictly follows Phases 1-3 because E2E test failures are harder to diagnose without confidence that the underlying unit logic is correct
- Parser function exports (`extractReferences`, `extractNamedRanges`, `buildExternalLinkMap`) are the only source code change required in this entire milestone — all other work is test infrastructure

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (E2E upload):** Inspect Tangle's FilePanel DOM to confirm a hidden `<input type="file">` exists. If the drop zone is purely div-based with no input, the `setInputFiles()` approach won't work and the `DataTransfer` workaround (Playwright issue #10667) must be planned explicitly.

Phases with standard patterns (skip phase research):
- **Phase 1 (Infrastructure):** All setup steps are documented in official Vitest, Playwright, React Flow, and SheetJS docs at HIGH confidence.
- **Phase 2 (Parser unit tests):** Pure function testing against known source code; no external unknowns.
- **Phase 3 (Graph unit tests):** Same — pure TypeScript, exported functions, established patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via live npm registry; official docs consulted for compatibility matrix; alternatives explicitly evaluated |
| Features | HIGH | Based on direct source code analysis of `parser.ts`, `graph.ts`, `types.ts`, `FilePanel.tsx`, `GraphView.tsx` — no inference required |
| Architecture | HIGH | Vitest, Playwright, and React Flow official docs all confirmed; directory structure and data flow are industry-standard patterns |
| Pitfalls | HIGH | Critical pitfalls sourced from official docs (React Flow testing guide, Vitest common errors), GitHub issue trackers with confirmed reproduction steps, and SheetJS official docs |

**Overall confidence:** HIGH

### Gaps to Address

- **FilePanel hidden input confirmation:** The drag-drop upload strategy for E2E tests depends on whether Tangle's FilePanel renders a hidden `<input type="file">`. This must be verified by inspecting the live DOM before writing Phase 4 upload tests. If no input exists, the `DataTransfer` workaround adds ~1 day of complexity.

- **`extractReferences` export:** These functions are currently unexported from `parser.ts`. The export is a trivial code change (add `export` keyword) but must happen before Phase 2 tests can be written. This is a known dependency that the roadmap should flag explicitly.

- **Fixture formula round-trip verification:** The generator script must include a read-back sanity check that asserts formula count > 0 after writing each fixture. This is documented in Pitfall 12 but is an implementation detail that needs explicit attention during Phase 1 execution.

- **Playwright webServer port vs. URL:** Pitfall 10 documents a Playwright bug where using `url:` in `webServer` config causes indefinite hangs. The correct config uses `port: 5173`. This is a one-line fix but easy to overlook when copying config examples from the internet.

## Sources

### Primary (HIGH confidence)
- npm registry (live queries) — vitest@4.0.18, @playwright/test@1.58.2, @testing-library/react@16.3.2, @testing-library/user-event@14.6.1, @testing-library/jest-dom@6.9.1, jsdom@28.1.0, @vitest/coverage-v8@4.0.18
- https://vitest.dev/guide/ — Node 20+ requirement, Vite 6+ requirement, environment config, globals config
- https://vitest.dev/guide/coverage.html — V8 provider, AST-remapping since Vitest 3.2.0
- https://vitest.dev/guide/environment — jsdom vs happy-dom API coverage differences
- https://vitest.dev/guide/common-errors — SheetJS inline dep, FileReader in node environment
- https://playwright.dev/docs/intro — Node 18+ requirement, Windows 11 support
- https://playwright.dev/docs/test-webserver — webServer config, port vs URL distinction
- https://playwright.dev/docs/api/class-locator — setInputFiles() API
- https://playwright.dev/docs/test-fixtures — Page Object Model patterns
- https://reactflow.dev/learn/advanced-use/testing — React Flow DOM mock requirements (ResizeObserver, DOMMatrixReadOnly, offsetHeight/Width, getBBox)
- https://docs.sheetjs.com/docs/getting-started/examples/export/ — programmatic workbook creation, formula cell structure
- https://docs.sheetjs.com/docs/demos/frontend/bundler/vitejs/ — SheetJS Vite integration
- Direct source analysis: `src/lib/parser.ts`, `src/lib/graph.ts`, `src/types.ts`, `src/components/FilePanel/FilePanel.tsx`, `src/components/Graph/GraphView.tsx`

### Secondary (MEDIUM confidence)
- https://github.com/xyflow/xyflow/issues/4483 — duplicate React instance causing hook errors in Vitest
- https://github.com/vitest-dev/vitest/discussions/1607 — jsdom vs happy-dom, FileReader API coverage
- https://github.com/microsoft/playwright/issues/10667 — drag-and-drop with DataTransfer in Playwright
- https://github.com/vitest-dev/vitest/issues/1703 — jsdom ArrayBuffer/FileReader compatibility
- https://bugbug.io/blog/test-automation-tools/cypress-vs-playwright/ — Playwright vs Cypress download volume and architectural comparison

### Tertiary (LOW confidence)
- https://github.com/SheetJS/sheetjs/issues/1880 — SheetJS unit test patterns (community discussion)
- https://medium.com/@samueldeveloper/react-testing-library-vitest-the-mistakes-that-haunt-developers-and-how-to-fight-them-like-ca0a0cda2ef8 — common setup mistakes

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
