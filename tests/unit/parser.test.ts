// tests/unit/parser.test.ts
// Environment: node (default from vitest.config.ts — no environment override needed)
// Covers: PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06, PARSE-07, PARSE-08, PARSE-12, PARSE-13
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { FIXTURES } from '../fixtures/index'
import { extractReferences, extractNamedRanges, buildExternalLinkMap, extractTables } from '../../src/lib/parser'

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

  it("PARSE-05: tolerates malformed external refs like [Book.xlsx]'Sheet Name'!A1 from generated fixtures", () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: "[financial-projection.xlsx]'Balance Sheet'!I16" }
    sheet['!ref'] = 'A1:A1'

    const { references } = extractReferences(sheet, 'Capital Summary', 'capital-model.xlsx', new Map(), new Map())

    expect(references).toHaveLength(1)
    expect(references[0].targetWorkbook).toBe('financial-projection.xlsx')
    expect(references[0].targetSheet).toBe('Balance Sheet')
    expect(references[0].cells).toContain('I16')
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

// ── PARSE-12: Excel table extraction ─────────────────────────────────────────
describe('extractTables (PARSE-12)', () => {
  it('PARSE-12: extractTables is exported and returns an empty array for a workbook with no tables', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['val']]), 'Sheet1')
    const tables = extractTables(wb)
    expect(Array.isArray(tables)).toBe(true)
    expect(tables).toHaveLength(0)
  })

  it('PARSE-12: returns table with correct name, ref, targetSheet, and cells', () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['Name', 'Value'], ['Alice', 1]])
    // Manually inject !tables metadata (mirrors what SheetJS sets when reading a real xlsx with tables)
    ;(ws as Record<string, unknown>)['!tables'] = [
      { displayName: 'SalesTable', name: 'Table1', ref: 'A1:B2' },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    const tables = extractTables(wb)
    expect(tables).toHaveLength(1)
    expect(tables[0].name).toBe('SalesTable')
    expect(tables[0].ref).toBe('A1:B2')
    expect(tables[0].targetSheet).toBe('Data')
    expect(tables[0].cells).toBe('A1:B2')
  })

  it('PARSE-12: falls back to name property when displayName is absent', () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['val']])
    ;(ws as Record<string, unknown>)['!tables'] = [{ name: 'Table2', ref: 'A1:A5' }]
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const tables = extractTables(wb)
    expect(tables).toHaveLength(1)
    expect(tables[0].name).toBe('Table2')
  })

  it('PARSE-12: collects tables from multiple sheets', () => {
    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.aoa_to_sheet([['A', 'B']])
    ;(ws1 as Record<string, unknown>)['!tables'] = [{ displayName: 'TableA', name: 'TableA', ref: 'A1:B5' }]
    const ws2 = XLSX.utils.aoa_to_sheet([['X']])
    ;(ws2 as Record<string, unknown>)['!tables'] = [{ displayName: 'TableB', name: 'TableB', ref: 'A1:A3' }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1')
    XLSX.utils.book_append_sheet(wb, ws2, 'Sheet2')
    const tables = extractTables(wb)
    expect(tables).toHaveLength(2)
    expect(tables.map(t => t.name).sort()).toEqual(['TableA', 'TableB'])
    expect(tables.find(t => t.name === 'TableA')?.targetSheet).toBe('Sheet1')
    expect(tables.find(t => t.name === 'TableB')?.targetSheet).toBe('Sheet2')
  })
})

