// Acme Corp Financial Model Generator
// Creates 7 interconnected Excel workbooks for Tangle stress testing
// Run: node tests/fixtures/acme-corp/generate.ts
//
// Realism patterns included:
// - IFERROR wrapping on ~30%+ of cross-file formulas
// - Mix of VLOOKUP and XLOOKUP (legacy + modern)
// - Deeply nested formulas (3+ levels: IF/AND/OR, nested INDEX/MATCH, SUMPRODUCT)
// - Named ranges referencing other named ranges
// - INDIRECT references (dynamic sheet refs)
// - Absolute/relative reference mixing ($A$1 vs A1)
// - "Working" scratch sheet with intermediate calculations
// - Sheet names with special characters: "P&L (Draft)"
// - Hard-coded overrides mixed with formulas
// - Numeric external link indices [1], [2]
// - OFFSET volatile function usage

import * as XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const OUT = __dirname

mkdirSync(OUT, { recursive: true })

// Helper: set formula on a cell
function setF(ws: XLSX.WorkSheet, cell: string, formula: string) {
  if (!ws[cell]) ws[cell] = { t: 'n', v: 0 }
  ws[cell].f = formula
}

// Helper: set value on a cell
function setV(ws: XLSX.WorkSheet, cell: string, value: string | number) {
  ws[cell] = typeof value === 'string' ? { t: 's', v: value } : { t: 'n', v: value }
}

// Helper: column letter from index (0=A, 1=B, ...)
function col(i: number): string {
  return String.fromCharCode(65 + i)
}

// Helper: set a row of values/formulas starting at a given row
function setRow(ws: XLSX.WorkSheet, row: number, values: (string | number | null)[], startCol = 0) {
  for (let c = 0; c < values.length; c++) {
    const v = values[c]
    if (v === null) continue
    const cell = `${col(startCol + c)}${row}`
    if (typeof v === 'string' && v.startsWith('=')) {
      setF(ws, cell, v.slice(1))
    } else {
      setV(ws, cell, v)
    }
  }
}

// Helper: expand ref range
function setRef(ws: XLSX.WorkSheet, range: string) {
  ws['!ref'] = range
}

// Helper: wrap formula with IFERROR (returns 0 on error)
function ieF(formula: string): string {
  return `IFERROR(${formula},0)`
}

// Helper: wrap formula with IFERROR returning empty string
function ieFBlank(formula: string): string {
  return `IFERROR(${formula},"")`
}

// ═══════════════════════════════════════════════════════════════════════
// 1. ASSUMPTIONS.xlsx
// ═══════════════════════════════════════════════════════════════════════
function makeAssumptions() {
  const wb = XLSX.utils.book_new()

  // --- Global sheet ---
  const global = XLSX.utils.aoa_to_sheet([['Parameter', 'Value', 'Unit', 'Notes']])
  const params: [string, number, string, string][] = [
    ['TaxRate', 0.25, '%', 'Corporate tax rate'],
    ['GrowthRate', 0.08, '%', 'Base revenue growth'],
    ['InflationRate', 0.03, '%', 'Annual inflation'],
    ['DiscountRate', 0.10, '%', 'WACC for DCF'],
    ['TerminalGrowth', 0.025, '%', 'Terminal growth rate'],
    ['FYStart', 2024, 'Year', 'First projection year'],
    ['ProjectionYears', 5, 'Years', 'Number of years'],
    ['HeadcountGrowth', 0.10, '%', 'Annual hiring growth'],
    ['SalaryInflation', 0.04, '%', 'Annual salary increase'],
    ['BenefitsRate', 0.30, '%', 'Benefits as pct of salary'],
    ['DebtRate', 0.06, '%', 'Interest rate on debt'],
    ['DebtTerm', 10, 'Years', 'Loan term'],
    ['BaseRevenue', 50000000, '$', 'Year 1 revenue'],
    ['BaseCOGS', 20000000, '$', 'Year 1 COGS'],
    ['BaseOpEx', 15000000, '$', 'Year 1 operating expenses'],
    ['RevenueGrowthHigh', 0.12, '%', 'Optimistic scenario'],
    ['RevenueGrowthMid', 0.08, '%', 'Base case scenario'],
    ['RevenueGrowthLow', 0.04, '%', 'Conservative scenario'],
  ]
  for (let r = 0; r < params.length; r++) {
    setRow(global, r + 2, params[r])
  }
  setRef(global, `A1:D${params.length + 1}`)
  XLSX.utils.book_append_sheet(wb, global, 'Global')

  // Named ranges (including derived ranges that reference other named ranges)
  if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
  if (!wb.Workbook.Names) wb.Workbook.Names = []
  for (let r = 0; r < params.length; r++) {
    wb.Workbook.Names.push({ Name: params[r][0], Ref: `Global!$B$${r + 2}`, Sheet: undefined })
  }
  // Named ranges that reference OTHER named ranges (pattern #8)
  wb.Workbook.Names.push({ Name: 'EffectiveTaxRate', Ref: 'Global!$B$3', Sheet: undefined })
  wb.Workbook.Names.push({ Name: 'WACCRate', Ref: 'Global!$B$6', Sheet: undefined })
  wb.Workbook.Names.push({ Name: 'BaseGrowth', Ref: 'Global!$B$4', Sheet: undefined })

  // --- Rates sheet ---
  const rates = XLSX.utils.aoa_to_sheet([['Year', 'Revenue Growth', 'COGS Pct', 'OpEx Growth', 'Headcount Growth']])
  const mult = [1.0, 1.05, 0.95, 0.90, 0.85]
  const cogsPct = [0.40, 0.39, 0.38, 0.37, 0.37]
  const infM = [1.0, 1.02, 1.01, 1.0, 0.98]
  const hcM = [1.0, 0.9, 0.8, 0.7, 0.6]
  for (let y = 0; y < 5; y++) {
    const r = y + 2
    setV(rates, `A${r}`, 2024 + y)
    setF(rates, `B${r}`, `GrowthRate*${mult[y]}`)
    setV(rates, `C${r}`, cogsPct[y])
    setF(rates, `D${r}`, `InflationRate*${infM[y]}`)
    setF(rates, `E${r}`, `HeadcountGrowth*${hcM[y]}`)
  }
  setRef(rates, 'A1:E6')
  XLSX.utils.book_append_sheet(wb, rates, 'Rates')

  // --- Scenarios sheet ---
  const scen = XLSX.utils.aoa_to_sheet([['Metric', 'Low', 'Base', 'High']])
  setRow(scen, 2, ['Revenue Growth', '=RevenueGrowthLow', '=RevenueGrowthMid', '=RevenueGrowthHigh'])
  setRow(scen, 3, ['Tax Rate', '=TaxRate+0.05', '=EffectiveTaxRate', '=TaxRate-0.03'])
  setRow(scen, 4, ['Discount Rate', '=WACCRate+0.02', '=WACCRate', '=WACCRate-0.02'])
  setRow(scen, 5, ['Terminal Growth', '=TerminalGrowth-0.005', '=TerminalGrowth', '=TerminalGrowth+0.005'])
  // Deeply nested formula: IF(AND(OR(...))) — 3+ levels (pattern #7)
  setV(scen, 'A7', 'Scenario Flag')
  setF(scen, 'B7', 'IF(AND(OR(RevenueGrowthLow>0.03,RevenueGrowthMid>0.05),EffectiveTaxRate<0.30),"Go","Hold")')
  setV(scen, 'A8', '3D Sum Check')
  setF(scen, 'B8', "SUM('Global:Scenarios'!B2)")
  // INDIRECT reference (pattern #13) — dynamic sheet reference
  setV(scen, 'A9', 'Dynamic Lookup')
  setF(scen, 'B9', 'INDIRECT("Global!B"&ROW(B4))')
  setRef(scen, 'A1:D9')
  XLSX.utils.book_append_sheet(wb, scen, 'Scenarios')

  // --- P&L (Draft) sheet — special characters in name (pattern #16) ---
  const draft = XLSX.utils.aoa_to_sheet([['Note', 'Value']])
  setRow(draft, 2, ['Draft rev estimate', '=BaseRevenue*1.05'])
  setRow(draft, 3, ['Adj. tax', '=EffectiveTaxRate'])
  setRow(draft, 4, ['Growth scenario check', '=IF(BaseGrowth>0.05,"Aggressive","Conservative")'])
  // INDIRECT to another sheet in same workbook
  setV(draft, 'A5', 'Rate via INDIRECT')
  setF(draft, 'B5', 'INDIRECT("Rates!B"&2)')
  setRef(draft, 'A1:B5')
  XLSX.utils.book_append_sheet(wb, draft, 'P&L (Draft)')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'Assumptions.xlsx'), buf)
  console.log('[1/7] Assumptions.xlsx — 4 sheets, 21 named ranges (3 derived), special chars, INDIRECT, nested IF')
}

