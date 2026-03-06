// tests/unit/parser.extended.test.ts
// Covers: PARSE-19 (3D refs), PARSE-20 (spill refs), PARSE-21 (enhanced structured table refs)
import * as XLSX from 'xlsx'
import { describe, it, expect } from 'vitest'
import { extractReferences } from '../../src/lib/parser'
import type { ExcelTable } from '../../src/types'

// ── PARSE-19: 3D References (Sheet1:Sheet3!A1) ──────────────────────────────

describe('extractReferences — 3D references (PARSE-19)', () => {
  it('PARSE-19a: detects unquoted 3D reference Sheet1:Sheet3!A1', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'SUM(Sheet1:Sheet3!A1)' }
    sheet['!ref'] = 'A1:A1'

    const { references } = extractReferences(
      sheet, 'Summary', 'test.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.is3DRef)
    expect(ref).toBeDefined()
    expect(ref?.targetSheet).toBe('Sheet1')
    expect(ref?.sheetRangeEnd).toBe('Sheet3')
    expect(ref?.cells).toContain('A1')
  })

  it('PARSE-19b: detects quoted 3D reference \'Jan\':\'Mar\'!B2:B100', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: "SUM('Jan':'Mar'!B2:B100)" }
    sheet['!ref'] = 'A1:A1'

    const { references } = extractReferences(
      sheet, 'Summary', 'test.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.is3DRef)
    expect(ref).toBeDefined()
    expect(ref?.targetSheet).toBe('Jan')
    expect(ref?.sheetRangeEnd).toBe('Mar')
    expect(ref?.cells).toContain('B2:B100')
  })

  it('PARSE-19c: 3D ref with spaces in sheet names', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: "SUM('Sheet 1':'Sheet 3'!A1:A10)" }
    sheet['!ref'] = 'A1:A1'

    const { references } = extractReferences(
      sheet, 'Summary', 'test.xlsx', new Map(), new Map(),
    )
    const ref = references.find(r => r.is3DRef)
    expect(ref).toBeDefined()
    expect(ref?.targetSheet).toBe('Sheet 1')
    expect(ref?.sheetRangeEnd).toBe('Sheet 3')
  })

  it('PARSE-19d: 3D ref counted as cross-sheet ref in workload', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'SUM(Sheet1:Sheet3!A1)' }
    sheet['!ref'] = 'A1:A1'

    const { workload } = extractReferences(
      sheet, 'Summary', 'test.xlsx', new Map(), new Map(),
    )
    expect(workload.crossSheetRefs).toBeGreaterThanOrEqual(1)
    expect(workload.totalFormulas).toBe(1)
  })

  it('PARSE-19e: 3D ref where both sheets equal source sheet is within-sheet', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'SUM(Sheet1:Sheet1!A1)' }
    sheet['!ref'] = 'A1:A1'

    const { references, workload } = extractReferences(
      sheet, 'Sheet1', 'test.xlsx', new Map(), new Map(),
    )
    // Self-ref via 3D (same start and end sheet) should be within-sheet
    const ref3d = references.find(r => r.is3DRef)
    expect(ref3d).toBeUndefined()
    expect(workload.withinSheetRefs).toBeGreaterThanOrEqual(1)
  })
})

// ── PARSE-20: Spill References (A1#) ────────────────────────────────────────

describe('extractReferences — spill references (PARSE-20)', () => {
  it('PARSE-20a: detects cross-sheet spill reference Sheet2!A1#', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'FILTER(Sheet2!A1#,Sheet2!B1#>0)' }
    sheet['!ref'] = 'A1:A1'

    const { references } = extractReferences(
      sheet, 'Sheet1', 'test.xlsx', new Map(), new Map(),
    )
    const spillRef = references.find(r => r.isSpill)
    expect(spillRef).toBeDefined()
    expect(spillRef?.targetSheet).toBe('Sheet2')
    expect(spillRef?.cells.some(c => c.includes('#'))).toBe(true)
  })

  it('PARSE-20b: spill ref on same-sheet reference is within-sheet', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['B1'] = { t: 'n', v: 0, f: 'SORT(Sheet1!A1#)' }
    sheet['!ref'] = 'B1:B1'

    const { references, workload } = extractReferences(
      sheet, 'Sheet1', 'test.xlsx', new Map(), new Map(),
    )
    // Same-sheet spill ref should not be emitted as cross-sheet
    const spillRef = references.find(r => r.isSpill && r.targetSheet === 'Sheet1')
    expect(spillRef).toBeUndefined()
    expect(workload.withinSheetRefs).toBeGreaterThanOrEqual(1)
  })

  it('PARSE-20c: bare spill ref without sheet prefix is within-sheet', () => {
    const sheet: XLSX.WorkSheet = {}
    // A formula that uses A1# without a sheet prefix — pure local ref
    sheet['B1'] = { t: 'n', v: 0, f: 'SORT(A1#)' }
    sheet['!ref'] = 'B1:B1'

    const { references, workload } = extractReferences(
      sheet, 'Sheet1', 'test.xlsx', new Map(), new Map(),
    )
    expect(references.filter(r => r.isSpill)).toHaveLength(0)
    expect(workload.withinSheetRefs).toBeGreaterThanOrEqual(1)
  })

  it('PARSE-20d: quoted sheet spill ref \'Data Sheet\'!C5#', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: "SORT('Data Sheet'!C5#)" }
    sheet['!ref'] = 'A1:A1'

    const { references } = extractReferences(
      sheet, 'Sheet1', 'test.xlsx', new Map(), new Map(),
    )
    const spillRef = references.find(r => r.isSpill)
    expect(spillRef).toBeDefined()
    expect(spillRef?.targetSheet).toBe('Data Sheet')
    expect(spillRef?.cells.some(c => c.includes('#'))).toBe(true)
  })
})

