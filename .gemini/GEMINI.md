# Tangle -- Gemini Instructions

## Goal
Web app for visualizing references within and between Excel files. Users upload .xlsx files and see an interactive node graph of all sheet-to-sheet and external file references.

## Stack
- React + TypeScript (Vite)
- Tailwind CSS
- SheetJS (xlsx) for client-side Excel parsing
- React Flow for interactive graph visualization
- Tauri for desktop builds (Windows installer)
- Frontend-only SPA -- no backend server

## GSD State
This project uses GSD. Read `.planning/.continue-here.md` for current state.
See `.planning/ROADMAP.md` for milestone/phase progress.

## Commands
```bash
npm install       # Install dependencies
npm run dev       # Vite dev server
npm run build     # Production build
npm run lint      # ESLint
```

## Key Files
- `src/lib/parser.ts` -- Excel parsing, extracts references from formulas
- `src/lib/graph.ts` -- Builds node/edge data from parsed references
- `src/components/FilePanel/` -- File upload and listing
- `src/components/Graph/` -- React Flow interactive graph
- `src/types.ts` -- Shared TypeScript types
- `.github/workflows/ci.yml` -- Single CI workflow (never create additional workflows)

## CI Rules
- Installer filenames must be stable (`Tangle-Setup.exe`)
- Never use `GITHUB_ACTIONS` for Vite base path -- use `VITE_PAGES=true`
- `package.json` is the single source of truth for version
