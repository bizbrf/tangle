// @vitest-environment jsdom
// tests/unit/parser.error.test.ts
// Environment: jsdom (per-file directive — required for FileReader in parseWorkbook() tests)
// Covers: PARSE-09 (empty workbook), PARSE-10 (corrupt file rejection), PARSE-11 (circular refs)
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import { FIXTURES } from '../fixtures/index'
import { parseWorkbook, extractReferences } from '../../src/lib/parser'

// ── PARSE-09: Empty workbook ─────────────────────────────────────────────────
describe('extractReferences — empty workbook (PARSE-09)', () => {
  it('returns zero references for an empty workbook', () => {
    // empty.xlsx: Sheet1 has plain values, no formula cells
    const buf = readFileSync(FIXTURES.empty)
    const wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'empty.xlsx', new Map(), new Map()
    )
    expect(references).toHaveLength(0)
  })

  it('returns all-zero workload metrics for an empty workbook', () => {
    const buf = readFileSync(FIXTURES.empty)
    const wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
    const { workload } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'empty.xlsx', new Map(), new Map()
    )
    expect(workload.totalFormulas).toBe(0)
    expect(workload.crossSheetRefs).toBe(0)
    expect(workload.crossFileRefs).toBe(0)
    expect(workload.withinSheetRefs).toBe(0)
  })
})

// ── PARSE-10: Corrupt file rejection ─────────────────────────────────────────
describe('parseWorkbook — malformed file (PARSE-10)', () => {
  it('rejects with an error (not a crash) when given a corrupt .xlsx file', async () => {
    // malformed.xlsx: PK header + garbage bytes — XLSX.read() throws on parse
    // parseWorkbook() wraps XLSX.read() in try/catch and calls reject(err)
    // jsdom provides File and FileReader globals needed by parseWorkbook()
    const buf = readFileSync(FIXTURES.malformed)
    const file = new File([buf], 'malformed.xlsx')
    // Do NOT assert on error message text — SheetJS error messages vary by version
    await expect(parseWorkbook(file, 'test-id')).rejects.toThrow()
  })

  it('promise is rejected, not undefined and not hanging', async () => {
    const buf = readFileSync(FIXTURES.malformed)
    const file = new File([buf], 'malformed.xlsx')
    let caught: unknown = null
    try {
      await parseWorkbook(file, 'test-id')
    } catch (err) {
      caught = err
    }
    // The error must be an Error instance (not null, not undefined)
    expect(caught).toBeInstanceOf(Error)
  })
})

// ── PARSE-11: Circular references ────────────────────────────────────────────
describe('extractReferences — circular references (PARSE-11)', () => {
  let wb: XLSX.WorkBook

  beforeAll(() => {
    // circular.xlsx: Sheet1.A1.f = 'Sheet2!A1', Sheet2.A1.f = 'Sheet1!A1'
    // extractReferences() is pure regex — no traversal, no recursion.
    // Both sheets must extract without hanging.
    const buf = readFileSync(FIXTURES.circular)
    wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  })

  it('PARSE-11: Sheet1 extracts circular ref to Sheet2 without hanging', () => {
    const { references } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'circular.xlsx', new Map(), new Map()
    )
    expect(references).toHaveLength(1)
    expect(references[0].targetSheet).toBe('Sheet2')
    expect(references[0].targetWorkbook).toBeNull()
  })

  it('PARSE-11: Sheet2 extracts circular ref back to Sheet1 without hanging', () => {
    const { references } = extractReferences(
      wb.Sheets['Sheet2'], 'Sheet2', 'circular.xlsx', new Map(), new Map()
    )
    expect(references).toHaveLength(1)
    expect(references[0].targetSheet).toBe('Sheet1')
    expect(references[0].targetWorkbook).toBeNull()
  })

  it('PARSE-11: workload metrics are correct for each circular sheet', () => {
    const { workload: w1 } = extractReferences(
      wb.Sheets['Sheet1'], 'Sheet1', 'circular.xlsx', new Map(), new Map()
    )
    expect(w1.totalFormulas).toBe(1)
    expect(w1.crossSheetRefs).toBe(1)

    const { workload: w2 } = extractReferences(
      wb.Sheets['Sheet2'], 'Sheet2', 'circular.xlsx', new Map(), new Map()
    )
    expect(w2.totalFormulas).toBe(1)
    expect(w2.crossSheetRefs).toBe(1)
  })
})