// ── PARSE-21: Enhanced Structured Table References ──────────────────────────

describe('extractReferences — enhanced structured table refs (PARSE-21)', () => {
  const tableMap = new Map<string, ExcelTable>([
    ['salestable', {
      name: 'SalesTable',
      ref: 'A1:D100',
      targetSheet: 'Data',
      cells: 'A1:D100',
      columns: ['Name', 'Amount', 'Date', 'Region'],
    }],
  ])

  it('PARSE-21a: Table1[[#Headers],[Name]] parsed with headers kind', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'SalesTable[[#Headers],[Name]]' }
    sheet['!ref'] = 'A1:A1'

    const { references } = extractReferences(
      sheet, 'Summary', 'test.xlsx', new Map(), new Map(), tableMap,
    )
    const ref = references.find(r => r.structuredRef?.kind === 'headers')
    expect(ref).toBeDefined()
    expect(ref?.tableName).toBe('SalesTable')
    expect(ref?.structuredRef?.specifier).toBe('#Headers')
    expect(ref?.structuredRef?.columnName).toBe('Name')
    expect(ref?.targetSheet).toBe('Data')
  })

  it('PARSE-21b: Table1[[#All]] full table with specifier', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'SalesTable[[#All]]' }
    sheet['!ref'] = 'A1:A1'

    const { references } = extractReferences(
      sheet, 'Summary', 'test.xlsx', new Map(), new Map(), tableMap,
    )
    const ref = references.find(r => r.structuredRef?.kind === 'all')
    expect(ref).toBeDefined()
    expect(ref?.tableName).toBe('SalesTable')
    expect(ref?.structuredRef?.specifier).toBe('#All')
    expect(ref?.structuredRef?.columnName).toBeUndefined()
  })

  it('PARSE-21c: Table1[[#This Row],[Amount]] relative row with column', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'SalesTable[[#This Row],[Amount]]' }
    sheet['!ref'] = 'A1:A1'

    const { references } = extractReferences(
      sheet, 'Summary', 'test.xlsx', new Map(), new Map(), tableMap,
    )
    const ref = references.find(r => r.structuredRef?.kind === 'this-row')
    expect(ref).toBeDefined()
    expect(ref?.structuredRef?.specifier).toBe('#This Row')
    expect(ref?.structuredRef?.columnName).toBe('Amount')
  })

  it('PARSE-21d: Table1[[#Totals]] parsed with totals kind', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'SalesTable[[#Totals]]' }
    sheet['!ref'] = 'A1:A1'

    const { references } = extractReferences(
      sheet, 'Summary', 'test.xlsx', new Map(), new Map(), tableMap,
    )
    const ref = references.find(r => r.structuredRef?.kind === 'totals')
    expect(ref).toBeDefined()
    expect(ref?.structuredRef?.specifier).toBe('#Totals')
  })

  it('PARSE-21e: structured ref on same sheet is within-sheet', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'SalesTable[[#Headers],[Name]]' }
    sheet['!ref'] = 'A1:A1'

    const { references, workload } = extractReferences(
      sheet, 'Data', 'test.xlsx', new Map(), new Map(), tableMap,
    )
    // Table is on 'Data' sheet, source is 'Data' → within-sheet
    const ref = references.find(r => r.structuredRef)
    expect(ref).toBeUndefined()
    expect(workload.withinSheetRefs).toBeGreaterThanOrEqual(1)
  })

  it('PARSE-21f: Table1[[#Data]] parsed with data kind', () => {
    const sheet: XLSX.WorkSheet = {}
    sheet['A1'] = { t: 'n', v: 0, f: 'SalesTable[[#Data]]' }
    sheet['!ref'] = 'A1:A1'

    const { references } = extractReferences(
      sheet, 'Summary', 'test.xlsx', new Map(), new Map(), tableMap,
    )
    const ref = references.find(r => r.structuredRef?.kind === 'data')
    expect(ref).toBeDefined()
    expect(ref?.structuredRef?.specifier).toBe('#Data')
  })
})
