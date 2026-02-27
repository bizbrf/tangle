# Phase 4: E2E Tests - Research

**Researched:** 2026-02-27
**Domain:** Playwright E2E testing of a React + React Flow + Vite SPA
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Selector strategy
- Use `data-testid` attributes throughout — stable selectors that survive CSS/DOM changes
- Full coverage: add `data-testid` to sidebar file items, sheet items, eye icon, layout mode selector, edge filter toggles, graph canvas nodes, graph edges, detail panel header, workload metrics, error messages
- `SheetNode` custom component: add `data-testid="sheet-node"` to its root div; Playwright targets all nodes via `getByTestId('sheet-node')`
- Error display: Claude should inspect how errors are currently rendered in source and add `data-testid="upload-error"` there

#### Test file structure
- 4 spec files grouped by feature area in `tests/e2e/`:
  - `upload.spec.ts` — E2E-01 through E2E-04
  - `interactions.spec.ts` — E2E-05 through E2E-09
  - `detail-panel.spec.ts` — E2E-10 through E2E-12
  - `errors.spec.ts` — E2E-13 through E2E-15
- Shared helper module: `tests/e2e/helpers.ts` with reusable functions (e.g., `uploadFile(page, path)`, `waitForNodes(page)`)
- No smoke test in Phase 4 — Phase 1 already covers app load

#### State isolation
- Full page reload before each test (`beforeEach` with `page.goto()`) — clean state, no test interdependencies
- Each test uploads what it needs via `setInputFiles()` — no shared upload state even within a spec file
- No assertion required to verify clean state — trust that React state resets on reload
- After upload, wait for `data-testid="sheet-node"` to appear (not a fixed timeout)

#### Fixture allocation
- `cross-sheet.xlsx` — default fixture for upload tests (E2E-01 through E2E-04) and detail panel tests (E2E-10 through E2E-12)
- `external-ref.xlsx` — layout mode and edge filter tests (E2E-05, E2E-06) — provides both internal and external edges
- `external-ref.xlsx` — hide/show test (E2E-07, E2E-08) and focus mode test (E2E-09)
- `malformed.xlsx` — corrupt upload error test (E2E-14) — reuse existing Phase 1 fixture
- Create `tests/fixtures/not-excel.txt` — non-Excel upload error test (E2E-13)
- Multi-file test (E2E-04): upload `cross-sheet.xlsx` + `external-ref.xlsx` together
- Focus mode test (E2E-09): basic coverage — click a node, confirm focus mode activates (node highlighted, non-neighbors dimmed/hidden). Does not need to test depth slider values.

