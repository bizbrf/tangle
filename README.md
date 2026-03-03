<p align="center">
  <img src="src-tauri/icons/icon.png" alt="Tangle" width="128" />
</p>

<h1 align="center">Tangle</h1>

<p align="center">
  Visualize references within and between Excel files as an interactive node graph.
</p>

<p align="center">
  <a href="https://github.com/bizbrf/tangle/releases/latest/download/Tangle-Setup.exe">Download for Windows</a>
</p>

<p align="center">
  <a href="https://github.com/bizbrf/tangle/actions/workflows/ci.yml">
    <img src="https://github.com/bizbrf/tangle/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
</p>

<p align="center">
  <a href="https://bizbrf.github.io/tangle"><img src="https://img.shields.io/badge/Live%20Demo-bizbrf.github.io%2Ftangle-e8445a?style=flat-square" alt="Live Demo" /></a>
</p>

---

## What it does

Drop `.xlsx` files into Tangle and instantly see how sheets reference each other. Every cross-sheet and cross-file formula becomes a visible edge in an interactive graph — making it easy to understand complex spreadsheet dependencies at a glance.

- **Cross-sheet references** — `Sheet1!A1`, `'Sheet Name'!A1:B2`
- **Cross-file references** — `[Workbook.xlsx]Sheet!A1`, `'[File Name.xlsx]Sheet'!A1`
- **No data leaves your machine** — everything is parsed and rendered client-side
 test
## Quick start

