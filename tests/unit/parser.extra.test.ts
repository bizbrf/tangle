// tests/unit/parser.extra.test.ts
// Environment: node / jsdom (jsdom only where parseWorkbook is tested)
// Covers additional branches not hit by parser.test.ts:
//   - extractNamedRanges: sheet-scoped named range (scope='sheet' path)
//   - extractNamedRanges: built-in name filter (_xlnm.)
//   - extractNamedRanges: named range ref without '!' (no sheet part)
//   - extractNamedRanges: quoted sheet name in ref
//   - extractReferences: named range that targets the same sheet (within-sheet skip)
//   - extractReferences: self-workbook + self-sheet via explicit workbook prefix
//   - extractReferences: plain within-sheet ref (no workbook prefix, same sheet)
import * as XLSX from 'xlsx'
import { describe, it, expect } from 'vitest'
import { extractNamedRanges, extractReferences } from '../../src/lib/parser'
import type { NamedRange } from '../../src/types'

// ── PARSE-14: extractNamedRanges — sheet-scoped named ranges ─────────────────

describe('extractNamedRanges — sheet-scoped named range (PARSE-14)', () => {
  it('PARSE-14: sheet-scoped named range has scope="sheet" and correct scopeSheet', () => {
    // Build a workbook with a sheet-scoped named range (entry.Sheet = 0 → Sheet1)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['val']]), 'Sheet1')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['val']]), 'Sheet2')
    if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
    // Sheet: 0 means this named range is scoped to SheetNames[0] = 'Sheet1'
    wb.Workbook.Names = [{ Name: 'LocalRange', Ref: 'Sheet2!B1:B5', Sheet: 0 }]

    const ranges = extractNamedRanges(wb)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].scope).toBe('sheet')
    expect(ranges[0].scopeSheet).toBe('Sheet1')
    expect(ranges[0].name).toBe('LocalRange')
    expect(ranges[0].targetSheet).toBe('Sheet2')
  })

  it('PARSE-14: workbook-scoped named range has scope="workbook" and no scopeSheet', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['val']]), 'Sheet1')
    if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
    wb.Workbook.Names = [{ Name: 'GlobalRange', Ref: 'Sheet1!A1:A10', Sheet: undefined }]

    const ranges = extractNamedRanges(wb)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].scope).toBe('workbook')
    expect(ranges[0].scopeSheet).toBeUndefined()
  })

  it('PARSE-14: built-in _xlnm. names are filtered out', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['val']]), 'Sheet1')
    if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
    wb.Workbook.Names = [
      { Name: '_xlnm.Print_Area', Ref: 'Sheet1!A1:D10', Sheet: undefined },
      { Name: 'ValidRange', Ref: 'Sheet1!A1:A5', Sheet: undefined },
    ]

    const ranges = extractNamedRanges(wb)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].name).toBe('ValidRange')
  })

  it('PARSE-14: named range ref without "!" has empty targetSheet and full ref as cells', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['val']]), 'Sheet1')
    if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
    // Ref with no "!" — unusual but should be handled gracefully
    wb.Workbook.Names = [{ Name: 'FlatRange', Ref: 'A1:A10', Sheet: undefined }]

    const ranges = extractNamedRanges(wb)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].targetSheet).toBe('')
    expect(ranges[0].cells).toBe('A1:A10')
  })

  it('PARSE-14: named range ref with quoted sheet name strips surrounding quotes', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['val']]), 'My Sheet')
    if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
    // Sheet name with spaces must be quoted in the Ref
    wb.Workbook.Names = [{ Name: 'QuotedRange', Ref: "'My Sheet'!C1:C5", Sheet: undefined }]

    const ranges = extractNamedRanges(wb)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].targetSheet).toBe('My Sheet')
    expect(ranges[0].cells).toBe('C1:C5')
  })

  it('PARSE-14: entry without Name or Ref is skipped', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['val']]), 'Sheet1')
    if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
    // Missing Name and missing Ref — both should be skipped
    wb.Workbook.Names = [
      { Name: undefined, Ref: 'Sheet1!A1', Sheet: undefined },
      { Name: 'NoRef', Ref: undefined, Sheet: undefined },
      { Name: 'Valid', Ref: 'Sheet1!B1', Sheet: undefined },
    ]

    const ranges = extractNamedRanges(wb)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].name).toBe('Valid')
  })
})

// ── PARSE-15: extractReferences — named range within-sheet skip ───────────────