### Claude's Discretion
- Exact `data-testid` naming convention beyond what's listed (e.g., `file-list-item`, `sheet-list-item`, etc.)
- Edge selectors — how Playwright targets specific edges in React Flow
- Helper function signatures and implementation details
- How to trigger focus mode click in Playwright (may require `force: true` for React Flow nodes)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| E2E-01 | User can upload a `.xlsx` file via the file input; the filename appears in the sidebar | `input[type="file"]` is in DOM (hidden), `setInputFiles()` is the upload mechanism; sidebar file row needs `data-testid="file-list-item"` |
| E2E-02 | Uploaded file's sheets are listed under the filename in the sidebar (expandable) | FilePanel auto-expands on upload; sheet rows need `data-testid="sheet-list-item"` |
| E2E-03 | Graph canvas renders at least one node after upload | `SheetNode` root div needs `data-testid="sheet-node"`; wait with `waitFor` not fixed timeout |
| E2E-04 | User can upload multiple files; all appear in sidebar and graph | `setInputFiles()` accepts array of paths for multi-file upload |
| E2E-05 | Switching layout mode (Graph → Grouped → Overview) updates the graph — node count changes for Overview mode | Toolbar buttons identified by text ('Overview'); node count drops to one-per-workbook in Overview |
| E2E-06 | Toggling edge kind filter (e.g., hiding external edges) removes those edges from the graph | EdgeKindFilterBar buttons contain color-coded labels; edges in RF live in `.react-flow__edge` elements or need `data-testid` on edge paths |
| E2E-07 | Clicking the eye icon on a file hides its nodes from the graph | Eye button is hidden until hover (`opacity-0 group-hover:opacity-100`); requires hover before click |
| E2E-08 | Clicking the eye icon again (re-show) restores the hidden nodes | Same hover requirement; nodes reappear after re-toggle |
| E2E-09 | Focus mode — clicking a node and setting focus depth filters graph to neighborhood only | Click node → click Focus button in DetailPanel; focus mode panel appears with "Focus" label text |
| E2E-10 | Clicking a sheet node opens the detail panel showing the sheet name | Selection via RF click; DetailPanel appears bottom-right; needs `data-testid="detail-panel"` and `data-testid="detail-panel-title"` |
| E2E-11 | Detail panel shows workload metrics (formula count, reference counts) | Workload grid renders "formulas", "within-sheet", "cross-sheet", "cross-file" labels; needs `data-testid="workload-metrics"` |
| E2E-12 | Clicking an edge opens the detail panel showing source and target sheet names | RF edge click; detail panel switches to "References" header; needs `data-testid` on References section |
| E2E-13 | Uploading a non-Excel file (e.g., `.txt`) shows an error message and does not crash the app | FilePanel sets error state and renders `<p>` with error text; needs `data-testid="upload-error"` |
| E2E-14 | Uploading a corrupt/malformed `.xlsx` file shows an error message in the UI | `parseWorkbook()` throws → catch block sets error; same `data-testid="upload-error"` |
| E2E-15 | App remains usable (other files still visible in graph) after a failed upload | Upload good file first, then corrupt file; verify good nodes still visible |
</phase_requirements>

---

## Summary

Phase 4 adds Playwright E2E tests covering the full upload-to-graph pipeline. Playwright 1.58.2 is already installed and configured (`playwright.config.ts` points to `tests/e2e/`, targets `http://localhost:5173`, uses Chromium only). The test infrastructure skeleton from Phase 1 already exists: a smoke spec (`tests/e2e/smoke.spec.ts`), a helper stub (`tests/helpers/upload.ts`), all fixture `.xlsx` files, and a working `webServer` config using `url` (not deprecated `port`).

The primary work in Phase 4 is threefold: (1) add `data-testid` attributes to the React source code (`FilePanel.tsx` and `GraphView.tsx`) where none currently exist, (2) create the four spec files plus a proper E2E helpers module at `tests/e2e/helpers.ts`, and (3) create the `not-excel.txt` fixture. The existing helper at `tests/helpers/upload.ts` is a stub that must be superseded by the proper helper at `tests/e2e/helpers.ts`.

The trickiest interactions involve React Flow: nodes are custom-rendered divs inside the RF canvas, so clicking them requires careful selector strategy (via `data-testid="sheet-node"`) and potentially `force: true` due to pointer-events management. Eye icon buttons are visibility-hidden until hover (`opacity-0 group-hover:opacity-100`), requiring an explicit `hover()` call before `click()`. The detail panel is conditionally rendered (returns `null` when nothing selected), so tests must wait for it after triggering selection.

**Primary recommendation:** Add `data-testid` attributes first (in source code), then write tests bottom-up (helpers → upload → interactions → detail-panel → errors).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | 1.58.2 | E2E test runner + browser automation | Already installed; configured in Phase 1; TypeScript-native |
| Playwright Chromium | bundled | Browser engine | Only Chromium in projects config; Windows target |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:path (path.join) | built-in | Construct absolute fixture paths | All `setInputFiles()` calls need absolute paths |
| @playwright/test `expect` | 1.58.2 | Assertions with auto-retry | All assertions — never use raw `if` checks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `data-testid` selectors | CSS class / text selectors | CSS classes change with Tailwind refactor; text is locale-sensitive. `data-testid` is the standard for component testing. |
| `page.click()` with selector | `page.locator().click()` | `locator()` is the current Playwright API; `page.click()` is legacy. Always use `locator()`. |
| Fixed `page.waitForTimeout()` | `page.waitForSelector()` / `.waitFor()` | Fixed timeouts are flaky. Use element-based waits. |

