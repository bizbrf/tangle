# Phase 2: Parser Unit Tests - Research

**Researched:** 2026-02-27
**Domain:** Vitest unit testing of `parser.ts` — pure-TypeScript reference extraction functions using SheetJS fixtures
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PARSE-01 | `extractReferences()` is exported from `parser.ts` and testable in isolation | Source change section: only 3 functions need `export` added; no other source changes required |
| PARSE-02 | Cross-sheet references with unquoted names (`SheetName!A1`) are detected correctly | Regex verified live — unquoted group (group 3/4) captures `SheetName` correctly; cross-sheet.xlsx fixture confirmed |
| PARSE-03 | Cross-sheet references with quoted names (`'Sheet Name'!A1:B2`) are detected correctly | Regex verified live — quoted group (group 1/2) handles spaces in sheet names; inline workbook pattern works |
| PARSE-04 | External file references with numeric link indices (`[1]Sheet!A1`) are resolved via `buildExternalLinkMap()` | buildExternalLinkMap takes a mock `wb.files` with rels XML; tested via mock wb object, not fixture file |
| PARSE-05 | External file references with bracketed filenames (`[File.xlsx]Sheet!A1`) are detected correctly | external-ref.xlsx fixture confirmed: formula `[External.xlsx]Prices!C3` round-trips through SheetJS |
| PARSE-06 | Named ranges are detected and distinguished from function calls (e.g., `SUM(...)` is not a named range) | Regex `\b(Name)\b(?!\()` verified: `SUM(A1:B10)` never matches; `MyRange` matches; `SUM(MyRange)` correctly detects `MyRange` but not `SUM` |
| PARSE-07 | Named range references in formulas do not appear as duplicate edges | Dedup key `NR\|name\|wb\|sheet` in `byTarget` Map verified live — same named range twice in one formula = 1 edge |
| PARSE-08 | Workload metrics (`totalFormulas`, `withinSheetRefs`, `crossSheetRefs`, `crossFileRefs`) are counted correctly | Metric increment logic traced in parser.ts lines 163-243; each counter has distinct trigger conditions |
| PARSE-09 | Empty workbooks return empty reference arrays with zero workload metrics | empty.xlsx fixture confirmed: 0 formula cells, no `cell.f` properties; parser exits early per `if (!formula) continue` |
| PARSE-10 | Malformed/corrupt `.xlsx` files cause `parseWorkbook()` to reject with an error, not crash | XLSX.read() throws `Unsupported ZIP encryption` on malformed.xlsx (verified live); parseWorkbook() wraps in try/catch + reject; requires jsdom for FileReader |
| PARSE-11 | Circular references between sheets do not cause infinite loops or crashes | extractReferences() is pure regex — no traversal, no recursion; circular.xlsx verified: both sheets extract without issue |
</phase_requirements>

---

## Summary

Phase 2 writes unit tests for every reference extraction path in `parser.ts`. The infrastructure (Vitest, fixtures, smoke test) is fully operational from Phase 1 — `npm test` passes 3 tests. Phase 2 adds `tests/unit/parser.test.ts` and `tests/unit/parser.error.test.ts`, targeting all 11 PARSE requirements.

The critical blocker identified in STATE.md is confirmed: `extractReferences()`, `extractNamedRanges()`, and `buildExternalLinkMap()` are private functions in `parser.ts` (not exported). Adding `export` to each is the **only source code change** required in this entire phase. All tests then call these functions directly, bypassing the `FileReader`-dependent `parseWorkbook()` public API — except for PARSE-10, which must call `parseWorkbook()` and requires `jsdom` to provide `FileReader`.

The seven Phase 1 fixtures cover most scenarios, but named range testing (PARSE-06, PARSE-07) requires a workbook with a formula that *uses* a named range by name (e.g., `=MyRange`). The current `named-ranges.xlsx` fixture only *defines* `MyRange` — it has no formula that references it. Tests for PARSE-06/07 should construct an inline workbook using `XLSX.utils.book_new()` within the test itself, which is clean and requires no fixture file changes.

