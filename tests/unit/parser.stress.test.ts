// tests/unit/parser.stress.test.ts
// Stress tests for parser edge cases — targets known weak spots in reference detection
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { FIXTURES } from '../fixtures/index'
import { extractReferences, extractNamedRanges, buildExternalLinkMap } from '../../src/lib/parser'
import type { NamedRange, ExcelTable } from '../../src/types'

// ── STRESS-01: Special sheet names ──────────────────────────────────────────

describe('extractReferences — special sheet names (STRESS-01)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(FIXTURES.specialSheets)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('STRESS-01a: detects reference to sheet with dot in name (Sheet.One)', () => {
    const { references } = extractReferences(
      wb.Sheets['Source'], 'Source', 'special-sheets.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.targetSheet === 'Sheet.One')
    expect(ref).toBeDefined()
    expect(ref?.cells).toContain('A1')
  })

  it('STRESS-01b: detects reference to sheet with spaces (My Sheet)', () => {
    const { references } = extractReferences(
      wb.Sheets['Source'], 'Source', 'special-sheets.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.targetSheet === 'My Sheet')
    expect(ref).toBeDefined()
  })

  it('STRESS-01c: detects reference to sheet with unicode chars (Données)', () => {
    const { references } = extractReferences(
      wb.Sheets['Source'], 'Source', 'special-sheets.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.targetSheet === 'Données')
    expect(ref).toBeDefined()
  })

  it('STRESS-01d: detects reference to sheet with parentheses (Sheet (2))', () => {
    const { references } = extractReferences(
      wb.Sheets['Source'], 'Source', 'special-sheets.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.targetSheet === 'Sheet (2)')
    expect(ref).toBeDefined()
  })

  it("STRESS-01e: detects reference to sheet with embedded apostrophe (O'Brien's Data)", () => {
    const { references } = extractReferences(
      wb.Sheets['Source'], 'Source', 'special-sheets.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.targetSheet === "O'Brien's Data")
    expect(ref).toBeDefined()
  })

  it('STRESS-01f: detects reference to sheet with hyphen and numbers (2024-Q1)', () => {
    const { references } = extractReferences(
      wb.Sheets['Source'], 'Source', 'special-sheets.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.targetSheet === '2024-Q1')
    expect(ref).toBeDefined()
  })

  it('STRESS-01g: total references from Source sheet equals 6', () => {
    const { references } = extractReferences(
      wb.Sheets['Source'], 'Source', 'special-sheets.xlsx', new Map(), new Map(),
    )
    expect(references.length).toBe(6)
  })
})

// ── STRESS-02: Many external references (>20 limit) ────────────────────────

describe('extractReferences — many externals beyond limit (STRESS-02)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(FIXTURES.manyExternals)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('STRESS-02a: detects all 25 external file references', () => {
    const { references } = extractReferences(
      wb.Sheets['Dashboard'], 'Dashboard', 'many-externals.xlsx', new Map(), new Map(),
    )
    // All 25 should be detected as cross-file references (bracketed filename format)
    expect(references.length).toBe(25)
  })

  it('STRESS-02b: all references are marked as cross-file (targetWorkbook is set)', () => {
    const { references } = extractReferences(
      wb.Sheets['Dashboard'], 'Dashboard', 'many-externals.xlsx', new Map(), new Map(),
    )
    const crossFile = references.filter(r => r.targetWorkbook !== null)
    expect(crossFile.length).toBe(25)
  })

  it('STRESS-02c: workload crossFileRefs matches total external refs', () => {
    const { workload } = extractReferences(
      wb.Sheets['Dashboard'], 'Dashboard', 'many-externals.xlsx', new Map(), new Map(),
    )
    expect(workload.crossFileRefs).toBe(25)
    expect(workload.crossSheetRefs).toBe(0)
  })

  it('STRESS-02d: buildExternalLinkMap hard limit of 20 does not crash with >20 links', () => {
    // buildExternalLinkMap loops i=1..20 and breaks when no rels file found.
    // With bracketed filenames (not numeric indices), it won't find rels files anyway.
    // Key test: it should not throw when called with a workbook that has >20 ext refs.
    const map = buildExternalLinkMap(wb)
    expect(map).toBeInstanceOf(Map)
  })
})

// ── STRESS-03: Mixed reference types in single formulas ─────────────────────

