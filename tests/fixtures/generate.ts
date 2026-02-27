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

// Fixture 8: Finance model — 5 sheets with diamond-shaped dependency + named ranges
function makeFinanceModelFixture(): void {
  const wb = XLSX.utils.book_new()

  // Assumptions — source data, no cross-sheet refs
  const assumptions = XLSX.utils.aoa_to_sheet([
    ['Tax Rate',      0.25],
    ['Growth Rate',   0.05],
    ['Discount Rate', 0.08],
    ['Base Revenue',  1000000],
    ['Base Expenses', 750000],
  ])

  // Income — refs Assumptions
  const income = XLSX.utils.aoa_to_sheet([['x', 'x'], ['x'], ['x', 'x']])
  income['A1'] = { t: 'n', v: 0, f: 'Assumptions!B4' }                       // Base Revenue
  income['B1'] = { t: 'n', v: 0, f: 'Assumptions!B4*(1+Assumptions!B2)' }    // Revenue * growth
  income['A2'] = { t: 'n', v: 0, f: 'Assumptions!B5' }                       // Base Expenses
  income['A3'] = { t: 'n', v: 0, f: 'Income!B1-Income!A2' }                  // Net Income (within-sheet)
  income['B3'] = { t: 'n', v: 0, f: 'Income!A3*(1-Assumptions!B1)' }         // After-tax
  income['!ref'] = 'A1:B3'

  // Balance — refs Assumptions + Income
  const balance = XLSX.utils.aoa_to_sheet([['x', 'x'], ['x']])
  balance['A1'] = { t: 'n', v: 0, f: 'Income!A3' }                           // Net income
  balance['B1'] = { t: 'n', v: 0, f: 'Assumptions!B4' }                      // Base revenue
  balance['A2'] = { t: 'n', v: 0, f: 'Balance!A1+Balance!B1' }               // Total assets (within-sheet)
  balance['!ref'] = 'A1:B2'

  // CashFlow — refs Income + Balance
  const cashflow = XLSX.utils.aoa_to_sheet([['x', 'x'], ['x']])
  cashflow['A1'] = { t: 'n', v: 0, f: 'Income!B3' }                          // After-tax income
  cashflow['A2'] = { t: 'n', v: 0, f: 'Balance!A2' }                         // Total assets
  cashflow['B1'] = { t: 'n', v: 0, f: 'CashFlow!A1-CashFlow!A2' }            // Net cash (within-sheet)
  cashflow['!ref'] = 'A1:B2'

  // Summary — refs all four
  const summary = XLSX.utils.aoa_to_sheet([['x', 'x'], ['x'], ['x'], ['x']])
  summary['A1'] = { t: 'n', v: 0, f: 'Income!A3' }                           // Net income
  summary['A2'] = { t: 'n', v: 0, f: 'Balance!A2' }                          // Total assets
  summary['A3'] = { t: 'n', v: 0, f: 'CashFlow!B1' }                         // Net cash
  summary['A4'] = { t: 'n', v: 0, f: 'Assumptions!B3' }                      // Discount rate
  summary['B1'] = { t: 'n', v: 0, f: 'Summary!A1*(1-Assumptions!B1)' }       // After-tax summary (within-sheet)
  summary['!ref'] = 'A1:B4'

  XLSX.utils.book_append_sheet(wb, assumptions, 'Assumptions')
  XLSX.utils.book_append_sheet(wb, income, 'Income')
  XLSX.utils.book_append_sheet(wb, balance, 'Balance')
  XLSX.utils.book_append_sheet(wb, cashflow, 'CashFlow')
  XLSX.utils.book_append_sheet(wb, summary, 'Summary')

  // Named ranges pointing into Assumptions
  if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
  if (!wb.Workbook.Names) wb.Workbook.Names = []
  wb.Workbook.Names.push(
    { Name: 'TaxRate',      Ref: 'Assumptions!$B$1', Sheet: undefined },
    { Name: 'GrowthRate',   Ref: 'Assumptions!$B$2', Sheet: undefined },
    { Name: 'DiscountRate', Ref: 'Assumptions!$B$3', Sheet: undefined },
  )

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 16, 'finance-model')
  writeFileSync(join(OUT_DIR, 'finance-model.xlsx'), buf)
}

