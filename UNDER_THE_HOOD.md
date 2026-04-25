# Tangle — Understanding the code and debugging

A guide for when the codebase feels foreign. It explains how the app is wired, where to look when something breaks, and how to follow one action through the code.

---

## 1. The stack in plain language

### What runs where

- **Browser** (or Tauri window): the only place your app code runs. There is no separate “server” for Tangle; the Excel files are read entirely in the browser.
- **Vite**: the tool that bundles your React app and runs the dev server (`npm run dev`). It turns `src/*.tsx` and imports into one (or a few) files the browser can run.
- **React**: the UI library. The screen is built from **components** (functions that return JSX). When **state** (e.g. `workbooks`) changes, React re-runs those components and updates the DOM.

### A few React ideas you’ll see everywhere

- **State** = data that, when it changes, causes the UI to update. Example: `const [workbooks, setWorkbooks] = useState<WorkbookFile[]>([])` in `App.tsx`. Updating with `setWorkbooks(...)` triggers a re-render.
- **Props** = arguments passed into a component. Example: `<FilePanel workbooks={workbooks} onWorkbooksChange={handleWorkbooksChange} />`. The parent owns the data and passes down what the child needs.
- **Callback** = a function passed as a prop so the child can tell the parent “something happened.” Example: `onWorkbooksChange` — when the user adds/removes files, FilePanel calls `onWorkbooksChange(newList)` and App updates `workbooks`.
- **Effect** (`useEffect`) = “after render, do something (often when a dependency changes).” Example: in GraphView, when `workbooks` or `hiddenFiles` changes, an effect calls `buildGraph(...)` and updates nodes/edges.

If you’re new to React, the main mental model: **state lives in one place (often the parent); children receive it via props and report back via callbacks.**

---

## 2. Where the “truth” lives

Almost everything the user sees comes from one list: **workbooks**.

| What you see                         | Where it comes from                          |
|-------------------------------------|-----------------------------------------------|
| List of files and sheets in sidebar | `workbooks` → passed to `FilePanel`           |
| Graph nodes and edges               | `workbooks` (+ hidden/options) → `buildGraph()` → React Flow |
| Detail panel when you click a node  | Selection state in `GraphView` + same `workbooks`-derived graph |

So:

- **Adding/removing a file** = changing `workbooks` in `App.tsx`.
- **Hiding a file** = `hiddenFiles` in `App.tsx`; the graph is built from “visible” workbooks only.
- **Highlighting a file** (Locate) = `highlightedFile` in `App.tsx`; GraphView uses it to select nodes and fit view.

If something is wrong with what files/sheets are shown or how the graph looks, the fix usually involves either the data inside `workbooks` or how that data is turned into nodes/edges (the graph layer).

---

## 3. Follow one action: “I upload an Excel file”

Trace this path in the code so you see how one click flows through the app.

1. **User drops a file (or picks one in the file dialog)**  
   - **File:** `src/components/FilePanel/FilePanel.tsx`  
   - **What happens:** The drop handler calls `handleFiles(e.dataTransfer.files)`; the file input’s `onChange` also calls `handleFiles(files)`.

2. **`handleFiles` runs**  
   - **File:** same file, function `handleFiles`.  
   - It filters to Excel extensions (`.xlsx`, etc.).  
   - For each file it calls `parseWorkbook(f, crypto.randomUUID())` (from `src/lib/parser.ts`).  
   - That returns a **Promise**, so `handleFiles` is `async` and uses `await Promise.all(...)` to get an array of parsed workbooks.

3. **Parsing (parser.ts)**  
   - **File:** `src/lib/parser.ts`  
   - **Function:** `parseWorkbook(file, id)`.  
   - Uses the **SheetJS (xlsx)** library to read the file and extract workbook/sheet/names/tables and **all formulas**. From formulas it extracts references (same sheet, other sheet, other file) and builds the structures defined in `src/types.ts` (`WorkbookFile`, `ParsedSheet`, `SheetReference`, etc.).  
   - So after this step you have in-memory “workbook” objects with sheets and references—no Excel file anymore, just our data.