describe('extractReferences — named range within-sheet skip (PARSE-15)', () => {
  it('PARSE-15: named range targeting the same sheet is skipped and counted as withinSheetRef', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'LocalRange' }
    sheet['!ref'] = 'A1:A1'

    // LocalRange targets Sheet1 (same as source sheet)
    const namedRangeMap = new Map<string, NamedRange>([
      ['localrange', {
        name: 'LocalRange',
        ref: 'Sheet1!A1:A5',
        targetSheet: 'Sheet1',
        targetWorkbook: null,
        cells: 'A1:A5',
        scope: 'workbook',
        scopeSheet: undefined,
      }],
    ])

    const { references, workload } = extractReferences(
      sheet, 'Sheet1', 'test.xlsx', new Map(), namedRangeMap,
    )
    // Named range targets same sheet → within-sheet ref, not emitted as a cross-sheet reference
    expect(references.find(r => r.namedRangeName === 'LocalRange')).toBeUndefined()
    expect(workload.withinSheetRefs).toBe(1)
  })

  it('PARSE-15: named range targeting a different sheet IS emitted as a cross-sheet reference', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'CrossRange' }
    sheet['!ref'] = 'A1:A1'

    const namedRangeMap = new Map<string, NamedRange>([
      ['crossrange', {
        name: 'CrossRange',
        ref: 'Sheet2!B1:B5',
        targetSheet: 'Sheet2',
        targetWorkbook: null,
        cells: 'B1:B5',
        scope: 'workbook',
        scopeSheet: undefined,
      }],
    ])

    const { references } = extractReferences(
      sheet, 'Sheet1', 'test.xlsx', new Map(), namedRangeMap,
    )
    const ref = references.find(r => r.namedRangeName === 'CrossRange')
    expect(ref).toBeDefined()
    expect(ref?.targetSheet).toBe('Sheet2')
  })
})

// ── PARSE-16: extractReferences — self-workbook+sheet via explicit prefix ──────

describe('extractReferences — self-workbook self-sheet skip (PARSE-16)', () => {
  it('PARSE-16: ref with explicit workbook prefix matching source workbook + sheet is counted as withinSheetRef', () => {
    const sheet: XLSX.WorkSheet = {}
    // Formula references the same workbook (by name) and same sheet
    sheet['A1'] = { t: 'n', v: 0, f: '[Source.xlsx]Sheet1!B2' }
    sheet['!ref'] = 'A1:A1'

    const { references, workload } = extractReferences(
      sheet, 'Sheet1', 'Source.xlsx', new Map(), new Map(),
    )
    // Self-reference: source wb + sheet = target wb + sheet → within-sheet, not emitted
    expect(references).toHaveLength(0)
    expect(workload.withinSheetRefs).toBe(1)
  })
})

// ── PARSE-17: extractReferences — plain same-sheet ref (no workbook prefix) ───

describe('extractReferences — plain same-sheet cell ref (PARSE-17)', () => {
  it('PARSE-17: formula referencing same sheet without workbook prefix is counted as withinSheetRef', () => {
    const sheet: XLSX.WorkSheet = {}
    // Formula: Sheet1!A2 when source sheet is Sheet1 → within-sheet
    sheet['B1'] = { t: 'n', v: 0, f: 'Sheet1!A2' }
    sheet['!ref'] = 'B1:B1'

    const { references, workload } = extractReferences(
      sheet, 'Sheet1', 'test.xlsx', new Map(), new Map(),
    )
    expect(references).toHaveLength(0)
    expect(workload.withinSheetRefs).toBe(1)
    expect(workload.crossSheetRefs).toBe(0)
    expect(workload.totalFormulas).toBe(1)
  })

  it('PARSE-17: formula referencing a DIFFERENT sheet without workbook prefix is emitted as cross-sheet ref', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['B1'] = { t: 'n', v: 0, f: 'Sheet2!A2' }
    sheet['!ref'] = 'B1:B1'

    const { references, workload } = extractReferences(
      sheet, 'Sheet1', 'test.xlsx', new Map(), new Map(),
    )
    expect(references).toHaveLength(1)
    expect(references[0].targetSheet).toBe('Sheet2')
    expect(workload.crossSheetRefs).toBe(1)
    expect(workload.withinSheetRefs).toBe(0)
  })
})

// ── PARSE-18: extractReferences — sheet passed as null/undefined ──────────────

describe('extractReferences — null sheet guard (PARSE-18)', () => {
  it('PARSE-18: returns empty refs and zero workload when sheet is null/undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { references, workload } = extractReferences(null as any, 'Sheet1', 'test.xlsx', new Map(), new Map())
    expect(references).toHaveLength(0)
    expect(workload.totalFormulas).toBe(0)
  })
})