describe('extractReferences — mixed ref types in single formula (STRESS-03)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(FIXTURES.mixedRefs)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('STRESS-03a: A1 detects both cross-sheet and external ref in one formula', () => {
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'mixed-refs.xlsx', new Map(), new Map(),
    )
    const a1Refs = references.filter(r => r.sourceCell === 'A1')
    const crossSheet = a1Refs.find(r => r.targetSheet === 'Sheet2' && !r.targetWorkbook)
    const external = a1Refs.find(r => r.targetWorkbook === 'Budget.xlsx')
    expect(crossSheet).toBeDefined()
    expect(external).toBeDefined()
  })

  it('STRESS-03b: B1 detects 3D ref and named range in one formula', () => {
    const namedRanges = extractNamedRanges(wb)
    const namedRangeMap = new Map(namedRanges.map(nr => [nr.name.toLowerCase(), nr]))
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'mixed-refs.xlsx', new Map(), namedRangeMap,
    )
    const b1Refs = references.filter(r => r.sourceCell === 'B1')
    const ref3d = b1Refs.find(r => r.is3DRef)
    const nrRef = b1Refs.find(r => r.namedRangeName === 'TaxRate')
    expect(ref3d).toBeDefined()
    expect(nrRef).toBeDefined()
  })

  it('STRESS-03c: C1 detects two different external files and one cross-sheet ref', () => {
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'mixed-refs.xlsx', new Map(), new Map(),
    )
    const c1Refs = references.filter(r => r.sourceCell === 'C1')
    const file1 = c1Refs.find(r => r.targetWorkbook === 'File1.xlsx')
    const file2 = c1Refs.find(r => r.targetWorkbook === 'File2.xlsx')
    const sheet3 = c1Refs.find(r => r.targetSheet === 'Sheet3' && !r.targetWorkbook)
    expect(file1).toBeDefined()
    expect(file2).toBeDefined()
    expect(sheet3).toBeDefined()
    expect(c1Refs.length).toBe(3)
  })
})

// ── STRESS-04: False positives from string literals ─────────────────────────

describe('extractReferences — false positives in string literals (STRESS-04)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(FIXTURES.falsePositives)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('STRESS-04a: pure string formula should produce zero cross-sheet references', () => {
    // A1 = '"Sheet2!A1 is the label"' — this is a string literal, not a real ref
    // The parser currently does regex matching on the raw formula string and
    // does NOT strip string literals first. This test exposes that weakness.
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'false-positives.xlsx', new Map(), new Map(),
    )
    const a1Refs = references.filter(r => r.sourceCell === 'A1')
    // EXPECTED: 0 refs (string literal). ACTUAL: parser may incorrectly detect Sheet2!A1
    expect(a1Refs.length).toBe(0)
  })

  it('STRESS-04b: CONCATENATE with string literal containing ref pattern should not produce external ref', () => {
    // B1 = 'CONCATENATE("Ref: ","[Budget.xlsx]Sheet1!A1")'
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'false-positives.xlsx', new Map(), new Map(),
    )
    const b1Refs = references.filter(r => r.sourceCell === 'B1')
    const extRef = b1Refs.find(r => r.targetWorkbook === 'Budget.xlsx')
    // EXPECTED: no external ref (it's inside a string literal)
    expect(extRef).toBeUndefined()
  })

  it('STRESS-04c: real ref mixed with string should still detect the real ref', () => {
    // C1 = 'Sheet2!A1&" dollars"' — Sheet2!A1 is a real ref, " dollars" is a string
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'false-positives.xlsx', new Map(), new Map(),
    )
    const c1Refs = references.filter(r => r.sourceCell === 'C1')
    expect(c1Refs.length).toBe(1)
    expect(c1Refs[0].targetSheet).toBe('Sheet2')
  })

  it('STRESS-04d: pure string with no ref-like patterns produces zero references', () => {
    // D1 = '"hello world"'
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'false-positives.xlsx', new Map(), new Map(),
    )
    const d1Refs = references.filter(r => r.sourceCell === 'D1')
    expect(d1Refs.length).toBe(0)
  })
})

// ── STRESS-05: Shadowed names (named range shadows sheet name) ──────────────