**Installation:** No new installation needed — `@playwright/test@1.58.2` already in `devDependencies`.

---

## Architecture Patterns

### Recommended Project Structure
```
tests/
  e2e/
    helpers.ts          # uploadFile(), waitForNodes(), waitForDetailPanel()
    upload.spec.ts      # E2E-01 through E2E-04
    interactions.spec.ts # E2E-05 through E2E-09
    detail-panel.spec.ts # E2E-10 through E2E-12
    errors.spec.ts      # E2E-13 through E2E-15
    smoke.spec.ts       # Phase 1 smoke tests (do not modify)
  fixtures/
    cross-sheet.xlsx    # already exists
    external-ref.xlsx   # already exists
    malformed.xlsx      # already exists
    not-excel.txt       # CREATE: plain text file for E2E-13
    ...other .xlsx      # already exist
  helpers/
    upload.ts           # Phase 1 stub — superseded by tests/e2e/helpers.ts
```

### Pattern 1: Standard Test Structure with beforeEach Reload
**What:** Every test in every spec gets a clean page via `beforeEach`. Each test uploads what it needs independently.
**When to use:** All tests in this phase — no shared state allowed.
**Example:**
```typescript
// Source: Playwright docs — https://playwright.dev/docs/test-fixtures
import { test, expect } from '@playwright/test'
import { uploadFile, waitForNodes } from './helpers'
import path from 'node:path'

const FIXTURES = path.resolve(__dirname, '../fixtures')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('E2E-01: filename appears in sidebar after upload', async ({ page }) => {
  await uploadFile(page, path.join(FIXTURES, 'cross-sheet.xlsx'))
  await waitForNodes(page)
  await expect(page.getByTestId('file-list-item').filter({ hasText: 'cross-sheet.xlsx' })).toBeVisible()
})
```

### Pattern 2: E2E Helpers Module (tests/e2e/helpers.ts)
**What:** Shared helper functions that encode common E2E actions. All specs import from here.
**When to use:** Any repeated action — upload, wait for nodes, wait for detail panel.
**Example:**
```typescript
// Source: Based on existing stub at tests/helpers/upload.ts + Playwright docs
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function uploadFile(page: Page, fixturePath: string): Promise<void> {
  const input = page.locator('input[type="file"]')
  await input.setInputFiles(fixturePath)
}

export async function uploadFiles(page: Page, fixturePaths: string[]): Promise<void> {
  const input = page.locator('input[type="file"]')
  await input.setInputFiles(fixturePaths)
}

export async function waitForNodes(page: Page): Promise<void> {
  await page.getByTestId('sheet-node').first().waitFor({ state: 'visible' })
}

export async function waitForDetailPanel(page: Page): Promise<void> {
  await page.getByTestId('detail-panel').waitFor({ state: 'visible' })
}
```

### Pattern 3: Hovering Before Clicking Hidden Buttons
**What:** The eye-icon button in FilePanel is `opacity-0 group-hover:opacity-100` — it only becomes clickable after hovering over the file row.
**When to use:** E2E-07, E2E-08 (hide/show file tests).
**Example:**
```typescript
// Hover the file row first, then click the eye button
const fileRow = page.getByTestId('file-list-item').filter({ hasText: 'external-ref.xlsx' })
await fileRow.hover()
await fileRow.getByTestId('eye-toggle').click()
// Now verify nodes are hidden
await expect(page.getByTestId('sheet-node')).toHaveCount(0)
```