**Primary recommendation:** Export 3 functions from `parser.ts`. Write `parser.test.ts` using `node` environment, loading fixtures with `readFileSync` + `XLSX.read()`. Write `parser.error.test.ts` using `@vitest-environment jsdom` per-file annotation for PARSE-10 (`parseWorkbook()` rejection). Construct named-range test workbooks inline for PARSE-06/07.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 | Unit test runner | Already installed and configured; `npm test` passes Phase 1 smoke tests |
| xlsx | ^0.18.5 | Fixture loading in tests | Already in `dependencies`; `XLSX.read(buf, {type:'buffer', cellFormula:true})` loads fixture files as WorkBook objects |
| node:fs | built-in | Load .xlsx fixture files | `readFileSync(FIXTURES.crossSheet)` returns Buffer; no async/FileReader needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsdom | ^28.1.0 | DOM environment for tests that call `parseWorkbook()` | Only for `parser.error.test.ts` (PARSE-10) — provides `FileReader` global needed by `parseWorkbook()` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsdom per-file env for PARSE-10 | Mock `FileReader` globally in node env | Mock approach is fragile and complex; jsdom 28 ships `FileReader` and is already installed; per-file `@vitest-environment jsdom` annotation is one line |
| Inline workbooks for PARSE-06/07 | Update `named-ranges.xlsx` via `generate.ts` | Both work; inline is cleaner for test clarity — keeps the test self-contained without regenerating fixtures |
| Direct `extractReferences()` calls | Call `parseWorkbook()` for all tests | `parseWorkbook()` requires `FileReader` (browser API); `extractReferences()` is pure TypeScript with no DOM dependency — much simpler to test |

**Installation:** No new packages needed. Everything is already installed from Phase 1.

---

## Architecture Patterns

### Recommended Project Structure
```
tests/
├── unit/
│   ├── parser.smoke.test.ts    # Phase 1: already exists, passes
│   ├── parser.test.ts          # Phase 2: happy-path + workload metric tests
│   └── parser.error.test.ts    # Phase 2: empty, malformed, circular tests
├── fixtures/
│   ├── cross-sheet.xlsx        # PARSE-02, PARSE-08 (1 formula, Sheet1 -> Sheet2)
│   ├── external-ref.xlsx       # PARSE-05 (1 formula, [External.xlsx]Prices!C3)
│   ├── named-ranges.xlsx       # PARSE-08 baseline (MyRange defined, Sheet2!A1 formula)
│   ├── empty.xlsx              # PARSE-09 (0 formulas)
│   ├── large.xlsx              # PARSE-11 / stress (100 sheets, chain refs)
│   ├── circular.xlsx           # PARSE-11 (Sheet1->Sheet2->Sheet1)
│   └── malformed.xlsx          # PARSE-10 (PK header + garbage bytes)
└── helpers/
    └── upload.ts               # Phase 4 stub (already exists)
src/lib/
└── parser.ts                   # Add `export` to 3 private functions (only source change)
```

### Pattern 1: Export Private Functions for Testability (PARSE-01)

**What:** Add `export` keyword to `extractReferences`, `extractNamedRanges`, and `buildExternalLinkMap` in `parser.ts`. These are currently private but need to be testable in isolation.

**Why this, not test-through-public-API:** `parseWorkbook()` requires `FileReader` (a browser DOM API). Node has `File` (WHATWG) but NOT `FileReader` (confirmed on Node 24.13.0). Testing through `parseWorkbook()` requires `jsdom` for every test. Testing `extractReferences()` directly needs only Node built-ins.

**The change (minimal):**
```typescript
// src/lib/parser.ts — add export to 3 functions

// Before:
function buildExternalLinkMap(wb: XLSX.WorkBook): Map<string, string> { ... }
function extractNamedRanges(wb: XLSX.WorkBook): NamedRange[] { ... }
function extractReferences(sheet, sheetName, workbookName, linkMap, namedRangeMap) { ... }

// After:
export function buildExternalLinkMap(wb: XLSX.WorkBook): Map<string, string> { ... }
export function extractNamedRanges(wb: XLSX.WorkBook): NamedRange[] { ... }
export function extractReferences(sheet, sheetName, workbookName, linkMap, namedRangeMap) { ... }
```

### Pattern 2: Fixture Loading in Node Environment

**What:** Load `.xlsx` fixture files with `readFileSync` + `XLSX.read()` in test `beforeAll` hooks. Pass the resulting `WorkSheet` directly to `extractReferences()`.

**Why:** No `FileReader`, no async complexity. The `FIXTURES` constant from Phase 1 provides typed, absolute paths.

