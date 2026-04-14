// Acme Corp Financial Model Generator
// Creates 7 interconnected Excel workbooks for Tangle stress testing
// Run: node tests/fixtures/acme-corp/generate.ts

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

  // Named ranges
  if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
  if (!wb.Workbook.Names) wb.Workbook.Names = []
  for (let r = 0; r < params.length; r++) {
    wb.Workbook.Names.push({ Name: params[r][0], Ref: `Global!$B$${r + 2}`, Sheet: undefined })
  }

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
  setRow(scen, 3, ['Tax Rate', '=TaxRate+0.05', '=TaxRate', '=TaxRate-0.03'])
  setRow(scen, 4, ['Discount Rate', '=DiscountRate+0.02', '=DiscountRate', '=DiscountRate-0.02'])
  setRow(scen, 5, ['Terminal Growth', '=TerminalGrowth-0.005', '=TerminalGrowth', '=TerminalGrowth+0.005'])
  setV(scen, 'A7', '3D Sum Check')
  setF(scen, 'B7', "SUM('Global:Scenarios'!B2)")
  setRef(scen, 'A1:D7')
  XLSX.utils.book_append_sheet(wb, scen, 'Scenarios')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'Assumptions.xlsx'), buf)
  console.log('[1/7] Assumptions.xlsx — 3 sheets, 18 named ranges, 3D ref')
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
      setF(vol, `${col(1 + y)}${row}`, `${col(y)}${row}*(1+'[Assumptions.xlsx]Rates'!B${y + 1}*${growthMult[r]})`)
    }
  }
  setRef(vol, 'A1:F6')
  XLSX.utils.book_append_sheet(wb, vol, 'Volume')

  // --- Pricing ---
  const price = XLSX.utils.aoa_to_sheet([['Product', 2024, 2025, 2026, 2027, 2028]])
  for (let r = 0; r < 5; r++) {
    const row = r + 2
    setV(price, `A${row}`, products[r][1] as string)
    setF(price, `B${row}`, `XLOOKUP(A${row},Products!A:A,Products!D:D)`)
    for (let y = 1; y < 5; y++) {
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
    setF(mix, `B${row}`, `Revenue!B${row}/Revenue!B7`)
    setF(mix, `C${row}`, `Revenue!F${row}/Revenue!F7`)
    setF(mix, `D${row}`, `C${row}-B${row}`)
    setF(mix, `E${row}`, `(Pricing!F${row}/Pricing!B${row})^(1/4)-1`)
  }
  setV(mix, 'A8', 'Revenue CAGR')
  setF(mix, 'B8', 'LET(rev2024,Revenue!B7,rev2028,Revenue!F7,cagr,(rev2028/rev2024)^(1/4)-1,cagr)')
  setRef(mix, 'A1:E8')
  XLSX.utils.book_append_sheet(wb, mix, 'Mix Analysis')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'Revenue-Model.xlsx'), buf)
  console.log('[2/7] Revenue-Model.xlsx — 5 sheets, XLOOKUP, LET, cross-file refs')
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
        setF(hc, `${c}${row}`, `ROUND(${prev}${row}*(1+'[Assumptions.xlsx]Global'!$B$10*${staff[r][5]}),0)`)
      }
    } else {
      // Executive: flat
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
      setF(comp, `${c}${row}`, `Headcount!${hcC}${row}*Headcount!H${row}*(1+'[Assumptions.xlsx]Global'!$B$11)^${y}*(1+'[Assumptions.xlsx]Global'!$B$12)`)
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
      setF(comp, `${c}${dRow}`, `SUMIFS(${c}2:${c}${staff.length + 1},$A$2:$A$${staff.length + 1},"${depts[d]}")`)
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
  setRef(summ, 'A1:E7')
  XLSX.utils.book_append_sheet(wb, summ, 'Summary')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'People.xlsx'), buf)
  console.log('[3/7] People.xlsx — 3 sheets, SUMIFS, ROUND, cross-file refs')
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
    setF(cogs, `${c}2`, `'[Revenue-Model.xlsx]Revenue'!${c}7*'[Assumptions.xlsx]Rates'!C${rateRow}*0.5`)
    setF(cogs, `${c}3`, `'[People.xlsx]Compensation'!${c}16`)
    setF(cogs, `${c}4`, `'[Revenue-Model.xlsx]Revenue'!${c}7*0.05`)
    setF(cogs, `${c}5`, `'[Revenue-Model.xlsx]Revenue'!${c}7*0.02`)
    setF(cogs, `${c}6`, `SUM(${c}2:${c}5)`)
    setF(cogs, `${c}7`, `1-(${c}6/'[Revenue-Model.xlsx]Revenue'!${c}7)`)
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
    // People costs
    for (let d = 0; d < 5; d++) {
      setF(opex, `${c}${d + 2}`, `'[People.xlsx]Summary'!${c}${d + 2}`)
    }
    // Non-people
    if (y === 0) {
      setV(opex, 'B7', 2000000); setV(opex, 'B8', 500000); setV(opex, 'B9', 300000)
      setF(opex, 'B10', "'[Revenue-Model.xlsx]Revenue'!B7*0.08")
      setV(opex, 'B11', 400000); setV(opex, 'B12', 200000)
    } else {
      const prev = col(y)
      setF(opex, `${c}7`, `${prev}7*(1+'[Assumptions.xlsx]Global'!$B$5)`)
      setF(opex, `${c}8`, `${prev}8*(1+'[Assumptions.xlsx]Global'!$B$5*1.5)`)
      setF(opex, `${c}9`, `${prev}9*(1+'[Assumptions.xlsx]Global'!$B$5*0.8)`)
      setF(opex, `${c}10`, `'[Revenue-Model.xlsx]Revenue'!${c}7*0.08`)
      setF(opex, `${c}11`, `${prev}11*(1+'[Assumptions.xlsx]Global'!$B$5)`)
      setF(opex, `${c}12`, `${prev}12*(1+'[Assumptions.xlsx]Global'!$B$5*0.5)`)
    }
    setF(opex, `${c}13`, `SUM(${c}2:${c}12)`)
  }
  setRef(opex, 'A1:F13')
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
  setRef(trends, 'A1:G3')
  XLSX.utils.book_append_sheet(wb, trends, 'Trends')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'Cost-Model.xlsx'), buf)
  console.log('[4/7] Cost-Model.xlsx — 3 sheets, refs to Revenue+People+Assumptions, LET')
}

