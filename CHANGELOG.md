# Changelog

All notable changes to Tangle will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
