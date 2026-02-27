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

---

## What it does

Drop `.xlsx` files into Tangle and instantly see how sheets reference each other. Every cross-sheet and cross-file formula becomes a visible edge in an interactive graph — making it easy to understand complex spreadsheet dependencies at a glance.

- **Cross-sheet references** — `Sheet1!A1`, `'Sheet Name'!A1:B2`
- **Cross-file references** — `[Workbook.xlsx]Sheet!A1`, `'[File Name.xlsx]Sheet'!A1`
- **No data leaves your machine** — everything is parsed and rendered client-side

## Features

- **Drag-and-drop upload** — add one or many `.xlsx` files at once
- **Three layout modes** — Graph (free-form dagre), Grouped (clustered by workbook), and Overview (one node per file)
- **Edge kind filtering** — toggle internal, cross-file, and external edges; "Cross-File Only" preset
- **Focus mode** — click any node, set hop depth (1-3), and filter to its neighborhood
- **Upstream/Downstream toggle** — directional BFS to trace dependencies or dependents
- **Hide/Show files** — eye toggle to temporarily remove a workbook's nodes from the graph
- **Locate file** — crosshair button pans and zooms to a file's nodes
- **Sheet workload metrics** — formula counts, within-sheet refs, cross-sheet refs, cross-file refs per sheet
- **Detail panel** — click any node or edge to see formulas, cell references, and workload breakdown
- **Formula badge** — f(x) indicator on nodes with formulas

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
  types.ts        # Shared TypeScript types
  App.tsx         # Root layout
src-tauri/        # Tauri (Rust) desktop wrapper
```

## License

MIT