**Example:**
```typescript
// tests/unit/parser.test.ts
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { FIXTURES } from '../fixtures/index'
import { extractReferences, extractNamedRanges, buildExternalLinkMap } from '../../src/lib/parser'

describe('extractReferences — cross-sheet', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(FIXTURES.crossSheet)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('detects unquoted cross-sheet reference (PARSE-02)', () => {
    const linkMap = new Map<string, string>()
    const namedRangeMap = new Map()
    const { references, workload } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', linkMap, namedRangeMap
    )
    expect(references).toHaveLength(1)
    expect(references[0].targetSheet).toBe('Sheet2')
    expect(references[0].targetWorkbook).toBeNull()
    expect(workload.crossSheetRefs).toBe(1)
    expect(workload.totalFormulas).toBe(1)
  })
})
```

### Pattern 3: Inline Workbook for Named Range Tests (PARSE-06, PARSE-07)

**What:** Construct a `XLSX.WorkBook` object inline within the test, without using a fixture file. This is necessary because the existing `named-ranges.xlsx` defines `MyRange` but has no formula that *references* it.

**Why inline, not fixture update:** Tests are self-documenting, do not require regenerating fixtures, and can be crafted to test exactly the combinations needed.

**Verified round-trip:** The formula `MyRange` round-trips through `XLSX.write()` + `XLSX.read()` with `cell.f = 'MyRange'` intact (verified in research).

**Example:**
```typescript
describe('extractReferences — named ranges (PARSE-06, PARSE-07)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    // Construct inline — named-ranges.xlsx fixture doesn't reference MyRange by name
    wb = XLSX.utils.book_new()
    const sheet1: XLSX.WorkSheet = {}
    sheet1['A1'] = { t: 'n', v: 0, f: 'MyRange' }         // named range reference
    sheet1['A2'] = { t: 'n', v: 0, f: 'SUM(Sheet2!B1:B5)' }  // function — NOT a named range
    sheet1['A3'] = { t: 'n', v: 0, f: 'MyRange+MyRange' }  // duplicate in one formula
    sheet1['!ref'] = 'A1:A3'
    const sheet2 = XLSX.utils.aoa_to_sheet([['src', 1, 2, 3]])
    XLSX.utils.book_append_sheet(wb, sheet1, 'Sheet1')
    XLSX.utils.book_append_sheet(wb, sheet2, 'Sheet2')
    if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
    wb.Workbook.Names = [{ Name: 'MyRange', Ref: 'Sheet2!A1:A10', Sheet: undefined }]
    // Write + read back to ensure formula strings survive round-trip
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('detects named range reference (PARSE-06)', () => {
    const namedRanges = extractNamedRanges(wb)
    const namedRangeMap = new Map(namedRanges.map(nr => [nr.name.toLowerCase(), nr]))
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), namedRangeMap
    )
    const nrRef = references.find(r => r.namedRangeName === 'MyRange')
    expect(nrRef).toBeDefined()
    expect(nrRef?.targetSheet).toBe('Sheet2')
  })

  it('SUM() is not detected as a named range (PARSE-06)', () => {
    const namedRanges = extractNamedRanges(wb)
    const namedRangeMap = new Map(namedRanges.map(nr => [nr.name.toLowerCase(), nr]))
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), namedRangeMap
    )
    // No reference should have namedRangeName = 'SUM'
    expect(references.every(r => r.namedRangeName !== 'SUM')).toBe(true)
  })

  it('duplicate named range in one formula emits one edge (PARSE-07)', () => {
    const namedRanges = extractNamedRanges(wb)
    const namedRangeMap = new Map(namedRanges.map(nr => [nr.name.toLowerCase(), nr]))
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), namedRangeMap
    )
    // A3 = 'MyRange+MyRange' — should produce exactly 1 ref for MyRange
    const a3Refs = references.filter(r => r.sourceCell === 'A3')
    const myRangeRefs = a3Refs.filter(r => r.namedRangeName === 'MyRange')
    expect(myRangeRefs).toHaveLength(1)
  })
})
```

### Pattern 4: Mock linkMap for Numeric Index Tests (PARSE-04)

**What:** To test numeric link index resolution (`[1]Sheet!A1` → `Assumptions.xlsx`), construct a `WorkSheet` inline with a formula containing `[1]` and pass a pre-populated `Map<string, string>` as the `linkMap`.

**Why not fixture-based:** SheetJS writes `[External.xlsx]` format when given bracketed filenames. It does NOT write `xl/externalLinks/_rels/` entries for programmatically-set formulas. Numeric index format (`[1]`) is what Excel produces internally — it cannot be generated by SheetJS from the public API. Testing `buildExternalLinkMap()` requires either crafting raw zip XML (impractical) or mocking the input.