1. Open **[bizbrf.github.io/tangle](https://bizbrf.github.io/tangle)** in your browser.
2. Drag one or more `.xlsx` files onto the left panel — or click the upload zone to browse.
3. The graph builds instantly. Every sheet becomes a node; every cross-sheet or cross-file formula becomes an edge.
4. Click any node or edge to open the detail panel and inspect formulas, cell references, and workload metrics.

## Using the graph

### Layout modes

Switch between three layouts using the toolbar at the top of the graph canvas:

- **Graph** — free-form dagre layout with all sheets as individual nodes. Good for exploring a single workbook or a small multi-file set.
- **Grouped** — sheets are clustered by workbook with a bounding box drawn around each file. Useful when you have multiple workbooks and want to see intra-file structure alongside inter-file connections.
- **Overview** — one node per uploaded file; only cross-file edges are shown. Use this when you have many sheets and want the high-level picture first.

### Edge colors

Each edge is color-coded by the kind of reference it represents:

| Color | Meaning |
|-------|---------|
| Red / coral | Cross-sheet reference within the same workbook |
| Indigo / blue-purple | Cross-file reference between two uploaded workbooks |
| Amber / orange | Reference to an external file not uploaded |
| Emerald / green | Named range reference |
| Violet / purple | Excel table reference |

Edge thickness scales with reference count — a thicker edge means more formulas share that connection. A number badge on an edge shows the exact count when greater than 1.

### Focus mode

Focus mode narrows the graph to a single node's neighborhood so you can trace dependencies without distraction.

1. Click any node to select it, then open the detail panel (it appears on the right).
2. Click the **Focus** button in the detail panel to enter focus mode centered on that node.
3. Use the **hop-depth slider** (1–3) to expand how many hops away from the selected node remain visible.
4. Use the **direction toggle** to control which connections are shown:
   - **Upstream** — what does this sheet depend on?
   - **Downstream** — what depends on this sheet?
   - **Both** — show the full neighborhood in both directions
5. All other nodes and edges dim; only the neighborhood stays highlighted.
6. Click the canvas background or press Escape to exit focus mode.

### Filtering edges

Use the Edge Kind filter controls (in the graph toolbar) to show or hide specific edge types:

- Toggle each color (red / indigo / amber / emerald / violet) independently to hide edge kinds you don't care about.
- The **Cross-File Only** preset hides all within-workbook edges, leaving only the inter-file connections — useful when you have many sheets and want the high-level cross-file picture.

### File panel controls

The left panel lists every uploaded file. Click the chevron next to a file name to expand the sheet list; each sheet shows a reference count badge.

Hover over any file row to reveal three icon buttons:

- **Eye** — hide or show that file's nodes in the graph without removing the file. Use this to temporarily declutter the canvas.
- **Crosshair** — pan and zoom the graph canvas to that file's nodes so you can locate them instantly.
- **X** — remove the file entirely from the session.

## Sheet detail panel

Clicking any node opens a detail panel on the right side of the canvas. The panel shows:

- **Workload grid** — total formulas, within-sheet refs, cross-sheet refs, and cross-file refs for that sheet.
- **Edge kind breakdown** — count of references per category (cross-sheet, cross-file, external, named range, table).
- **Formula list** — the actual cell addresses and formula text for every reference on the selected edge (click an edge to populate this).
- **Quick actions** — **Focus** to enter focus mode centered on this node, and **Hide** to remove the node from view without deleting the file.

The `f(x)` badge on a node indicates it contains formulas.

## Install

### Windows (recommended)

Download the latest installer — no dependencies required.

- **[Tangle-Setup.exe](https://github.com/bizbrf/tangle/releases/latest/download/Tangle-Setup.exe)** — recommended (NSIS installer)
- **[Tangle-Setup.msi](https://github.com/bizbrf/tangle/releases/latest/download/Tangle-Setup.msi)** — MSI format

### Run from source

Requires Node.js 18+.

```bash
git clone https://github.com/bizbrf/tangle.git
cd tangle
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build the desktop app from source

Requires Node.js 18+ and [Rust](https://rustup.rs/).

```bash
npm run tauri:build
```

The installer will be at `src-tauri/target/release/bundle/nsis/`.

## Tech stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, TypeScript, Tailwind CSS v4 |
| Graph | React Flow (@xyflow/react v12), Dagre |
| Excel parsing | SheetJS (xlsx) — client-side only |
| Desktop | Tauri v2 (Rust + WebView2) |
| Build | Vite 7 |

## Project structure

```
src/
  components/
    FilePanel/    # Sidebar — file upload, file list, sheet list
    Graph/        # Graph canvas, detail panel, controls
    ui/           # Shared UI primitives
  lib/
    parser.ts     # Excel formula parsing and reference extraction
    graph.ts      # Node/edge graph construction and layout
    perf.ts       # Performance monitoring and graph quality metrics
  types.ts        # Shared TypeScript types
  App.tsx         # Root layout
src-tauri/        # Tauri (Rust) desktop wrapper
tests/
  unit/           # Unit tests
  e2e/            # End-to-end tests with Playwright
  perf/           # Performance tests and budgets
    harness.test.ts  # Performance test suite
    baseline.json    # Performance baselines
```

## Performance & Determinism

Tangle enforces performance budgets and deterministic behavior to ensure consistent and predictable graph layouts:

### Deterministic Layouts

All graph layouts use deterministic seeding to produce identical results across runs:

- Layout algorithms accept an optional `layoutSeed` parameter
- The same seed produces the same node positions (±1px tolerance)
- Seed is derived from graph structure hash when not explicitly provided
- Enables reproducible testing and reliable layout comparisons

### Performance Budgets

The following performance budgets are enforced in CI (baseline: mid-tier laptop):

| Operation | Budget (ms) | Description |
|-----------|-------------|-------------|
| Initial graph render (cold) | ≤ 600 | First layout @ 300 nodes / 600 edges |
| Initial graph render (warm) | ≤ 300 | Subsequent layouts |
| Reorganize action | ≤ 400 | Direction change or mode toggle |
| Grouping toggle | ≤ 350 | Switch between graph modes |
| Formula parsing (cold) | ≤ 600 | Initial workbook parse |

CI fails when budgets exceed tolerance (+15%).

### Graph Quality Metrics

Automated checks prevent layout regressions:

- **No node overlaps** — all nodes must be non-overlapping
- **Consistent edge crossings** — same seed produces same crossing count
- **Stable edge lengths** — average edge length variance tracked

### Running Performance Tests

```bash
# Run performance tests locally
npm run test:perf

# Run with verbose output
npm run test:perf -- --reporter=verbose

# Update baselines (after intentional improvements)
# Edit tests/perf/baseline.json with new measurements
```

### Debugging Performance

Enable performance logging in development:

```javascript
// In browser console or localStorage
localStorage.setItem('TANGLE_DEBUG_PERF', 'true');
```

Performance events are logged to the console:
- `perf:layout` — layout duration, node/edge counts, seed
- `perf:graph-quality` — overlap count, crossing count, edge length stats

## Security & data privacy

Tangle processes all Excel data locally — nothing is uploaded to a server. See
**[SECURITY.md](SECURITY.md)** for a full data security review including data
flow diagrams, dependency audit, and Tauri permission analysis.

## License

MIT
