# Technology Stack

**Analysis Date:** 2026-02-27

## Languages

**Primary:**
- TypeScript 5.9.3 - Frontend React application and build configuration
- Rust 1.77.2 - Tauri desktop application wrapper

**Secondary:**
- JavaScript (JSX/TSX) - React component syntax via Vite

## Runtime

**Environment:**
- Node.js 18+ (development and Tauri build)
- Rust toolchain for native desktop build

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.2.0 - UI library with functional components and hooks
- TypeScript - Type safety and strict mode enabled
- Vite 7.3.1 - Build tool and dev server on port 5173

**Graph Visualization:**
- @xyflow/react 12.10.1 - Interactive node/edge graph canvas with zoom, pan, selection
- @dagrejs/dagre 2.0.4 - Graph layout engine (hierarchical, grid, clustered layouts)

**Styling:**
- Tailwind CSS 4.2.1 - Utility-first CSS framework
- @tailwindcss/vite 4.2.1 - Vite plugin for Tailwind integration

**Desktop:**
- Tauri 2.10.0 - Native desktop wrapper (Windows executable via WebView2)
- @tauri-apps/cli 2.10.0 - CLI for building/running Tauri app
- tauri-plugin-log 2 - Logging plugin for debug builds

**Testing/Quality:**
- ESLint 9.39.1 - Linting with flat config
- @eslint/js 9.39.1 - ESLint recommended rules
- typescript-eslint 8.48.0 - TypeScript linting rules
- eslint-plugin-react-hooks 7.0.1 - React hooks linting
- eslint-plugin-react-refresh 0.4.24 - Fast refresh linting
- Husky 9.1.7 - Git hooks framework
- lint-staged 16.2.7 - Run linters on staged files before commit

**Excel Parsing:**
- xlsx (SheetJS) 0.18.5 - Client-side XLSX parsing with formula extraction and external link resolution

## Key Dependencies

**Critical:**
- react 19.2.0 - Core UI framework
- react-dom 19.2.0 - React DOM rendering
- @xyflow/react 12.10.1 - Graph visualization (interdependent with dagre for layout)
- xlsx 0.18.5 - Excel file parsing; handles .xlsx, .xls, .xlsm, .xlsb formats
- @dagrejs/dagre 2.0.4 - Hierarchical graph layout algorithm

**Infrastructure:**
- tailwindcss 4.2.1 - Styling engine
- typescript ~5.9.3 - Type compilation
- vite 7.3.1 - Build and dev server

## Configuration

**Environment:**
- No environment variables required - fully client-side application
- No `.env` files in use
- Configuration is purely compile-time (TypeScript config, Vite config)

**Build:**
- `vite.config.ts` - Vite configuration with React and Tailwind plugins
- `tsconfig.json` + `tsconfig.app.json` - TypeScript compiler options with strict mode enabled
- `eslint.config.js` - ESLint configuration with TypeScript, React, and React Hooks rules
- `src-tauri/Cargo.toml` - Rust dependency manifest for Tauri desktop app
- `src-tauri/tauri.conf.json` - Tauri app configuration (window size, build targets, icon paths)

**Development:**
- `package.json` lint-staged configuration - runs ESLint with zero warnings before commits
- Husky git hooks - enforces linting on staged files

## Platform Requirements

**Development:**
- Node.js 18+ (for npm and Vite dev server)
- Rust 1.77.2+ (only for building native Tauri executable)
- Windows 10+ for Tauri native development
- MSVC or gcc toolchain (handled by rustup)

**Production:**
- Windows 10+ (released as .exe via NSIS installer or portable)
- WebView2 runtime (typically pre-installed on modern Windows)
- No external server or backend required - all parsing and rendering client-side

## Build Output

**Web Mode:**
- `dist/` directory
- Single-page app bundle (~790kb gzipped)
- Served from `http://localhost:5173` in dev

**Desktop Mode:**
- `src-tauri/target/release/bundle/nsis/` - Windows NSIS installer
- `src-tauri/target/release/` - Standalone executable
- Tauri dev mode: native window spawned from `npm run tauri:dev`

## Notable Technical Decisions

**Client-Side Only:**
- No backend server required
- Excel parsing happens in-browser using xlsx library
- All graph computation and rendering is local
- Supports external file references without requiring uploaded files

**TypeScript Strict Mode:**
- `strict: true` enabled in `tsconfig.app.json`
- No `any` types allowed (except where absolutely necessary)
- All unused locals and parameters flagged

**CSS Framework:**
- Tailwind CSS v4 (not v3) for latest features
- Vite plugin handles JIT compilation and optimization
- Custom color tokens defined in JavaScript (design tokens in GraphView component)

**Graph Layout:**
- Dagre provides hierarchical layout for "Graph" mode
- Custom column-based layout for "Grouped" mode (clusters per workbook)
- Manual "Overview" mode (one node per file)

---

*Stack analysis: 2026-02-27*