describe('extractReferences — shadowed names (STRESS-05)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(FIXTURES.shadowedNames)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('STRESS-05a: A1 with Sheet2!A1 detects cross-sheet ref to Sheet2 (not named range)', () => {
    const namedRanges = extractNamedRanges(wb)
    const namedRangeMap = new Map(namedRanges.map(nr => [nr.name.toLowerCase(), nr]))
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'shadowed-names.xlsx', new Map(), namedRangeMap,
    )
    const a1Refs = references.filter(r => r.sourceCell === 'A1')
    // The Sheet2!A1 pattern should be detected as a cross-sheet ref
    const sheetRef = a1Refs.find(r => r.targetSheet === 'Sheet2' && !r.namedRangeName)
    expect(sheetRef).toBeDefined()
  })

  it('STRESS-05b: named range "Sheet2" pointing to Sheet3 exists in extraction', () => {
    const namedRanges = extractNamedRanges(wb)
    const nr = namedRanges.find(r => r.name === 'Sheet2')
    expect(nr).toBeDefined()
    expect(nr?.targetSheet).toBe('Sheet3')
  })

  it('STRESS-05c: B1 with SUM(DataRange) detects named range ref to Sheet3', () => {
    const namedRanges = extractNamedRanges(wb)
    const namedRangeMap = new Map(namedRanges.map(nr => [nr.name.toLowerCase(), nr]))
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'shadowed-names.xlsx', new Map(), namedRangeMap,
    )
    const b1Refs = references.filter(r => r.sourceCell === 'B1')
    const dataRangeRef = b1Refs.find(r => r.namedRangeName === 'DataRange')
    expect(dataRangeRef).toBeDefined()
    expect(dataRangeRef?.targetSheet).toBe('Sheet3')
  })

  it('STRESS-05d: named range "Sheet2" should NOT also be detected as named range ref in A1 formula "Sheet2!A1"', () => {
    // The formula is 'Sheet2!A1' — "Sheet2" appears followed by "!", not followed by "("
    // The named range regex uses \b(Sheet2)\b(?!\() — this would match "Sheet2" in "Sheet2!A1"
    // This is a potential false positive: the parser might double-count Sheet2 as both
    // a sheet ref (to Sheet2) and a named range ref (to Sheet3)
    const namedRanges = extractNamedRanges(wb)
    const namedRangeMap = new Map(namedRanges.map(nr => [nr.name.toLowerCase(), nr]))
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'shadowed-names.xlsx', new Map(), namedRangeMap,
    )
    const a1Refs = references.filter(r => r.sourceCell === 'A1')
    // Check if a named range "Sheet2" was falsely detected in the formula "Sheet2!A1"
    const nrRef = a1Refs.find(r => r.namedRangeName === 'Sheet2')
    // EXPECTED: no named range ref — "Sheet2" in "Sheet2!A1" is a sheet reference, not a named range
    expect(nrRef).toBeUndefined()
  })
})

// ── STRESS-06: Long formulas with many references ───────────────────────────

describe('extractReferences — long formulas (STRESS-06)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(FIXTURES.longFormulas)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('STRESS-06a: formula with 50 cell refs to Sheet2 produces exactly 1 cross-sheet edge', () => {
    // All 50 refs point to Sheet2 — they should be aggregated into one reference
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'long-formulas.xlsx', new Map(), new Map(),
    )
    const a1Refs = references.filter(r => r.sourceCell === 'A1')
    const sheet2Refs = a1Refs.filter(r => r.targetSheet === 'Sheet2')
    expect(sheet2Refs.length).toBe(1)
    // But it should collect all 50 cell addresses
    expect(sheet2Refs[0].cells.length).toBe(50)
  })

  it('STRESS-06b: formula with 20 different sheet targets produces 20 cross-sheet edges', () => {
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'long-formulas.xlsx', new Map(), new Map(),
    )
    const a2Refs = references.filter(r => r.sourceCell === 'A2')
    expect(a2Refs.length).toBe(20)
  })

  it('STRESS-06c: workload metrics sum correctly for long formula', () => {
    const { workload } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'long-formulas.xlsx', new Map(), new Map(),
    )
    expect(workload.totalFormulas).toBe(2)
    // 1 cross-sheet edge from A1 (Sheet2) + 20 from A2 (S1..S20)
    expect(workload.crossSheetRefs).toBe(21)
  })
})