4. **Resolving names (collisions / duplicates)**  
   - **File:** `src/components/FilePanel/importUtils.ts`  
   - **Function:** `resolveImportedWorkbooks(existingWorkbooks, parsed)`.  
   - Takes the list you already have and the newly parsed list, and resolves **storage names** so every workbook has a unique internal name (collision handling uses `src/lib/filenameSanitizer.ts`).  
   - Returns `{ workbooks: resolved, duplicateOriginalNames }`. The “added another copy of X” message comes from `formatDuplicateImportNotice(duplicateOriginalNames)`.

5. **Updating the app state**  
   - **File:** `FilePanel.tsx` again.  
   - It calls `onWorkbooksChange([...workbooks, ...resolved])`.  
   - **File:** `src/App.tsx`  
   - `onWorkbooksChange` is `handleWorkbooksChange`, which does `setWorkbooks(next)`. So **App’s `workbooks` state** is now the old list plus the new ones.

6. **React re-renders**  
   - `App` re-renders with the new `workbooks`.  
   - It passes the new `workbooks` to both `FilePanel` and `GraphView`.

7. **FilePanel**  
   - Just renders the new list; it already has the updated `workbooks` prop. It may set a notice (e.g. “Added another copy of …”) and expand the new items.

8. **GraphView**  
   - **File:** `src/components/Graph/GraphView.tsx`  
   - It has a **useEffect** that depends on `workbooks` (and `layoutMode`, `hiddenFiles`, etc.). When `workbooks` changes, the effect runs:  
     - Calls `buildGraph(workbooks, layoutMode, hiddenFiles, showNamedRanges, showTables, layoutDirection)` from `src/lib/graph.ts`.  
     - Then `computeLayoutNodes(...)` (which uses `applyLayoutAlgorithm`) to position nodes.  
     - Then `setNodes(...)` and `setEdges(...)` (React Flow state).  
   - React Flow re-renders the canvas, so you see the new nodes and edges.

So for **“upload a file”** the chain is:

**FilePanel (handleFiles)** → **parser.parseWorkbook** → **importUtils.resolveImportedWorkbooks** → **App.setWorkbooks** → **GraphView useEffect** → **graph.buildGraph** → **setNodes / setEdges**.

If “upload” is broken, the bug is somewhere on that path (often parsing or name resolution). If the graph is wrong, it’s usually in `buildGraph` or the effect that calls it.

---

## 4. Debugging map: “When X goes wrong, look here”

Use this to know where to open the code and add logs or breakpoints.

| Symptom | Where to look first |
|--------|----------------------|
| **Upload does nothing / wrong files** | `FilePanel.tsx`: `handleFiles`, filter by `EXCEL_EXTENSIONS`. Check `inputRef` and the file input `accept`. |
| **“Failed to parse” or wrong sheets/refs** | `src/lib/parser.ts`: `parseWorkbook`, formula regexes, and how `SheetReference` / `ParsedSheet` are built. |
| **Duplicate file names / weird names** | `src/lib/filenameSanitizer.ts` (sanitize/collision) and `src/components/FilePanel/importUtils.ts` (`resolveImportedWorkbooks`). |
| **Graph empty or missing nodes** | `src/lib/graph.ts`: `buildGraph` (who gets a node, who’s filtered by `hiddenFiles`). Also check that `workbooks` in App actually has the file (e.g. log in App or in the effect in GraphView). |
| **Graph layout looks wrong** | `src/lib/graph.ts`: `applyLayoutAlgorithm`, and the Dagre options (direction, rank, etc.). Layout mode and direction come from GraphView state (toolbar). |
| **Wrong or missing edges** | Parsing: `parser.ts` (are references extracted?). Graph: `graph.ts` (how edges are built from `references`). |
| **Clicking a node does nothing / wrong detail** | `GraphView.tsx`: selection handlers (`onSelectionChange` or similar), and `DetailPanel.tsx`: it receives `selectedNodes`, `selectedEdge`, `allEdges`. |
| **“Locate” (highlight file) doesn’t work** | `App.tsx`: `highlightedFile` and `onLocateFile`. `GraphView`: effect that filters nodes by `highlightedFile` and calls `fitView`. |
| **Hide/Show file has no effect** | `App.tsx`: `hiddenFiles` and `onToggleHidden`. `graph.ts`: `buildGraph` filters with `hiddenFiles`. |
| **URL (view/dir/fit) not restoring** | `GraphView.tsx`: `readUrlParams`, `writeUrlParams`, and where they’re used on load and when changing view/dir/fit. |
| **Styles / layout look wrong** | `src/index.css` (global + React Flow overrides). Component-level: `Graph/constants.ts`, `toolbarStyles.ts`, and inline styles in components. |
| **TypeScript / build error** | Fix types in `src/types.ts` or in the file the error points to. Run `npm run build` or `npx tsc -b --noEmit` to see all type errors. |
| **Tests fail** | Unit: `vitest` / files in `tests/` or `*.test.ts`. E2E: `playwright` in `e2e/` or similar. Check test description and the code path it’s testing (often parser or graph). |