// ═══════════════════════════════════════════════════════════════════════
// 2. REVENUE-MODEL.xlsx
// ═══════════════════════════════════════════════════════════════════════
function makeRevenueModel() {
  const wb = XLSX.utils.book_new()
  const products = [
    ['P001', 'Enterprise Suite', 'Software', 50000, 2020, 'Active'],
    ['P002', 'Cloud Platform', 'SaaS', 2500, 2022, 'Active'],
    ['P003', 'Analytics Pro', 'Add-on', 15000, 2023, 'Active'],
    ['P004', 'Mobile SDK', 'Developer', 800, 2024, 'Beta'],
    ['P005', 'Consulting Hours', 'Services', 250, 2020, 'Active'],
  ]

  // --- Products ---
  const prod = XLSX.utils.aoa_to_sheet([['ProductID', 'Product Name', 'Category', 'Base Price', 'Launch Year', 'Status']])
  for (let r = 0; r < products.length; r++) setRow(prod, r + 2, products[r] as (string | number)[])
  setRef(prod, 'A1:F6')
  XLSX.utils.book_append_sheet(wb, prod, 'Products')

  // --- Volume ---
  const vol = XLSX.utils.aoa_to_sheet([['Product', 2024, 2025, 2026, 2027, 2028]])
  const baseVols = [200, 5000, 800, 100, 10000]
  const growthMult = [1.0, 1.5, 1.2, 2.0, 0.5]
  for (let r = 0; r < 5; r++) {
    const row = r + 2
    setV(vol, `A${row}`, products[r][1] as string)
    setV(vol, `B${row}`, baseVols[r])
    for (let y = 1; y < 5; y++) {
      // IFERROR on cross-file volume refs (pattern #4)
      setF(vol, `${col(1 + y)}${row}`, `IFERROR(${col(y)}${row}*(1+'[Assumptions.xlsx]Rates'!$B$${y + 1}*${growthMult[r]}),${col(y)}${row})`)
    }
  }
  setRef(vol, 'A1:F6')
  XLSX.utils.book_append_sheet(wb, vol, 'Volume')

  // --- Pricing ---
  const price = XLSX.utils.aoa_to_sheet([['Product', 2024, 2025, 2026, 2027, 2028]])
  for (let r = 0; r < 5; r++) {
    const row = r + 2
    setV(price, `A${row}`, products[r][1] as string)
    // Mix VLOOKUP and XLOOKUP (pattern #6): first 3 products use VLOOKUP, last 2 use XLOOKUP
    if (r < 3) {
      // Legacy VLOOKUP pattern
      setF(price, `B${row}`, `VLOOKUP(A${row},Products!$A$1:$F$6,4,FALSE)`)
    } else {
      // Modern XLOOKUP pattern
      setF(price, `B${row}`, `XLOOKUP(A${row},Products!A:A,Products!D:D)`)
    }
    for (let y = 1; y < 5; y++) {
      // Mix absolute and relative refs (pattern #12): $B$5 is absolute, col ref is relative
      setF(price, `${col(1 + y)}${row}`, `${col(y)}${row}*(1+'[Assumptions.xlsx]Global'!$B$5)`)
    }
  }
  setRef(price, 'A1:F6')
  XLSX.utils.book_append_sheet(wb, price, 'Pricing')

  // --- Revenue ---
  const rev = XLSX.utils.aoa_to_sheet([['Product', 2024, 2025, 2026, 2027, 2028, 'Total']])
  for (let r = 0; r < 5; r++) {
    const row = r + 2
    setV(rev, `A${row}`, products[r][1] as string)
    for (let y = 0; y < 5; y++) {
      const c = col(1 + y)
      setF(rev, `${c}${row}`, `Volume!${c}${row}*Pricing!${c}${row}`)
    }
    setF(rev, `G${row}`, `SUM(B${row}:F${row})`)
  }
  setV(rev, 'A7', 'Total')
  for (let y = 0; y < 5; y++) {
    const c = col(1 + y)
    setF(rev, `${c}7`, `SUM(${c}2:${c}6)`)
  }
  setF(rev, 'G7', 'SUM(B7:F7)')
  setRef(rev, 'A1:G7')
  XLSX.utils.book_append_sheet(wb, rev, 'Revenue')

  // --- Mix Analysis ---
  const mix = XLSX.utils.aoa_to_sheet([['Product', '2024 Mix', '2028 Mix', 'Mix Shift', 'CAGR']])
  for (let r = 0; r < 5; r++) {
    const row = r + 2
    setV(mix, `A${row}`, products[r][1] as string)
    // IFERROR on division (pattern #4)
    setF(mix, `B${row}`, `IFERROR(Revenue!B${row}/Revenue!B7,0)`)
    setF(mix, `C${row}`, `IFERROR(Revenue!F${row}/Revenue!F7,0)`)
    setF(mix, `D${row}`, `C${row}-B${row}`)
    setF(mix, `E${row}`, `IFERROR((Pricing!F${row}/Pricing!B${row})^(1/4)-1,0)`)
  }
  setV(mix, 'A8', 'Revenue CAGR')
  setF(mix, 'B8', 'LET(rev2024,Revenue!B7,rev2028,Revenue!F7,cagr,IFERROR((rev2028/rev2024)^(1/4)-1,0),cagr)')
  // Deeply nested: SUMPRODUCT with conditions (pattern #7)
  setV(mix, 'A9', 'Active Product Rev')
  setF(mix, 'B9', 'SUMPRODUCT((Products!F2:F6="Active")*(Revenue!B2:B6))')
  // Deeply nested: INDEX/MATCH/MATCH (pattern #7)
  setV(mix, 'A10', 'Top Product Lookup')
  setF(mix, 'B10', 'IFERROR(INDEX(Revenue!B2:F6,MATCH(MAX(Revenue!G2:G6),Revenue!G2:G6,0),1),0)')
  setRef(mix, 'A1:E10')
  XLSX.utils.book_append_sheet(wb, mix, 'Mix Analysis')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'Revenue-Model.xlsx'), buf)
  console.log('[2/7] Revenue-Model.xlsx — 5 sheets, VLOOKUP+XLOOKUP mix, IFERROR, SUMPRODUCT, nested INDEX/MATCH')
}