// ── PARSE-13: Table structured reference detection ────────────────────────────
describe('extractReferences — table structured refs (PARSE-13)', () => {
  it('PARSE-13: detects structured reference TableName[Column] in formula', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['B1'] = { t: 'n', v: 0, f: 'SUM(SalesTable[Amount])' }
    sheet['!ref'] = 'B1:B1'
    const tableMap = new Map([
      ['salestable', { name: 'SalesTable', ref: 'A1:B10', targetSheet: 'Data', cells: 'A1:B10' }],
    ])
    const { references } = extractReferences(sheet, 'Summary', 'test.xlsx', new Map(), new Map(), tableMap)
    const tblRef = references.find(r => r.tableName === 'SalesTable')
    expect(tblRef).toBeDefined()
    expect(tblRef?.targetSheet).toBe('Data')
    expect(tblRef?.tableName).toBe('SalesTable')
  })

  it('PARSE-13: skips table ref when source and target sheet are the same (counts as withinSheetRef)', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['B1'] = { t: 'n', v: 0, f: 'SUM(SalesTable[Amount])' }
    sheet['!ref'] = 'B1:B1'
    const tableMap = new Map([
      ['salestable', { name: 'SalesTable', ref: 'A1:B10', targetSheet: 'Data', cells: 'A1:B10' }],
    ])
    // Source sheet 'Data' matches table's targetSheet 'Data' → within-sheet ref
    const { references, workload } = extractReferences(sheet, 'Data', 'test.xlsx', new Map(), new Map(), tableMap)
    expect(references.find(r => r.tableName === 'SalesTable')).toBeUndefined()
    expect(workload.withinSheetRefs).toBe(1)
  })

  it('PARSE-13: duplicate table name in one formula emits exactly one reference', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['B1'] = { t: 'n', v: 0, f: 'SalesTable[Amount]+SalesTable[Qty]' }
    sheet['!ref'] = 'B1:B1'
    const tableMap = new Map([
      ['salestable', { name: 'SalesTable', ref: 'A1:B10', targetSheet: 'Data', cells: 'A1:B10' }],
    ])
    const { references } = extractReferences(sheet, 'Summary', 'test.xlsx', new Map(), new Map(), tableMap)
    const tblRefs = references.filter(r => r.tableName === 'SalesTable')
    expect(tblRefs).toHaveLength(1)
  })
})

// ── PARSE-14: [@ColumnName] relative row reference detection ──────────────────
describe('extractReferences — [@ColumnName] relative references (PARSE-14)', () => {
  it('PARSE-14: [@ColumnName] is counted as a withinSheetRef', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['C1'] = { t: 'n', v: 0, f: '[@Amount]*1.1' }
    sheet['!ref'] = 'C1:C1'
    const { references, workload } = extractReferences(
      sheet, 'Data', 'test.xlsx', new Map(), new Map()
    )
    // [@ColumnName] is a within-table relative reference — no cross-sheet edge produced
    expect(references).toHaveLength(0)
    expect(workload.withinSheetRefs).toBeGreaterThanOrEqual(1)
  })

  it('PARSE-14: multiple [@Column] refs in one formula each count as a withinSheetRef', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['C1'] = { t: 'n', v: 0, f: '[@Price]*[@Qty]' }
    sheet['!ref'] = 'C1:C1'
    const { workload } = extractReferences(
      sheet, 'Data', 'test.xlsx', new Map(), new Map()
    )
    expect(workload.withinSheetRefs).toBeGreaterThanOrEqual(2)
  })
})

// ── PARSE-15: QueryName.Result[ColumnName] detection ─────────────────────────
describe('extractReferences — QueryName.Result[Column] (PARSE-15)', () => {
  it('PARSE-15: detects QueryName.Result[Column] and creates a table ref when query is in tableMap', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['B1'] = { t: 'n', v: 0, f: 'SalesQuery.Result[Revenue]' }
    sheet['!ref'] = 'B1:B1'
    const tableMap = new Map([
      ['salesquery', { name: 'SalesQuery', ref: 'A1:C5', targetSheet: 'QueryOutput', cells: 'A1:C5' }],
    ])
    const { references } = extractReferences(
      sheet, 'Summary', 'test.xlsx', new Map(), new Map(), tableMap
    )
    const tblRef = references.find(r => r.tableName === 'SalesQuery')
    expect(tblRef).toBeDefined()
    expect(tblRef?.targetSheet).toBe('QueryOutput')
  })

  it('PARSE-15: QueryName.Result[Column] on same sheet counts as withinSheetRef', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['B1'] = { t: 'n', v: 0, f: 'LocalQuery.Result[Revenue]' }
    sheet['!ref'] = 'B1:B1'
    const tableMap = new Map([
      ['localquery', { name: 'LocalQuery', ref: 'A1:C5', targetSheet: 'Summary', cells: 'A1:C5' }],
    ])
    const { references, workload } = extractReferences(
      sheet, 'Summary', 'test.xlsx', new Map(), new Map(), tableMap
    )
    expect(references.find(r => r.tableName === 'LocalQuery')).toBeUndefined()
    expect(workload.withinSheetRefs).toBeGreaterThanOrEqual(1)
  })
})