### Pattern 4: Clicking React Flow Nodes
**What:** React Flow nodes are custom divs inside the RF canvas. Standard click works via `data-testid="sheet-node"` if pointer-events are set. If click is intercepted by the canvas overlay, use `force: true`.
**When to use:** E2E-09 (focus mode), E2E-10 through E2E-12 (detail panel).
**Example:**
```typescript
// Click the first sheet node to open detail panel
const firstNode = page.getByTestId('sheet-node').first()
await firstNode.click()
// If the above fails due to RF canvas overlay:
await firstNode.click({ force: true })
// Then wait for detail panel
await waitForDetailPanel(page)
```

### Pattern 5: Counting Nodes After Layout Switch
**What:** Switching to Overview mode reduces node count to one per workbook. Count `data-testid="sheet-node"` elements before and after.
**When to use:** E2E-05.
**Example:**
```typescript
// Count before (Graph mode — shows all sheets)
const graphCount = await page.getByTestId('sheet-node').count()

// Switch to Overview
await page.getByRole('button', { name: 'Overview' }).click()
// Or via data-testid: await page.getByTestId('layout-overview').click()

// Count after — should be fewer (one per workbook)
const overviewCount = await page.getByTestId('sheet-node').count()
expect(overviewCount).toBeLessThan(graphCount)
```

### Pattern 6: Multi-File Upload
**What:** `setInputFiles()` accepts a string array for uploading multiple files simultaneously.
**When to use:** E2E-04.
**Example:**
```typescript
const input = page.locator('input[type="file"]')
await input.setInputFiles([
  path.join(FIXTURES, 'cross-sheet.xlsx'),
  path.join(FIXTURES, 'external-ref.xlsx'),
])
```

### Anti-Patterns to Avoid
- **Fixed timeouts:** Never use `page.waitForTimeout(2000)`. Use element-based waits: `locator.waitFor({ state: 'visible' })`.
- **Selecting by CSS class:** Tailwind classes change; `data-testid` is stable. Never `page.locator('.some-class')` unless it is a well-known stable class (e.g., `.react-flow__edge`).
- **Shared state between tests:** Every test must call `page.goto('/')` in `beforeEach`. Never rely on state left by a previous test.
- **Test ordering dependency:** Tests in the same spec file must be independently executable.
- **Clicking without waiting:** Always wait for the element to be visible before clicking. Use `await expect(locator).toBeVisible()` before interaction, or rely on Playwright's auto-waiting (locator actions auto-wait).

---

## Source Code Audit: data-testid Gaps

**Current state:** Zero `data-testid` attributes exist anywhere in `src/`. All must be added.

### FilePanel.tsx — Required Additions

| Element | Suggested testid | Used By |
|---------|-----------------|---------|
| Error `<p>` element (line ~202) | `upload-error` | E2E-13, E2E-14, E2E-15 |
| File row `<div>` (line ~232) | `file-list-item` | E2E-01, E2E-04, E2E-07, E2E-08 |
| Sheet row `<div>` (line ~300) | `sheet-list-item` | E2E-02 |
| Eye `<button>` (line ~261) | `eye-toggle` | E2E-07, E2E-08 |

### GraphView.tsx — Required Additions

| Element | Suggested testid | Used By |
|---------|-----------------|---------|
| SheetNode root `<div>` (line ~396, ~239, ~323) | `sheet-node` | E2E-03, E2E-04, E2E-05, E2E-06, E2E-07, E2E-08, E2E-09, E2E-10 |
| DetailPanel outer `<div>` (line ~659) | `detail-panel` | E2E-10, E2E-11, E2E-12 |
| DetailPanel header `<span>` (line ~669) | `detail-panel-title` | E2E-10, E2E-12 |
| Workload section container (line ~774) | `workload-metrics` | E2E-11 |
| Layout toolbar buttons (line ~951) | `layout-graph`, `layout-grouped`, `layout-overview` | E2E-05 |
| Edge filter toggle buttons (line ~1020) | `edge-filter-{kind}` (e.g., `edge-filter-external`) | E2E-06 |
| Focus mode panel outer `<div>` (line ~1436) | `focus-panel` | E2E-09 |