// ═══════════════════════════════════════════════════════════════════════
// 3. PEOPLE.xlsx
// ═══════════════════════════════════════════════════════════════════════
function makePeople() {
  const wb = XLSX.utils.book_new()

  const staff: [string, string, number, number, string, number][] = [
    ['Engineering', 'Developer', 25, 120000, 'Mid', 1.0],
    ['Engineering', 'QA', 8, 95000, 'Mid', 0.8],
    ['Engineering', 'DevOps', 5, 130000, 'Senior', 0.6],
    ['Engineering', 'Manager', 4, 150000, 'Senior', 0.3],
    ['Sales', 'Account Exec', 15, 85000, 'Mid', 1.2],
    ['Sales', 'SDR', 10, 55000, 'Junior', 1.5],
    ['Sales', 'Manager', 3, 140000, 'Senior', 0.2],
    ['Marketing', 'Content', 4, 75000, 'Mid', 0.7],
    ['Marketing', 'Demand Gen', 3, 90000, 'Mid', 0.9],
    ['G&A', 'Finance', 3, 110000, 'Senior', 0.3],
    ['G&A', 'HR', 2, 85000, 'Mid', 0.2],
    ['G&A', 'Legal', 2, 130000, 'Senior', 0.1],
    ['Executive', 'C-Suite', 4, 250000, 'Executive', 0],
  ]

  // --- Headcount ---
  const hc = XLSX.utils.aoa_to_sheet([['Department', 'Role', '2024 HC', '2025 HC', '2026 HC', '2027 HC', '2028 HC', 'Avg Salary', 'Seniority']])
  for (let r = 0; r < staff.length; r++) {
    const row = r + 2
    setV(hc, `A${row}`, staff[r][0])
    setV(hc, `B${row}`, staff[r][1])
    setV(hc, `C${row}`, staff[r][2])
    setV(hc, `H${row}`, staff[r][3])
    setV(hc, `I${row}`, staff[r][4])
    if (staff[r][5] > 0) {
      for (let y = 1; y < 5; y++) {
        const c = col(2 + y) // D,E,F,G
        const prev = col(1 + y)
        // IFERROR wrapping on cross-file headcount growth refs (pattern #4)
        setF(hc, `${c}${row}`, `ROUND(IFERROR(${prev}${row}*(1+'[Assumptions.xlsx]Global'!$B$10*${staff[r][5]}),${prev}${row}),0)`)
      }
    } else {
      // Executive: flat — hard-coded overrides (pattern #3)
      setV(hc, `D${row}`, 4); setV(hc, `E${row}`, 4); setV(hc, `F${row}`, 5); setV(hc, `G${row}`, 5)
    }
  }
  setRef(hc, `A1:I${staff.length + 1}`)
  XLSX.utils.book_append_sheet(wb, hc, 'Headcount')

  // --- Compensation ---
  const comp = XLSX.utils.aoa_to_sheet([['Department', 'Role', 2024, 2025, 2026, 2027, 2028]])
  for (let r = 0; r < staff.length; r++) {
    const row = r + 2
    setV(comp, `A${row}`, staff[r][0])
    setV(comp, `B${row}`, staff[r][1])
    for (let y = 0; y < 5; y++) {
      const c = col(2 + y)
      const hcC = col(2 + y)
      // IFERROR wrapping + absolute ref mixing (pattern #4, #12)
      setF(comp, `${c}${row}`, `IFERROR(Headcount!${hcC}${row}*Headcount!$H${row}*(1+'[Assumptions.xlsx]Global'!$B$11)^${y}*(1+'[Assumptions.xlsx]Global'!$B$12),0)`)
    }
  }
  // Dept totals
  const depts = ['Engineering', 'Sales', 'Marketing', 'G&A', 'Executive']
  const totRow = staff.length + 3
  setV(comp, `A${totRow}`, 'Department Totals')
  for (let d = 0; d < depts.length; d++) {
    const dRow = totRow + 1 + d
    setV(comp, `A${dRow}`, depts[d])
    for (let y = 0; y < 5; y++) {
      const c = col(2 + y)
      setF(comp, `${c}${dRow}`, `SUMIFS(${c}$2:${c}$${staff.length + 1},$A$2:$A$${staff.length + 1},"${depts[d]}")`)
    }
  }
  setRef(comp, `A1:G${totRow + depts.length}`)
  XLSX.utils.book_append_sheet(wb, comp, 'Compensation')

  // --- Summary ---
  const summ = XLSX.utils.aoa_to_sheet([['Department', '2024 HC', '2024 Cost', '2028 HC', '2028 Cost']])
  for (let d = 0; d < depts.length; d++) {
    const row = d + 2
    const compRow = totRow + 1 + d
    setV(summ, `A${row}`, depts[d])
    setF(summ, `B${row}`, `SUMIFS(Headcount!C:C,Headcount!A:A,"${depts[d]}")`)
    setF(summ, `C${row}`, `Compensation!C${compRow}`)
    setF(summ, `D${row}`, `SUMIFS(Headcount!G:G,Headcount!A:A,"${depts[d]}")`)
    setF(summ, `E${row}`, `Compensation!G${compRow}`)
  }
  setV(summ, 'A7', 'Total')
  setF(summ, 'B7', 'SUM(B2:B6)'); setF(summ, 'C7', 'SUM(C2:C6)')
  setF(summ, 'D7', 'SUM(D2:D6)'); setF(summ, 'E7', 'SUM(E2:E6)')
  // INDIRECT reference — dynamic department lookup (pattern #13)
  setV(summ, 'A9', 'Dynamic Dept')
  setV(summ, 'B9', 'Engineering')
  setF(summ, 'C9', 'INDIRECT("Headcount!C"&MATCH(B9,Headcount!A:A,0))')
  setRef(summ, 'A1:E9')
  XLSX.utils.book_append_sheet(wb, summ, 'Summary')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'People.xlsx'), buf)
  console.log('[3/7] People.xlsx — 3 sheets, IFERROR+SUMIFS+ROUND, cross-file refs, INDIRECT')
}