**Example:**
```typescript
describe('extractReferences — numeric external link index (PARSE-04)', () => {
  it('resolves [1]Sheet!A1 via linkMap to actual filename', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: '[1]Prices!C3' }
    sheet['!ref'] = 'A1:A1'
    const linkMap = new Map([['1', 'Assumptions.xlsx']])
    const { references } = extractReferences(sheet, 'Sheet1', 'Source.xlsx', linkMap, new Map())
    expect(references).toHaveLength(1)
    expect(references[0].targetWorkbook).toBe('Assumptions.xlsx')
    expect(references[0].targetSheet).toBe('Prices')
  })
})
```

### Pattern 5: Per-File jsdom Environment for parseWorkbook() Tests (PARSE-10)

**What:** `parser.error.test.ts` uses a per-file Vitest environment annotation to opt into jsdom, which provides `FileReader`. This is needed only for testing `parseWorkbook()` rejection behavior.

**Why jsdom, not mock:** jsdom 28 ships `FileReader` that works with Vitest's node module resolution. The mock approach would require reimplementing `FileReader`'s async event model — fragile and unnecessary when jsdom is already installed.

**The annotation (one line at top of file):**
```typescript
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FIXTURES } from '../fixtures/index'
import { parseWorkbook } from '../../src/lib/parser'

describe('parseWorkbook — error handling (PARSE-10)', () => {
  it('rejects with an error when given a corrupt .xlsx file', async () => {
    const buf = readFileSync(FIXTURES.malformed)
    // jsdom provides File global with FileReader support
    const file = new File([buf], 'malformed.xlsx')
    await expect(parseWorkbook(file, 'test-id')).rejects.toThrow()
  })
})
```

### Pattern 6: Circular Reference Test (PARSE-11)

**What:** Call `extractReferences()` on both sheets of `circular.xlsx`. The test verifies completion within a timeout, producing expected references without hanging.

**Why no infinite loop:** `extractReferences()` is pure regex — it reads formula strings but does NOT traverse the reference graph. Sheet1 formula `Sheet2!A1` produces a ref to Sheet2. Sheet2 formula `Sheet1!A1` produces a ref to Sheet1. No recursion occurs.

**Example:**
```typescript
describe('extractReferences — circular references (PARSE-11)', () => {
  it('processes circular refs without hanging and returns expected refs', () => {
    const buf = readFileSync(FIXTURES.circular)
    const wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
    const linkMap = new Map<string, string>()
    const namedRangeMap = new Map()

    // Sheet1 -> Sheet2
    const { references: sheet1Refs } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'circular.xlsx', linkMap, namedRangeMap
    )
    expect(sheet1Refs).toHaveLength(1)
    expect(sheet1Refs[0].targetSheet).toBe('Sheet2')

    // Sheet2 -> Sheet1 (the circular part)
    const { references: sheet2Refs } = extractReferences(
      wb.Sheets['Sheet2'], 'Sheet2', 'circular.xlsx', linkMap, namedRangeMap
    )
    expect(sheet2Refs).toHaveLength(1)
    expect(sheet2Refs[0].targetSheet).toBe('Sheet1')
  })
})
```

### Anti-Patterns to Avoid