// Fixture 9: Hub-and-spoke — one master sheet referencing 5 external files
function makeHubAndSpokeFixture(): void {
  const wb = XLSX.utils.book_new()

  const dashboard = XLSX.utils.aoa_to_sheet([['x', 'x'], ['x', 'x'], ['x'], ['x'], ['x']])
  dashboard['A1'] = { t: 'n', v: 0, f: '[Budget.xlsx]Sheet1!B2' }
  dashboard['A2'] = { t: 'n', v: 0, f: '[Actuals.xlsx]Sheet1!B2' }
  dashboard['A3'] = { t: 'n', v: 0, f: '[Forecast.xlsx]Projections!C5' }
  dashboard['A4'] = { t: 'n', v: 0, f: '[HR.xlsx]Headcount!A1' }
  dashboard['A5'] = { t: 'n', v: 0, f: '[Operations.xlsx]Costs!B5' }
  dashboard['B1'] = { t: 'n', v: 0, f: '[Budget.xlsx]Variance!A1' }          // second ref to Budget
  dashboard['B2'] = { t: 'n', v: 0, f: 'Dashboard!A1-Dashboard!A2' }         // within-sheet variance
  dashboard['!ref'] = 'A1:B5'

  XLSX.utils.book_append_sheet(wb, dashboard, 'Dashboard')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 7, 'hub-and-spoke')
  writeFileSync(join(OUT_DIR, 'hub-and-spoke.xlsx'), buf)
}

// Fixture 10: Named ranges heavy — multiple named ranges across 3 sheets
function makeNamedRangesHeavyFixture(): void {
  const wb = XLSX.utils.book_new()

  // Config — source values, no cross-sheet refs
  const config = XLSX.utils.aoa_to_sheet([
    ['Interest Rate', 0.07],
    ['Max Cap',       100000],
    ['Min Floor',     1000],
    ['Period',        12],
  ])

  // Calc — refs Config
  const calc = XLSX.utils.aoa_to_sheet([['x', 'x'], ['x'], ['x']])
  calc['A1'] = { t: 'n', v: 0, f: 'Config!B1' }                              // Interest Rate
  calc['A2'] = { t: 'n', v: 0, f: 'Config!B2' }                              // Max Cap
  calc['A3'] = { t: 'n', v: 0, f: 'Config!B4' }                              // Period
  calc['B1'] = { t: 'n', v: 0, f: 'Calc!A1*Calc!A2/Calc!A3' }               // monthly payment (within-sheet)
  calc['!ref'] = 'A1:B3'

  // Output — refs Config + Calc
  const output = XLSX.utils.aoa_to_sheet([['x', 'x'], ['x']])
  output['A1'] = { t: 'n', v: 0, f: 'Calc!B1' }                             // monthly payment
  output['A2'] = { t: 'n', v: 0, f: 'Config!B3' }                           // Min Floor
  output['B1'] = { t: 'n', v: 0, f: 'Output!A1+Output!A2' }                 // total (within-sheet)
  output['!ref'] = 'A1:B2'

  XLSX.utils.book_append_sheet(wb, config, 'Config')
  XLSX.utils.book_append_sheet(wb, calc, 'Calc')
  XLSX.utils.book_append_sheet(wb, output, 'Output')

  // Named ranges — workbook-scoped and sheet-scoped
  if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
  if (!wb.Workbook.Names) wb.Workbook.Names = []
  wb.Workbook.Names.push(
    { Name: 'InterestRate', Ref: 'Config!$B$1',   Sheet: undefined },  // workbook-scoped
    { Name: 'MaxCap',       Ref: 'Config!$B$2',   Sheet: undefined },
    { Name: 'MinFloor',     Ref: 'Config!$B$3',   Sheet: undefined },
    { Name: 'Period',       Ref: 'Config!$B$4',   Sheet: undefined },
    { Name: 'CalcResult',   Ref: 'Calc!$B$1',     Sheet: undefined },
    { Name: 'LocalRate',    Ref: 'Config!$B$1',   Sheet: 0 },          // sheet-scoped (Config sheet)
  )

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 7, 'named-ranges-heavy')
  writeFileSync(join(OUT_DIR, 'named-ranges-heavy.xlsx'), buf)
}