---

## 5. Practical debugging tips

### Use the browser devtools

- **Console:** Add `console.log('workbooks', workbooks)` (e.g. in App or in the GraphView effect) to see what data you have when something runs.  
- **Sources:** Set breakpoints in the same places (e.g. in `handleFiles`, in `buildGraph`) and step through.  
- **Network:** For a front-end-only app you’ll mostly see the initial HTML/JS; file content is read locally via `FileReader`/SheetJS, so there’s no “upload” request to inspect.

### Use the React devtools

- Install the “React Developer Tools” extension.  
- In the Components tree, select `App` and look at state: `workbooks`, `highlightedFile`, `hiddenFiles`.  
- Then select `FilePanel` or the component that wraps the graph; check props.  
- When you change something (e.g. upload, hide, locate), see which component re-renders and what state/props it has. That tells you whether the bug is “state not updated” or “UI not reacting to state.”

### Add temporary logs

- **App.tsx:** Log when workbooks change:  
  `useEffect(() => { console.log('App workbooks', workbooks.length, workbooks.map(w => w.name)); }, [workbooks]);`
- **GraphView:** In the effect that calls `buildGraph`, log inputs and output:  
  `const { nodes, edges } = buildGraph(...); console.log('buildGraph', { nodes: nodes.length, edges: edges.length });`
- **FilePanel:** At the start of `handleFiles`:  
  `console.log('handleFiles', files?.length, Array.from(files || []).map(f => f.name));`

### Run the app and tests

- **Dev:** `npm run dev` — change code and save; the app hot-reloads.  
- **Typecheck:** `npx tsc -b --noEmit` — catches type errors without running the app.  
- **Lint:** `npm run lint` — catches many logical/style issues.  
- **Unit tests:** `npm test` — fast feedback on parser/graph/utils.  
- **E2E:** `npm run test:e2e` — full flow in a browser (make sure dev build or production build is run first if the script expects it).

---

## 6. File map (short)

- **Entry:** `index.html` → `src/main.tsx` → `src/App.tsx`.  
- **State:** `App.tsx` holds `workbooks`, `highlightedFile`, `hiddenFiles` and passes them (and callbacks) to children.  
- **Left panel:** `src/components/FilePanel/FilePanel.tsx` + `importUtils.ts`.  
- **Right panel:** `src/components/Graph/GraphView.tsx` and the rest of `Graph/` (nodes, edges, toolbar, detail panel, legend).  
- **Data shape:** `src/types.ts`.  
- **Excel → our data:** `src/lib/parser.ts`.  
- **Our data → graph:** `src/lib/graph.ts`.  
- **Names / collisions:** `src/lib/filenameSanitizer.ts`; **structured refs / cycles:** `src/lib/resolver.ts`.  
- **Build/tooling:** `vite.config.ts`, `package.json`; **desktop:** `src-tauri/`.

When something feels foreign, pick one of the “follow one action” steps or one row in the debugging map and open that file; then add a log or breakpoint and run the app. That will make the code much more concrete.