- **Testing via `parseWorkbook()` for all tests:** Requires jsdom `FileReader` for every test file. Use `extractReferences()` directly for all tests except PARSE-10.
- **Using `aoa_to_sheet` for inline formula workbooks:** `aoa_to_sheet([['=MyRange']])` sets `t:'s'` (string value), NOT `cell.f`. Always use `ws['A1'] = { t:'n', v:0, f:'MyRange' }` for formula cells.
- **Relying on `named-ranges.xlsx` fixture for PARSE-06/07:** The fixture defines `MyRange` but has no formula that *uses* it. Construct inline workbooks for named range reference tests.
- **Trying to test `buildExternalLinkMap()` via real SheetJS fixtures:** SheetJS programmatic writes do not produce `xl/externalLinks/_rels/` entries. Use mock `linkMap` inputs to test numeric index resolution.
- **Forgetting `cellFormula: true` in `XLSX.read()`:** Without this option, `cell.f` is not populated. Every `XLSX.read()` call in tests must include `{ type: 'buffer', cellFormula: true }`.
- **Using `globals: false` / explicit imports only:** `vitest.config.ts` sets `globals: true`. Tests can use `describe/it/expect` without importing. But `beforeAll`, `beforeEach` still need explicit import from `'vitest'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-sheet regex testing | Custom string parser for formula validation | `extractReferences()` directly | The function IS the implementation — test it directly |
| FileReader in node tests | Custom FileReader mock/polyfill | `@vitest-environment jsdom` annotation | jsdom 28 ships `FileReader`; mock is fragile for async event model |
| Numeric link index rels XML | Raw zip XML crafting for buildExternalLinkMap | Mock `linkMap = new Map([['1', 'file.xlsx']])` | linkMap is a pure `Map<string, string>` input — pass it directly |
| Formula fixture with named range usage | Update generate.ts + regenerate fixtures | Inline `XLSX.utils.book_new()` in `beforeAll` | Self-contained, no fixture regeneration step, test clearly documents intent |
| Workload counter validation | Manual formula counting across sheets | `extractReferences()` return value `workload` | workload is a first-class return value from the function being tested |

**Key insight:** `extractReferences()` takes a `XLSX.WorkSheet`, not a file path. Any `WorkSheet` object — from a fixture file OR constructed inline — is a valid input. This makes the function highly testable without DOM APIs.

---

## Common Pitfalls

### Pitfall 1: `cellFormula: true` Missing from XLSX.read()
**What goes wrong:** `cell.f` is undefined on every cell; `extractReferences()` finds no formulas; tests pass vacuously with empty reference arrays.
**Why it happens:** SheetJS does not parse formula strings by default — it only parses them when explicitly requested.
**How to avoid:** Every `XLSX.read()` call in tests must include `{ type: 'buffer', cellFormula: true }`. Add to `beforeAll` pattern.
**Warning signs:** References array is always empty; workload metrics all zero even for formulas you can verify in the fixture.

### Pitfall 2: Inline Formula Cells Must Use Explicit Construction
**What goes wrong:** `sheet['A1'] = { v: '=MyRange' }` or `aoa_to_sheet([['=MyRange']])` creates a string value cell — `cell.f` is not set. `extractReferences()` finds nothing.
**Why it happens:** SheetJS `aoa_to_sheet` and plain value assignment never set `cell.f`. Formula cells require `{ t: 'n', v: 0, f: 'FormulaString' }`.
**How to avoid:** Always construct formula cells as `ws['A1'] = { t: 'n', v: 0, f: 'FormulaString' }`. After building an inline workbook, write + read back with `cellFormula: true` to verify.
**Warning signs:** `references` is empty when you expected matches.

### Pitfall 3: `extractReferences` Not Yet Exported — Import Will Fail
**What goes wrong:** `import { extractReferences } from '../../src/lib/parser'` throws at module load time; all tests in the file fail immediately.
**Why it happens:** `extractReferences`, `extractNamedRanges`, and `buildExternalLinkMap` are private (no `export` keyword). This is the sole source change required in Phase 2.
**How to avoid:** Add `export` to all three functions in `parser.ts` BEFORE writing any test that imports them. This is the first task of Phase 2.
**Warning signs:** Import error message includes the function name at module load time.

### Pitfall 4: `parseWorkbook()` Needs `FileReader` — Fails in Node Environment
**What goes wrong:** Calling `parseWorkbook()` in a node-environment test throws `FileReader is not defined` and the test errors (not fails — errors), producing confusing output.
**Why it happens:** `parseWorkbook()` uses `new FileReader()` and `reader.readAsArrayBuffer()`. `FileReader` is a browser DOM API — not available in Node 24 (`typeof FileReader === 'undefined'`).
**How to avoid:** Add `// @vitest-environment jsdom` at the top of `parser.error.test.ts`. All other test files use the default node environment.
**Warning signs:** Error at test runtime: `ReferenceError: FileReader is not defined`.

### Pitfall 5: Named Range Fixture Doesn't Reference the Named Range
**What goes wrong:** Tests using `named-ranges.xlsx` for PARSE-06 (named range detection) find zero `namedRangeName` references because `Sheet1!A1` has formula `Sheet2!A1` — a cell reference, not a named range reference.
**Why it happens:** `named-ranges.xlsx` was generated to verify named range *definition* (Workbook.Names), not named range *usage in formulas*.
**How to avoid:** Construct inline workbooks in `beforeAll` for PARSE-06/07 tests. The inline workbook has `A1.f = 'MyRange'` (uses named range by name).
**Warning signs:** `references.every(r => !r.namedRangeName)` is true; the test that asserts `nrRef` exists fails.