// ── STRESS-07: Deep reference chains ────────────────────────────────────────

describe('extractReferences — deep chains (STRESS-07)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(FIXTURES.deepChains)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('STRESS-07a: Chain2 references Chain1', () => {
    const { references } = extractReferences(
      wb.Sheets['Chain2'], 'Chain2', 'deep-chains.xlsx', new Map(), new Map(),
    )
    expect(references.length).toBeGreaterThanOrEqual(1)
    expect(references[0].targetSheet).toBe('Chain1')
  })

  it('STRESS-07b: Chain25 references Chain24', () => {
    const { references } = extractReferences(
      wb.Sheets['Chain25'], 'Chain25', 'deep-chains.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.targetSheet === 'Chain24')
    expect(ref).toBeDefined()
  })

  it('STRESS-07c: every 5th sheet (5,10,15,20,25) also references Chain1', () => {
    for (const i of [5, 10, 15, 20, 25]) {
      const { references } = extractReferences(
        wb.Sheets[`Chain${i}`], `Chain${i}`, 'deep-chains.xlsx', new Map(), new Map(),
      )
      const backRef = references.find(r => r.targetSheet === 'Chain1')
      expect(backRef).toBeDefined()
    }
  })

  it('STRESS-07d: Chain1 (first in chain) has no cross-sheet references', () => {
    const { references } = extractReferences(
      wb.Sheets['Chain1'], 'Chain1', 'deep-chains.xlsx', new Map(), new Map(),
    )
    expect(references.length).toBe(0)
  })
})

// ── STRESS-08: Quoted specials ──────────────────────────────────────────────

describe('extractReferences — quoted special sheet names (STRESS-08)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(FIXTURES.quotedSpecials)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('STRESS-08a: detects reference to sheet with leading digit (1st Quarter)', () => {
    const { references } = extractReferences(
      wb.Sheets['Source'], 'Source', 'quoted-specials.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.targetSheet === '1st Quarter')
    expect(ref).toBeDefined()
  })

  it('STRESS-08b: detects reference to sheet with dots and spaces (Rev. Summary)', () => {
    const { references } = extractReferences(
      wb.Sheets['Source'], 'Source', 'quoted-specials.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.targetSheet === 'Rev. Summary')
    expect(ref).toBeDefined()
  })

  it("STRESS-08c: detects reference to sheet with embedded apostrophe (It's Data)", () => {
    const { references } = extractReferences(
      wb.Sheets['Source'], 'Source', 'quoted-specials.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.targetSheet === "It's Data")
    expect(ref).toBeDefined()
  })

  it('STRESS-08d: detects reference with bracketed external in quoted form', () => {
    // D1 = "'[Budget.xlsx]Sheet1'!A1" — external ref in quoted sheet name form
    const { references } = extractReferences(
      wb.Sheets['Source'], 'Source', 'quoted-specials.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.targetWorkbook === 'Budget.xlsx')
    expect(ref).toBeDefined()
  })
})

// ── STRESS-09: Nested functions wrapping references ─────────────────────────

describe('extractReferences — nested functions (STRESS-09)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(FIXTURES.nestedFunctions)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('STRESS-09a: IF() with two different sheet refs detects both', () => {
    // A1 = 'IF(A2>0,Sheet2!B1,Sheet3!C1)'
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'nested-functions.xlsx', new Map(), new Map(),
    )
    const a1Refs = references.filter(r => r.sourceCell === 'A1')
    const sheet2 = a1Refs.find(r => r.targetSheet === 'Sheet2')
    const sheet3 = a1Refs.find(r => r.targetSheet === 'Sheet3')
    expect(sheet2).toBeDefined()
    expect(sheet3).toBeDefined()
    expect(a1Refs.length).toBe(2)
  })

  it('STRESS-09b: VLOOKUP with external ref detects the external file', () => {
    // B1 = 'VLOOKUP(A1,[Budget.xlsx]Data!A1:B10,2,FALSE)'
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'nested-functions.xlsx', new Map(), new Map(),
    )
    const b1Refs = references.filter(r => r.sourceCell === 'B1')
    const extRef = b1Refs.find(r => r.targetWorkbook === 'Budget.xlsx')
    expect(extRef).toBeDefined()
    expect(extRef?.targetSheet).toBe('Data')
  })

  it('STRESS-09c: INDEX/MATCH with cross-sheet refs detects both target sheets', () => {
    // C1 = 'INDEX(Sheet2!A1:A10,MATCH(A1,Sheet3!B1:B10,0))'
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'nested-functions.xlsx', new Map(), new Map(),
    )
    const c1Refs = references.filter(r => r.sourceCell === 'C1')
    const sheet2 = c1Refs.find(r => r.targetSheet === 'Sheet2')
    const sheet3 = c1Refs.find(r => r.targetSheet === 'Sheet3')
    expect(sheet2).toBeDefined()
    expect(sheet3).toBeDefined()
    expect(c1Refs.length).toBe(2)
  })
})