**Note on SheetNode:** All three node variants (named range, external file, regular sheet) use the `SheetNode` function. Add `data-testid="sheet-node"` to each variant's root `<div>`. The Overview mode uses `isFileNode: true` nodes, which render via the `data.isFileNode` branch — these should also get `data-testid="sheet-node"` so Overview count tests work.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auto-waiting for elements | `page.waitForTimeout(ms)` | `locator.waitFor()` / Playwright auto-wait | Fixed timeouts are flaky; Playwright retries automatically |
| File upload simulation | Manual DataTransfer events | `input.setInputFiles(path)` | Hidden `<input type="file">` is in the DOM; `setInputFiles` works directly |
| Counting nodes reliably | Manual DOM queries | `page.getByTestId().count()` with `expect(...).toHaveCount()` | Playwright's `toHaveCount()` retries until count matches |
| Selector retries | Manual polling loops | `expect(locator).toBeVisible()` | Built-in retry logic with configurable timeout |
| Test isolation | Session-level state sharing | `beforeEach` with `page.goto('/')` | React state fully resets on navigation |

**Key insight:** Playwright's locator API has retry-built-in. Never write polling loops or fixed sleeps — they are always wrong and always fragile.

---

## Common Pitfalls

### Pitfall 1: Eye Button Not Clickable Without Hover
**What goes wrong:** `page.getByTestId('eye-toggle').click()` throws "element is not visible" or clicks nothing.
**Why it happens:** `FilePanel.tsx` applies `opacity-0 group-hover:opacity-100` to the action button container. Without hover, the button is invisible.
**How to avoid:** Always `await fileRow.hover()` before clicking any action button on a file row.
**Warning signs:** "Element is not visible" or "timeout waiting for element" errors on eye-toggle clicks.

### Pitfall 2: React Flow Node Clicks Intercepted by Canvas
**What goes wrong:** Clicking `[data-testid="sheet-node"]` does nothing, or the detail panel doesn't open.
**Why it happens:** React Flow renders a transparent pane overlay for pan/zoom handling that can intercept pointer events. This is a known Playwright + React Flow interaction issue.
**How to avoid:** Use `{ force: true }` as fallback: `await node.click({ force: true })`. This bypasses pointer-event checks and dispatches a synthetic click directly.
**Warning signs:** Test hangs waiting for detail panel after node click; no selection state change.

### Pitfall 3: Overview Mode — Node Counts Differ From Expectation
**What goes wrong:** E2E-05 expects "fewer nodes in Overview" but count is unexpected.
**Why it happens:** Overview mode renders one `isFileNode: true` node per workbook (not per sheet). If `data-testid="sheet-node"` is only added to the regular sheet branch of `SheetNode`, the file nodes won't be counted. Both `external-ref.xlsx` has multiple sheets but may produce multiple workbook nodes depending on what's uploaded.
**How to avoid:** Add `data-testid="sheet-node"` to ALL three branches of `SheetNode` (named range, file node, regular sheet). For E2E-05 with `external-ref.xlsx`, the test should assert `overviewCount < graphCount` rather than an exact number.
**Warning signs:** `toHaveCount()` assertion fails with unexpected numbers.

### Pitfall 4: FilePanel Auto-Expands on Upload
**What goes wrong:** Tests for E2E-02 (sheet list visible) appear to work even without explicit expand click.
**Why it happens:** `FilePanel.tsx` calls `setExpanded(prev => { next.add(wb.id) })` on every successful upload — the file is expanded automatically.
**How to avoid:** This is actually helpful — E2E-02 can immediately check for `sheet-list-item` without needing to click expand. Document this behavior so tests don't add unnecessary expand clicks.
**Warning signs:** Tests adding expand clicks that aren't needed — add only if sheet list is NOT auto-expanded.