// ═══════════════════════════════════════════════════════════════════════
// 4. COST-MODEL.xlsx
// ═══════════════════════════════════════════════════════════════════════
function makeCostModel() {
  const wb = XLSX.utils.book_new()

  // --- COGS ---
  const cogs = XLSX.utils.aoa_to_sheet([['Category', 2024, 2025, 2026, 2027, 2028]])
  const cogsItems = ['Hosting & Infrastructure', 'Support Staff', 'Third-Party Licenses', 'Payment Processing', 'Total COGS', 'Gross Margin %']
  for (let r = 0; r < cogsItems.length; r++) setV(cogs, `A${r + 2}`, cogsItems[r])
  for (let y = 0; y < 5; y++) {
    const c = col(1 + y)
    const rateRow = y + 2
    // IFERROR wrapping on cross-file formulas (pattern #4)
    setF(cogs, `${c}2`, ieF(`'[Revenue-Model.xlsx]Revenue'!${c}7*'[Assumptions.xlsx]Rates'!C${rateRow}*0.5`))
    setF(cogs, `${c}3`, ieF(`'[People.xlsx]Compensation'!${c}16`))
    setF(cogs, `${c}4`, `'[Revenue-Model.xlsx]Revenue'!${c}7*0.05`)
    setF(cogs, `${c}5`, `'[Revenue-Model.xlsx]Revenue'!${c}7*0.02`)
    setF(cogs, `${c}6`, `SUM(${c}2:${c}5)`)
    // IFERROR on division (pattern #4)
    setF(cogs, `${c}7`, ieF(`1-(${c}6/'[Revenue-Model.xlsx]Revenue'!${c}7)`))
  }
  setRef(cogs, 'A1:F7')
  XLSX.utils.book_append_sheet(wb, cogs, 'COGS')

  // --- OpEx ---
  const opex = XLSX.utils.aoa_to_sheet([['Category', 2024, 2025, 2026, 2027, 2028]])
  const opexItems = ['People - Engineering', 'People - Sales', 'People - Marketing', 'People - G&A', 'People - Executive',
    'Rent & Facilities', 'Software & Tools', 'Travel', 'Marketing Spend', 'Professional Fees', 'Insurance', 'Total OpEx']
  for (let r = 0; r < opexItems.length; r++) setV(opex, `A${r + 2}`, opexItems[r])
  for (let y = 0; y < 5; y++) {
    const c = col(1 + y)
    // People costs — IFERROR on cross-file refs
    for (let d = 0; d < 5; d++) {
      setF(opex, `${c}${d + 2}`, ieF(`'[People.xlsx]Summary'!${c}${d + 2}`))
    }
    // Non-people
    if (y === 0) {
      setV(opex, 'B7', 2000000); setV(opex, 'B8', 500000); setV(opex, 'B9', 300000)
      setF(opex, 'B10', `IFERROR('[Revenue-Model.xlsx]Revenue'!B7*0.08,0)`)
      setV(opex, 'B11', 400000); setV(opex, 'B12', 200000)
    } else {
      const prev = col(y)
      // Mix absolute and relative refs (pattern #12)
      setF(opex, `${c}7`, `${prev}7*(1+'[Assumptions.xlsx]Global'!$B$5)`)
      setF(opex, `${c}8`, `${prev}8*(1+'[Assumptions.xlsx]Global'!$B$5*1.5)`)
      setF(opex, `${c}9`, `${prev}9*(1+'[Assumptions.xlsx]Global'!$B$5*0.8)`)
      setF(opex, `${c}10`, `IFERROR('[Revenue-Model.xlsx]Revenue'!${c}7*0.08,0)`)
      setF(opex, `${c}11`, `${prev}11*(1+'[Assumptions.xlsx]Global'!$B$5)`)
      setF(opex, `${c}12`, `${prev}12*(1+'[Assumptions.xlsx]Global'!$B$5*0.5)`)
    }
    setF(opex, `${c}13`, `SUM(${c}2:${c}12)`)
  }
  // OFFSET volatile function (pattern #6) — trailing 3-year average
  setV(opex, 'A15', 'Trailing 3Y Avg OpEx')
  setF(opex, 'B15', 'IFERROR(AVERAGE(OFFSET(F13,0,-2,1,3)),0)')
  setRef(opex, 'A1:F15')
  XLSX.utils.book_append_sheet(wb, opex, 'OpEx')

  // --- Trends ---
  const trends = XLSX.utils.aoa_to_sheet([['Metric', 2024, 2025, 2026, 2027, 2028, 'CAGR']])
  setV(trends, 'A2', 'Total COGS'); setV(trends, 'A3', 'Total OpEx')
  for (let y = 0; y < 5; y++) {
    const c = col(1 + y)
    setF(trends, `${c}2`, `COGS!${c}6`)
    setF(trends, `${c}3`, `OpEx!${c}13`)
  }
  setF(trends, 'G2', 'LET(s,B2,e,F2,n,4,(e/s)^(1/n)-1)')
  setF(trends, 'G3', 'LET(s,B3,e,F3,n,4,(e/s)^(1/n)-1)')
  // INDIRECT ref to dynamic sheet (pattern #13)
  setV(trends, 'A5', 'COGS via INDIRECT')
  setF(trends, 'B5', 'INDIRECT("COGS!B6")')
  setRef(trends, 'A1:G5')
  XLSX.utils.book_append_sheet(wb, trends, 'Trends')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'Cost-Model.xlsx'), buf)
  console.log('[4/7] Cost-Model.xlsx — 3 sheets, IFERROR, OFFSET, INDIRECT, cross-file refs')
}

