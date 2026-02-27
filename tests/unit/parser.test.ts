// tests/unit/parser.test.ts
// Environment: node (default from vitest.config.ts — no environment override needed)
// Covers: PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06, PARSE-07, PARSE-08
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { FIXTURES } from '../fixtures/index'
import { extractReferences, extractNamedRanges, buildExternalLinkMap } from '../../src/lib/parser'

// ── PARSE-01: Functions are importable ───────────────────────────────────────
// Verified implicitly: if this file loads without error, the exports exist.
// Explicit check in the first test below.

// ── PARSE-02 + PARSE-08: Unquoted cross-sheet ref + workload metrics ─────────
describe('extractReferences — unquoted cross-sheet ref (PARSE-02, PARSE-08)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    // cross-sheet.xlsx: Sheet1.A1.f = 'Sheet2!A1' (unquoted, no spaces in name)
    const buf = readFileSync(FIXTURES.crossSheet)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('PARSE-01: extractReferences is exported and callable', () => {
    // If import above succeeded, the function exists. Call it to confirm runtime shape.
    const result = extractReferences(wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), new Map())
    expect(result).toHaveProperty('references')
    expect(result).toHaveProperty('workload')
  })

  it('PARSE-02: detects unquoted cross-sheet reference SheetName!A1', () => {
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), new Map()
    )
    expect(references).toHaveLength(1)
    expect(references[0].targetSheet).toBe('Sheet2')
    expect(references[0].targetWorkbook).toBeNull()
    expect(references[0].cells).toContain('A1')
  })

  it('PARSE-08: workload metrics are correct for one cross-sheet formula', () => {
    const { workload } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), new Map()
    )
    expect(workload.totalFormulas).toBe(1)
    expect(workload.crossSheetRefs).toBe(1)
    expect(workload.crossFileRefs).toBe(0)
    expect(workload.withinSheetRefs).toBe(0)
  })
})

// ── PARSE-03: Quoted cross-sheet ref (sheet name with spaces) ────────────────
describe('extractReferences — quoted cross-sheet ref (PARSE-03)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    // Inline workbook — cross-sheet.xlsx uses unquoted names.
    // PARSE-03 requires 'Sheet Name'!A1:B2 (spaces require quoting in Excel).
    const wbRaw = XLSX.utils.book_new()
    const sheet1: XLSX.WorkSheet = {}
    // Formula references a sheet whose name contains a space — must be quoted
    sheet1['A1'] = { t: 'n', v: 0, f: "'Sheet Name'!A1:B2" }
    sheet1['!ref'] = 'A1:A1'
    const sheetWithSpace = XLSX.utils.aoa_to_sheet([['src', 1]])
    XLSX.utils.book_append_sheet(wbRaw, sheet1, 'Sheet1')
    XLSX.utils.book_append_sheet(wbRaw, sheetWithSpace, 'Sheet Name')
    // Write + read back to ensure cell.f survives round-trip
    const buf = XLSX.write(wbRaw, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it("PARSE-03: detects quoted cross-sheet reference 'Sheet Name'!A1:B2", () => {
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), new Map()
    )
    expect(references).toHaveLength(1)
    expect(references[0].targetSheet).toBe('Sheet Name')
    expect(references[0].targetWorkbook).toBeNull()
    expect(references[0].cells).toContain('A1:B2')
  })
})

// ── PARSE-04: Numeric external link index resolution ─────────────────────────
describe('extractReferences — numeric external link index (PARSE-04)', () => {
  it('PARSE-04: resolves [1]Prices!C3 to actual filename via linkMap', () => {
    // Inline sheet — SheetJS programmatic writes do NOT produce xl/externalLinks/_rels/
    // entries, so numeric index format cannot come from a fixture file.
    // Pass a mock linkMap directly to test the resolution path.
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: '[1]Prices!C3' }
    sheet['!ref'] = 'A1:A1'
    const linkMap = new Map([['1', 'Assumptions.xlsx']])
    const { references } = extractReferences(sheet, 'Sheet1', 'Source.xlsx', linkMap, new Map())
    expect(references).toHaveLength(1)
    expect(references[0].targetWorkbook).toBe('Assumptions.xlsx')
    expect(references[0].targetSheet).toBe('Prices')
  })

  it('PARSE-04: buildExternalLinkMap is exported and returns a Map', () => {
    // Smoke-test the export itself with an empty workbook (no externalLinks)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['val']]), 'Sheet1')
    const map = buildExternalLinkMap(wb)
    expect(map).toBeInstanceOf(Map)
    // Empty workbook has no external links
    expect(map.size).toBe(0)
  })
})

