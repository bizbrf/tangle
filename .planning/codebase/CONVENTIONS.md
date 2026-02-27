# Coding Conventions

**Analysis Date:** 2026-02-27

## Naming Patterns

**Files:**
- PascalCase for React components: `FilePanel.tsx`, `GraphView.tsx`, `TangleLogo.tsx`
- camelCase for utility/library files: `parser.ts`, `graph.ts`, `types.ts`
- index files use `index.css` for stylesheets, `main.tsx` for entry point

**Functions:**
- camelCase for all function names: `handleFiles()`, `extractReferences()`, `buildGraph()`
- Prefix event handlers with `handle`: `handleWorkbooksChange()`, `handleToggleHidden()`, `handleLocateFile()`
- Helper functions in components use camelCase: `toggleExpand()`, `removeWorkbook()`
- Icon components follow `Icon{Name}()` pattern: `IconUpload()`, `IconFile()`, `IconSheet()`, `IconChevron()`

**Variables:**
- camelCase for local variables and state: `workbooks`, `hiddenFiles`, `expandedSet`
- Set variables use Set type with descriptive names: `Set<string>` for collections like `hiddenFiles`, `expanded`
- Use `next` for computed state values in updaters: `const next = new Set(prev)` pattern

**Types:**
- PascalCase for interfaces and types: `WorkbookFile`, `ParsedSheet`, `SheetReference`, `NodeData`, `EdgeData`
- Type suffixes: `Props` for component props (`FilePanelProps`), `Data` for node/edge data (`NodeData`, `EdgeData`)
- Union types named with `Type` suffix or descriptive name: `EdgeKind`, `LayoutMode`

**Constants:**
- UPPERCASE_SNAKE_CASE for regex patterns and constants: `EXCEL_EXTENSIONS`, `CELL_RE`, `REF_WITH_CELL_RE`, `NODE_W`, `NODE_H`
- Design token object `C` for color constants in GraphView
- Single-letter constant `C` used as namespace for related values: `C.accent`, `C.accentDim`, `C.surface`

## Code Style

**Formatting:**
- Uses Prettier via `lint-staged` for automated formatting on commit
- File runs through ESLint with `eslint --max-warnings 0` (zero warnings policy)
- Line length target appears to be ~100 characters based on observed code formatting
- Indentation: 2 spaces (standard for TypeScript/React)

**Linting:**
- ESLint with TypeScript support: `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Flat config format in `eslint.config.js` using ESLint 9.x
- Extends: `@eslint/js`, `typescript-eslint`, `react-hooks`, `react-refresh`
- Ignores: `dist/` directory

**TypeScript Configuration:**
- Strict mode enabled in `tsconfig.app.json`
- `noUnusedLocals: true`, `noUnusedParameters: true` enforced
- `noFallthroughCasesInSwitch: true` for exhaustive switch handling
- `noUncheckedSideEffectImports: true` to catch unintended side effects
- Target: ES2022, Module: ESNext
- JSX: react-jsx (automatic JSX runtime)

## Import Organization

**Order:**
1. External libraries: `import { useState } from 'react'`, `import * as XLSX from 'xlsx'`
2. Local components: `import { FilePanel } from './components/FilePanel/FilePanel'`
3. Local utilities/lib: `import { buildGraph } from '../../lib/graph'`
4. Local types: `import type { WorkbookFile } from '../../types'`
5. Styles: `import '@xyflow/react/dist/style.css'`, `import './index.css'`

**Path Aliases:**
- No path aliases configured; uses relative paths exclusively: `'../../types'`, `'../lib/parser'`
- Imports use relative paths from the current file location

**Named Exports:**
- Functional components use named exports: `export function FilePanel(...)`, `export function TangleLogo(...)`
- Utilities exported as named exports: `export function parseWorkbook(...)`, `export function buildGraph(...)`
- Types/interfaces exported as named with `export interface`: `export interface WorkbookFile`
- Default exports used only for App.tsx (root component): `export default function App()`

## Error Handling

**Patterns:**
- Promise-based error handling in async functions using `try/catch` blocks
- Example in `parseWorkbook()`: `try { ... } catch (err) { reject(err); }`
- File reading errors: `reader.onerror = () => reject(new Error(...))` for FileReader API
- Component-level error state: `[error, setError]` for displaying error messages
- Silent error handling in event handlers: `async function handleFiles()` with catch calling `setError()`

**No error boundaries detected** — errors are handled at the component level via state.

## Logging

**Framework:** No logging library detected; uses native `console` if needed (not visible in source).

**Patterns:**
- No explicit console logging observed in production code
- Parser code relies on error propagation rather than logging
- Graph building uses early returns and condition checks rather than logging

## Comments

**When to Comment:**
- Divider-style comments for major sections: `// ── Icon helpers ──`, `// ── Component ─────`
- Inline comments for complex regex or logic: `// Extract from bracket notation if present`, `// Skip self-sheet references`
- Comments above functions for complex algorithms: Excel reference parsing with detailed explanation of cell-ref patterns
- Comments used sparingly; code is generally self-documenting through naming