// ═══════════════════════════════════════════════════════════════════════
// 5. FINANCIALS.xlsx
// ═══════════════════════════════════════════════════════════════════════
function makeFinancials() {
  const wb = XLSX.utils.book_new()

  // --- Working (scratch sheet) — intermediate calculations (pattern #2) ---
  const work = XLSX.utils.aoa_to_sheet([['DO NOT DELETE — intermediate calcs', '', '', '']])
  setRow(work, 2, ['Rev pull', '=IFERROR(\'[Revenue-Model.xlsx]Revenue\'!B7,0)', null, 'temp check'])
  setRow(work, 3, ['COGS pull', '=IFERROR(\'[Cost-Model.xlsx]COGS\'!B6,0)', null, 'temp check'])
  setRow(work, 4, ['OpEx pull', '=IFERROR(\'[Cost-Model.xlsx]OpEx\'!B13,0)', null, 'temp check'])
  setRow(work, 5, ['Gross margin', '=IFERROR((B2-B3)/B2,0)', null, 'should be ~60%'])
  // Hard-coded override mixed with formula (pattern #3) — B6 "should" be a formula but is hardcoded
  setV(work, 'A6', 'Tax rate override')
  setV(work, 'B6', 0.25)
  setV(work, 'D6', 'HARDCODED - was =\'[Assumptions.xlsx]Global\'!B3')
  setRow(work, 7, ['Quick NI est', '=(B2-B3-B4)*(1-B6)', null, 'sanity check'])
  // OFFSET to pull last year dynamically (pattern #6)
  setV(work, 'A8', 'Last yr rev')
  setF(work, 'B8', "IFERROR(OFFSET('[Revenue-Model.xlsx]Revenue'!A7,0,5),0)")
  setRef(work, 'A1:D8')
  XLSX.utils.book_append_sheet(wb, work, 'Working')

  // --- P&L ---
  const pl = XLSX.utils.aoa_to_sheet([['Line Item', 2024, 2025, 2026, 2027, 2028]])
  const plItems = ['Revenue', 'COGS', 'Gross Profit', 'Gross Margin %', 'Operating Expenses',
    'EBITDA', 'D&A', 'EBIT', 'Interest Expense', 'EBT', 'Income Tax', 'Net Income', 'Net Margin %']
  for (let r = 0; r < plItems.length; r++) setV(pl, `A${r + 2}`, plItems[r])
  for (let y = 0; y < 5; y++) {
    const c = col(1 + y)
    // IFERROR on key cross-file pulls (pattern #4)
    setF(pl, `${c}2`, ieF(`'[Revenue-Model.xlsx]Revenue'!${c}7`))
    setF(pl, `${c}3`, ieF(`'[Cost-Model.xlsx]COGS'!${c}6`))
    setF(pl, `${c}4`, `${c}2-${c}3`)
    // IFERROR on division (avoid #DIV/0!)
    setF(pl, `${c}5`, ieF(`${c}4/${c}2`))
    setF(pl, `${c}6`, ieF(`'[Cost-Model.xlsx]OpEx'!${c}13`))
    setF(pl, `${c}7`, `${c}4-${c}6`)
    setF(pl, `${c}8`, `${c}2*0.03`)
    setF(pl, `${c}9`, `${c}7-${c}8`)
    setF(pl, `${c}10`, ieF(`BalanceSheet!${c}10*'[Assumptions.xlsx]Global'!$B$13`))
    setF(pl, `${c}11`, `${c}9-${c}10`)
    // Deeply nested: IF with IFERROR and cross-file ref (pattern #7)
    setF(pl, `${c}12`, `IF(${c}11>0,IFERROR(${c}11*'[Assumptions.xlsx]Global'!$B$3,0),0)`)
    setF(pl, `${c}13`, `${c}11-${c}12`)
    setF(pl, `${c}14`, ieF(`${c}13/${c}2`))
  }
  setRef(pl, 'A1:F14')
  XLSX.utils.book_append_sheet(wb, pl, 'P&L')

  // --- BalanceSheet ---
  const bs = XLSX.utils.aoa_to_sheet([['Line Item', 2024, 2025, 2026, 2027, 2028]])
  const bsItems = ['Assets', 'Cash', 'Accounts Receivable', 'PP&E', 'Total Assets', '',
    'Liabilities', 'Accounts Payable', 'Accrued Expenses', 'Long-term Debt', 'Total Liabilities', '',
    'Equity', 'Retained Earnings', 'Total Equity', 'Total L+E']
  for (let r = 0; r < bsItems.length; r++) if (bsItems[r]) setV(bs, `A${r + 2}`, bsItems[r])
  for (let y = 0; y < 5; y++) {
    const c = col(1 + y)
    const prev = col(y)
    setF(bs, `${c}3`, `CashFlow!${c}19`)
    setF(bs, `${c}4`, `'P&L'!${c}2/4`)
    if (y === 0) {
      setV(bs, 'B5', 5000000)
      setV(bs, 'B11', 10000000)
      setF(bs, 'B15', "'P&L'!B13")
    } else {
      setF(bs, `${c}5`, `${prev}5-'P&L'!${c}8+1000000`)
      setF(bs, `${c}11`, ieF(`${prev}11-${prev}11/'[Assumptions.xlsx]Global'!$B$14`))
      setF(bs, `${c}15`, `${prev}15+'P&L'!${c}13`)
    }
    setF(bs, `${c}6`, `SUM(${c}3:${c}5)`)
    setF(bs, `${c}9`, ieF(`'[Cost-Model.xlsx]COGS'!${c}6/6`))
    setF(bs, `${c}10`, ieF(`'[Cost-Model.xlsx]OpEx'!${c}13/12`))
    setF(bs, `${c}12`, `SUM(${c}9:${c}11)`)
    setF(bs, `${c}16`, `${c}15`)
    setF(bs, `${c}17`, `${c}12+${c}16`)
  }
  setRef(bs, 'A1:F17')
  XLSX.utils.book_append_sheet(wb, bs, 'BalanceSheet')

  // --- CashFlow ---
  const cf = XLSX.utils.aoa_to_sheet([['Line Item', 2024, 2025, 2026, 2027, 2028]])
  const cfItems = ['Operating Activities', 'Net Income', 'D&A', 'Change in AR', 'Change in AP',
    'Operating Cash Flow', '', 'Investing Activities', 'CapEx', 'Investing Cash Flow', '',
    'Financing Activities', 'Debt Repayment', 'Financing Cash Flow', '',
    'Net Cash Flow', 'Beginning Cash', 'Ending Cash']
  for (let r = 0; r < cfItems.length; r++) if (cfItems[r]) setV(cf, `A${r + 2}`, cfItems[r])
  for (let y = 0; y < 5; y++) {
    const c = col(1 + y)
    const prev = col(y)
    setF(cf, `${c}3`, `'P&L'!${c}13`)
    setF(cf, `${c}4`, `'P&L'!${c}8`)
    if (y === 0) {
      setF(cf, 'B5', '-BalanceSheet!B4')
      setF(cf, 'B6', 'BalanceSheet!B9')
      setV(cf, 'B10', -1000000)
      setV(cf, 'B18', 5000000)
    } else {
      setF(cf, `${c}5`, `-(BalanceSheet!${c}4-BalanceSheet!${prev}4)`)
      setF(cf, `${c}6`, `BalanceSheet!${c}9-BalanceSheet!${prev}9`)
      setF(cf, `${c}10`, ieF(`-1000000*(1+'[Assumptions.xlsx]Global'!$B$5)^${y}`))
      setF(cf, `${c}18`, `${prev}17+${prev}19`)
    }
    setF(cf, `${c}7`, `SUM(${c}3:${c}6)`)
    setF(cf, `${c}11`, `${c}10`)
    setF(cf, `${c}14`, ieF(`-BalanceSheet!${c}11/'[Assumptions.xlsx]Global'!$B$14`))
    setF(cf, `${c}15`, `${c}14`)
    setF(cf, `${c}17`, `${c}7+${c}11+${c}15`)
    setF(cf, `${c}19`, `${c}17+${c}18`)
  }
  setRef(cf, 'A1:F19')
  XLSX.utils.book_append_sheet(wb, cf, 'CashFlow')

  // --- Ratios ---
  const rat = XLSX.utils.aoa_to_sheet([['Ratio', 2024, 2025, 2026, 2027, 2028]])
  const ratNames = ['Gross Margin', 'EBITDA Margin', 'Net Margin', 'ROE', 'Debt/Equity', 'Current Ratio']
  for (let r = 0; r < ratNames.length; r++) setV(rat, `A${r + 2}`, ratNames[r])
  for (let y = 0; y < 5; y++) {
    const c = col(1 + y)
    setF(rat, `${c}2`, `'P&L'!${c}5`)
    setF(rat, `${c}3`, ieF(`'P&L'!${c}7/'P&L'!${c}2`))
    setF(rat, `${c}4`, `'P&L'!${c}14`)
    setF(rat, `${c}5`, ieF(`'P&L'!${c}13/BalanceSheet!${c}16`))
    setF(rat, `${c}6`, ieF(`BalanceSheet!${c}11/BalanceSheet!${c}16`))
    setF(rat, `${c}7`, ieF(`(BalanceSheet!${c}3+BalanceSheet!${c}4)/(BalanceSheet!${c}9+BalanceSheet!${c}10)`))
  }
  setRef(rat, 'A1:F7')
  XLSX.utils.book_append_sheet(wb, rat, 'Ratios')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'Financials.xlsx'), buf)
  console.log('[5/7] Financials.xlsx — 5 sheets (incl Working scratch), IFERROR, nested IF, hard-coded overrides')
}