### Pitfall 6: withinSheetRefs vs crossSheetRefs Counting
**What goes wrong:** A test asserts `crossSheetRefs === 1` but gets `0`, or vice versa. Self-references are easy to miscategorize.
**Why it happens:** In `extractReferences()`, a formula `Sheet1!A1` when called with `sheetName = 'Sheet1'` is counted as `withinSheetRefs` (same sheet) and skipped. Only references to OTHER sheets increment `crossSheetRefs`.
**How to avoid:** When testing cross-sheet refs, the formula must reference a DIFFERENT sheet than `sheetName`. When testing within-sheet refs, formula must reference the SAME sheet.
**Warning signs:** crossSheetRefs is 0 when expected 1 — check if formula sheet name matches the sheetName argument.

### Pitfall 7: Malformed File Error Message Varies by SheetJS Version
**What goes wrong:** Test asserts `.toThrow('Unsupported ZIP encryption')` but XLSX throws a different message in the installed version.
**Why it happens:** SheetJS error messages for corrupt files are implementation-specific and may change.
**How to avoid:** Use `.rejects.toThrow()` without a specific message string, or use `.rejects.toThrow(Error)`. Do NOT assert on the specific error message text.
**Warning signs:** Test fails with "Expected error message to match" even though an error IS thrown.

---

## Code Examples

Verified patterns from live testing:

### Full test file structure: parser.test.ts
```typescript
// tests/unit/parser.test.ts
// Environment: node (default from vitest.config.ts)
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { FIXTURES } from '../fixtures/index'
import { extractReferences, extractNamedRanges, buildExternalLinkMap } from '../../src/lib/parser'

// ── PARSE-02: Unquoted cross-sheet ref ──────────────────────────────────────
describe('extractReferences — cross-sheet (PARSE-02, PARSE-08)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(FIXTURES.crossSheet)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('detects unquoted cross-sheet reference', () => {
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), new Map()
    )
    expect(references).toHaveLength(1)
    expect(references[0].targetSheet).toBe('Sheet2')
    expect(references[0].targetWorkbook).toBeNull()
    expect(references[0].cells).toContain('A1')
  })

  it('workload metrics are correct (PARSE-08)', () => {
    const { workload } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), new Map()
    )
    expect(workload.totalFormulas).toBe(1)
    expect(workload.crossSheetRefs).toBe(1)
    expect(workload.crossFileRefs).toBe(0)
    expect(workload.withinSheetRefs).toBe(0)
  })
})
```

### Full test file structure: parser.error.test.ts
```typescript
// @vitest-environment jsdom
// tests/unit/parser.error.test.ts
// Environment: jsdom (per-file annotation — needed for FileReader in parseWorkbook)
import { describe, it, expect, beforeAll } from 'vitest'
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { FIXTURES } from '../fixtures/index'
import { parseWorkbook, extractReferences } from '../../src/lib/parser'

// ── PARSE-09: Empty workbook ─────────────────────────────────────────────────
describe('extractReferences — empty workbook (PARSE-09)', () => {
  it('returns zero references and zero workload metrics', () => {
    const buf = readFileSync(FIXTURES.empty)
    const wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
    const { references, workload } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'empty.xlsx', new Map(), new Map()
    )
    expect(references).toHaveLength(0)
    expect(workload.totalFormulas).toBe(0)
    expect(workload.crossSheetRefs).toBe(0)
    expect(workload.crossFileRefs).toBe(0)
    expect(workload.withinSheetRefs).toBe(0)
  })
})

// ── PARSE-10: Corrupt file rejects ──────────────────────────────────────────
describe('parseWorkbook — malformed file (PARSE-10)', () => {
  it('rejects with an error (not a crash) for corrupt .xlsx', async () => {
    const buf = readFileSync(FIXTURES.malformed)
    const file = new File([buf], 'malformed.xlsx')
    await expect(parseWorkbook(file, 'test-id')).rejects.toThrow()
  })
})

// ── PARSE-11: Circular references ───────────────────────────────────────────
describe('extractReferences — circular references (PARSE-11)', () => {
  it('processes Sheet1->Sheet2->Sheet1 without hanging', () => {
    const buf = readFileSync(FIXTURES.circular)
    const wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
    const linkMap = new Map<string, string>()
    const nrMap = new Map()
    const { references: r1 } = extractReferences(wb.Sheets['Sheet1'], 'Sheet1', 'c.xlsx', linkMap, nrMap)
    const { references: r2 } = extractReferences(wb.Sheets['Sheet2'], 'Sheet2', 'c.xlsx', linkMap, nrMap)
    expect(r1[0].targetSheet).toBe('Sheet2')
    expect(r2[0].targetSheet).toBe('Sheet1')
  })
})
```

