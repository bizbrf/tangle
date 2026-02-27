// tests/unit/parser.smoke.test.ts
// Validates that SheetJS resolves correctly through Vitest's module pipeline.
// This test specifically confirms the `server.deps.inline: ['xlsx']` fix in
// vitest.config.ts works — without it, this import throws ERR_REQUIRE_ESM.
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { FIXTURES } from '../fixtures/index'

describe('SheetJS import smoke test', () => {
  it('xlsx module resolves correctly via Vitest (server.deps.inline fix)', () => {
    // If server.deps.inline: ['xlsx'] is missing from vitest.config.ts,
    // this test will throw: "Cannot find module 'xlsx'" or "ERR_REQUIRE_ESM"
    const wb = XLSX.utils.book_new()
    expect(wb.SheetNames).toEqual([])
  })

  it('can create and read a workbook with a formula cell', () => {
    const wb = XLSX.utils.book_new()
    const ws: XLSX.WorkSheet = {}
    // Explicit formula cell construction — aoa_to_sheet does NOT preserve cell.f
    ws['A1'] = { t: 'n', v: 0, f: 'Sheet2!A1' }
    ws['!ref'] = 'A1:A1'
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['value']]), 'Sheet2')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const wb2 = XLSX.read(buf, { type: 'buffer', cellFormula: true })
    // Verify the formula round-trip preserved cell.f
    expect(wb2.Sheets['Sheet1']['A1'].f).toBe('Sheet2!A1')
  })

  it('cross-sheet fixture has a formula cell at Sheet1.A1', () => {
    // Verifies fixtures:generate produced a readable, formula-bearing file
    const buf = readFileSync(FIXTURES.crossSheet)
    const wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
    expect(wb.Sheets['Sheet1']['A1'].f).toBe('Sheet2!A1')
  })
})
