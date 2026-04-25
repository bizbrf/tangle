# Changelog

All notable changes to Tangle will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.1] - 2026-04-25

### Added

- **Dense theme chrome** — the design-handoff details that didn't make v2.0.0:
  - **Ruler gutter strips** on the canvas top + left edges, mono-spaced tick labels at 100px intervals.
  - **Bottom hotkey strip** pinned to the canvas bottom listing the active keyboard shortcuts (`G`/`L`/`F`/`Ctrl+F`/`Shift+click`/`Ctrl+\`/`Esc`).
  - Both render only when `theme.chrome.gutter` / `theme.chrome.statusStrip` are true (Dense only); Refined and Cinematic are unchanged.

### Fixed

- E2E-31 / E2E-32 multi-select tests flaked on Linux runners because separate `keyboard.down('Shift')` / `keyboard.up()` actions could race the click. Now uses Playwright's `modifiers: ['Shift']` for atomic shift-click.
- Dense theme's `MiniMap` and `Legend` overlays now lift above the bottom hotkey strip instead of overlapping it.

## [2.0.0] - 2026-04-25

### Added — Theme system

- Three swappable visual themes with `Ctrl+\` (or `Cmd+\`) to cycle, plus a moon-icon switcher in the toolbar:
  - **Refined** — original polished dark theme, curved edges, dot grid (default).
  - **Dense** — mono-forward typography, sharp corners, orthogonal edges, denser line grid for power users.
  - **Cinematic** — full-bleed starfield with floating glass panels, blue-shifted palette, gentle pulse on the selected node (respects `prefers-reduced-motion`).
- Theme choice persists across reloads via `localStorage` (`tangle.theme`).
- Per-theme CSS custom properties on `:root[data-theme="..."]` — every color is a token; adding a fourth theme is a CSS-only change.
- `alpha(color, pct)` helper using `color-mix(in srgb, …)` so transparency math works on top of CSS variables.

### Added — Graph features (since 1.2.0)

- **PNG export** — toolbar button writes a timestamped, 2× resolution image of the current viewport.
- **Node search** — `Ctrl+F` or `/` to fuzzy-search by sheet, workbook, named range, or table; matched nodes stay vivid while non-matches dim.
- **Circular reference warnings** — toolbar badge surfaces detected cycles; click a cycle to fit-view its nodes and highlight the loop.
- **Stats panel** — workbook/sheet/formula counts, edge breakdown by kind, busiest sheets.
- **Edge hover tooltips** — source → target, edge kind, ref count, first cell ranges, first formula.
- **Click-to-navigate** — clicking sheet names in the detail panel pans to and selects that node.
- **IndexedDB persistence** — uploaded files survive page refresh; "Clear all" button; restored banner on revisit.
- **Path tracing** — Shift-select two nodes and click "Show paths" to highlight every route between them up to depth 5.
- **Acme Corp test fixtures** — 7-workbook financial model with realistic corporate patterns (22 sheets, named ranges, tables, cross-file refs).

### Fixed (since 1.2.0)

- Quoted sheet names with apostrophes — formula regex handled escaped quotes incorrectly in 4 places.
- String-literal false positives — formulas like `="A1"` were being parsed as references; `maskStringLiterals()` now strips literals before regex passes.
- Named-range shadowing — references to a name shadowing a function were misclassified.
- Radial layout infinite loop on cyclic graphs — BFS now visits each node once.
- Hex-alpha appended to CSS var strings (`${var}33`) — produced silently invalid CSS, hiding hover/path/cycle glow effects on three components.
- Side effect inside `setWorkbooks` updater — `removeFile` was called twice under React 19 StrictMode; now scheduled outside the pure updater.
- IndexedDB errors swallowed — `saveFile`/`loadAllFiles`/`removeFile`/`clearAllFiles` now log via `console.warn` and surface a "Could not restore previous files" banner when restore fails.
- Batch upload no longer drops the entire batch when one file fails to parse; failed file names are reported.

### Changed

- `edgeAccentColor()` and `edgeRestColor()` now return CSS-var references instead of literal hex/rgba — edges automatically retint when the theme changes.
- `WeightedEdge` and `SheetNode` are now `React.memo`-wrapped so unaffected items skip re-render on selection events.
- `SheetNode` collapsed from four near-identical render branches into a single shell driven by a `NODE_ACCENT` lookup.
- `Theme` interface trimmed to fields actually consumed at runtime (`canvas`, `edge.type`); typography, node radii, and chrome behaviour live in CSS variables now.
- `selectedNodeIds` state collapsed — derived from `selectedNodes` via memo so the three representations of selection stay in sync.
- CI workflows consolidated into a single `ci.yml` with `needs:` dependencies (no more cross-workflow artifact passing).
- 339 unit tests + 4 new theme E2E tests (theme cycle, hotkey, persistence, reduced-motion).

### Breaking

- `edgeRestColor()` returns a `color-mix(...)` string instead of `rgba(...)`. Visual output is equivalent, but downstream consumers that match on the `rgba(` prefix must update.
- `Theme` interface no longer carries `font`, `node`, `chrome`, or `edge.animated` fields. Forks that read those should migrate to CSS variables on `:root[data-theme="..."]`.

### Migration notes

If you have a fork that relied on the v1 color helpers:

- `${C.accent}33` style hex-alpha concatenation no longer works — `C.*` are CSS-var strings. Use `alpha(C.accent, 20)`.
- Color tokens are defined in `src/components/Graph/constants.ts`; per-theme palettes are in `src/index.css`.

## [1.2.0] - 2026-03-06

### Added

- Graph Reorganizer for on-demand deterministic layout reflow
- External file naming integrity with sanitization, collision handling, and display/storage separation
- Graph Controls redesign with improved grouping reliability
- Resizable left panel for file list
- Table reference tests (PARSE-12, PARSE-13, GRAPH-09)
- Comprehensive unit test pass covering graph helpers, edge helpers, and parser branches
- E2E modernization with cross-browser coverage, failure artifacts, and new test scenarios
- CONTRIBUTING.md with contributor guide
- GitHub issue and PR templates
- Architecture documentation
- SECURITY.md with data flow diagrams
- CHANGELOG.md backfilled from v1.0.0

### Changed

- README overhauled with live demo link, download links, and usage options
- CI steps reordered for faster failure feedback
- GraphView.tsx refactored into focused modules

### Fixed

- Structured formula reference resolution, cycle detection, and rename support
- Parser regex for hyphens and apostrophes in sheet names
- Edge ID safety for special characters
- Button accessibility attributes

## [1.1.0] - 2026-02-28

### Added

- CI/CD pipeline with GitHub Actions (lint, typecheck, unit tests, E2E tests, build)
- GitHub Pages auto-deployment of live demo
- Tauri desktop installer build (Windows .exe and .msi) attached to GitHub releases
- Auto-versioning: package.json version → git tag → GitHub release
- CI badge in README

### Changed

- README rewritten as a full user tutorial

### Fixed

- Use `VITE_PAGES` env var for base path instead of `GITHUB_ACTIONS` (which broke Tauri builds)
- Stable installer filenames for permanent download links
- Release created as draft until installer is attached

## [1.0.2] - 2026-02-27

### Added

- Vitest test infrastructure with coverage reporting
- Playwright E2E test suite (upload, interaction, detail panel, error handling)
- Parser unit tests (PARSE-01 through PARSE-11)
- Graph unit tests (GRAPH-01 through GRAPH-07)
- Excel test fixture generator and seven `.xlsx` fixture files
- Tables toggle with intermediate table nodes in graph
- `ExcelTable` type and `extractTables` parser

## [1.0.1] - 2026-02-25

### Fixed

- Overview nodes showing sheet count instead of file name
- README links updated for new GitHub username

## [1.0.0] - 2026-02-25

### Added

- Excel (`.xlsx`) file parsing with SheetJS
- Cross-sheet reference detection (`Sheet!A1`, `'Sheet Name'!A1:B2`)
- External file reference detection (`[Workbook.xlsx]Sheet!A1`)
- Named range and named range node toggle
- Interactive graph visualization with React Flow
- Drag-and-drop and click-to-browse file upload
- Three layout modes (left-right, top-bottom, grouped)
- File-level overview layout mode
- Edge kind filter with toggles and cross-file preset
- Highlight file in graph with locate button
- Per-file collapse to single node
- Hide/show file toggle
- Focus mode with hop-depth slider for neighborhood filtering
- Upstream/downstream direction toggle for focus mode
- Cluster view with workbook bounding boxes
- Detail panel for node and edge inspection
- Tauri v2 desktop app (Windows)

[1.2.0]: https://github.com/bizbrf/tangle/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/bizbrf/tangle/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/bizbrf/tangle/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/bizbrf/tangle/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/bizbrf/tangle/releases/tag/v1.0.0
