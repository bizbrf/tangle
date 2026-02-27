# Phase 4: E2E Tests - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Playwright E2E tests covering the full upload-to-graph pipeline and all interactive features in a real browser. Tests verify that the UI reacts correctly to user actions — uploading files, switching layouts, filtering edges, hiding files, opening the detail panel, and handling upload errors. Implementation of new UI features is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Selector strategy
- Use `data-testid` attributes throughout — stable selectors that survive CSS/DOM changes
- Full coverage: add `data-testid` to sidebar file items, sheet items, eye icon, layout mode selector, edge filter toggles, graph canvas nodes, graph edges, detail panel header, workload metrics, error messages
- `SheetNode` custom component: add `data-testid="sheet-node"` to its root div; Playwright targets all nodes via `getByTestId('sheet-node')`
- Error display: Claude should inspect how errors are currently rendered in source and add `data-testid="upload-error"` there

### Test file structure
- 4 spec files grouped by feature area in `tests/e2e/`:
  - `upload.spec.ts` — E2E-01 through E2E-04
  - `interactions.spec.ts` — E2E-05 through E2E-09
  - `detail-panel.spec.ts` — E2E-10 through E2E-12
  - `errors.spec.ts` — E2E-13 through E2E-15
- Shared helper module: `tests/e2e/helpers.ts` with reusable functions (e.g., `uploadFile(page, path)`, `waitForNodes(page)`)
- No smoke test in Phase 4 — Phase 1 already covers app load

### State isolation
- Full page reload before each test (`beforeEach` with `page.goto()`) — clean state, no test interdependencies
- Each test uploads what it needs via `setInputFiles()` — no shared upload state even within a spec file
- No assertion required to verify clean state — trust that React state resets on reload
- After upload, wait for `data-testid="sheet-node"` to appear (not a fixed timeout)

### Fixture allocation
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

</decisions>

<specifics>
## Specific Ideas

- No specific references or "I want it like X" moments — open to standard Playwright patterns

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-e2e-tests*
*Context gathered: 2026-02-27*