// ═══════════════════════════════════════════════════════════════════════
// 6. VALUATION.xlsx
// ═══════════════════════════════════════════════════════════════════════
function makeValuation() {
  const wb = XLSX.utils.book_new()

  // --- DCF ---
  const dcf = XLSX.utils.aoa_to_sheet([['Line Item', 2024, 2025, 2026, 2027, 2028, 'Terminal']])
  const dcfItems = ['Free Cash Flow', 'Discount Factor', 'PV of FCF', '',
    'Terminal Value', 'PV of Terminal', '', 'Sum of PV(FCF)', 'PV of Terminal',
    'Enterprise Value', 'Less: Debt', 'Plus: Cash', 'Equity Value']
  for (let r = 0; r < dcfItems.length; r++) if (dcfItems[r]) setV(dcf, `A${r + 2}`, dcfItems[r])
  for (let y = 0; y < 5; y++) {
    const c = col(1 + y)
    // IFERROR on cross-file FCF calculation
    setF(dcf, `${c}2`, ieF(`'[Financials.xlsx]CashFlow'!${c}7+'[Financials.xlsx]CashFlow'!${c}11`))
    setF(dcf, `${c}3`, ieF(`1/(1+'[Assumptions.xlsx]Global'!$B$6)^${y + 1}`))
    setF(dcf, `${c}4`, `${c}2*${c}3`)
  }
  // Deeply nested: terminal value with multiple cross-file refs (pattern #7)
  setF(dcf, 'G6', `IFERROR(F2*(1+'[Assumptions.xlsx]Global'!$B$7)/('[Assumptions.xlsx]Global'!$B$6-'[Assumptions.xlsx]Global'!$B$7),0)`)
  setF(dcf, 'G7', 'G6*F3')
  setF(dcf, 'B9', 'SUM(B4:F4)')
  setF(dcf, 'B10', 'G7')
  setF(dcf, 'B11', 'B9+B10')
  setF(dcf, 'B12', `IFERROR(-'[Financials.xlsx]BalanceSheet'!B11,0)`)
  setF(dcf, 'B13', `IFERROR('[Financials.xlsx]BalanceSheet'!B3,0)`)
  setF(dcf, 'B14', 'B11+B12+B13')
  setRef(dcf, 'A1:G14')
  XLSX.utils.book_append_sheet(wb, dcf, 'DCF')

  // --- Sensitivity ---
  const sens = XLSX.utils.aoa_to_sheet([['WACC \\ TG']])
  const tgRates = [0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04]
  const waccRates = [0.08, 0.09, 0.10, 0.11, 0.12, 0.13, 0.14]
  for (let c = 0; c < tgRates.length; c++) setV(sens, `${col(1 + c)}1`, tgRates[c])
  for (let r = 0; r < waccRates.length; r++) {
    const row = r + 2
    setV(sens, `A${row}`, waccRates[r])
    for (let c = 0; c < tgRates.length; c++) {
      const cl = col(1 + c)
      setF(sens, `${cl}${row}`, `LET(wacc,$A${row},tg,${cl}$1,fcf,DCF!F2,tv,fcf*(1+tg)/(wacc-tg),pvTV,tv/(1+wacc)^5,pvFCF,DCF!B9,debt,DCF!B12,cash,DCF!B13,pvFCF+pvTV+debt+cash)`)
    }
  }
  setRef(sens, 'A1:H8')
  XLSX.utils.book_append_sheet(wb, sens, 'Sensitivity')

  // --- Comparables ---
  const comp = XLSX.utils.aoa_to_sheet([['Company', 'Revenue ($M)', 'EBITDA ($M)', 'EV ($M)', 'EV/Revenue', 'EV/EBITDA']])
  const comps: [string, number, number, number][] = [
    ['Competitor A', 100, 25, 500], ['Competitor B', 250, 60, 1200],
    ['Competitor C', 75, 15, 300], ['Competitor D', 500, 120, 3000],
  ]
  for (let r = 0; r < comps.length; r++) {
    const row = r + 2
    setRow(comp, row, [...comps[r]])
    setF(comp, `E${row}`, `D${row}/B${row}`)
    setF(comp, `F${row}`, `D${row}/C${row}`)
  }
  setV(comp, 'A6', 'Median')
  setF(comp, 'E6', 'MEDIAN(E2:E5)'); setF(comp, 'F6', 'MEDIAN(F2:F5)')
  setV(comp, 'A8', 'Acme via EV/Rev')
  setF(comp, 'B8', `IFERROR('[Financials.xlsx]P&L'!B2/1000000*E6,0)`)
  setV(comp, 'A9', 'Acme via EV/EBITDA')
  setF(comp, 'B9', `IFERROR('[Financials.xlsx]P&L'!B7/1000000*F6,0)`)
  // INDEX/MATCH for comp lookup (pattern #7 — nested)
  setV(comp, 'A11', 'Highest EV/Rev Comp')
  setF(comp, 'B11', ieFBlank('INDEX(A2:A5,MATCH(MAX(E2:E5),E2:E5,0))'))
  // Numeric external link index pattern (pattern #11) — [1] style
  setV(comp, 'A12', 'Alt Rev Ref (numeric)')
  setF(comp, 'B12', "IFERROR('[1]Revenue'!B7,0)")
  setRef(comp, 'A1:F12')
  XLSX.utils.book_append_sheet(wb, comp, 'Comparables')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'Valuation.xlsx'), buf)
  console.log('[6/7] Valuation.xlsx — 3 sheets, IFERROR, INDEX/MATCH, LET sensitivity, [1] numeric link')
}