// Fixture 11: Wide — 10-sheet non-linear dependency graph (stress test for layout)
function makeWideFixture(): void {
  const wb = XLSX.utils.book_new()
  const names = ['Inputs', 'Pricing', 'Volume', 'Revenue', 'COGS', 'Margin', 'OpEx', 'EBITDA', 'Tax', 'NetIncome']
  const sheets: Record<string, XLSX.WorkSheet> = {}
  // Initialize with A1:C1 coverage so B and C columns are within !ref
  for (const n of names) {
    sheets[n] = XLSX.utils.aoa_to_sheet([['x', 'x', 'x']])
    sheets[n]['!ref'] = 'A1:C1'
  }

  // Inputs → Pricing, Volume
  sheets['Pricing']['A1']    = { t: 'n', v: 0, f: 'Inputs!A1' }
  sheets['Pricing']['B1']    = { t: 'n', v: 0, f: 'Inputs!A2' }
  sheets['Volume']['A1']     = { t: 'n', v: 0, f: 'Inputs!A1' }
  sheets['Volume']['B1']     = { t: 'n', v: 0, f: 'Inputs!A3' }

  // Pricing + Volume → Revenue
  sheets['Revenue']['A1']    = { t: 'n', v: 0, f: 'Pricing!A1' }
  sheets['Revenue']['B1']    = { t: 'n', v: 0, f: 'Volume!A1' }
  sheets['Revenue']['C1']    = { t: 'n', v: 0, f: 'Revenue!A1*Revenue!B1' }  // within-sheet

  // Inputs + Volume → COGS
  sheets['COGS']['A1']       = { t: 'n', v: 0, f: 'Inputs!A2' }
  sheets['COGS']['B1']       = { t: 'n', v: 0, f: 'Volume!B1' }
  sheets['COGS']['C1']       = { t: 'n', v: 0, f: 'COGS!A1*COGS!B1' }       // within-sheet

  // Revenue + COGS → Margin
  sheets['Margin']['A1']     = { t: 'n', v: 0, f: 'Revenue!C1' }
  sheets['Margin']['B1']     = { t: 'n', v: 0, f: 'COGS!C1' }
  sheets['Margin']['C1']     = { t: 'n', v: 0, f: 'Margin!A1-Margin!B1' }   // within-sheet

  // Inputs → OpEx
  sheets['OpEx']['A1']       = { t: 'n', v: 0, f: 'Inputs!A3' }
  sheets['OpEx']['B1']       = { t: 'n', v: 0, f: 'Inputs!A4' }

  // Margin + OpEx → EBITDA
  sheets['EBITDA']['A1']     = { t: 'n', v: 0, f: 'Margin!C1' }
  sheets['EBITDA']['B1']     = { t: 'n', v: 0, f: 'OpEx!A1' }
  sheets['EBITDA']['C1']     = { t: 'n', v: 0, f: 'EBITDA!A1-EBITDA!B1' }  // within-sheet

  // Inputs + EBITDA → Tax
  sheets['Tax']['A1']        = { t: 'n', v: 0, f: 'Inputs!A5' }
  sheets['Tax']['B1']        = { t: 'n', v: 0, f: 'EBITDA!C1' }
  sheets['Tax']['C1']        = { t: 'n', v: 0, f: 'Tax!A1*Tax!B1' }         // within-sheet

  // EBITDA + Tax → NetIncome
  sheets['NetIncome']['A1']  = { t: 'n', v: 0, f: 'EBITDA!C1' }
  sheets['NetIncome']['B1']  = { t: 'n', v: 0, f: 'Tax!C1' }
  sheets['NetIncome']['C1']  = { t: 'n', v: 0, f: 'NetIncome!A1-NetIncome!B1' } // within-sheet

  for (const n of names) XLSX.utils.book_append_sheet(wb, sheets[n], n)

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, 24, 'wide')
  writeFileSync(join(OUT_DIR, 'wide.xlsx'), buf)
}

// Run all generators
makeCrossSheetFixture()
makeExternalRefFixture()
makeNamedRangeFixture()
makeEmptyFixture()
makeLargeFixture()
makeCircularFixture()
makeMalformedFixture()
makeFinanceModelFixture()
makeHubAndSpokeFixture()
makeNamedRangesHeavyFixture()
makeWideFixture()
console.log('All fixtures generated successfully.')