### Pitfall 5: Error `<p>` Not In DOM Until Error Occurs
**What goes wrong:** Checking for `data-testid="upload-error"` before triggering error causes test to fail.
**Why it happens:** `{error && <p ...>}` conditional render — `upload-error` element doesn't exist when `error` is null.
**How to avoid:** Use `waitFor({ state: 'visible' })` after triggering upload, not before.
**Warning signs:** `expect(page.getByTestId('upload-error')).toBeVisible()` with immediate assertion (no wait).

### Pitfall 6: Detail Panel Returns Null Until Node is Selected
**What goes wrong:** `page.getByTestId('detail-panel')` finds no element.
**Why it happens:** `DetailPanel` returns `null` when `selectedNodes.length === 0 && !selectedEdge`. The element isn't in the DOM at all.
**How to avoid:** After clicking a node, use `await page.getByTestId('detail-panel').waitFor({ state: 'visible' })` to wait for panel to appear.
**Warning signs:** "Locator resolved to hidden" or "element not found" on detail-panel queries.

### Pitfall 7: Edge Clicking in React Flow
**What goes wrong:** Clicking an SVG `<path>` for an edge doesn't trigger edge selection.
**Why it happens:** React Flow's `WeightedEdge` uses `BaseEdge` which renders an SVG path. The clickable hit area may be very thin (strokeWidth 1.2-4.5px). The path itself has `pointer-events: none` style in some RF versions.
**How to avoid:** The `WeightedEdge` renders a `BaseEdge` (`id={id}`) plus an optional label div. The label div (for multi-ref edges) has `pointerEvents: 'all'`. For single-ref edges with no label, clicking the SVG path directly may fail. Consider adding `data-testid` to the edge via a wrapper, OR use RF's `onEdgeClick` and test via label badges when `refCount > 1`. Alternatively, test E2E-12 with `external-ref.xlsx` which should have multi-ref edges with label badges (clickable `<div>`).
**Warning signs:** Click on edge doesn't trigger detail panel opening; no edge selection occurs.

---

## Code Examples

Verified patterns from official sources:

### Helper module (tests/e2e/helpers.ts)
```typescript
// Source: Based on @playwright/test 1.58.2 API
import type { Page } from '@playwright/test'

const FIXTURE_DIR = new URL('../fixtures', import.meta.url).pathname

export function fixturePath(filename: string): string {
  return new URL(`../fixtures/${filename}`, import.meta.url).pathname
}

export async function uploadFile(page: Page, filename: string): Promise<void> {
  const input = page.locator('input[type="file"]')
  await input.setInputFiles(fixturePath(filename))
}

export async function uploadFiles(page: Page, filenames: string[]): Promise<void> {
  const input = page.locator('input[type="file"]')
  await input.setInputFiles(filenames.map(fixturePath))
}

export async function waitForNodes(page: Page): Promise<void> {
  await page.getByTestId('sheet-node').first().waitFor({ state: 'visible' })
}

export async function waitForDetailPanel(page: Page): Promise<void> {
  await page.getByTestId('detail-panel').waitFor({ state: 'visible' })
}
```

### upload.spec.ts skeleton
```typescript
// Source: Playwright docs — beforeEach pattern
import { test, expect } from '@playwright/test'
import { uploadFile, uploadFiles, waitForNodes } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('E2E-01: filename appears in sidebar after upload', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)
  await expect(page.getByTestId('file-list-item').filter({ hasText: 'cross-sheet.xlsx' })).toBeVisible()
})

test('E2E-02: uploaded file sheets appear in sidebar', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  // FilePanel auto-expands on upload — sheets are immediately visible
  await expect(page.getByTestId('sheet-list-item').first()).toBeVisible()
})

test('E2E-03: graph renders at least one node after upload', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()
})

test('E2E-04: multiple files upload and appear in sidebar and graph', async ({ page }) => {
  await uploadFiles(page, ['cross-sheet.xlsx', 'external-ref.xlsx'])
  await waitForNodes(page)
  await expect(page.getByTestId('file-list-item')).toHaveCount(2)
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()
})
```