// ── STRESS-10: Numeric external link indices with linkMap ───────────────────

describe('extractReferences — numeric external link indices (STRESS-10)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    const buf = readFileSync(FIXTURES.numericExternalLinks)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('STRESS-10a: [1]Prices!A1 resolved via linkMap to actual filename', () => {
    const linkMap = new Map([
      ['1', 'Assumptions.xlsx'],
      ['2', 'Config.xlsx'],
    ])
    const { references } = extractReferences(
      wb.Sheets['Local'], 'Local', 'numeric-external-links.xlsx', linkMap, new Map(),
    )
    const ref = references.find(r => r.targetWorkbook === 'Assumptions.xlsx' && r.targetSheet === 'Prices')
    expect(ref).toBeDefined()
  })

  it('STRESS-10b: [2]Config!B2 resolved via linkMap', () => {
    const linkMap = new Map([
      ['1', 'Assumptions.xlsx'],
      ['2', 'Config.xlsx'],
    ])
    const { references } = extractReferences(
      wb.Sheets['Local'], 'Local', 'numeric-external-links.xlsx', linkMap, new Map(),
    )
    const ref = references.find(r => r.targetWorkbook === 'Config.xlsx' && r.targetSheet === 'Config')
    expect(ref).toBeDefined()
  })

  it('STRESS-10c: [1] with quoted sheet name resolves correctly', () => {
    // C1 = "[1]'Sheet With Spaces'!C3"
    const linkMap = new Map([
      ['1', 'Assumptions.xlsx'],
      ['2', 'Config.xlsx'],
    ])
    const { references } = extractReferences(
      wb.Sheets['Local'], 'Local', 'numeric-external-links.xlsx', linkMap, new Map(),
    )
    const ref = references.find(r => r.targetWorkbook === 'Assumptions.xlsx' && r.targetSheet === 'Sheet With Spaces')
    expect(ref).toBeDefined()
  })

  it('STRESS-10d: [25] beyond the 20-link limit is still detected as external ref', () => {
    // D1 = '[25]FarAway!D4' — index 25 won't be in any linkMap from buildExternalLinkMap
    // but the bracketed format should still be detected as an external ref
    const linkMap = new Map<string, string>() // empty — no rels files
    const { references } = extractReferences(
      wb.Sheets['Local'], 'Local', 'numeric-external-links.xlsx', linkMap, new Map(),
    )
    const ref = references.find(r => r.targetSheet === 'FarAway')
    expect(ref).toBeDefined()
    // Without linkMap resolution, targetWorkbook should be the raw index "25"
    expect(ref?.targetWorkbook).toBe('25')
  })

  it('STRESS-10e: workload correctly counts all as crossFileRefs', () => {
    const linkMap = new Map([
      ['1', 'Assumptions.xlsx'],
      ['2', 'Config.xlsx'],
    ])
    const { workload } = extractReferences(
      wb.Sheets['Local'], 'Local', 'numeric-external-links.xlsx', linkMap, new Map(),
    )
    expect(workload.crossFileRefs).toBeGreaterThanOrEqual(4)
    expect(workload.crossSheetRefs).toBe(0)
  })
})

// ── STRESS-11: Inline edge cases (no fixture needed) ────────────────────────