// ═══════════════════════════════════════════════════════════════════════
// 5. FINANCIALS.xlsx
// ═══════════════════════════════════════════════════════════════════════
function makeFinancials() {
  const wb = XLSX.utils.book_new()

  // --- P&L ---
  const pl = XLSX.utils.aoa_to_sheet([['Line Item', 2024, 2025, 2026, 2027, 2028]])
  const plItems = ['Revenue', 'COGS', 'Gross Profit', 'Gross Margin %', 'Operating Expenses',
    'EBITDA', 'D&A', 'EBIT', 'Interest Expense', 'EBT', 'Income Tax', 'Net Income', 'Net Margin %']
  for (let r = 0; r < plItems.length; r++) setV(pl, `A${r + 2}`, plItems[r])
  for (let y = 0; y < 5; y++) {
    const c = col(1 + y)
    setF(pl, `${c}2`, `'[Revenue-Model.xlsx]Revenue'!${c}7`)
    setF(pl, `${c}3`, `'[Cost-Model.xlsx]COGS'!${c}6`)
    setF(pl, `${c}4`, `${c}2-${c}3`)
    setF(pl, `${c}5`, `${c}4/${c}2`)
    setF(pl, `${c}6`, `'[Cost-Model.xlsx]OpEx'!${c}13`)
    setF(pl, `${c}7`, `${c}4-${c}6`)
    setF(pl, `${c}8`, `${c}2*0.03`)
    setF(pl, `${c}9`, `${c}7-${c}8`)
    setF(pl, `${c}10`, `BalanceSheet!${c}10*'[Assumptions.xlsx]Global'!$B$13`)
    setF(pl, `${c}11`, `${c}9-${c}10`)
    setF(pl, `${c}12`, `MAX(0,${c}11*'[Assumptions.xlsx]Global'!$B$3)`)
    setF(pl, `${c}13`, `${c}11-${c}12`)
    setF(pl, `${c}14`, `${c}13/${c}2`)
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
      setF(bs, `${c}11`, `${prev}11-${prev}11/'[Assumptions.xlsx]Global'!$B$14`)
      setF(bs, `${c}15`, `${prev}15+'P&L'!${c}13`)
    }
    setF(bs, `${c}6`, `SUM(${c}3:${c}5)`)
    setF(bs, `${c}9`, `'[Cost-Model.xlsx]COGS'!${c}6/6`)
    setF(bs, `${c}10`, `'[Cost-Model.xlsx]OpEx'!${c}13/12`)
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
      setF(cf, `${c}10`, `-1000000*(1+'[Assumptions.xlsx]Global'!$B$5)^${y}`)
      setF(cf, `${c}18`, `${prev}17+${prev}19`)
    }
    setF(cf, `${c}7`, `SUM(${c}3:${c}6)`)
    setF(cf, `${c}11`, `${c}10`)
    setF(cf, `${c}14`, `-BalanceSheet!${c}11/'[Assumptions.xlsx]Global'!$B$14`)
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
    setF(rat, `${c}3`, `'P&L'!${c}7/'P&L'!${c}2`)
    setF(rat, `${c}4`, `'P&L'!${c}14`)
    setF(rat, `${c}5`, `'P&L'!${c}13/BalanceSheet!${c}16`)
    setF(rat, `${c}6`, `BalanceSheet!${c}11/BalanceSheet!${c}16`)
    setF(rat, `${c}7`, `(BalanceSheet!${c}3+BalanceSheet!${c}4)/(BalanceSheet!${c}9+BalanceSheet!${c}10)`)
  }
  setRef(rat, 'A1:F7')
  XLSX.utils.book_append_sheet(wb, rat, 'Ratios')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'Financials.xlsx'), buf)
  console.log('[5/7] Financials.xlsx — 4 sheets, refs to 4 files, P&L↔BS circular')
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
    setF(dcf, `${c}2`, `'[Financials.xlsx]CashFlow'!${c}7+'[Financials.xlsx]CashFlow'!${c}11`)
    setF(dcf, `${c}3`, `1/(1+'[Assumptions.xlsx]Global'!$B$6)^${y + 1}`)
    setF(dcf, `${c}4`, `${c}2*${c}3`)
  }
  setF(dcf, 'G6', "F2*(1+'[Assumptions.xlsx]Global'!$B$7)/('[Assumptions.xlsx]Global'!$B$6-'[Assumptions.xlsx]Global'!$B$7)")
  setF(dcf, 'G7', 'G6*F3')
  setF(dcf, 'B9', 'SUM(B4:F4)')
  setF(dcf, 'B10', 'G7')
  setF(dcf, 'B11', 'B9+B10')
  setF(dcf, 'B12', "-'[Financials.xlsx]BalanceSheet'!B11")
  setF(dcf, 'B13', "'[Financials.xlsx]BalanceSheet'!B3")
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
  setF(comp, 'B8', "'[Financials.xlsx]P&L'!B2/1000000*E6")
  setV(comp, 'A9', 'Acme via EV/EBITDA')
  setF(comp, 'B9', "'[Financials.xlsx]P&L'!B7/1000000*F6")
  setRef(comp, 'A1:F9')
  XLSX.utils.book_append_sheet(wb, comp, 'Comparables')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'Valuation.xlsx'), buf)
  console.log('[6/7] Valuation.xlsx — 3 sheets, LAMBDA/LET, sensitivity matrix, cross-file')
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
    setF(kpis, `${c}2`, `'[Revenue-Model.xlsx]Revenue'!${c}7`)
    if (y > 0) setF(kpis, `${c}3`, `${c}2/${prev}2-1`)
    setF(kpis, `${c}4`, `'[Financials.xlsx]P&L'!${c}4`)
    setF(kpis, `${c}5`, `'[Financials.xlsx]P&L'!${c}5`)
    setF(kpis, `${c}6`, `'[Financials.xlsx]P&L'!${c}7`)
    setF(kpis, `${c}7`, `'[Financials.xlsx]P&L'!${c}7/'[Financials.xlsx]P&L'!${c}2`)
    setF(kpis, `${c}8`, `'[Financials.xlsx]P&L'!${c}13`)
    setF(kpis, `${c}9`, `'[Financials.xlsx]P&L'!${c}14`)
    setF(kpis, `${c}10`, `'[Financials.xlsx]CashFlow'!${c}7+'[Financials.xlsx]CashFlow'!${c}11`)
    setF(kpis, `${c}11`, `'[Financials.xlsx]BalanceSheet'!${c}3`)
    setF(kpis, `${c}14`, `'[People.xlsx]Summary'!${c}7`)
    setF(kpis, `${c}15`, `'[Revenue-Model.xlsx]Revenue'!${c}7/'[People.xlsx]Summary'!${c}7`)
    setF(kpis, `${c}16`, `'[People.xlsx]Summary'!${c}3`)
    setF(kpis, `${c}17`, `${c}16/${c}2`)
    setF(kpis, `${c}20`, `'[Cost-Model.xlsx]COGS'!${c}6`)
    setF(kpis, `${c}21`, `${c}20/${c}2`)
    setF(kpis, `${c}22`, `'[Cost-Model.xlsx]OpEx'!${c}13`)
    setF(kpis, `${c}23`, `${c}22/${c}2`)
  }
  // CAGR
  setF(kpis, 'G2', '(F2/B2)^(1/4)-1')
  setF(kpis, 'G4', '(F4/B4)^(1/4)-1')
  setF(kpis, 'G6', '(F6/B6)^(1/4)-1')
  setF(kpis, 'G8', '(F8/B8)^(1/4)-1')
  // Valuation
  setF(kpis, 'B26', "'[Valuation.xlsx]DCF'!B11")
  setF(kpis, 'B27', "'[Valuation.xlsx]DCF'!B14")
  setF(kpis, 'B28', 'B26/B2'); setF(kpis, 'B29', 'B26/B6')
  // Assumptions
  setF(kpis, 'B32', "'[Assumptions.xlsx]Global'!B4")
  setF(kpis, 'B33', "'[Assumptions.xlsx]Global'!B3")
  setF(kpis, 'B34', "'[Assumptions.xlsx]Global'!B6")
  setF(kpis, 'B35', "'[Assumptions.xlsx]Global'!B7")
  // LET multi-file
  setV(kpis, 'A37', 'Quick NI Check')
  setF(kpis, 'B37', "LET(rev,'[Revenue-Model.xlsx]Revenue'!B7,cogs,'[Cost-Model.xlsx]COGS'!B6,opex,'[Cost-Model.xlsx]OpEx'!B13,tax,'[Assumptions.xlsx]Global'!B3,ebt,rev-cogs-opex,ni,ebt*(1-tax),ni)")
  setRef(kpis, 'A1:G37')
  XLSX.utils.book_append_sheet(wb, kpis, 'KPIs')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(join(OUT, 'Dashboard.xlsx'), buf)
  console.log('[7/7] Dashboard.xlsx — 1 sheet, refs to ALL 6 files, LET multi-file')
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
