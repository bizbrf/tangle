// tests/fixtures/generate.ts
// Run via: node tests/fixtures/generate.ts
// Node 24.13.0 natively strips TypeScript types — no tsx needed
import * as XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const OUT_DIR = __dirname

// Ensure output directory exists
mkdirSync(OUT_DIR, { recursive: true })

/**
 * Read-back verification: counts cells where cell.f is set.
 * Throws if count < expectedMinFormulas.
 * Critical: catches the aoa_to_sheet formula pitfall before files are written.
 */
function verify(buf: Buffer, expectedMinFormulas: number, label: string): void {
  const wb = XLSX.read(buf, { type: 'buffer', cellFormula: true })
  let count = 0
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name]
    for (const key of Object.keys(sheet)) {
      if (!key.startsWith('!') && sheet[key]?.f) count++
    }
  }
  if (count < expectedMinFormulas) {
    throw new Error(`[${label}] Expected >= ${expectedMinFormulas} formula cells, found ${count}`)
  }
  console.log(`[${label}] OK — ${count} formula cells`)
}

// Fixture 1: Cross-sheet reference (Sheet1 -> Sheet2)
function makeCrossSheetFixture(): void {
  const wb = XLSX.utils.book_new()
  const sheet1 = XLSX.utils.aoa_to_sheet([['placeholder']])
  // CRITICAL: set formula cell explicitly — aoa_to_sheet does NOT set cell.f
  sheet1['A1'] = { t: 'n', v: 0, f: 'Sheet2!A1' }
  const sheet2 = XLSX.utils.aoa_to_sheet([['source value']])
  XLSX.utils.book_append_sheet(wb, sheet1, 'Sheet1')
  XLSX.utils.book_append_sheet(wb, sheet2, 'Sheet2')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 1, 'cross-sheet')
  writeFileSync(join(OUT_DIR, 'cross-sheet.xlsx'), buf)
}

// Fixture 2: External file reference (bracketed filename format)
function makeExternalRefFixture(): void {
  const wb = XLSX.utils.book_new()
  const sheet1 = XLSX.utils.aoa_to_sheet([['placeholder']])
  // Bracketed external ref: [External.xlsx]Prices!C3
  sheet1['A1'] = { t: 'n', v: 0, f: '[External.xlsx]Prices!C3' }
  XLSX.utils.book_append_sheet(wb, sheet1, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 1, 'external-ref')
  writeFileSync(join(OUT_DIR, 'external-ref.xlsx'), buf)
}

// Fixture 3: Named range
function makeNamedRangeFixture(): void {
  const wb = XLSX.utils.book_new()
  const sheet1 = XLSX.utils.aoa_to_sheet([['placeholder']])
  sheet1['A1'] = { t: 'n', v: 0, f: 'Sheet2!A1' }
  const sheet2 = XLSX.utils.aoa_to_sheet([['source']])
  XLSX.utils.book_append_sheet(wb, sheet1, 'Sheet1')
  XLSX.utils.book_append_sheet(wb, sheet2, 'Sheet2')
  // Add named range via workbook Names table
  if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
  if (!wb.Workbook.Names) wb.Workbook.Names = []
  wb.Workbook.Names.push({ Name: 'MyRange', Ref: 'Sheet2!A1:A10', Sheet: undefined })
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 1, 'named-ranges')
  writeFileSync(join(OUT_DIR, 'named-ranges.xlsx'), buf)
}

// Fixture 4: Empty workbook (no formulas)
function makeEmptyFixture(): void {
  const wb = XLSX.utils.book_new()
  const sheet1 = XLSX.utils.aoa_to_sheet([['value', 'value2']])
  // Intentionally no formula cells — parser must return empty results
  XLSX.utils.book_append_sheet(wb, sheet1, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  // No verify() call for empty — 0 formulas is the correct expected result
  console.log('[empty] OK — 0 formula cells (intentional)')
  writeFileSync(join(OUT_DIR, 'empty.xlsx'), buf)
}

// Fixture 5: Large workbook (100 sheets, each referencing the previous)
function makeLargeFixture(): void {
  const wb = XLSX.utils.book_new()
  for (let i = 1; i <= 100; i++) {
    const sheet = XLSX.utils.aoa_to_sheet([['placeholder']])
    if (i > 1) {
      // Sheet2 references Sheet1, Sheet3 references Sheet2, etc.
      sheet['A1'] = { t: 'n', v: 0, f: `Sheet${i - 1}!A1` }
    }
    XLSX.utils.book_append_sheet(wb, sheet, `Sheet${i}`)
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 99, 'large')
  writeFileSync(join(OUT_DIR, 'large.xlsx'), buf)
}

// Fixture 6: Circular reference (Sheet1 -> Sheet2 -> Sheet1)
function makeCircularFixture(): void {
  // SheetJS does not evaluate formulas — just stores formula strings
  // Parser must not infinite-loop when traversing circular ref chains
  const wb = XLSX.utils.book_new()
  const sheet1 = XLSX.utils.aoa_to_sheet([['placeholder']])
  sheet1['A1'] = { t: 'n', v: 0, f: 'Sheet2!A1' }
  const sheet2 = XLSX.utils.aoa_to_sheet([['placeholder']])
  sheet2['A1'] = { t: 'n', v: 0, f: 'Sheet1!A1' }
  XLSX.utils.book_append_sheet(wb, sheet1, 'Sheet1')
  XLSX.utils.book_append_sheet(wb, sheet2, 'Sheet2')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 2, 'circular')
  writeFileSync(join(OUT_DIR, 'circular.xlsx'), buf)
}

// Fixture 7: Malformed/corrupt file
function makeMalformedFixture(): void {
  // SheetJS always writes valid xlsx — must write corrupt bytes manually
  // PK header is a valid zip signature prefix; rest is garbage
  const garbage = Buffer.from('PK\x03\x04this is not a valid xlsx file — corrupt for testing')
  writeFileSync(join(OUT_DIR, 'malformed.xlsx'), garbage)
  console.log('[malformed] OK — corrupt bytes written (not a valid xlsx)')
}

// Run all generators
makeCrossSheetFixture()
makeExternalRefFixture()
makeNamedRangeFixture()
makeEmptyFixture()
makeLargeFixture()
makeCircularFixture()
makeMalformedFixture()
console.log('All fixtures generated successfully.')