### interactions.spec.ts — eye toggle pattern
```typescript
// Source: Playwright hover-then-click pattern for hidden buttons
test('E2E-07: clicking eye icon hides file nodes from graph', async ({ page }) => {
  await uploadFile(page, 'external-ref.xlsx')
  await waitForNodes(page)

  const nodesBefore = await page.getByTestId('sheet-node').count()
  expect(nodesBefore).toBeGreaterThan(0)

  // Eye button is invisible until hover
  const fileRow = page.getByTestId('file-list-item').first()
  await fileRow.hover()
  await fileRow.getByTestId('eye-toggle').click()

  // Nodes from hidden file should disappear
  await expect(page.getByTestId('sheet-node')).toHaveCount(0)
})
```

### errors.spec.ts — error message pattern
```typescript
// Source: FilePanel error rendering + Playwright waitFor
test('E2E-13: uploading a .txt file shows error message', async ({ page }) => {
  await uploadFile(page, 'not-excel.txt')
  // Wait for error to appear (conditional render)
  const error = page.getByTestId('upload-error')
  await error.waitFor({ state: 'visible' })
  await expect(error).toContainText('Only Excel files')
  // App did not crash — "No files loaded" empty state still there or upload zone still visible
  await expect(page.locator('input[type="file"]')).toBeAttached()
})
```

### data-testid additions to FilePanel.tsx
```tsx
// Error paragraph — add data-testid
{error && (
  <p
    data-testid="upload-error"
    className="mx-3 mb-2 text-xs px-2 py-1.5 rounded-lg"
    style={{ color: '#e8445a', background: 'rgba(232,68,90,0.1)', border: '1px solid rgba(232,68,90,0.2)' }}
  >
    {error}
  </p>
)}

// File row — add data-testid
<div
  data-testid="file-list-item"
  className="group relative flex items-center ..."
  ...
>

// Eye button — add data-testid
<button
  data-testid="eye-toggle"
  className="rounded p-0.5"
  ...
>

// Sheet row — add data-testid
<div
  data-testid="sheet-list-item"
  key={sheet.sheetName}
  ...
>
```