describe('extractReferences — inline edge cases (STRESS-11)', () => {
  it('STRESS-11a: formula with only string literal "Sheet2!A1" (no real ref) — false positive test', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: '"Sheet2!A1"' }
    sheet['!ref'] = 'A1:A1'
    const { references } = extractReferences(sheet, 'Sheet1', 'test.xlsx', new Map(), new Map())
    // The parser regex does not strip string literals. This exposes the false positive.
    // EXPECTED: 0 references. ACTUAL: may find Sheet2!A1 inside the string literal.
    expect(references.length).toBe(0)
  })

  it('STRESS-11b: named range name that matches a function name like "SUM" should not false-match', () => {
    // This is tricky: if someone defines a named range called "MAX" or "SUM",
    // the (?!\() guard should prevent matching "SUM(" but might still match "SUM" in other contexts
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'SUM(Sheet2!A1:A10)' }
    sheet['!ref'] = 'A1:A1'
    const namedRangeMap = new Map<string, NamedRange>([
      ['sum', {
        name: 'SUM',
        ref: 'Sheet3!A1:A10',
        targetSheet: 'Sheet3',
        targetWorkbook: null,
        cells: 'A1:A10',
        scope: 'workbook',
        scopeSheet: undefined,
      }],
    ])
    const { references } = extractReferences(sheet, 'Sheet1', 'test.xlsx', new Map(), namedRangeMap)
    // SUM( should NOT match as named range due to (?!\() guard
    const nrRef = references.find(r => r.namedRangeName === 'SUM')
    expect(nrRef).toBeUndefined()
  })

  it('STRESS-11c: empty sheet name in formula is handled gracefully', () => {
    const sheet: XLSX.WorkSheet = {}
    // Malformed formula with empty sheet part: '!A1' — should not crash
    sheet['A1'] = { t: 'n', v: 0, f: "'!A1" }
    sheet['!ref'] = 'A1:A1'
    // Should not throw
    const { references } = extractReferences(sheet, 'Sheet1', 'test.xlsx', new Map(), new Map())
    // May produce 0 or some refs — the key is it doesn't crash
    expect(Array.isArray(references)).toBe(true)
  })

  it('STRESS-11d: formula with tab/newline characters does not crash', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'Sheet2!A1\n+Sheet3!B1' }
    sheet['!ref'] = 'A1:A1'
    const { references } = extractReferences(sheet, 'Sheet1', 'test.xlsx', new Map(), new Map())
    expect(Array.isArray(references)).toBe(true)
  })

  it('STRESS-11e: very long sheet name (100+ chars) is handled', () => {
    const longName = 'A'.repeat(120)
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: `${longName}!A1` }
    sheet['!ref'] = 'A1:A1'
    const { references } = extractReferences(sheet, 'Sheet1', 'test.xlsx', new Map(), new Map())
    // The regex UNQUOTED_SHEET allows word chars, dots, spaces — 'A' x 120 should match
    const ref = references.find(r => r.targetSheet === longName)
    expect(ref).toBeDefined()
  })

  it('STRESS-11f: table name that shadows a named range name — both detected', () => {
    const sheet: XLSX.WorkSheet = {}
    // Formula: SalesData[Amount] + SalesData
    // "SalesData" is both a table name and a named range name
    sheet['A1'] = { t: 'n', v: 0, f: 'SalesData[Amount]' }
    sheet['B1'] = { t: 'n', v: 0, f: 'SalesData' }
    sheet['!ref'] = 'A1:B1'

    const tableMap = new Map<string, ExcelTable>([
      ['salesdata', { name: 'SalesData', ref: 'A1:B10', targetSheet: 'Data', cells: 'A1:B10' }],
    ])
    const namedRangeMap = new Map<string, NamedRange>([
      ['salesdata', {
        name: 'SalesData',
        ref: 'Config!A1:A5',
        targetSheet: 'Config',
        targetWorkbook: null,
        cells: 'A1:A5',
        scope: 'workbook',
        scopeSheet: undefined,
      }],
    ])

    const { references } = extractReferences(
      sheet, 'Sheet1', 'test.xlsx', new Map(), namedRangeMap, tableMap,
    )

    // A1 should detect table ref to Data
    const a1Tbl = references.find(r => r.sourceCell === 'A1' && r.tableName === 'SalesData')
    expect(a1Tbl).toBeDefined()
    expect(a1Tbl?.targetSheet).toBe('Data')

    // B1 should detect named range ref to Config (since SalesData is also a named range)
    const b1Nr = references.find(r => r.sourceCell === 'B1' && r.namedRangeName === 'SalesData')
    expect(b1Nr).toBeDefined()
    expect(b1Nr?.targetSheet).toBe('Config')
  })
})
