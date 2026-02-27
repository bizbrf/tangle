# External Integrations

**Analysis Date:** 2026-02-27

## APIs & External Services

**None detected.**

The application is entirely client-side with no external API dependencies. All processing happens locally in the user's browser or Tauri desktop window.

## Data Storage

**Databases:**
- None - application is stateless

**File Storage:**
- **Local filesystem only** (client-side)
- Users upload `.xlsx` files via drag-and-drop or file picker
- Files are parsed in memory; no persistence to disk
- Each workbook is stored as a `WorkbookFile` object in React state

**Caching:**
- None - application rebuilds graph on every upload or filter change

## Authentication & Identity

**Auth Provider:**
- None required

**Implementation:**
- Application is single-user and local-only
- No login, user accounts, or authentication system
- No data transmission to external services

## Monitoring & Observability

**Error Tracking:**
- None - no external error reporting service

**Logs:**
- Console logging only in development via `tauri-plugin-log`
- Log level: `Info` in debug builds (see `src-tauri/src/lib.rs`)
- No analytics or telemetry

## CI/CD & Deployment

**Hosting:**
- Not applicable - desktop application
- Distributed as Windows executable via GitHub Releases
- Installation via NSIS installer or portable .exe download
- Web version deployable to any static host (vite outputs to `dist/`)

**CI Pipeline:**
- None detected - repository uses standard git with no GitHub Actions workflows for automation
- Build and release managed manually

## Environment Configuration

**Required env vars:**
- None - no external services or secrets

**Secrets location:**
- Not applicable

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Data Flow

**Input:**
1. User drags/drops or browses for `.xlsx` files → `FilePanel.tsx`
2. Files read as `ArrayBuffer` via `FileReader` API
3. Passed to `parseWorkbook()` in `src/lib/parser.ts`

**Processing (All Client-Side):**
1. `xlsx` library (`XLSX.read()`) parses workbook structure and formulas
2. `buildExternalLinkMap()` extracts external file references from relationship XMLs
3. `extractNamedRanges()` parses workbook named ranges
4. `extractReferences()` runs regex patterns on all formulas to find cell references
5. Results organized into `WorkbookFile` objects with sheet-level workload metrics

**Visualization:**
1. Parsed data passed to `buildGraph()` in `src/lib/graph.ts`
2. Dagre computes node positions based on layout mode
3. React Flow renders interactive canvas with pan/zoom/selection
4. User interactions (focus, filter, hide, highlight) update local React state

**Output:**
- Interactive graph display only (no export feature)
- Detail panel shows formula metadata and reference info
- Everything rendered in browser/desktop WebView

## Supported File Formats

**Excel Formats (via xlsx library):**
- `.xlsx` - Modern Office Open XML format
- `.xls` - Legacy Excel binary format
- `.xlsm` - Excel with macros
- `.xlsb` - Excel binary format

**Detected via:**
- `EXCEL_EXTENSIONS` constant in `src/lib/parser.ts`: `['.xlsx', '.xls', '.xlsm', '.xlsb']`
- `EXCEL_EXT_RE` regex: `/\.(xlsx|xls|xlsm|xlsb)$/i`

## Cross-File Reference Detection

**External File References:**
- Pattern: `[Workbook.xlsx]Sheet!A1` or `'[File Name.xlsx]Sheet'!A1`
- Resolution: SheetJS exposes external link relationships in `workbook.files` → `xl/externalLinks/_rels/externalLink{N}.xml.rels`
- Extracts target filename from relationship XML and maps to reference indices
- Creates node for external file even if not uploaded

**Internal References:**
- Pattern: `Sheet!A1`, `'Sheet Name'!A1:B2`, or `A1:B2` (within-sheet)
- Extracted via regex in `src/lib/parser.ts`
- Supports quoted sheet names with spaces
- Supports Unicode in sheet names (range: `\u00C0-\u024F`)

**Named Ranges:**
- Extracted from `workbook.Workbook.Names` array
- Scope: workbook-level or sheet-specific
- References resolved via named range definitions
- Built-in names filtered (e.g., `_xlnm.Print_Area`)

## Performance Considerations

**Single-Page Processing:**
- All parsing happens on-demand when file is uploaded
- No lazy-loading or streaming (entire workbook loaded into memory)
- Suitable for typical Excel files (< 100MB)

**Graph Rendering:**
- React Flow with Dagre layout can handle hundreds of nodes
- Performance scales with number of sheets and cross-references
- No virtual scrolling (assumes < 1000 nodes)

## Security Model

**Data Privacy:**
- **No data transmission** - all processing is local
- Files never sent to servers
- Browser local storage not used (state lost on page refresh)
- No cookies or tracking

**CORS & CSP:**
- CSP disabled in Tauri config (`"csp": null`)
- Not applicable to desktop app (no cross-origin requests)

**Sandboxing:**
- Tauri provides OS-level sandboxing for desktop app
- No access to file system beyond uploaded files (read-only)
- No shell command execution

---

*Integration audit: 2026-02-27*