### data-testid additions to GraphView.tsx
```tsx
// SheetNode — all three branches: named range, file node, regular sheet
// Regular sheet branch (the main return):
<div
  data-testid="sheet-node"
  style={containerStyle}
  ...
>

// FilePanel detail panel wrapper:
<div data-testid="detail-panel" style={panelStyle}>
  <div style={{ ... }}>
    <span data-testid="detail-panel-title" style={{ ... }}>
      {isMulti ? ... : node ? ... : 'References'}
    </span>

// Workload section:
<div data-testid="workload-metrics" style={{ display: 'grid', ... }}>

// Layout buttons in Toolbar:
<button
  key={mode}
  data-testid={`layout-${mode}`}  // layout-graph, layout-grouped, layout-overview
  ...
>

// Edge filter buttons in EdgeKindFilterBar:
<button
  key={kind}
  data-testid={`edge-filter-${kind}`}  // edge-filter-internal, edge-filter-external, etc.
  ...
>

// Focus panel:
<div data-testid="focus-panel" style={{ position: 'absolute', ... }}>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `webServer.port` | `webServer.url` | Playwright 1.57+ (port deprecated) | Already using `url` — no change needed |
| `page.waitForSelector()` | `locator.waitFor()` | Playwright 1.25+ | Use `locator.waitFor()` — already correct pattern |
| `page.$()` / `page.$$()` | `page.locator()` | Playwright 1.14+ | Use `locator()` API exclusively |
| `page.click(selector)` | `page.locator(selector).click()` | Playwright 1.14+ | Use locator-based API |

**Deprecated/outdated in this project's context:**
- `tests/helpers/upload.ts` stub: superseded by `tests/e2e/helpers.ts` — the Phase 1 stub targeted `input[type="file"]` correctly but lives in the wrong directory for E2E imports.
- Fixed timeouts: The smoke test uses no fixed timeouts (correct). Phase 4 tests must not introduce any.

---

## Open Questions

1. **Edge click reliability for E2E-12**
   - What we know: `WeightedEdge` renders a `BaseEdge` (SVG `<path>`) plus an optional label `<div>` when `refCount > 1`. The label div has `pointerEvents: 'all'`.
   - What's unclear: Whether clicking the SVG path directly works in Playwright with RF 12, or whether only the label div is reliably clickable.
   - Recommendation: For E2E-12, use `external-ref.xlsx` which likely has edges with `refCount > 1` (multiple references). Target the edge label badge div. Alternatively, add `data-testid` to the `BaseEdge` SVG wrapper using RF's `interactionWidth` approach or add a transparent hit-area div. Test this first; fall back to label-only approach if SVG click is unreliable.

2. **Focus mode activation via DetailPanel vs. direct node double-click**
   - What we know: Focus mode is triggered via the "Focus" button in `DetailPanel`, which only appears after a node is selected. There's no node double-click shortcut.
   - What's unclear: Whether `click({ force: true })` is needed for RF node clicks consistently.
   - Recommendation: Test with `click()` first; add `{ force: true }` only if plain click fails. Document which approach worked.

3. **Overview mode fixture node counts**
   - What we know: `external-ref.xlsx` is used for E2E-05. In Overview mode it shows one node per workbook. We don't know exact sheet count of this fixture.
   - What's unclear: Exact `graphCount` vs `overviewCount` difference.
   - Recommendation: Assert `overviewCount < graphCount` rather than exact numbers, OR check that count equals number of uploaded workbooks (1 for single file upload). For E2E-05, uploading one multi-sheet workbook guarantees `overviewCount === 1 && graphCount > 1`.

---

## Sources

### Primary (HIGH confidence)
- Playwright 1.58.2 installed in project — version confirmed via `node_modules/@playwright/test/package.json`
- `C:/Users/chase/projects/tangle/playwright.config.ts` — full config reviewed
- `C:/Users/chase/projects/tangle/src/components/FilePanel/FilePanel.tsx` — full source reviewed; no existing `data-testid` attributes; hidden `input[type="file"]` confirmed in DOM
- `C:/Users/chase/projects/tangle/src/components/Graph/GraphView.tsx` — full source reviewed; `SheetNode`, `DetailPanel`, `Toolbar`, `EdgeKindFilterBar` all reviewed for testability
- `C:/Users/chase/projects/tangle/tests/e2e/smoke.spec.ts` — existing smoke test reviewed
- `C:/Users/chase/projects/tangle/tests/helpers/upload.ts` — Phase 1 stub reviewed
- `C:/Users/chase/projects/tangle/tests/fixtures/index.ts` — fixture paths confirmed

### Secondary (MEDIUM confidence)
- Playwright docs — `setInputFiles()` accepts string array for multi-file: consistent with Playwright 1.x API behavior observed in codebase
- React Flow v12 (@xyflow/react 12.10.1) — pointer-events behavior and click interception: inferred from source code + known RF architecture; `force: true` workaround is a documented community pattern

### Tertiary (LOW confidence)
- Edge SVG click reliability in Playwright + React Flow: based on RF architecture knowledge; needs empirical verification during Wave 1 of plan

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Playwright 1.58.2 already installed and verified; config confirmed correct
- Architecture: HIGH — source code fully reviewed; all components and their DOM structure are known
- Pitfalls: HIGH for FilePanel pitfalls (source verified); MEDIUM for RF edge click behavior (architectural inference)

**Research date:** 2026-02-27
**Valid until:** 2026-03-29 (30 days — stable stack, no fast-moving dependencies)
