# Contributing to Tangle

Thank you for taking the time to contribute! This guide covers everything you need to get a local development environment running, write and run tests, and submit a pull request.

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Local setup](#local-setup)
3. [Scripts](#scripts)
4. [Project layout](#project-layout)
5. [Testing](#testing)
6. [Code style](#code-style)
7. [Submitting a pull request](#submitting-a-pull-request)
8. [Test fixtures](#test-fixtures)

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS (matches CI) |
| npm | bundled with Node 20 |
| Rust + Cargo | Only required for the Tauri desktop build |

---

## Local setup

```bash
git clone https://github.com/bizbrf/tangle.git
cd tangle
npm ci          # install exact locked dependencies
npm run dev     # start the Vite dev server on http://localhost:5173
```

For the Tauri desktop app (optional):

```bash
npm run tauri:dev
```

---

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start the Vite development server |
| `npm run build` | TypeScript type-check + Vite production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across all TypeScript files |
| `npm test` | Run Vitest unit tests (single pass) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Vitest with V8 coverage report |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run fixtures:generate` | Regenerate the binary test fixtures |
| `npm run tauri:build` | Build the Tauri desktop installer |

---

## Project layout

```
src/
  App.tsx                   Root component — wires FilePanel ↔ GraphView
  types.ts                  Shared TypeScript interfaces and enums
  lib/
    identity.ts             Canonical ID / normalization helpers (normalizeWorkbookName, makeSheetId, …)
    filenameSanitizer.ts    Filename sanitization + collision resolution
    graph.ts                Graph data model, layout algorithms, buildGraph()
    parser.ts               Excel workbook parsing (SheetJS wrapper)
    resolver.ts             Reference resolution utilities
  components/
    FilePanel/              Sidebar: file upload, file list, expand/collapse
    Graph/
      GraphView.tsx         Main ReactFlow canvas + orchestration
      hooks/
        useUrlGraphState.ts URL-persisted graph control state
        useFocusNeighborhood.ts  Focus mode BFS traversal
      Toolbar.tsx           View/direction/grouping toolbar
      DetailPanel.tsx       Right-side reference inspector panel
      SheetNode.tsx         Custom node renderer
      ClusterNode.tsx       Workbook cluster bounding box
      WeightedEdge.tsx      Custom edge renderer
      EdgeKindFilterBar.tsx Edge type filter controls
      Legend.tsx            Edge colour legend
      edge-helpers.ts       Edge colour / width utilities
      constants.ts          Design-token constants (colours, sizes)
    ui/
      TangleLogo.tsx        Logo component

tests/
  unit/                     Vitest unit tests
  e2e/                      Playwright browser tests
  fixtures/                 Binary Excel fixtures + generator script

docs/
  architecture.md           Architecture overview and data-flow diagrams
  system-design-review.md   Design review notes and improvement recommendations
```

---

## Testing

### Unit tests

```bash
npm test                          # run all unit tests once
npm run test:watch                # watch mode for iterative development
npm run test:coverage             # generate a coverage report
```

Unit tests live in `tests/unit/` and use **Vitest** with **jsdom**. Each file mirrors a `src/lib/` module.

### End-to-end tests

```bash
npm run test:e2e                             # all browsers
npx playwright test --project=chromium      # Chromium only (fastest)
npx playwright test --project=firefox       # Firefox
npx playwright test --project=webkit        # Safari (WebKit)
```

E2E tests live in `tests/e2e/` and use **Playwright**. Test fixtures (`.xlsx` files) live in `tests/fixtures/`.

### Test fixtures

The binary fixtures are checked in to the repository. If you need to regenerate them (e.g. to add a new fixture):

```bash
npm run fixtures:generate
```

The generator script lives at `tests/fixtures/generate.ts`.

---

## Code style

- **ESLint** (`npm run lint`) enforces the project rules. All lint warnings are treated as errors in CI.
- **TypeScript** strict mode is enabled. Run `npx tsc -b --noEmit` to type-check without building.
- **Husky + lint-staged** run ESLint automatically on every `git commit` (only on staged files).
- There are no automatic formatters (e.g. Prettier) configured — match the style of the surrounding code.

Key conventions:

- Use named exports for React components (no default component exports except `App`).
- Prefer small, focused hooks over large monolithic components.
- New domain identifiers (node IDs, edge IDs, normalization) should go through `src/lib/identity.ts`.
- Typed errors: throw `ParseError` (from `src/types.ts`) from parsing code rather than generic `Error`.

---

## Submitting a pull request

1. Fork the repository and create a branch from `main`.
2. Make your changes and add or update tests as needed.
3. Ensure `npm test`, `npm run lint`, and `npx tsc -b --noEmit` all pass locally.
4. Open a pull request against `main` with a clear description of what changed and why.
5. CI will run build, lint, unit tests, and Playwright E2E tests automatically.

We follow the [Conventional Commits](https://www.conventionalcommits.org/) format for commit messages, though it is not strictly enforced.