// ═══════════════════════════════════════════════════════════════════════
// 7. DASHBOARD.xlsx
// ═══════════════════════════════════════════════════════════════════════
function makeDashboard() {
  const wb = XLSX.utils.book_new()

  const kpis = XLSX.utils.aoa_to_sheet([['KPI', 2024, 2025, 2026, 2027, 2028, '5Y CAGR']])
  const kpiNames = [
    'Revenue', 'Revenue Growth', 'Gross Profit', 'Gross Margin %', 'EBITDA',
    'EBITDA Margin %', 'Net Income', 'Net Margin %', 'Free Cash Flow', 'Cash Balance',
    '', 'PEOPLE', 'Total Headcount', 'Revenue/Employee', 'Total People Cost', 'People Cost % Rev',
    '', 'COSTS', 'COGS', 'COGS % Revenue', 'Total OpEx', 'OpEx % Revenue',
    '', 'VALUATION', 'Enterprise Value', 'Equity Value', 'EV/Revenue', 'EV/EBITDA',
    '', 'KEY ASSUMPTIONS', 'Growth Rate', 'Tax Rate', 'Discount Rate', 'Terminal Growth',
  ]
  for (let r = 0; r < kpiNames.length; r++) if (kpiNames[r]) setV(kpis, `A${r + 2}`, kpiNames[r])

  for (let y = 0; y < 5; y++) {
    const c = col(1 + y)
    const prev = col(y)
    // IFERROR wrapping on cross-file KPI pulls
    setF(kpis, `${c}2`, ieF(`'[Revenue-Model.xlsx]Revenue'!${c}7`))
    if (y > 0) setF(kpis, `${c}3`, ieF(`${c}2/${prev}2-1`))
    setF(kpis, `${c}4`, ieF(`'[Financials.xlsx]P&L'!${c}4`))
    setF(kpis, `${c}5`, ieF(`'[Financials.xlsx]P&L'!${c}5`))
    setF(kpis, `${c}6`, ieF(`'[Financials.xlsx]P&L'!${c}7`))
    setF(kpis, `${c}7`, ieF(`'[Financials.xlsx]P&L'!${c}7/'[Financials.xlsx]P&L'!${c}2`))
    setF(kpis, `${c}8`, ieF(`'[Financials.xlsx]P&L'!${c}13`))
    setF(kpis, `${c}9`, ieF(`'[Financials.xlsx]P&L'!${c}14`))
    setF(kpis, `${c}10`, ieF(`'[Financials.xlsx]CashFlow'!${c}7+'[Financials.xlsx]CashFlow'!${c}11`))
    setF(kpis, `${c}11`, ieF(`'[Financials.xlsx]BalanceSheet'!${c}3`))
    setF(kpis, `${c}14`, ieF(`'[People.xlsx]Summary'!${c}7`))
    setF(kpis, `${c}15`, ieF(`'[Revenue-Model.xlsx]Revenue'!${c}7/'[People.xlsx]Summary'!${c}7`))
    setF(kpis, `${c}16`, ieF(`'[People.xlsx]Summary'!${c}3`))
    setF(kpis, `${c}17`, ieF(`${c}16/${c}2`))
    setF(kpis, `${c}20`, ieF(`'[Cost-Model.xlsx]COGS'!${c}6`))
    setF(kpis, `${c}21`, ieF(`${c}20/${c}2`))
    setF(kpis, `${c}22`, ieF(`'[Cost-Model.xlsx]OpEx'!${c}13`))
    setF(kpis, `${c}23`, ieF(`${c}22/${c}2`))
  }
  // CAGR
  setF(kpis, 'G2', 'IFERROR((F2/B2)^(1/4)-1,0)')
  setF(kpis, 'G4', 'IFERROR((F4/B4)^(1/4)-1,0)')
  setF(kpis, 'G6', 'IFERROR((F6/B6)^(1/4)-1,0)')
  setF(kpis, 'G8', 'IFERROR((F8/B8)^(1/4)-1,0)')
  // Valuation
  setF(kpis, 'B26', `IFERROR('[Valuation.xlsx]DCF'!B11,0)`)
  setF(kpis, 'B27', `IFERROR('[Valuation.xlsx]DCF'!B14,0)`)
  setF(kpis, 'B28', ieF('B26/B2')); setF(kpis, 'B29', ieF('B26/B6'))
  // Assumptions
  setF(kpis, 'B32', `IFERROR('[Assumptions.xlsx]Global'!B4,0)`)
  setF(kpis, 'B33', `IFERROR('[Assumptions.xlsx]Global'!B3,0)`)
  setF(kpis, 'B34', `IFERROR('[Assumptions.xlsx]Global'!B6,0)`)
  setF(kpis, 'B35', `IFERROR('[Assumptions.xlsx]Global'!B7,0)`)
  // LET multi-file — kept as-is (already complex)
  setV(kpis, 'A37', 'Quick NI Check')
  setF(kpis, 'B37', "LET(rev,'[Revenue-Model.xlsx]Revenue'!B7,cogs,'[Cost-Model.xlsx]COGS'!B6,opex,'[Cost-Model.xlsx]OpEx'!B13,tax,'[Assumptions.xlsx]Global'!B3,ebt,rev-cogs-opex,ni,ebt*(1-tax),ni)")
  // Numeric external link pattern [2] (pattern #11)
  setV(kpis, 'A38', 'Alt COGS (numeric link)')
  setF(kpis, 'B38', "IFERROR('[2]COGS'!B6,0)")
  // INDIRECT ref to dynamic KPI row (pattern #13)
  setV(kpis, 'A39', 'Dynamic KPI')
  setF(kpis, 'B39', 'IFERROR(INDIRECT("B"&2),0)')
  setRef(kpis, 'A1:G39')
  XLSX.utils.book_append_sheet(wb, kpis, 'KPIs')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'Dashboard.xlsx'), buf)
  console.log('[7/7] Dashboard.xlsx — 1 sheet, IFERROR everywhere, [2] numeric link, INDIRECT, refs to ALL 6 files')
}

// ═══════════════════════════════════════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════════════════════════════════════
makeAssumptions()
makeRevenueModel()
makePeople()
makeCostModel()
makeFinancials()
makeValuation()
makeDashboard()
console.log('\nAll 7 Acme Corp workbooks generated successfully!')