### Export additions to parser.ts (only source change in phase)
```typescript
// src/lib/parser.ts — change 3 function declarations from private to exported

// Line 48: was `function buildExternalLinkMap`
export function buildExternalLinkMap(wb: XLSX.WorkBook): Map<string, string> { ... }

// Line 86: was `function extractNamedRanges`
export function extractNamedRanges(wb: XLSX.WorkBook): NamedRange[] { ... }

// Line 134: was `function extractReferences`
export function extractReferences(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  workbookName: string,
  linkMap: Map<string, string>,
  namedRangeMap: Map<string, NamedRange>,
): { references: SheetReference[]; workload: SheetWorkload } { ... }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Testing via public `parseWorkbook()` API only | Export internal functions for direct unit testing | Standard Vitest pattern | Avoids FileReader dependency for 10/11 requirements |
| `jsdom` for all tests | Per-file `@vitest-environment jsdom` annotation | Vitest 1+ | Keeps default fast `node` environment; jsdom only where needed |
| Fixture-only test data | Inline `XLSX.utils.book_new()` in `beforeAll` | Common Vitest pattern | Self-documenting tests, no fixture regeneration step |

**Deprecated/outdated:**
- `readFileEntry` function in `parser.ts`: `readFileEntry` is private and handles CFB container entries — not needed for export; tests interact with `buildExternalLinkMap` directly.
- `globals: false` pattern: vitest.config.ts already sets `globals: true` — no need to import `describe/it/expect`.

---

## Open Questions

1. **`extractNamedRanges()` return in tests — does exported function need `wb` type cast?**
   - What we know: `extractNamedRanges(wb)` takes `XLSX.WorkBook` directly; the type is already typed correctly internally.
   - What's unclear: Whether TypeScript strict mode will complain about the `wb.Workbook?.Names` access pattern after export.
   - Recommendation: Test imports the function with the same `XLSX.WorkBook` type — should type-check cleanly. If TS complains, the test can cast `wb as XLSX.WorkBook`.

2. **PARSE-03 fixture: does `cross-sheet.xlsx` have a quoted sheet name test case?**
   - What we know: `cross-sheet.xlsx` has `Sheet1` and `Sheet2` (unquoted names). PARSE-03 requires quoted names with spaces (`'Sheet Name'!A1`).
   - What's unclear: Whether to add a quoted-name fixture or construct inline.
   - Recommendation: Construct inline workbook for PARSE-03 (a WorkSheet with formula `'Sheet Name'!A1:B2` and a sheet named `Sheet Name`). Regex is already verified to handle this case.

3. **`buildExternalLinkMap()` testing scope**
   - What we know: SheetJS programmatic writes do not produce `xl/externalLinks/_rels/` entries. The function reads from `wb.files` (raw zip entries).
   - What's unclear: Whether we should also test `buildExternalLinkMap()` with a mock `wb.files` object containing rels XML, or rely on the integration path (linkMap mock in `extractReferences` tests).
   - Recommendation: Test `buildExternalLinkMap()` with a crafted mock `wb.files` object containing minimal rels XML. This gives direct coverage of the function. It's more work but proves the XML parsing logic.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (exists, separate from `vite.config.ts`) |
| Quick run command | `npm test` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARSE-01 | `extractReferences()` is importable from `parser.ts` | unit | `npm test` | ❌ Wave 0 — needs export + test file |
| PARSE-02 | Unquoted cross-sheet refs detected | unit | `npm test` | ❌ Wave 0 — `tests/unit/parser.test.ts` |
| PARSE-03 | Quoted cross-sheet refs detected | unit | `npm test` | ❌ Wave 0 — `tests/unit/parser.test.ts` |
| PARSE-04 | Numeric index `[1]` resolved via linkMap | unit | `npm test` | ❌ Wave 0 — `tests/unit/parser.test.ts` |
| PARSE-05 | Bracketed filename `[File.xlsx]` detected | unit | `npm test` | ❌ Wave 0 — `tests/unit/parser.test.ts` |
| PARSE-06 | Named ranges detected; function calls excluded | unit | `npm test` | ❌ Wave 0 — `tests/unit/parser.test.ts` |
| PARSE-07 | Duplicate named range → single edge | unit | `npm test` | ❌ Wave 0 — `tests/unit/parser.test.ts` |
| PARSE-08 | Workload metrics counted correctly | unit | `npm test` | ❌ Wave 0 — `tests/unit/parser.test.ts` |
| PARSE-09 | Empty workbook → zero metrics | unit | `npm test` | ❌ Wave 0 — `tests/unit/parser.error.test.ts` |
| PARSE-10 | Corrupt file → `parseWorkbook()` rejects | unit (jsdom) | `npm test` | ❌ Wave 0 — `tests/unit/parser.error.test.ts` |
| PARSE-11 | Circular refs complete without hanging | unit | `npm test` | ❌ Wave 0 — `tests/unit/parser.error.test.ts` |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm run test:coverage`
- **Phase gate:** All 11 PARSE requirements green before marking phase complete