// ── PARSE-05: Bracketed filename external ref ─────────────────────────────────
describe('extractReferences — bracketed filename external ref (PARSE-05)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    // external-ref.xlsx: Sheet1.A1.f = '[External.xlsx]Prices!C3'
    const buf = readFileSync(FIXTURES.externalRef)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('PARSE-05: detects [External.xlsx]Prices!C3 as a cross-file reference', () => {
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), new Map()
    )
    expect(references).toHaveLength(1)
    expect(references[0].targetWorkbook).toBe('External.xlsx')
    expect(references[0].targetSheet).toBe('Prices')
    expect(references[0].cells).toContain('C3')
  })

  it('PARSE-08: crossFileRefs metric is incremented for external file reference', () => {
    const { workload } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), new Map()
    )
    expect(workload.totalFormulas).toBe(1)
    expect(workload.crossFileRefs).toBe(1)
    expect(workload.crossSheetRefs).toBe(0)
    expect(workload.withinSheetRefs).toBe(0)
  })
})

// ── PARSE-06 + PARSE-07: Named range detection and dedup ──────────────────────
describe('extractReferences — named ranges (PARSE-06, PARSE-07)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    // Inline workbook — named-ranges.xlsx only DEFINES MyRange but has no formula
    // that references it by name. Construct inline for named range USAGE tests.
    const wbRaw = XLSX.utils.book_new()
    const sheet1: XLSX.WorkSheet = {}
    sheet1['A1'] = { t: 'n', v: 0, f: 'MyRange' }              // named range reference
    sheet1['A2'] = { t: 'n', v: 0, f: 'SUM(Sheet2!B1:B5)' }    // function call — NOT a named range
    sheet1['A3'] = { t: 'n', v: 0, f: 'MyRange+MyRange' }       // same named range twice
    sheet1['!ref'] = 'A1:A3'
    const sheet2 = XLSX.utils.aoa_to_sheet([['src', 1, 2, 3, 4, 5]])
    XLSX.utils.book_append_sheet(wbRaw, sheet1, 'Sheet1')
    XLSX.utils.book_append_sheet(wbRaw, sheet2, 'Sheet2')
    if (!wbRaw.Workbook) wbRaw.Workbook = { Names: [], Views: [], WBProps: {} }
    wbRaw.Workbook.Names = [{ Name: 'MyRange', Ref: 'Sheet2!A1:A10', Sheet: undefined }]
    // Write + read back to preserve cell.f strings
    const buf = XLSX.write(wbRaw, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('PARSE-06: extractNamedRanges is exported and returns NamedRange[]', () => {
    const namedRanges = extractNamedRanges(wb)
    expect(Array.isArray(namedRanges)).toBe(true)
    expect(namedRanges).toHaveLength(1)
    expect(namedRanges[0].name).toBe('MyRange')
    expect(namedRanges[0].targetSheet).toBe('Sheet2')
  })

  it('PARSE-06: detects named range reference in formula (MyRange → Sheet2)', () => {
    const namedRanges = extractNamedRanges(wb)
    const namedRangeMap = new Map(namedRanges.map(nr => [nr.name.toLowerCase(), nr]))
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), namedRangeMap
    )
    const nrRef = references.find(r => r.namedRangeName === 'MyRange')
    expect(nrRef).toBeDefined()
    expect(nrRef?.targetSheet).toBe('Sheet2')
    expect(nrRef?.namedRangeName).toBe('MyRange')
  })

  it('PARSE-06: SUM() is NOT detected as a named range reference', () => {
    const namedRanges = extractNamedRanges(wb)
    const namedRangeMap = new Map(namedRanges.map(nr => [nr.name.toLowerCase(), nr]))
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), namedRangeMap
    )
    // No reference should have namedRangeName = 'SUM'
    const sumRef = references.find(r => r.namedRangeName === 'SUM')
    expect(sumRef).toBeUndefined()
  })

  it('PARSE-07: duplicate named range in one formula emits exactly one edge', () => {
    // A3 = 'MyRange+MyRange' — should produce exactly 1 ref for MyRange, not 2
    const namedRanges = extractNamedRanges(wb)
    const namedRangeMap = new Map(namedRanges.map(nr => [nr.name.toLowerCase(), nr]))
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'test.xlsx', new Map(), namedRangeMap
    )
    const a3Refs = references.filter(r => r.sourceCell === 'A3')
    const myRangeRefs = a3Refs.filter(r => r.namedRangeName === 'MyRange')
    expect(myRangeRefs).toHaveLength(1)
  })
})