**JSDoc/TSDoc:**
- Not consistently used; type annotations serve as documentation
- No @param/@returns/@throws annotations observed
- Interface definitions serve as implicit documentation through property names

## Function Design

**Size:** Functions are small and focused. Examples:
- `stripExcelExt()` — single line
- `edgeStrokeWidth()` — 1-2 lines
- `normWb()` — 5 lines
- `handleFiles()` — ~20 lines (longest reasonable size)
- Complex functions like `extractReferences()` broken into clear sections with comments

**Parameters:**
- Use destructuring for component props: `function FilePanel({ workbooks, onWorkbooksChange, ... }: FilePanelProps)`
- Use destructuring for object returns: `const { references, workload } = extractReferences(...)`
- Callback functions receive single argument when appropriate: `(prev) => { ... }` for setState updaters

**Return Values:**
- Explicit return types in function signatures: `function parseWorkbook(file: File, fileId: string): Promise<WorkbookFile>`
- Objects returned with clear structure: `{ references, workload }`, `{ nodes, edges }`
- Maps and Sets used for efficient lookups: `Map<string, string>`, `Set<string>`

## Module Design

**Exports:**
- Named exports for reusable functions and components
- Single default export only for root component (App.tsx)
- All types exported with `export interface` / `export type`

**Barrel Files:**
- Not used; components imported directly by full path
- Import pattern: `import { FilePanel } from './components/FilePanel/FilePanel'` (no index.ts re-exports)

**File Structure by Module:**
- `lib/parser.ts` — all parsing logic centralized (2 functions exported)
- `lib/graph.ts` — all graph building logic centralized (multiple builder functions)
- `components/` — each component in its own directory with co-located types in interfaces
- `types.ts` — shared type definitions for entire app

## React Patterns

**Hooks Usage:**
- Functional components exclusively; no class components
- Standard hooks: `useState`, `useCallback`, `useEffect`, `useMemo`, `useRef`, `useInternalNode`
- Custom hooks extracted from context provider: `useReactFlow()` from React Flow

**State Management:**
- Local component state with `useState` for UI state: `[workbooks, setWorkbooks]`, `[expanded, setExpanded]`
- Root-level state in App.tsx passed down as props
- No context API or Redux; props passed through component tree

**Callback Props:**
- Optional callbacks with `?` marker: `onWorkbooksChange?: (workbooks: WorkbookFile[]) => void`
- Callbacks wrapped with `useCallback()` to prevent unnecessary re-renders
- Event handlers follow `handleEventName()` convention

**Component Props:**
- Props interface defined inline above component: `interface FilePanelProps { ... }`
- Props destructured in function signature with type annotation
- Optional props use `?` in interface definition

## Styling

**Framework:** Tailwind CSS v4 via `@tailwindcss/vite` plugin

**Patterns:**
- Inline styles for dynamic values: `style={{ background: dragging ? '...' : '...' }}`
- Tailwind classes for static layout: `className="flex flex-col items-center"`
- Design tokens as object literal `C` for repeated color values in complex components
- CSS modules not used; all styling via Tailwind + inline styles

**Color System:**
- Hex colors: `#0b0d11` (dark bg), `#e8445a` (accent red), `#edf0f5` (light text)
- Dark theme with semantic color tokens: accent, surface, border, text variants
- RGBA for opacity effects: `rgba(232,68,90,0.15)` for hover states

---

*Convention analysis: 2026-02-27*