### Wave 0 Gaps
- [ ] `src/lib/parser.ts` — add `export` to `extractReferences`, `extractNamedRanges`, `buildExternalLinkMap`
- [ ] `tests/unit/parser.test.ts` — covers PARSE-01 through PARSE-08
- [ ] `tests/unit/parser.error.test.ts` — covers PARSE-09, PARSE-10, PARSE-11 (jsdom per-file env)

No new packages needed. No fixture file changes needed (inline workbooks cover PARSE-03, PARSE-04, PARSE-06, PARSE-07).

---

## Sources

### Primary (HIGH confidence)
- Live code inspection: `src/lib/parser.ts` — function signatures, export status, regex patterns, workload counter logic (all lines read directly)
- Live code inspection: `tests/fixtures/generate.ts`, `tests/fixtures/index.ts` — fixture structure and cell construction patterns
- Live code inspection: `tests/unit/parser.smoke.test.ts` — existing test pattern to follow
- Live verification: `XLSX.read()` on all 7 fixture files confirmed formula content (cross-sheet, external-ref, named-ranges, empty, circular)
- Live verification: `XLSX.read()` on `malformed.xlsx` throws `Unsupported ZIP encryption` (confirms PARSE-10 path works)
- Live verification: `File` and `Blob` available in Node 24.13.0; `FileReader` is NOT (typeof undefined) — confirms jsdom needed for PARSE-10
- Live verification: jsdom 28.1.0 provides `FileReader`, `File`, `Blob` (confirmed via JSDOM instantiation)
- Live verification: Named range regex `\b(MyRange)\b(?!\()` — `SUM(A1:B10)` does not match; `MyRange`, `SUM(MyRange)`, `MyRange+MyRange` match correctly
- Live verification: Inline workbook `beforeAll` pattern — `XLSX.write()` + `XLSX.read()` round-trip preserves `cell.f = 'MyRange'` (confirmed)
- Live verification: Dedup logic — `NR|MyRange||Sheet2` key in `byTarget` Map prevents duplicate named range edges within one formula
- `.planning/STATE.md` — confirms: "extractReferences, extractNamedRanges, and buildExternalLinkMap must be exported from parser.ts before Phase 2 tests can be written. This is the only source code change required in the entire milestone."
- `.planning/phases/01-infrastructure/01-RESEARCH.md` — documents SheetJS patterns, Vitest configuration, formula cell pitfalls
- `.planning/phases/01-infrastructure/01-03-SUMMARY.md` — Phase 1 completion state, established patterns

### Secondary (MEDIUM confidence)
- Vitest per-file environment annotation (`// @vitest-environment jsdom`) — documented in Vitest official docs; pattern standard since Vitest 1.x
- `package.json` — confirms vitest@4.0.18, jsdom@28.1.0, xlsx@0.18.5 installed
- `.planning/REQUIREMENTS.md` — 11 PARSE requirements fully read and mapped to test cases

### Tertiary (LOW confidence)
- None — all critical claims verified via live code execution or direct file inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages live-verified as installed; no new installs needed
- Architecture: HIGH — extractReferences() verified callable with WorkSheet; jsdom FileReader verified; regex verified live; dedup behavior verified live
- Test patterns: HIGH — all inline workbook patterns executed and verified formula round-trip
- Pitfalls: HIGH — each pitfall reproduced or directly verified from code inspection

**Research date:** 2026-02-27
**Valid until:** 2026-03-29 (stable ecosystem — Vitest and SheetJS are the only variable packages)
