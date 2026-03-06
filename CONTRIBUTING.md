# Contributing to Tangle

Thank you for your interest in contributing! This guide covers everything you need to get started.

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Development setup](#development-setup)
3. [Available scripts](#available-scripts)
4. [Project structure](#project-structure)
5. [Running tests](#running-tests)
6. [Code style](#code-style)
7. [Commit and branch conventions](#commit-and-branch-conventions)
8. [Submitting a pull request](#submitting-a-pull-request)

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Node.js | 18+ | Required for the web app |
| npm | bundled with Node | Used for package management |
| Rust + Cargo | stable | Required **only** for the Tauri desktop build |
| Git | any recent | Standard source control |

Install Rust via [rustup.rs](https://rustup.rs/) if you plan to work on the desktop app.

---

## Development setup

```bash
git clone https://github.com/bizbrf/tangle.git
cd tangle
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The dev server supports hot module replacement.

---

## Available scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check + production build (`dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint across all TypeScript files |
| `npm test` | Run unit tests with Vitest (single run) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run unit tests with coverage report |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run tauri:dev` | Start Tauri dev app (requires Rust) |
| `npm run tauri:build` | Build Tauri desktop installer (requires Rust) |

---

## Project structure

```
src/
  App.tsx                       # Root layout component
  main.tsx                      # Entry point
  index.css                     # Global styles (Tailwind)
  types.ts                      # Shared TypeScript interfaces
  lib/
    parser.ts                   # Excel parsing — sheets, tables, references, formulas
    graph.ts                    # Graph construction and Dagre layout
    resolver.ts                 # Formula reference resolution, cycle detection
    filenameSanitizer.ts        # Filename sanitization and collision resolution
  components/
    FilePanel/                  # Sidebar: upload zone, file list, sheet list
    Graph/                      # Graph canvas, toolbar, nodes, edges, detail panel
    ui/                         # Shared UI primitives (logo, icons)
tests/
  unit/                         # Vitest unit tests
  e2e/                          # Playwright E2E tests
  fixtures/                     # Test .xlsx files and generator script
.github/
  workflows/
    ci.yml                      # Single CI workflow: build, test, release, deploy
```

---

## Running tests

### Unit tests

```bash
npm test
```

Unit tests live in `tests/unit/` and end in `.test.ts`. They use Vitest with the `jsdom` environment for component-adjacent logic and the `node` environment for pure library modules.

### E2E tests

```bash
npm run test:e2e
```

E2E tests live in `tests/e2e/` and end in `.spec.ts`. They use Playwright and require a running dev server (the `webServer` option in `playwright.config.ts` starts one automatically when `VITE_PAGES` is not set).

To run only Chromium (faster during development):

```bash
npx playwright test --project=chromium
```

### Linting

```bash
npm run lint
```

ESLint is configured with `typescript-eslint` and `eslint-plugin-react-hooks`. Lint runs automatically on staged files via Husky + lint-staged before each commit.

---

## Code style

- **TypeScript strict mode** — no `any` without a comment explaining why.
- **Named exports** — avoid default exports.
- **Functional React components only** — no class components.
- **`const` over `let`**, never `var`.
- **Tailwind CSS utility classes** — no CSS modules or styled-components.
- **`src/lib/` is framework-free** — no React imports, no DOM access in `src/lib/`.
- **`src/types.ts` is the single source of truth** for shared interfaces. If you add a new shared type, put it there.
- **All interactive elements must have ARIA labels** and support keyboard navigation.

---

## Commit and branch conventions

### Branch names

| Prefix | Use for |
|--------|---------|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `chore/` | Dependency bumps, tooling, config changes |
| `docs/` | Documentation only |
| `test/` | New or updated tests only |

Example: `feature/web-worker-parsing`, `fix/cross-file-edge-color`, `docs/add-contributing`

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary>

[optional body]

[optional footer]
```

| Type | Use for |
|------|---------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `test` | Adding or updating tests |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore` | Tooling, dependencies, config |
| `perf` | Performance improvement |

Examples:
```
feat(graph): add hop-depth slider to focus mode
fix(parser): handle empty sheet names in external references
docs: add CONTRIBUTING guide
test(e2e): add smoke test for file upload
```

---

## Submitting a pull request

1. **Fork** the repository and create your branch from `main`.
2. **Make your changes.** Keep commits small and focused.
3. **Write or update tests** for any new or changed behavior.
4. **Run the full check suite** before opening the PR:

   ```bash
   npm run lint
   npm test
   npm run build
   npm run test:e2e --project=chromium   # optional but encouraged
   ```

5. **Open a PR** against `main` and fill in the PR template.
6. **Address review feedback** promptly. Reviewers may request changes or ask questions.

PRs must pass CI (lint + unit tests + build + E2E) before merging.

---

## Architecture notes

See [docs/architecture.md](docs/architecture.md) for a deeper explanation of how the parsing pipeline, graph engine, and React layer interact.

---

## Security

All Excel data is processed **locally in your browser** — nothing is sent to a server. See [SECURITY.md](SECURITY.md) for a full data-flow review.

---

## License

By contributing you agree that your changes will be licensed under the project's [MIT License](LICENSE).
