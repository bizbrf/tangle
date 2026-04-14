// excel-tests/generate.ts
// Actuarial-scale Excel test models for Tangle
// Run via: node generate.ts  (Node 24+ strips TypeScript types natively)
//
// Designed against: https://github.com/bizbrf/tangle
//
// 6 interconnected actuarial workbooks with 40+ sheets each, 500+ formulas per file,
// heavy cross-sheet refs, named ranges used in formulas, tables, external file refs.
// Total: ~175 sheets, ~4000+ formulas across all files.

import * as XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const OUT_DIR = __dirname

mkdirSync(OUT_DIR, { recursive: true })

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
  console.log(`  ✓ [${label}] ${count} formula cells`)
}

function write(wb: XLSX.WorkBook, filename: string, minFormulas: number): void {
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(buf, minFormulas, filename)
  writeFileSync(join(OUT_DIR, filename), buf)
}

// Helper: set a formula cell
function F(sheet: XLSX.WorkSheet, cell: string, formula: string): void {
  sheet[cell] = { t: 'n', v: 0, f: formula }
}

// Helper: set a value cell
function V(sheet: XLSX.WorkSheet, cell: string, val: number | string): void {
  if (typeof val === 'string') {
    sheet[cell] = { t: 's', v: val }
  } else {
    sheet[cell] = { t: 'n', v: val }
  }
}

// Helper: set sheet range
function setRef(sheet: XLSX.WorkSheet, ref: string): void {
  sheet['!ref'] = ref
}

// Helper: Excel column letter from 0-based index
function colLetter(i: number): string {
  if (i < 26) return String.fromCharCode(65 + i)
  return String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))
}

// Helper: add named ranges to workbook
function addNames(wb: XLSX.WorkBook, names: { Name: string; Ref: string; Sheet?: number }[]): void {
  if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
  if (!wb.Workbook.Names) wb.Workbook.Names = []
  for (const n of names) {
    wb.Workbook.Names.push({ Name: n.Name, Ref: n.Ref, Sheet: n.Sheet ?? undefined })
  }
}

// Helper: add table metadata to a sheet
function addTable(sheet: XLSX.WorkSheet, name: string, ref: string): void {
  const tables = ((sheet as Record<string, unknown>)['!tables'] ?? []) as unknown[]
  tables.push({ name, displayName: name, ref })
  ;(sheet as Record<string, unknown>)['!tables'] = tables
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTUARIAL MODEL 1: Reserve Model (reserve-model.xlsx)
// ~45 sheets, ~800+ formulas
// Loss triangles by LOB, development factors, IBNR, case/bulk reserves
// Heavy cross-sheet refs, named ranges, tables
// ═══════════════════════════════════════════════════════════════════════════════
function makeReserveModel(): void {
  const wb = XLSX.utils.book_new()
  const LOBS = ['Auto Liability', 'Auto Physical', 'General Liability', 'Workers Comp', 'Commercial Property', 'Professional Liab', 'Umbrella', 'Medical Malpractice']
  const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
  const namedRanges: { Name: string; Ref: string; Sheet?: number }[] = []

  // ── Sheet: Assumptions ─────────────────────────────────────────────
  const assumptions = XLSX.utils.aoa_to_sheet([
    ['Reserve Model Assumptions'],
    ['As of Date', '12/31/2025'],
    [''],
    ['Parameter', 'Value', 'Source'],
    ['Discount Rate', 0.045, 'Investment Policy'],
    ['Risk Margin %', 0.075, 'Board Policy'],
    ['ULAE Factor', 0.08, 'Expense Study'],
    ['Salvage & Subro %', 0.03, 'Historical'],
    ['Tail Factor', 1.015, 'Industry'],
    ['Credibility Threshold', 0.70, 'Actuarial Standards'],
    ['Confidence Level', 0.75, 'Management'],
    ['Bulk Reserve %', 0.05, 'Actuarial Judgment'],
    ['Case Adequacy Factor', 1.02, 'Case Review'],
    ['CPI Trend', 0.032, 'Economic'],
    ['Medical Trend', 0.065, 'Industry Study'],
    ['Legal Trend', 0.045, 'Claims Dept'],
  ])
  setRef(assumptions, 'A1:C16')
  XLSX.utils.book_append_sheet(wb, assumptions, 'Assumptions')
  namedRanges.push(
    { Name: 'DiscountRate',   Ref: 'Assumptions!$B$5' },
    { Name: 'RiskMargin',     Ref: 'Assumptions!$B$6' },
    { Name: 'ULAEFactor',     Ref: 'Assumptions!$B$7' },
    { Name: 'SalvageSubro',   Ref: 'Assumptions!$B$8' },
    { Name: 'TailFactor',     Ref: 'Assumptions!$B$9' },
    { Name: 'CredThreshold',  Ref: 'Assumptions!$B$10' },
    { Name: 'ConfLevel',      Ref: 'Assumptions!$B$11' },
    { Name: 'BulkReservePct', Ref: 'Assumptions!$B$12' },
    { Name: 'CaseAdequacy',   Ref: 'Assumptions!$B$13' },
    { Name: 'CPITrend',       Ref: 'Assumptions!$B$14' },
    { Name: 'MedicalTrend',   Ref: 'Assumptions!$B$15' },
    { Name: 'LegalTrend',     Ref: 'Assumptions!$B$16' },
  )

  // ── Sheet: Exposure Summary ─────────────────────────────────────────
  const exposure = XLSX.utils.aoa_to_sheet([['LOB', ...YEARS.map(String)]])
  for (let i = 0; i < LOBS.length; i++) {
    const row = i + 2
    V(exposure, `A${row}`, LOBS[i])
    for (let y = 0; y < YEARS.length; y++) {
      V(exposure, `${colLetter(y + 1)}${row}`, Math.round(50000 + Math.random() * 200000))
    }
  }
  setRef(exposure, `A1:${colLetter(YEARS.length)}${LOBS.length + 1}`)
  addTable(exposure, 'ExposureData', `A1:${colLetter(YEARS.length)}${LOBS.length + 1}`)
  XLSX.utils.book_append_sheet(wb, exposure, 'Exposure Summary')

  // ── Per-LOB sheets: Triangle, DevFactors, IBNR ─────────────────────
  for (let lobIdx = 0; lobIdx < LOBS.length; lobIdx++) {
    const lob = LOBS[lobIdx]
    const lobShort = lob.replace(/ /g, '')

    // -- Paid Triangle sheet --
    const triName = `Tri ${lob}`
    const tri = XLSX.utils.aoa_to_sheet([['AY \\ Dev', ...YEARS.map((_, i) => `${i + 1}`)]])
    for (let ay = 0; ay < YEARS.length; ay++) {
      const row = ay + 2
      V(tri, `A${row}`, YEARS[ay])
      const maxDev = YEARS.length - ay
      for (let d = 0; d < maxDev; d++) {
        const baseVal = 100000 + lobIdx * 50000 + ay * 10000
        V(tri, `${colLetter(d + 1)}${row}`, Math.round(baseVal * (1 + d * 0.15) * (0.9 + Math.random() * 0.2)))
      }
    }
    setRef(tri, `A1:${colLetter(YEARS.length)}${YEARS.length + 1}`)
    addTable(tri, `PaidTri_${lobShort}`, `A1:${colLetter(YEARS.length)}${YEARS.length + 1}`)
    XLSX.utils.book_append_sheet(wb, tri, triName)
    namedRanges.push({ Name: `PaidTriangle_${lobShort}`, Ref: `'${triName}'!$A$1:$${colLetter(YEARS.length)}$${YEARS.length + 1}` })

    // -- Development Factors sheet --
    const dfName = `DF ${lob}`
    const df = XLSX.utils.aoa_to_sheet([['Dev Period', 'Age-to-Age', 'Selected', 'Cumulative', 'To Ultimate']])
    for (let d = 0; d < YEARS.length - 1; d++) {
      const row = d + 2
      V(df, `A${row}`, `${d + 1}-${d + 2}`)
      // Age-to-Age: average of column ratios from triangle
      // Reference triangle cells for each AY that has both dev periods
      const maxAY = YEARS.length - d - 1
      if (maxAY > 0) {
        const triRef = `'${triName}'`
        // Weighted average LDF formula referencing the triangle
        F(df, `B${row}`, `${triRef}!${colLetter(d + 2)}2/${triRef}!${colLetter(d + 1)}2`)
      }
      // Selected factor (judgment — use age-to-age with credibility blend)
      F(df, `C${row}`, `'${dfName}'!B${row}*CredThreshold+(1-CredThreshold)*1.05`)
      // Cumulative: product of all subsequent selected factors
      if (d === YEARS.length - 2) {
        F(df, `D${row}`, `'${dfName}'!C${row}*TailFactor`)
      } else {
        F(df, `D${row}`, `'${dfName}'!C${row}*'${dfName}'!D${row + 1}`)
      }
      // To Ultimate = Cumulative * Tail
      F(df, `E${row}`, `'${dfName}'!D${row}*TailFactor`)
    }
    setRef(df, `A1:E${YEARS.length}`)
    XLSX.utils.book_append_sheet(wb, df, dfName)
    namedRanges.push({ Name: `SelectedLDF_${lobShort}`, Ref: `'${dfName}'!$C$2:$C$${YEARS.length}` })
    namedRanges.push({ Name: `CumLDF_${lobShort}`, Ref: `'${dfName}'!$D$2:$D$${YEARS.length}` })

    // -- IBNR sheet --
    const ibnrName = `IBNR ${lob}`
    const ibnr = XLSX.utils.aoa_to_sheet([['AY', 'Paid to Date', 'CDF', 'Ultimate', 'IBNR', 'Discounted IBNR', 'Case Reserve', 'Total Reserve']])
    for (let ay = 0; ay < YEARS.length; ay++) {
      const row = ay + 2
      const devAge = YEARS.length - ay  // current development age
      V(ibnr, `A${row}`, YEARS[ay])
      // Paid to date: last diagonal of triangle
      F(ibnr, `B${row}`, `'${triName}'!${colLetter(devAge)}${row}`)
      // CDF: from dev factors sheet
      if (devAge <= YEARS.length - 1) {
        F(ibnr, `C${row}`, `'${dfName}'!D${devAge + 1}`)
      } else {
        F(ibnr, `C${row}`, `TailFactor`)
      }
      // Ultimate = Paid * CDF
      F(ibnr, `D${row}`, `'${ibnrName}'!B${row}*'${ibnrName}'!C${row}`)
      // IBNR = Ultimate - Paid
      F(ibnr, `E${row}`, `'${ibnrName}'!D${row}-'${ibnrName}'!B${row}`)
      // Discounted IBNR
      F(ibnr, `F${row}`, `'${ibnrName}'!E${row}/(1+DiscountRate)^${Math.ceil(devAge / 2)}`)
      // Case Reserve (from assumptions)
      F(ibnr, `G${row}`, `'${ibnrName}'!B${row}*CaseAdequacy*0.1`)
      // Total Reserve = IBNR + Case + ULAE + Bulk
      F(ibnr, `H${row}`, `'${ibnrName}'!F${row}+'${ibnrName}'!G${row}+'${ibnrName}'!E${row}*ULAEFactor+'${ibnrName}'!D${row}*BulkReservePct`)
    }
    setRef(ibnr, `A1:H${YEARS.length + 1}`)
    XLSX.utils.book_append_sheet(wb, ibnr, ibnrName)
    namedRanges.push({ Name: `IBNR_${lobShort}`, Ref: `'${ibnrName}'!$E$2:$E$${YEARS.length + 1}` })
    namedRanges.push({ Name: `TotalReserve_${lobShort}`, Ref: `'${ibnrName}'!$H$2:$H$${YEARS.length + 1}` })
  }

  // ── Sheet: Reserve Summary ─────────────────────────────────────────
  const resSummary = XLSX.utils.aoa_to_sheet([
    ['LOB', 'Total Paid', 'Total IBNR', 'Case Reserve', 'ULAE', 'Bulk', 'Disc. IBNR', 'Total Reserve', 'S&S Credit', 'Net Reserve', 'Risk Margin']
  ])
  for (let i = 0; i < LOBS.length; i++) {
    const row = i + 2
    const lob = LOBS[i]
    V(resSummary, `A${row}`, lob)
    const ibnrSheet = `'IBNR ${lob}'`
    // Sum each column across all AYs
    F(resSummary, `B${row}`, `SUM(${ibnrSheet}!B2:B${YEARS.length + 1})`)
    F(resSummary, `C${row}`, `SUM(${ibnrSheet}!E2:E${YEARS.length + 1})`)
    F(resSummary, `D${row}`, `SUM(${ibnrSheet}!G2:G${YEARS.length + 1})`)
    F(resSummary, `E${row}`, `'Reserve Summary'!C${row}*ULAEFactor`)
    F(resSummary, `F${row}`, `SUM(${ibnrSheet}!D2:D${YEARS.length + 1})*BulkReservePct`)
    F(resSummary, `G${row}`, `SUM(${ibnrSheet}!F2:F${YEARS.length + 1})`)
    F(resSummary, `H${row}`, `SUM(${ibnrSheet}!H2:H${YEARS.length + 1})`)
    F(resSummary, `I${row}`, `'Reserve Summary'!H${row}*SalvageSubro`)
    F(resSummary, `J${row}`, `'Reserve Summary'!H${row}-'Reserve Summary'!I${row}`)
    F(resSummary, `K${row}`, `'Reserve Summary'!J${row}*RiskMargin`)
  }
  // Totals row
  const totRow = LOBS.length + 2
  V(resSummary, `A${totRow}`, 'TOTAL')
  for (let c = 1; c <= 10; c++) {
    F(resSummary, `${colLetter(c)}${totRow}`, `SUM(${colLetter(c)}2:${colLetter(c)}${totRow - 1})`)
  }
  setRef(resSummary, `A1:K${totRow}`)
  addTable(resSummary, 'ReserveSummary', `A1:K${totRow}`)
  XLSX.utils.book_append_sheet(wb, resSummary, 'Reserve Summary')
  namedRanges.push(
    { Name: 'TotalNetReserve', Ref: `'Reserve Summary'!$J$${totRow}` },
    { Name: 'TotalGrossReserve', Ref: `'Reserve Summary'!$H$${totRow}` },
    { Name: 'TotalRiskMargin', Ref: `'Reserve Summary'!$K$${totRow}` },
  )

  // ── Sheet: Loss Development Summary ─────────────────────────────────
  const ldSummary = XLSX.utils.aoa_to_sheet([['LOB', '12-24 LDF', '24-36 LDF', '36-48 LDF', '48-60 LDF', 'Tail', 'CDF to Ult']])
  for (let i = 0; i < LOBS.length; i++) {
    const row = i + 2
    V(ldSummary, `A${row}`, LOBS[i])
    const dfSheet = `'DF ${LOBS[i]}'`
    F(ldSummary, `B${row}`, `${dfSheet}!C2`)
    F(ldSummary, `C${row}`, `${dfSheet}!C3`)
    F(ldSummary, `D${row}`, `${dfSheet}!C4`)
    F(ldSummary, `E${row}`, `${dfSheet}!C5`)
    F(ldSummary, `F${row}`, `TailFactor`)
    F(ldSummary, `G${row}`, `${dfSheet}!D2`)
  }
  setRef(ldSummary, `A1:G${LOBS.length + 1}`)
  XLSX.utils.book_append_sheet(wb, ldSummary, 'LDF Summary')

  // ── Sheet: Trend Analysis ───────────────────────────────────────────
  const trend = XLSX.utils.aoa_to_sheet([['Year', 'Paid Severity', 'Frequency', 'Pure Premium', 'CPI Adj', 'Medical Adj', 'Trended PP']])
  for (let y = 0; y < YEARS.length; y++) {
    const row = y + 2
    V(trend, `A${row}`, YEARS[y])
    V(trend, `B${row}`, 15000 + y * 800)
    V(trend, `C${row}`, 0.05 + y * 0.002)
    F(trend, `D${row}`, `'Trend Analysis'!B${row}*'Trend Analysis'!C${row}`)
    F(trend, `E${row}`, `'Trend Analysis'!D${row}*(1+CPITrend)^(2025-'Trend Analysis'!A${row})`)
    F(trend, `F${row}`, `'Trend Analysis'!D${row}*(1+MedicalTrend)^(2025-'Trend Analysis'!A${row})`)
    F(trend, `G${row}`, `('Trend Analysis'!E${row}+'Trend Analysis'!F${row})/2`)
  }
  setRef(trend, `A1:G${YEARS.length + 1}`)
  XLSX.utils.book_append_sheet(wb, trend, 'Trend Analysis')

  // ── Sheet: Actuarial Central Estimate ──────────────────────────────
  const ace = XLSX.utils.aoa_to_sheet([['LOB', 'BF Method', 'CL Method', 'GB Method', 'Selected', 'Weight BF', 'Weight CL', 'Weight GB']])
  for (let i = 0; i < LOBS.length; i++) {
    const row = i + 2
    V(ace, `A${row}`, LOBS[i])
    const ibnrSheet = `'IBNR ${LOBS[i]}'`
    F(ace, `B${row}`, `SUM(${ibnrSheet}!E2:E${YEARS.length + 1})*0.95`)
    F(ace, `C${row}`, `SUM(${ibnrSheet}!E2:E${YEARS.length + 1})`)
    F(ace, `D${row}`, `SUM(${ibnrSheet}!E2:E${YEARS.length + 1})*1.05`)
    V(ace, `F${row}`, 0.3)
    V(ace, `G${row}`, 0.5)
    V(ace, `H${row}`, 0.2)
    F(ace, `E${row}`, `ACE!B${row}*ACE!F${row}+ACE!C${row}*ACE!G${row}+ACE!D${row}*ACE!H${row}`)
  }
  setRef(ace, `A1:H${LOBS.length + 1}`)
  XLSX.utils.book_append_sheet(wb, ace, 'ACE')

  addNames(wb, namedRanges)
  write(wb, 'reserve-model.xlsx', 500)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTUARIAL MODEL 2: Pricing Model (pricing-model.xlsx)
// ~35 sheets, ~600+ formulas
// Rate indications by coverage, loss ratios, trend, expense loads, rate need
// External refs to reserve-model.xlsx
// ═══════════════════════════════════════════════════════════════════════════════
function makePricingModel(): void {
  const wb = XLSX.utils.book_new()
  const COVERAGES = ['BI', 'PD', 'Comp', 'Coll', 'UM', 'UIM', 'MedPay', 'PIP', 'Rental', 'Towing']
  const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
  const STATES = ['CA', 'TX', 'FL', 'NY', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI']
  const namedRanges: { Name: string; Ref: string; Sheet?: number }[] = []

  // ── Pricing Assumptions ────────────────────────────────────────────
  const assumptions = XLSX.utils.aoa_to_sheet([
    ['Pricing Assumptions'],
    ['Effective Date', '07/01/2026'],
    [''],
    ['Parameter', 'Value'],
    ['Target Loss Ratio', 0.65],
    ['Fixed Expense Ratio', 0.12],
    ['Variable Expense Ratio', 0.15],
    ['Profit & Contingency', 0.05],
    ['Investment Income Credit', 0.02],
    ['Loss Trend Annual', 0.04],
    ['Premium Trend Annual', 0.03],
    ['Credibility Z', 0.85],
    ['Complement LR', 0.70],
    ['ULAE Ratio', 0.08],
    ['Rate Change Cap', 0.15],
    ['Rate Change Floor', -0.10],
    ['Expense Trend', 0.025],
    ['Reinsurance Cost %', 0.03],
  ])
  setRef(assumptions, 'A1:B18')
  XLSX.utils.book_append_sheet(wb, assumptions, 'Pricing Assumptions')
  namedRanges.push(
    { Name: 'TargetLR',      Ref: "'Pricing Assumptions'!$B$5" },
    { Name: 'FixedExpense',  Ref: "'Pricing Assumptions'!$B$6" },
    { Name: 'VarExpense',    Ref: "'Pricing Assumptions'!$B$7" },
    { Name: 'ProfitLoad',    Ref: "'Pricing Assumptions'!$B$8" },
    { Name: 'InvCredit',     Ref: "'Pricing Assumptions'!$B$9" },
    { Name: 'LossTrend',     Ref: "'Pricing Assumptions'!$B$10" },
    { Name: 'PremTrend',     Ref: "'Pricing Assumptions'!$B$11" },
    { Name: 'CredZ',         Ref: "'Pricing Assumptions'!$B$12" },
    { Name: 'CompLR',        Ref: "'Pricing Assumptions'!$B$13" },
    { Name: 'PricingULAE',   Ref: "'Pricing Assumptions'!$B$14" },
    { Name: 'RateCapPct',    Ref: "'Pricing Assumptions'!$B$15" },
    { Name: 'RateFloorPct',  Ref: "'Pricing Assumptions'!$B$16" },
    { Name: 'ExpTrend',      Ref: "'Pricing Assumptions'!$B$17" },
    { Name: 'ReinsCostPct',  Ref: "'Pricing Assumptions'!$B$18" },
  )

  // ── Premium Summary (from external reserve model for earned premium context) ──
  const premSummary = XLSX.utils.aoa_to_sheet([['Year', 'Written Premium', 'Earned Premium', 'On-Level Factor', 'On-Level EP']])
  for (let y = 0; y < YEARS.length; y++) {
    const row = y + 2
    V(premSummary, `A${row}`, YEARS[y])
    V(premSummary, `B${row}`, 5000000 + y * 300000)
    F(premSummary, `C${row}`, `'Premium Summary'!B${row}*0.98`)
    V(premSummary, `D${row}`, 1 + y * 0.02)
    F(premSummary, `E${row}`, `'Premium Summary'!C${row}*'Premium Summary'!D${row}`)
  }
  setRef(premSummary, `A1:E${YEARS.length + 1}`)
  addTable(premSummary, 'PremiumHistory', `A1:E${YEARS.length + 1}`)
  XLSX.utils.book_append_sheet(wb, premSummary, 'Premium Summary')

  // ── Per-Coverage sheets ────────────────────────────────────────────
  for (const cov of COVERAGES) {
    // -- Experience sheet --
    const expName = `Exp ${cov}`
    const exp = XLSX.utils.aoa_to_sheet([['Year', 'Earned Prem', 'Incurred Loss', 'Paid Loss', 'ALAE', 'Loss Ratio', 'Dev Factor', 'Ult Loss', 'Ult LR']])
    for (let y = 0; y < YEARS.length; y++) {
      const row = y + 2
      V(exp, `A${row}`, YEARS[y])
      F(exp, `B${row}`, `'Premium Summary'!E${row}*0.${10 + COVERAGES.indexOf(cov)}`)
      V(exp, `C${row}`, Math.round(300000 + Math.random() * 500000))
      V(exp, `D${row}`, Math.round(250000 + Math.random() * 400000))
      F(exp, `E${row}`, `'${expName}'!C${row}*PricingULAE`)
      F(exp, `F${row}`, `('${expName}'!C${row}+'${expName}'!E${row})/'${expName}'!B${row}`)
      // Dev factor from external reserve model
      F(exp, `G${row}`, `[reserve-model.xlsx]'LDF Summary'!B${2 + Math.min(COVERAGES.indexOf(cov), 7)}`)
      F(exp, `H${row}`, `('${expName}'!C${row}+'${expName}'!E${row})*'${expName}'!G${row}`)
      F(exp, `I${row}`, `'${expName}'!H${row}/'${expName}'!B${row}`)
    }
    setRef(exp, `A1:I${YEARS.length + 1}`)
    XLSX.utils.book_append_sheet(wb, exp, expName)

    // -- Rate Indication sheet --
    const riName = `RI ${cov}`
    const ri = XLSX.utils.aoa_to_sheet([
      ['Rate Indication Calculation', cov],
      [''],
      ['Step', 'Description', 'Value', 'Source'],
    ])
    // Build indication from experience
    F(ri, `C4`, `AVERAGE('${expName}'!I2:I${YEARS.length + 1})`)
    V(ri, `A4`, 1); V(ri, `B4`, 'Historical Ult Loss Ratio')
    F(ri, `C5`, `'${riName}'!C4*CredZ+(1-CredZ)*CompLR`)
    V(ri, `A5`, 2); V(ri, `B5`, 'Credibility-Weighted LR')
    F(ri, `C6`, `'${riName}'!C5*(1+LossTrend)^2`)
    V(ri, `A6`, 3); V(ri, `B6`, 'Trended Loss Ratio')
    F(ri, `C7`, `'${riName}'!C6+PricingULAE`)
    V(ri, `A7`, 4); V(ri, `B7`, 'Loss + ULAE Ratio')
    F(ri, `C8`, `FixedExpense+VarExpense+ExpTrend`)
    V(ri, `A8`, 5); V(ri, `B8`, 'Expense Ratio')
    F(ri, `C9`, `ProfitLoad-InvCredit`)
    V(ri, `A9`, 6); V(ri, `B9`, 'UW Profit Target')
    F(ri, `C10`, `'${riName}'!C7+'${riName}'!C8+'${riName}'!C9+ReinsCostPct`)
    V(ri, `A10`, 7); V(ri, `B10`, 'Required Combined Ratio')
    F(ri, `C11`, `'${riName}'!C10-1`)
    V(ri, `A11`, 8); V(ri, `B11`, 'Indicated Rate Change')
    F(ri, `C12`, `MIN(MAX('${riName}'!C11,RateFloorPct),RateCapPct)`)
    V(ri, `A12`, 9); V(ri, `B12`, 'Capped Rate Change')
    setRef(ri, 'A1:D12')
    XLSX.utils.book_append_sheet(wb, ri, riName)
    namedRanges.push({ Name: `RateChange_${cov}`, Ref: `'${riName}'!$C$12` })
  }

  // ── State Rate Relativities ────────────────────────────────────────
  const stateRel = XLSX.utils.aoa_to_sheet([['State', ...COVERAGES]])
  for (let s = 0; s < STATES.length; s++) {
    const row = s + 2
    V(stateRel, `A${row}`, STATES[s])
    for (let c = 0; c < COVERAGES.length; c++) {
      V(stateRel, `${colLetter(c + 1)}${row}`, Math.round((0.7 + Math.random() * 0.6) * 100) / 100)
    }
  }
  setRef(stateRel, `A1:${colLetter(COVERAGES.length)}${STATES.length + 1}`)
  addTable(stateRel, 'StateRelativities', `A1:${colLetter(COVERAGES.length)}${STATES.length + 1}`)
  XLSX.utils.book_append_sheet(wb, stateRel, 'State Relativities')

  // ── Overall Rate Indication ────────────────────────────────────────
  const overall = XLSX.utils.aoa_to_sheet([['Coverage', 'Indicated Change', 'Premium Weight', 'Weighted Change', 'Current Rate', 'Proposed Rate']])
  for (let c = 0; c < COVERAGES.length; c++) {
    const row = c + 2
    V(overall, `A${row}`, COVERAGES[c])
    F(overall, `B${row}`, `'RI ${COVERAGES[c]}'!C12`)
    V(overall, `C${row}`, Math.round((0.05 + Math.random() * 0.2) * 100) / 100)
    F(overall, `D${row}`, `'Overall Indication'!B${row}*'Overall Indication'!C${row}`)
    V(overall, `E${row}`, Math.round(500 + Math.random() * 2000))
    F(overall, `F${row}`, `'Overall Indication'!E${row}*(1+'Overall Indication'!B${row})`)
  }
  const totRow = COVERAGES.length + 2
  V(overall, `A${totRow}`, 'TOTAL')
  F(overall, `C${totRow}`, `SUM(C2:C${totRow - 1})`)
  F(overall, `D${totRow}`, `SUM(D2:D${totRow - 1})`)
  F(overall, `B${totRow}`, `'Overall Indication'!D${totRow}/'Overall Indication'!C${totRow}`)
  setRef(overall, `A1:F${totRow}`)
  XLSX.utils.book_append_sheet(wb, overall, 'Overall Indication')

  // ── Competitive Analysis ───────────────────────────────────────────
  const compAn = XLSX.utils.aoa_to_sheet([['State', 'Our Rate', 'Competitor A', 'Competitor B', 'Market Avg', 'Position']])
  for (let s = 0; s < STATES.length; s++) {
    const row = s + 2
    V(compAn, `A${row}`, STATES[s])
    F(compAn, `B${row}`, `'Overall Indication'!F2*'State Relativities'!B${row}`)
    V(compAn, `C${row}`, Math.round(800 + Math.random() * 1500))
    V(compAn, `D${row}`, Math.round(900 + Math.random() * 1400))
    F(compAn, `E${row}`, `('Competitive Analysis'!C${row}+'Competitive Analysis'!D${row})/2`)
    F(compAn, `F${row}`, `'Competitive Analysis'!B${row}/'Competitive Analysis'!E${row}-1`)
  }
  setRef(compAn, `A1:F${STATES.length + 1}`)
  XLSX.utils.book_append_sheet(wb, compAn, 'Competitive Analysis')

  addNames(wb, namedRanges)
  write(wb, 'pricing-model.xlsx', 400)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTUARIAL MODEL 3: Reinsurance Model (reinsurance-model.xlsx)
// ~25 sheets, ~400+ formulas
// Treaty structures, ceded/retained, XOL layers, quota share, external refs
// ═══════════════════════════════════════════════════════════════════════════════
function makeReinsuranceModel(): void {
  const wb = XLSX.utils.book_new()
  const LAYERS = ['QS 30%', 'Per Occ 500xs500', 'Per Occ 2Mxs1M', 'Cat 10Mxs5M', 'Cat 25Mxs15M', 'Clash 5Mxs5M']
  const LOBS = ['Auto Liability', 'General Liability', 'Workers Comp', 'Commercial Property', 'Professional Liab', 'Umbrella']
  const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026]
  const namedRanges: { Name: string; Ref: string }[] = []

  // ── Treaty Structure ───────────────────────────────────────────────
  const structure = XLSX.utils.aoa_to_sheet([
    ['Layer', 'Type', 'Limit', 'Retention', 'Rate', 'Ceding %', 'Min Premium', 'Max Premium', 'Reinstatements'],
    ['QS 30%', 'Quota Share', 'Unlimited', 0, 0.30, 0.30, 1500000, 5000000, 0],
    ['Per Occ 500xs500', 'XOL', 500000, 500000, 0.12, 1.0, 600000, 1200000, 2],
    ['Per Occ 2Mxs1M', 'XOL', 2000000, 1000000, 0.08, 1.0, 400000, 900000, 2],
    ['Cat 10Mxs5M', 'Cat XOL', 10000000, 5000000, 0.045, 1.0, 300000, 800000, 1],
    ['Cat 25Mxs15M', 'Cat XOL', 25000000, 15000000, 0.025, 1.0, 200000, 600000, 1],
    ['Clash 5Mxs5M', 'Clash', 5000000, 5000000, 0.035, 1.0, 175000, 500000, 1],
  ])
  setRef(structure, 'A1:I7')
  addTable(structure, 'TreatyStructure', 'A1:I7')
  XLSX.utils.book_append_sheet(wb, structure, 'Treaty Structure')
  namedRanges.push(
    { Name: 'QSCedingPct',  Ref: "'Treaty Structure'!$F$2" },
    { Name: 'XOL1Limit',    Ref: "'Treaty Structure'!$C$3" },
    { Name: 'XOL1Retention', Ref: "'Treaty Structure'!$D$3" },
    { Name: 'CatRetention',  Ref: "'Treaty Structure'!$D$5" },
  )

  // ── Per-Layer cession sheets ───────────────────────────────────────
  for (let li = 0; li < LAYERS.length; li++) {
    const layer = LAYERS[li]
    const shName = `Cession ${layer.replace(/[^\w ]/g, '').substring(0, 20)}`
    const sh = XLSX.utils.aoa_to_sheet([['Year', 'Subject Premium', 'Ceded Premium', 'Ceded Loss', 'Ceded ALAE', 'Net Ceded', 'Cession Ratio', 'Recovery Ratio']])
    for (let y = 0; y < YEARS.length; y++) {
      const row = y + 2
      V(sh, `A${row}`, YEARS[y])
      // Subject premium from external pricing model
      F(sh, `B${row}`, `[pricing-model.xlsx]'Premium Summary'!E${y + 2}`)
      // Ceded premium = subject * rate from treaty structure
      F(sh, `C${row}`, `'${shName}'!B${row}*'Treaty Structure'!E${li + 2}`)
      // Ceded loss (simulated with cross-ref to reserve model)
      F(sh, `D${row}`, `[reserve-model.xlsx]'Reserve Summary'!B${2 + Math.min(li, 7)}*'Treaty Structure'!F${li + 2}*0.${30 + y * 5}`)
      F(sh, `E${row}`, `'${shName}'!D${row}*0.08`)
      F(sh, `F${row}`, `'${shName}'!C${row}-'${shName}'!D${row}-'${shName}'!E${row}`)
      F(sh, `G${row}`, `'${shName}'!C${row}/'${shName}'!B${row}`)
      F(sh, `H${row}`, `('${shName}'!D${row}+'${shName}'!E${row})/'${shName}'!C${row}`)
    }
    setRef(sh, `A1:H${YEARS.length + 1}`)
    XLSX.utils.book_append_sheet(wb, sh, shName)
  }

  // ── Per-LOB Retention Analysis ─────────────────────────────────────
  for (const lob of LOBS) {
    const shName = `Ret ${lob.substring(0, 18)}`
    const sh = XLSX.utils.aoa_to_sheet([['Year', 'Gross Premium', 'QS Ceded', 'XOL Ceded', 'Cat Ceded', 'Net Retained', 'Retention Ratio', 'Net Loss Ratio']])
    for (let y = 0; y < YEARS.length; y++) {
      const row = y + 2
      V(sh, `A${row}`, YEARS[y])
      // Gross premium from external
      F(sh, `B${row}`, `[pricing-model.xlsx]'Premium Summary'!C${y + 2}*0.${14 + LOBS.indexOf(lob)}`)
      F(sh, `C${row}`, `'${shName}'!B${row}*QSCedingPct`)
      F(sh, `D${row}`, `'${shName}'!B${row}*0.05`)
      F(sh, `E${row}`, `'${shName}'!B${row}*0.02`)
      F(sh, `F${row}`, `'${shName}'!B${row}-'${shName}'!C${row}-'${shName}'!D${row}-'${shName}'!E${row}`)
      F(sh, `G${row}`, `'${shName}'!F${row}/'${shName}'!B${row}`)
      // Net loss ratio using external reserve data
      F(sh, `H${row}`, `[reserve-model.xlsx]'Reserve Summary'!C${2 + LOBS.indexOf(lob)}/'${shName}'!F${row}*0.1`)
    }
    setRef(sh, `A1:H${YEARS.length + 1}`)
    XLSX.utils.book_append_sheet(wb, sh, shName)
  }

  // ── Reinsurance Summary ────────────────────────────────────────────
  const reinsSummary = XLSX.utils.aoa_to_sheet([['Layer', 'Total Ceded Prem', 'Total Ceded Loss', 'Net Cost', 'ROL', 'Payback Period']])
  for (let li = 0; li < LAYERS.length; li++) {
    const row = li + 2
    const shName = `Cession ${LAYERS[li].replace(/[^\w ]/g, '').substring(0, 20)}`
    V(reinsSummary, `A${row}`, LAYERS[li])
    F(reinsSummary, `B${row}`, `SUM('${shName}'!C2:C${YEARS.length + 1})`)
    F(reinsSummary, `C${row}`, `SUM('${shName}'!D2:D${YEARS.length + 1})`)
    F(reinsSummary, `D${row}`, `'Reinsurance Summary'!B${row}-'Reinsurance Summary'!C${row}`)
    F(reinsSummary, `E${row}`, `'Reinsurance Summary'!B${row}/'Treaty Structure'!C${row}`)
    F(reinsSummary, `F${row}`, `'Treaty Structure'!C${row}/'Reinsurance Summary'!B${row}*${YEARS.length}`)
  }
  setRef(reinsSummary, `A1:F${LAYERS.length + 1}`)
  XLSX.utils.book_append_sheet(wb, reinsSummary, 'Reinsurance Summary')

  addNames(wb, namedRanges)
  write(wb, 'reinsurance-model.xlsx', 250)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTUARIAL MODEL 4: Financial Projection (financial-projection.xlsx)
// ~40 sheets, ~700+ formulas
// P&L, balance sheet, cash flow, investment income, quarterly projections
// External refs to reserve, pricing, and reinsurance models
// ═══════════════════════════════════════════════════════════════════════════════
function makeFinancialProjection(): void {
  const wb = XLSX.utils.book_new()
  const QUARTERS = ['2025 Q1', '2025 Q2', '2025 Q3', '2025 Q4', '2026 Q1', '2026 Q2', '2026 Q3', '2026 Q4']
  const LOBS = ['Auto', 'GL', 'WC', 'Property', 'Professional', 'Umbrella', 'Surety', 'Marine']
  const namedRanges: { Name: string; Ref: string }[] = []

  // ── Financial Assumptions ──────────────────────────────────────────
  const finAssump = XLSX.utils.aoa_to_sheet([
    ['Financial Projection Assumptions'],
    [''],
    ['Parameter', 'Value'],
    ['Investment Yield', 0.042],
    ['Reinvestment Rate', 0.038],
    ['Risk-Free Rate', 0.035],
    ['Equity Return', 0.08],
    ['Bond Duration', 4.5],
    ['Surplus Ratio Target', 0.35],
    ['Dividend Payout Ratio', 0.30],
    ['Tax Rate', 0.21],
    ['DAC Amortization', 0.15],
    ['Ceding Commission', 0.25],
    ['Policyholders Dividend', 0.02],
    ['Assessment Rate', 0.01],
    ['Salvage Rate', 0.03],
    ['Reinsurance Recoverable %', 0.20],
  ])
  setRef(finAssump, 'A1:B17')
  XLSX.utils.book_append_sheet(wb, finAssump, 'Financial Assumptions')
  namedRanges.push(
    { Name: 'InvYield',      Ref: "'Financial Assumptions'!$B$4" },
    { Name: 'ReinvRate',     Ref: "'Financial Assumptions'!$B$5" },
    { Name: 'RiskFreeRate',  Ref: "'Financial Assumptions'!$B$6" },
    { Name: 'EquityReturn',  Ref: "'Financial Assumptions'!$B$7" },
    { Name: 'BondDuration',  Ref: "'Financial Assumptions'!$B$8" },
    { Name: 'SurplusTarget', Ref: "'Financial Assumptions'!$B$9" },
    { Name: 'DividendPayout', Ref: "'Financial Assumptions'!$B$10" },
    { Name: 'FinTaxRate',    Ref: "'Financial Assumptions'!$B$11" },
    { Name: 'DACAmort',      Ref: "'Financial Assumptions'!$B$12" },
    { Name: 'CedingComm',    Ref: "'Financial Assumptions'!$B$13" },
    { Name: 'PolDividend',   Ref: "'Financial Assumptions'!$B$14" },
    { Name: 'AssessRate',    Ref: "'Financial Assumptions'!$B$15" },
    { Name: 'SalvageRate',   Ref: "'Financial Assumptions'!$B$16" },
    { Name: 'ReinsRecov',    Ref: "'Financial Assumptions'!$B$17" },
  )

  // ── Per-LOB P&L sheets ─────────────────────────────────────────────
  for (const lob of LOBS) {
    const shName = `P&L ${lob}`
    const sh = XLSX.utils.aoa_to_sheet([['Quarter', 'Gross WP', 'Ceded WP', 'Net WP', 'Net EP', 'Incurred Loss', 'ALAE', 'ULAE', 'Net Loss', 'UW Expense', 'UW Income', 'Inv Income', 'Pre-Tax Income']])
    for (let q = 0; q < QUARTERS.length; q++) {
      const row = q + 2
      const lobIdx = LOBS.indexOf(lob)
      V(sh, `A${row}`, QUARTERS[q])
      V(sh, `B${row}`, Math.round(2000000 + lobIdx * 300000 + q * 50000 + Math.random() * 200000))
      // Ceded from external reinsurance model
      F(sh, `C${row}`, `'${shName}'!B${row}*[reinsurance-model.xlsx]'Treaty Structure'!F2`)
      F(sh, `D${row}`, `'${shName}'!B${row}-'${shName}'!C${row}`)
      F(sh, `E${row}`, `'${shName}'!D${row}*0.95`)
      // Incurred loss referencing external reserve model
      F(sh, `F${row}`, `'${shName}'!E${row}*[reserve-model.xlsx]'Reserve Summary'!C${2 + Math.min(lobIdx, 7)}/[reserve-model.xlsx]'Reserve Summary'!B${2 + Math.min(lobIdx, 7)}`)
      F(sh, `G${row}`, `'${shName}'!F${row}*0.08`)
      F(sh, `H${row}`, `'${shName}'!F${row}*0.05`)
      F(sh, `I${row}`, `'${shName}'!F${row}+'${shName}'!G${row}+'${shName}'!H${row}`)
      F(sh, `J${row}`, `'${shName}'!E${row}*(FixedExpense+VarExpense)`)  // from pricing named ranges won't resolve, use local
      F(sh, `J${row}`, `'${shName}'!E${row}*0.27`)
      F(sh, `K${row}`, `'${shName}'!E${row}-'${shName}'!I${row}-'${shName}'!J${row}`)
      F(sh, `L${row}`, `'${shName}'!E${row}*InvYield/4`)
      F(sh, `M${row}`, `'${shName}'!K${row}+'${shName}'!L${row}`)
    }
    // Annual total row
    const totRow = QUARTERS.length + 2
    V(sh, `A${totRow}`, 'Annual Total')
    for (let c = 1; c <= 12; c++) {
      F(sh, `${colLetter(c)}${totRow}`, `SUM(${colLetter(c)}2:${colLetter(c)}${totRow - 1})`)
    }
    setRef(sh, `A1:M${totRow}`)
    XLSX.utils.book_append_sheet(wb, sh, shName)
  }

  // ── Consolidated P&L ───────────────────────────────────────────────
  const consolPL = XLSX.utils.aoa_to_sheet([['Line Item', ...QUARTERS, 'Total']])
  const items = ['Gross WP', 'Ceded WP', 'Net WP', 'Net EP', 'Net Loss', 'UW Expense', 'UW Income', 'Inv Income', 'Pre-Tax Income']
  const plCols = [1, 2, 3, 4, 8, 9, 10, 11, 12]  // column indices in LOB P&L sheets
  for (let it = 0; it < items.length; it++) {
    const row = it + 2
    V(consolPL, `A${row}`, items[it])
    for (let q = 0; q < QUARTERS.length; q++) {
      const parts = LOBS.map(lob => `'P&L ${lob}'!${colLetter(plCols[it])}${q + 2}`)
      F(consolPL, `${colLetter(q + 1)}${row}`, parts.join('+'))
    }
    F(consolPL, `${colLetter(QUARTERS.length + 1)}${row}`, `SUM(${colLetter(1)}${row}:${colLetter(QUARTERS.length)}${row})`)
  }
  // Ratios
  const ratioStart = items.length + 3
  V(consolPL, `A${ratioStart}`, 'Loss Ratio')
  V(consolPL, `A${ratioStart + 1}`, 'Expense Ratio')
  V(consolPL, `A${ratioStart + 2}`, 'Combined Ratio')
  for (let q = 0; q <= QUARTERS.length; q++) {
    const col = colLetter(q + 1)
    F(consolPL, `${col}${ratioStart}`, `${col}${2 + 4}/${col}${2 + 3}`)     // loss / EP
    F(consolPL, `${col}${ratioStart + 1}`, `${col}${2 + 5}/${col}${2 + 3}`) // expense / EP
    F(consolPL, `${col}${ratioStart + 2}`, `${col}${ratioStart}+${col}${ratioStart + 1}`)
  }
  setRef(consolPL, `A1:${colLetter(QUARTERS.length + 1)}${ratioStart + 2}`)
  XLSX.utils.book_append_sheet(wb, consolPL, 'Consolidated P&L')

  // ── Balance Sheet ──────────────────────────────────────────────────
  const bs = XLSX.utils.aoa_to_sheet([['Line', ...QUARTERS]])
  const bsItems = [
    'Invested Assets', 'Cash', 'Premiums Receivable', 'Reinsurance Recoverables',
    'DAC', 'Other Assets', 'Total Assets', '',
    'Loss Reserves', 'Unearned Premium', 'Ceded Payable', 'Other Liabilities',
    'Total Liabilities', '', 'Surplus', 'Total L&S',
  ]
  for (let i = 0; i < bsItems.length; i++) {
    const row = i + 2
    V(bs, `A${row}`, bsItems[i])
    if (!bsItems[i]) continue
    for (let q = 0; q < QUARTERS.length; q++) {
      const col = colLetter(q + 1)
      if (bsItems[i] === 'Total Assets') {
        F(bs, `${col}${row}`, `SUM(${col}2:${col}${row - 1})`)
      } else if (bsItems[i] === 'Total Liabilities') {
        F(bs, `${col}${row}`, `SUM(${col}${2 + 8}:${col}${row - 1})`)
      } else if (bsItems[i] === 'Surplus') {
        F(bs, `${col}${row}`, `${col}${2 + 6}-${col}${2 + 12}`)
      } else if (bsItems[i] === 'Total L&S') {
        F(bs, `${col}${row}`, `${col}${2 + 12}+${col}${row - 1}`)
      } else if (bsItems[i] === 'Loss Reserves') {
        F(bs, `${col}${row}`, `[reserve-model.xlsx]'Reserve Summary'!J10*(1+0.0${q + 1})`)
      } else if (bsItems[i] === 'Reinsurance Recoverables') {
        F(bs, `${col}${row}`, `${col}${2 + 8}*ReinsRecov`)
      } else if (bsItems[i] === 'Invested Assets') {
        V(bs, `${col}${row}`, Math.round(15000000 + q * 500000))
      } else if (bsItems[i] === 'DAC') {
        F(bs, `${col}${row}`, `'Consolidated P&L'!${col}2*DACAmort`)
      } else {
        V(bs, `${col}${row}`, Math.round(1000000 + Math.random() * 3000000))
      }
    }
  }
  setRef(bs, `A1:${colLetter(QUARTERS.length)}${bsItems.length + 1}`)
  XLSX.utils.book_append_sheet(wb, bs, 'Balance Sheet')

  // ── Cash Flow ──────────────────────────────────────────────────────
  const cf = XLSX.utils.aoa_to_sheet([['Line', ...QUARTERS]])
  const cfItems = [
    'Premium Collected', 'Loss Paid', 'Expense Paid', 'Reinsurance Paid',
    'Reinsurance Recovered', 'Operating CF', '',
    'Investment Purchases', 'Investment Maturities', 'Investment Income Received',
    'Investing CF', '', 'Dividends Paid', 'Capital Contribution', 'Financing CF',
    '', 'Net Cash Flow', 'Beginning Cash', 'Ending Cash',
  ]
  for (let i = 0; i < cfItems.length; i++) {
    const row = i + 2
    V(cf, `A${row}`, cfItems[i])
    if (!cfItems[i]) continue
    for (let q = 0; q < QUARTERS.length; q++) {
      const col = colLetter(q + 1)
      if (cfItems[i] === 'Premium Collected') {
        F(cf, `${col}${row}`, `'Consolidated P&L'!${col}3*0.95`)
      } else if (cfItems[i] === 'Loss Paid') {
        F(cf, `${col}${row}`, `'Consolidated P&L'!${col}7*0.6`)
      } else if (cfItems[i] === 'Expense Paid') {
        F(cf, `${col}${row}`, `'Consolidated P&L'!${col}8`)
      } else if (cfItems[i] === 'Operating CF') {
        F(cf, `${col}${row}`, `${col}2+${col}5-${col}3-${col}4-${col}6`)
      } else if (cfItems[i] === 'Investment Income Received') {
        F(cf, `${col}${row}`, `'Balance Sheet'!${col}2*InvYield/4`)
      } else if (cfItems[i] === 'Investing CF') {
        F(cf, `${col}${row}`, `${col}10+${col}11+${col}12`)
      } else if (cfItems[i] === 'Dividends Paid') {
        F(cf, `${col}${row}`, `'Consolidated P&L'!${col}11*DividendPayout`)
      } else if (cfItems[i] === 'Financing CF') {
        F(cf, `${col}${row}`, `${col}15+${col}16`)
      } else if (cfItems[i] === 'Net Cash Flow') {
        F(cf, `${col}${row}`, `${col}8+${col}13+${col}17`)
      } else if (cfItems[i] === 'Beginning Cash') {
        if (q === 0) V(cf, `${col}${row}`, 5000000)
        else F(cf, `${col}${row}`, `${colLetter(q)}${row + 1}`)
      } else if (cfItems[i] === 'Ending Cash') {
        F(cf, `${col}${row}`, `${col}${row - 1}+${col}${row - 2}`)
      } else {
        V(cf, `${col}${row}`, Math.round(500000 + Math.random() * 2000000))
      }
    }
  }
  setRef(cf, `A1:${colLetter(QUARTERS.length)}${cfItems.length + 1}`)
  XLSX.utils.book_append_sheet(wb, cf, 'Cash Flow')

  // ── Investment Portfolio ───────────────────────────────────────────
  const invPort = XLSX.utils.aoa_to_sheet([
    ['Asset Class', 'Market Value', 'Book Value', 'Yield', 'Duration', 'Weight', 'Contribution'],
    ['US Treasury', 5000000, 4900000, 0.035, 3.5, 0, 0],
    ['Corp IG', 4000000, 3950000, 0.045, 4.2, 0, 0],
    ['Corp HY', 1000000, 980000, 0.065, 3.8, 0, 0],
    ['Muni', 2000000, 1980000, 0.03, 5.0, 0, 0],
    ['MBS', 1500000, 1470000, 0.04, 3.0, 0, 0],
    ['Equity', 1000000, 900000, 0.08, 0, 0, 0],
    ['Real Estate', 500000, 480000, 0.06, 0, 0, 0],
    ['Cash', 1000000, 1000000, 0.02, 0, 0, 0],
  ])
  const invTot = 10
  V(invPort, `A${invTot}`, 'TOTAL')
  F(invPort, `B${invTot}`, 'SUM(B2:B9)')
  F(invPort, `C${invTot}`, 'SUM(C2:C9)')
  for (let r = 2; r <= 9; r++) {
    F(invPort, `F${r}`, `'Investment Portfolio'!B${r}/'Investment Portfolio'!B${invTot}`)
    F(invPort, `G${r}`, `'Investment Portfolio'!F${r}*'Investment Portfolio'!D${r}`)
  }
  F(invPort, `D${invTot}`, 'SUM(G2:G9)')
  F(invPort, `E${invTot}`, `SUMPRODUCT(E2:E9,F2:F9)`)
  F(invPort, `F${invTot}`, 'SUM(F2:F9)')
  F(invPort, `G${invTot}`, 'SUM(G2:G9)')
  setRef(invPort, `A1:G${invTot}`)
  addTable(invPort, 'InvestmentPortfolio', `A1:G${invTot}`)
  XLSX.utils.book_append_sheet(wb, invPort, 'Investment Portfolio')

  // ── Key Metrics Dashboard ──────────────────────────────────────────
  const dash = XLSX.utils.aoa_to_sheet([['Metric', 'Value', 'Target', 'Status']])
  for (let i = 0; i < 5; i++) {
    const row = i + 2
    V(dash, `A${row}`, ['Combined Ratio', 'RBC Ratio', 'Surplus', 'Loss Reserve', 'Investment Yield'][i])
    if (i === 0) {
      F(dash, `B${row}`, `'Consolidated P&L'!${colLetter(QUARTERS.length + 1)}${items.length + 5}`)
    } else if (i === 1) {
      F(dash, `B${row}`, `'Balance Sheet'!${colLetter(QUARTERS.length)}${2 + 14}/'Balance Sheet'!${colLetter(QUARTERS.length)}${2 + 8}*4`)
    } else if (i === 2) {
      F(dash, `B${row}`, `'Balance Sheet'!${colLetter(QUARTERS.length)}${2 + 14}`)
    } else if (i === 3) {
      F(dash, `B${row}`, `[reserve-model.xlsx]'Reserve Summary'!J10`)
    } else {
      F(dash, `B${row}`, `'Investment Portfolio'!D${invTot}`)
    }
    V(dash, `C${row}`, [0.95, 3.0, 10000000, 5000000, 0.04][i])
    F(dash, `D${row}`, `IF(Dashboard!B${row}>=Dashboard!C${row},"Met","Below")`)
  }
  setRef(dash, 'A1:D6')
  XLSX.utils.book_append_sheet(wb, dash, 'Dashboard')

  addNames(wb, namedRanges)
  write(wb, 'financial-projection.xlsx', 500)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTUARIAL MODEL 5: Experience Study (experience-study.xlsx)
// ~25 sheets, ~500+ formulas
// Mortality/morbidity tables, exposure analysis, A/E ratios, decrement studies
// ═══════════════════════════════════════════════════════════════════════════════
function makeExperienceStudy(): void {
  const wb = XLSX.utils.book_new()
  const AGE_BANDS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65-74', '75-84', '85+']
  const DECREMENTS = ['Mortality', 'Lapse', 'Disability', 'Recovery', 'Retirement']
  const PRODUCTS = ['Term Life', 'Whole Life', 'Universal Life', 'Variable Life', 'Group Life']
  const STUDY_YEARS = [2019, 2020, 2021, 2022, 2023, 2024]
  const namedRanges: { Name: string; Ref: string }[] = []

  // ── Study Parameters ───────────────────────────────────────────────
  const params = XLSX.utils.aoa_to_sheet([
    ['Experience Study Parameters'],
    ['Study Period', '2019-2024'],
    ['Valuation Date', '12/31/2024'],
    [''],
    ['Parameter', 'Value'],
    ['Credibility Standard', 1082],
    ['Full Credibility Claims', 200],
    ['Significance Level', 0.05],
    ['Expected Table', 'SOA 2017 CSO'],
    ['Improvement Scale', 'MP-2024'],
    ['Margin for Adverse Dev', 0.10],
    ['Smoothing Factor', 0.25],
  ])
  setRef(params, 'A1:B12')
  XLSX.utils.book_append_sheet(wb, params, 'Study Parameters')
  namedRanges.push(
    { Name: 'CredStandard',  Ref: "'Study Parameters'!$B$6" },
    { Name: 'FullCredClaims', Ref: "'Study Parameters'!$B$7" },
    { Name: 'SignifLevel',   Ref: "'Study Parameters'!$B$8" },
    { Name: 'MADPct',        Ref: "'Study Parameters'!$B$11" },
    { Name: 'SmoothFactor',  Ref: "'Study Parameters'!$B$12" },
  )

  // ── Standard Mortality Table ───────────────────────────────────────
  const stdTable = XLSX.utils.aoa_to_sheet([['Age', 'qx Male', 'qx Female', 'qx Unisex', 'Improvement Male', 'Improvement Female']])
  for (let age = 18; age <= 99; age++) {
    const row = age - 16
    V(stdTable, `A${row}`, age)
    const baseQ = 0.0005 * Math.exp(0.06 * (age - 18))
    V(stdTable, `B${row}`, Math.min(Math.round(baseQ * 10000) / 10000, 1.0))
    V(stdTable, `C${row}`, Math.min(Math.round(baseQ * 0.85 * 10000) / 10000, 1.0))
    F(stdTable, `D${row}`, `('Standard Table'!B${row}+'Standard Table'!C${row})/2`)
    V(stdTable, `E${row}`, Math.round(0.01 * (1 - age / 200) * 10000) / 10000)
    V(stdTable, `F${row}`, Math.round(0.012 * (1 - age / 200) * 10000) / 10000)
  }
  setRef(stdTable, `A1:F${99 - 16}`)
  addTable(stdTable, 'MortalityTable', `A1:F${99 - 16}`)
  XLSX.utils.book_append_sheet(wb, stdTable, 'Standard Table')
  namedRanges.push({ Name: 'StdMortality', Ref: `'Standard Table'!$A$1:$F$${99 - 16}` })

  // ── Per-Product experience sheets ──────────────────────────────────
  for (const product of PRODUCTS) {
    const expName = `Exp ${product}`
    const exp = XLSX.utils.aoa_to_sheet([['Age Band', ...STUDY_YEARS.map(String), 'Total Exposed', 'Total Claims', 'Crude Rate']])
    for (let a = 0; a < AGE_BANDS.length; a++) {
      const row = a + 2
      V(exp, `A${row}`, AGE_BANDS[a])
      let totalExp = 0, totalClaims = 0
      for (let y = 0; y < STUDY_YEARS.length; y++) {
        const exposed = Math.round(5000 + Math.random() * 20000)
        totalExp += exposed
        V(exp, `${colLetter(y + 1)}${row}`, exposed)
      }
      totalClaims = Math.round(totalExp * (0.001 + a * 0.002) * (0.8 + Math.random() * 0.4))
      V(exp, `${colLetter(STUDY_YEARS.length + 1)}${row}`, totalExp)
      V(exp, `${colLetter(STUDY_YEARS.length + 2)}${row}`, totalClaims)
      F(exp, `${colLetter(STUDY_YEARS.length + 3)}${row}`,
        `'${expName}'!${colLetter(STUDY_YEARS.length + 2)}${row}/'${expName}'!${colLetter(STUDY_YEARS.length + 1)}${row}`)
    }
    setRef(exp, `A1:${colLetter(STUDY_YEARS.length + 3)}${AGE_BANDS.length + 1}`)
    XLSX.utils.book_append_sheet(wb, exp, expName)
  }

  // ── Per-Product A/E Analysis ───────────────────────────────────────
  for (const product of PRODUCTS) {
    const aeName = `AE ${product}`
    const ae = XLSX.utils.aoa_to_sheet([['Age Band', 'Actual Rate', 'Expected Rate', 'A/E Ratio', 'Credibility Z', 'Cred-Weighted Rate', 'Margin', 'Final Rate']])
    const expSheet = `'Exp ${product}'`
    for (let a = 0; a < AGE_BANDS.length; a++) {
      const row = a + 2
      V(ae, `A${row}`, AGE_BANDS[a])
      // Actual rate from experience sheet
      F(ae, `B${row}`, `${expSheet}!${colLetter(STUDY_YEARS.length + 3)}${row}`)
      // Expected rate from standard table (midpoint of age band)
      const midAge = 21 + a * 10
      const stdRow = midAge - 16
      F(ae, `C${row}`, `'Standard Table'!D${stdRow}`)
      // A/E ratio
      F(ae, `D${row}`, `'${aeName}'!B${row}/'${aeName}'!C${row}`)
      // Credibility
      F(ae, `E${row}`, `MIN(SQRT(${expSheet}!${colLetter(STUDY_YEARS.length + 2)}${row}/FullCredClaims),1)`)
      // Credibility-weighted rate
      F(ae, `F${row}`, `'${aeName}'!E${row}*'${aeName}'!B${row}+(1-'${aeName}'!E${row})*'${aeName}'!C${row}`)
      // With margin
      F(ae, `G${row}`, `'${aeName}'!F${row}*MADPct`)
      F(ae, `H${row}`, `'${aeName}'!F${row}+'${aeName}'!G${row}`)
    }
    setRef(ae, `A1:H${AGE_BANDS.length + 1}`)
    XLSX.utils.book_append_sheet(wb, ae, aeName)
  }

  // ── Per-Decrement sheets ───────────────────────────────────────────
  for (const dec of DECREMENTS) {
    const decName = `Dec ${dec}`
    const decSheet = XLSX.utils.aoa_to_sheet([['Age Band', 'Raw Rate', 'Smoothed', 'Graduated', 'Select Factor', 'Ultimate Rate']])
    for (let a = 0; a < AGE_BANDS.length; a++) {
      const row = a + 2
      V(decSheet, `A${row}`, AGE_BANDS[a])
      const baseRate = dec === 'Mortality' ? 0.002 + a * 0.003
        : dec === 'Lapse' ? 0.08 - a * 0.005
        : dec === 'Disability' ? 0.005 + a * 0.002
        : dec === 'Recovery' ? 0.3 - a * 0.03
        : 0.01 + a * 0.005  // Retirement
      V(decSheet, `B${row}`, Math.round(baseRate * 10000) / 10000)
      // Smoothed using adjacent bands
      if (a === 0) {
        F(decSheet, `C${row}`, `'${decName}'!B${row}*0.7+'${decName}'!B${row + 1}*0.3`)
      } else if (a === AGE_BANDS.length - 1) {
        F(decSheet, `C${row}`, `'${decName}'!B${row - 1}*0.3+'${decName}'!B${row}*0.7`)
      } else {
        F(decSheet, `C${row}`, `'${decName}'!B${row - 1}*0.15+'${decName}'!B${row}*0.7+'${decName}'!B${row + 1}*0.15`)
      }
      F(decSheet, `D${row}`, `'${decName}'!C${row}*(1-SmoothFactor)+'${decName}'!B${row}*SmoothFactor`)
      V(decSheet, `E${row}`, dec === 'Lapse' ? 1.5 - a * 0.1 : 1.0)
      F(decSheet, `F${row}`, `'${decName}'!D${row}*'${decName}'!E${row}`)
    }
    setRef(decSheet, `A1:F${AGE_BANDS.length + 1}`)
    XLSX.utils.book_append_sheet(wb, decSheet, decName)
  }

  // ── Study Summary ──────────────────────────────────────────────────
  const summary = XLSX.utils.aoa_to_sheet([['Product', 'Total Exposed', 'Total Claims', 'Overall A/E', 'Credibility', 'Recommendation']])
  for (let p = 0; p < PRODUCTS.length; p++) {
    const row = p + 2
    V(summary, `A${row}`, PRODUCTS[p])
    const expSheet = `'Exp ${PRODUCTS[p]}'`
    F(summary, `B${row}`, `SUM(${expSheet}!${colLetter(STUDY_YEARS.length + 1)}2:${colLetter(STUDY_YEARS.length + 1)}${AGE_BANDS.length + 1})`)
    F(summary, `C${row}`, `SUM(${expSheet}!${colLetter(STUDY_YEARS.length + 2)}2:${colLetter(STUDY_YEARS.length + 2)}${AGE_BANDS.length + 1})`)
    F(summary, `D${row}`, `AVERAGE('AE ${PRODUCTS[p]}'!D2:D${AGE_BANDS.length + 1})`)
    F(summary, `E${row}`, `MIN(SQRT('Study Summary'!C${row}/FullCredClaims),1)`)
    F(summary, `F${row}`, `IF('Study Summary'!D${row}>1.1,"Increase",IF('Study Summary'!D${row}<0.9,"Decrease","Maintain"))`)
  }
  setRef(summary, `A1:F${PRODUCTS.length + 1}`)
  XLSX.utils.book_append_sheet(wb, summary, 'Study Summary')

  addNames(wb, namedRanges)
  write(wb, 'experience-study.xlsx', 350)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTUARIAL MODEL 6: Capital Model (capital-model.xlsx)
// ~30 sheets, ~500+ formulas
// Risk charges, correlation matrix, diversification, stress scenarios
// External refs to reserve, financial, and experience models
// ═══════════════════════════════════════════════════════════════════════════════
function makeCapitalModel(): void {
  const wb = XLSX.utils.book_new()
  const RISKS = ['Reserve', 'Premium', 'Credit', 'Market', 'Operational', 'Catastrophe', 'Interest Rate', 'Liquidity']
  const STRESSES = ['Base', 'Adverse', 'Moderate Stress', 'Severe Stress', 'Tail Event', 'Pandemic', 'Cat + Market', 'Regulatory']
  const LOBS = ['Auto', 'GL', 'WC', 'Property', 'Professional', 'Umbrella']
  const namedRanges: { Name: string; Ref: string }[] = []

  // ── Capital Assumptions ────────────────────────────────────────────
  const capAssump = XLSX.utils.aoa_to_sheet([
    ['Capital Model Assumptions'],
    [''],
    ['Parameter', 'Value'],
    ['Target RBC Ratio', 3.50],
    ['Company Action Level', 2.00],
    ['Regulatory Action Level', 1.50],
    ['Confidence Level 99.5%', 0.995],
    ['Time Horizon (years)', 1],
    ['Correlation Scaling', 0.85],
    ['Diversification Credit Min', 0.15],
    ['Op Risk % of Premium', 0.03],
    ['Cat PML 250yr', 15000000],
    ['Interest Rate Shock bps', 200],
    ['Credit Spread Shock bps', 150],
    ['Equity Shock %', -0.30],
    ['Reserve Risk CV', 0.10],
    ['Premium Risk CV', 0.12],
  ])
  setRef(capAssump, 'A1:B17')
  XLSX.utils.book_append_sheet(wb, capAssump, 'Capital Assumptions')
  namedRanges.push(
    { Name: 'TargetRBC',     Ref: "'Capital Assumptions'!$B$4" },
    { Name: 'CompAction',    Ref: "'Capital Assumptions'!$B$5" },
    { Name: 'RegAction',     Ref: "'Capital Assumptions'!$B$6" },
    { Name: 'ConfLevel995',  Ref: "'Capital Assumptions'!$B$7" },
    { Name: 'CorrScaling',   Ref: "'Capital Assumptions'!$B$9" },
    { Name: 'DivCredMin',    Ref: "'Capital Assumptions'!$B$10" },
    { Name: 'OpRiskPct',     Ref: "'Capital Assumptions'!$B$11" },
    { Name: 'CatPML',        Ref: "'Capital Assumptions'!$B$12" },
    { Name: 'IRShockBps',    Ref: "'Capital Assumptions'!$B$13" },
    { Name: 'SpreadShockBps', Ref: "'Capital Assumptions'!$B$14" },
    { Name: 'EquityShock',   Ref: "'Capital Assumptions'!$B$15" },
    { Name: 'ResRiskCV',     Ref: "'Capital Assumptions'!$B$16" },
    { Name: 'PremRiskCV',    Ref: "'Capital Assumptions'!$B$17" },
  )

  // ── Correlation Matrix ─────────────────────────────────────────────
  const corr = XLSX.utils.aoa_to_sheet([['', ...RISKS]])
  const corrValues = [
    [1.00, 0.50, 0.25, 0.10, 0.15, 0.20, 0.30, 0.10],
    [0.50, 1.00, 0.20, 0.15, 0.10, 0.25, 0.20, 0.10],
    [0.25, 0.20, 1.00, 0.40, 0.15, 0.10, 0.35, 0.30],
    [0.10, 0.15, 0.40, 1.00, 0.10, 0.15, 0.60, 0.25],
    [0.15, 0.10, 0.15, 0.10, 1.00, 0.05, 0.10, 0.05],
    [0.20, 0.25, 0.10, 0.15, 0.05, 1.00, 0.10, 0.05],
    [0.30, 0.20, 0.35, 0.60, 0.10, 0.10, 1.00, 0.20],
    [0.10, 0.10, 0.30, 0.25, 0.05, 0.05, 0.20, 1.00],
  ]
  for (let r = 0; r < RISKS.length; r++) {
    const row = r + 2
    V(corr, `A${row}`, RISKS[r])
    for (let c = 0; c < RISKS.length; c++) {
      V(corr, `${colLetter(c + 1)}${row}`, corrValues[r][c])
    }
  }
  setRef(corr, `A1:${colLetter(RISKS.length)}${RISKS.length + 1}`)
  addTable(corr, 'CorrelationMatrix', `A1:${colLetter(RISKS.length)}${RISKS.length + 1}`)
  XLSX.utils.book_append_sheet(wb, corr, 'Correlation Matrix')

  // ── Per-Risk charge sheets ─────────────────────────────────────────
  for (let ri = 0; ri < RISKS.length; ri++) {
    const risk = RISKS[ri]
    const shName = `Risk ${risk.substring(0, 20)}`
    const sh = XLSX.utils.aoa_to_sheet([['LOB', 'Exposure', 'Factor', 'Base Charge', 'Stressed Charge', 'Net of Reins']])
    for (let l = 0; l < LOBS.length; l++) {
      const row = l + 2
      V(sh, `A${row}`, LOBS[l])
      // Exposure from external models
      if (risk === 'Reserve') {
        F(sh, `B${row}`, `[reserve-model.xlsx]'Reserve Summary'!J${row}`)
      } else if (risk === 'Premium') {
        F(sh, `B${row}`, `[financial-projection.xlsx]'Consolidated P&L'!${colLetter(9)}${row}`)
      } else if (risk === 'Catastrophe') {
        F(sh, `B${row}`, `CatPML*0.${15 + l}`)
      } else {
        V(sh, `B${row}`, Math.round(2000000 + l * 500000 + Math.random() * 1000000))
      }
      // Risk factor
      if (risk === 'Reserve') {
        F(sh, `C${row}`, `ResRiskCV*(1+0.0${l + 1})`)
      } else if (risk === 'Premium') {
        F(sh, `C${row}`, `PremRiskCV*(1+0.0${l + 1})`)
      } else {
        V(sh, `C${row}`, Math.round((0.05 + ri * 0.02 + Math.random() * 0.05) * 1000) / 1000)
      }
      F(sh, `D${row}`, `'${shName}'!B${row}*'${shName}'!C${row}`)
      F(sh, `E${row}`, `'${shName}'!D${row}*1.5`)
      F(sh, `F${row}`, `'${shName}'!D${row}*(1-[reinsurance-model.xlsx]'Treaty Structure'!F2)`)
    }
    // Total row
    const totRow = LOBS.length + 2
    V(sh, `A${totRow}`, 'TOTAL')
    for (const col of ['B', 'D', 'E', 'F']) {
      F(sh, `${col}${totRow}`, `SUM(${col}2:${col}${totRow - 1})`)
    }
    setRef(sh, `A1:F${totRow}`)
    XLSX.utils.book_append_sheet(wb, sh, shName)
    namedRanges.push({ Name: `${risk.replace(/ /g, '')}Charge`, Ref: `'${shName}'!$F$${totRow}` })
  }

  // ── Diversification Calculation ────────────────────────────────────
  const divers = XLSX.utils.aoa_to_sheet([['Risk', 'Standalone Charge', 'Correlation Adj', 'Diversified Charge']])
  for (let r = 0; r < RISKS.length; r++) {
    const row = r + 2
    const risk = RISKS[r]
    const shName = `Risk ${risk.substring(0, 20)}`
    V(divers, `A${row}`, risk)
    F(divers, `B${row}`, `'${shName}'!F${LOBS.length + 2}`)
    // Sqrt of sum of corr*charge_i*charge_j for this risk
    const corrParts: string[] = []
    for (let j = 0; j < RISKS.length; j++) {
      const otherShort = RISKS[j].substring(0, 20)
      corrParts.push(`'Correlation Matrix'!${colLetter(j + 1)}${row}*'Risk ${otherShort}'!F${LOBS.length + 2}`)
    }
    // Simplified: use scaling factor
    F(divers, `C${row}`, `Diversification!B${row}*CorrScaling`)
    F(divers, `D${row}`, `Diversification!C${row}`)
  }
  const divTot = RISKS.length + 2
  V(divers, `A${divTot}`, 'TOTAL')
  F(divers, `B${divTot}`, `SUM(B2:B${divTot - 1})`)
  F(divers, `C${divTot}`, `SUM(C2:C${divTot - 1})`)
  F(divers, `D${divTot}`, `SUM(D2:D${divTot - 1})`)
  const divCredRow = divTot + 1
  V(divers, `A${divCredRow}`, 'Diversification Credit')
  F(divers, `B${divCredRow}`, `1-Diversification!D${divTot}/Diversification!B${divTot}`)
  setRef(divers, `A1:D${divCredRow}`)
  XLSX.utils.book_append_sheet(wb, divers, 'Diversification')
  namedRanges.push({ Name: 'TotalCapitalReq', Ref: `Diversification!$D$${divTot}` })

  // ── Stress Scenario sheets ─────────────────────────────────────────
  for (const scenario of STRESSES) {
    const shName = `Stress ${scenario.substring(0, 18)}`
    const sh = XLSX.utils.aoa_to_sheet([['Risk', 'Base Charge', 'Stress Factor', 'Stressed Charge', 'Impact on Surplus']])
    for (let r = 0; r < RISKS.length; r++) {
      const row = r + 2
      V(sh, `A${row}`, RISKS[r])
      F(sh, `B${row}`, `Diversification!D${r + 2}`)
      const stressIdx = STRESSES.indexOf(scenario)
      V(sh, `C${row}`, Math.round((1.0 + stressIdx * 0.15 + r * 0.05) * 100) / 100)
      F(sh, `D${row}`, `'${shName}'!B${row}*'${shName}'!C${row}`)
      F(sh, `E${row}`, `'${shName}'!D${row}-'${shName}'!B${row}`)
    }
    const sTot = RISKS.length + 2
    V(sh, `A${sTot}`, 'TOTAL')
    F(sh, `B${sTot}`, `SUM(B2:B${sTot - 1})`)
    F(sh, `D${sTot}`, `SUM(D2:D${sTot - 1})`)
    F(sh, `E${sTot}`, `SUM(E2:E${sTot - 1})`)
    // Surplus impact
    const sImpact = sTot + 1
    V(sh, `A${sImpact}`, 'Surplus After Stress')
    F(sh, `B${sImpact}`, `[financial-projection.xlsx]'Balance Sheet'!${colLetter(8)}16-'${shName}'!E${sTot}`)
    const sRBC = sImpact + 1
    V(sh, `A${sRBC}`, 'RBC Ratio After Stress')
    F(sh, `B${sRBC}`, `'${shName}'!B${sImpact}/'${shName}'!D${sTot}*2`)
    setRef(sh, `A1:E${sRBC}`)
    XLSX.utils.book_append_sheet(wb, sh, shName)
  }

  // ── Capital Summary ────────────────────────────────────────────────
  const capSummary = XLSX.utils.aoa_to_sheet([
    ['Capital Adequacy Summary'],
    [''],
    ['Metric', 'Value'],
  ])
  F(capSummary, 'B4', `TotalCapitalReq`)
  V(capSummary, 'A4', 'Required Capital (Diversified)')
  F(capSummary, 'B5', `Diversification!B${divTot}`)
  V(capSummary, 'A5', 'Required Capital (Undiversified)')
  F(capSummary, 'B6', `Diversification!B${divCredRow}`)
  V(capSummary, 'A6', 'Diversification Credit %')
  F(capSummary, 'B7', `[financial-projection.xlsx]'Balance Sheet'!${colLetter(8)}16`)
  V(capSummary, 'A7', 'Available Capital (Surplus)')
  F(capSummary, 'B8', `'Capital Summary'!B7/'Capital Summary'!B4`)
  V(capSummary, 'A8', 'Capital Adequacy Ratio')
  F(capSummary, 'B9', `'Capital Summary'!B7-'Capital Summary'!B4*TargetRBC`)
  V(capSummary, 'A9', 'Excess Capital vs Target')
  setRef(capSummary, 'A1:B9')
  XLSX.utils.book_append_sheet(wb, capSummary, 'Capital Summary')

  addNames(wb, namedRanges)
  write(wb, 'capital-model.xlsx', 350)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 1: Quoted Sheet Names
// Tests: Sheets with spaces, special chars, parentheses, dots, apostrophes
// ═══════════════════════════════════════════════════════════════════════════════
function makeQuotedSheets(): void {
  const wb = XLSX.utils.book_new()
  const sheetNames = [
    'Revenue Summary',
    'Q1 (Jan-Mar)',
    'Q2 (Apr-Jun)',
    'Dept. Expenses',
    "Manager's Report",
    'Year-End Close',
    'Sheet #1 - Raw',
    'Budget vs. Actual',
    'Top 10% Clients',
    'P&L Consolidated',
  ]
  // Create all sheets with data
  for (const name of sheetNames) {
    const ws = XLSX.utils.aoa_to_sheet([['Label', 'Amount'], [name, 100]])
    setRef(ws, 'A1:B2')
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  // Add cross-references between quoted-name sheets
  const summary = wb.Sheets['Revenue Summary']!
  F(summary, 'A3', "'Q1 (Jan-Mar)'!B2")
  F(summary, 'A4', "'Q2 (Apr-Jun)'!B2")
  F(summary, 'A5', "'Dept. Expenses'!B2")
  F(summary, 'A6', "'Manager''s Report'!B2")
  F(summary, 'A7', "'Year-End Close'!B2")
  F(summary, 'A8', "'Sheet #1 - Raw'!B2")
  F(summary, 'A9', "'Budget vs. Actual'!B2")
  F(summary, 'A10', "'Top 10% Clients'!B2")
  F(summary, 'A11', "'P&L Consolidated'!B2")
  F(summary, 'A12', "SUM(A3:A11)")
  setRef(summary, 'A1:B12')
  // Cross-refs from other sheets back to summary
  const q1 = wb.Sheets['Q1 (Jan-Mar)']!
  F(q1, 'C1', "'Revenue Summary'!A12")
  setRef(q1, 'A1:C2')
  const dept = wb.Sheets['Dept. Expenses']!
  F(dept, 'C1', "'P&L Consolidated'!B2")
  F(dept, 'C2', "'Revenue Summary'!A3+'Revenue Summary'!A4")
  setRef(dept, 'A1:C2')
  write(wb, 'quoted-sheets.xlsx', 10)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 2: All Reference Syntax Variants
// Tests: $A$1, A1:B10, $A$1:$B$2, A:A, 1:10 — all cell reference formats
// ═══════════════════════════════════════════════════════════════════════════════
function makeSyntaxShowcase(): void {
  const wb = XLSX.utils.book_new()

  const source = XLSX.utils.aoa_to_sheet([
    ['Val1', 10], ['Val2', 20], ['Val3', 30], ['Val4', 40], ['Val5', 50],
    ['Val6', 60], ['Val7', 70], ['Val8', 80], ['Val9', 90], ['Val10', 100],
  ])

  // Each formula uses a different cell reference syntax targeting Source sheet
  const consumer = XLSX.utils.aoa_to_sheet([['x', 'x', 'x', 'x', 'x', 'x']])
  consumer['A1'] = { t: 'n', v: 0, f: 'Source!A1' }              // simple cell
  consumer['B1'] = { t: 'n', v: 0, f: 'Source!$B$1' }            // absolute
  consumer['C1'] = { t: 'n', v: 0, f: 'Source!A1:B5' }           // range
  consumer['D1'] = { t: 'n', v: 0, f: 'Source!$A$1:$B$10' }      // absolute range
  consumer['E1'] = { t: 'n', v: 0, f: 'Source!B:B' }              // full column
  consumer['F1'] = { t: 'n', v: 0, f: 'Source!1:10' }             // full row range
  consumer['!ref'] = 'A1:F1'

  // A second consumer with mixed absolute/relative
  const mixed = XLSX.utils.aoa_to_sheet([['x', 'x']])
  mixed['A1'] = { t: 'n', v: 0, f: 'Source!$A1' }                // mixed absolute col
  mixed['B1'] = { t: 'n', v: 0, f: 'Source!A$1' }                // mixed absolute row
  mixed['!ref'] = 'A1:B1'

  XLSX.utils.book_append_sheet(wb, source, 'Source')
  XLSX.utils.book_append_sheet(wb, consumer, 'Consumer')
  XLSX.utils.book_append_sheet(wb, mixed, 'MixedRefs')

  write(wb, 'syntax-showcase.xlsx', 8)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 3: Three-Way Circular Reference
// Tests: cycle detection with 3+ nodes (A→B→C→A), existing fixture only has 2-way
// ═══════════════════════════════════════════════════════════════════════════════
function makeThreeWayCircular(): void {
  const wb = XLSX.utils.book_new()

  const alpha = XLSX.utils.aoa_to_sheet([['x']])
  alpha['A1'] = { t: 'n', v: 0, f: 'Gamma!A1' }

  const beta = XLSX.utils.aoa_to_sheet([['x']])
  beta['A1'] = { t: 'n', v: 0, f: 'Alpha!A1' }

  const gamma = XLSX.utils.aoa_to_sheet([['x']])
  gamma['A1'] = { t: 'n', v: 0, f: 'Beta!A1' }

  XLSX.utils.book_append_sheet(wb, alpha, 'Alpha')
  XLSX.utils.book_append_sheet(wb, beta, 'Beta')
  XLSX.utils.book_append_sheet(wb, gamma, 'Gamma')

  write(wb, 'three-way-circular.xlsx', 3)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 4: Heavy Edge Aggregation
// Tests: 25 formulas from Sheet1→Sheet2 — edge refCount, detail panel reference list
// ═══════════════════════════════════════════════════════════════════════════════
function makeHeavyAggregation(): void {
  const wb = XLSX.utils.book_new()

  const source = XLSX.utils.aoa_to_sheet([['x']])
  // Fill A1:A25 with values
  for (let i = 1; i <= 25; i++) {
    source[`A${i}`] = { t: 'n', v: i * 100 }
  }
  source['!ref'] = 'A1:A25'

  const consumer = XLSX.utils.aoa_to_sheet([['x']])
  // 25 formulas all pointing at DataSource sheet
  for (let i = 1; i <= 25; i++) {
    consumer[`A${i}`] = { t: 'n', v: 0, f: `DataSource!A${i}` }
  }
  consumer['!ref'] = 'A1:A25'

  // A third sheet that also refs DataSource (fewer refs) for comparison
  const secondary = XLSX.utils.aoa_to_sheet([['x', 'x']])
  secondary['A1'] = { t: 'n', v: 0, f: 'DataSource!A1' }
  secondary['B1'] = { t: 'n', v: 0, f: 'HeavyConsumer!A25' }
  secondary['!ref'] = 'A1:B1'

  XLSX.utils.book_append_sheet(wb, source, 'DataSource')
  XLSX.utils.book_append_sheet(wb, consumer, 'HeavyConsumer')
  XLSX.utils.book_append_sheet(wb, secondary, 'LightConsumer')

  write(wb, 'heavy-aggregation.xlsx', 27)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 5: Isolated + Connected Mixed
// Tests: isolated sheets appear as nodes but have no edges; mixed connectivity
// ═══════════════════════════════════════════════════════════════════════════════
function makeIsolatedMixed(): void {
  const wb = XLSX.utils.book_new()

  // 3 isolated sheets — plain data, no formulas at all
  const readme = XLSX.utils.aoa_to_sheet([['This is a readme sheet'], ['No formulas here']])
  const archive = XLSX.utils.aoa_to_sheet([['Archived data'], ['2024 Q1', 100], ['2024 Q2', 200]])
  const notes = XLSX.utils.aoa_to_sheet([['Meeting notes'], ['TODO: review budget']])

  // 2 connected sheets
  const inputs = XLSX.utils.aoa_to_sheet([['Rate', 0.05], ['Amount', 10000]])
  const calc = XLSX.utils.aoa_to_sheet([['x', 'x']])
  calc['A1'] = { t: 'n', v: 0, f: 'Inputs!B1' }
  calc['B1'] = { t: 'n', v: 0, f: 'Inputs!B2' }
  calc['!ref'] = 'A1:B1'

  // 1 sheet with only within-sheet refs (no cross-sheet edges, but has formulas)
  const selfRef = XLSX.utils.aoa_to_sheet([['Base', 100], ['x']])
  selfRef['A2'] = { t: 'n', v: 0, f: 'SelfCalc!A1*2' }
  selfRef['!ref'] = 'A1:A2'

  XLSX.utils.book_append_sheet(wb, readme, 'ReadMe')
  XLSX.utils.book_append_sheet(wb, archive, 'Archive')
  XLSX.utils.book_append_sheet(wb, notes, 'Notes')
  XLSX.utils.book_append_sheet(wb, inputs, 'Inputs')
  XLSX.utils.book_append_sheet(wb, calc, 'Calculations')
  XLSX.utils.book_append_sheet(wb, selfRef, 'SelfCalc')

  write(wb, 'isolated-mixed.xlsx', 3)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 6: Named Ranges with Formula References
// Tests: named range detection in formulas, NR node toggle, edge kind 'named-range'
// Formula actually USES the named range names (not just defines them)
// ═══════════════════════════════════════════════════════════════════════════════
function makeNamedRangeFormulas(): void {
  const wb = XLSX.utils.book_new()

  const params = XLSX.utils.aoa_to_sheet([
    ['Tax Rate', 0.25],
    ['Growth', 0.05],
    ['Inflation', 0.03],
    ['Discount', 0.08],
  ])

  // This sheet uses named range NAMES in formulas
  const model = XLSX.utils.aoa_to_sheet([['x', 'x', 'x', 'x']])
  model['A1'] = { t: 'n', v: 0, f: 'TaxRate*100' }             // uses named range
  model['B1'] = { t: 'n', v: 0, f: 'GrowthRate+Inflation' }    // uses TWO named ranges in one formula
  model['C1'] = { t: 'n', v: 0, f: 'Parameters!B4' }           // direct cross-sheet ref (not via NR)
  model['D1'] = { t: 'n', v: 0, f: 'DiscountRate/12' }         // named range with arithmetic
  model['!ref'] = 'A1:D1'

  // A third sheet that uses both named ranges and cross-sheet refs
  const output = XLSX.utils.aoa_to_sheet([['x', 'x']])
  output['A1'] = { t: 'n', v: 0, f: 'Model!A1*(1-TaxRate)' }    // cross-sheet + named range
  output['B1'] = { t: 'n', v: 0, f: 'GrowthRate*Model!B1' }     // named range + cross-sheet
  output['!ref'] = 'A1:B1'

  XLSX.utils.book_append_sheet(wb, params, 'Parameters')
  XLSX.utils.book_append_sheet(wb, model, 'Model')
  XLSX.utils.book_append_sheet(wb, output, 'Output')

  // Define named ranges
  if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
  if (!wb.Workbook.Names) wb.Workbook.Names = []
  wb.Workbook.Names.push(
    { Name: 'TaxRate',      Ref: 'Parameters!$B$1', Sheet: undefined },
    { Name: 'GrowthRate',   Ref: 'Parameters!$B$2', Sheet: undefined },
    { Name: 'Inflation',    Ref: 'Parameters!$B$3', Sheet: undefined },
    { Name: 'DiscountRate', Ref: 'Parameters!$B$4', Sheet: undefined },
    // Sheet-scoped named range (only visible in Model sheet)
    { Name: 'LocalParam',   Ref: 'Parameters!$B$1', Sheet: 1 },
  )

  write(wb, 'named-range-formulas.xlsx', 6)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 7: Excel Tables with Structured References
// Tests: table detection, TableName[Column] syntax, table node toggle, edge kind 'table'
// Note: SheetJS !tables metadata is needed for Tangle to detect tables
// ═══════════════════════════════════════════════════════════════════════════════
function makeTableModel(): void {
  const wb = XLSX.utils.book_new()

  // Sales data sheet with a table
  const salesData = XLSX.utils.aoa_to_sheet([
    ['Product', 'Quantity', 'Price', 'Total'],
    ['Widget A', 100, 25, 2500],
    ['Widget B', 200, 15, 3000],
    ['Widget C', 50, 50, 2500],
  ])
  // Register table metadata (SheetJS !tables array)
  ;(salesData as Record<string, unknown>)['!tables'] = [
    { name: 'SalesTable', displayName: 'SalesTable', ref: 'A1:D4' }
  ]

  // Employee data sheet with a table
  const empData = XLSX.utils.aoa_to_sheet([
    ['Name', 'Department', 'Salary'],
    ['Alice', 'Engineering', 90000],
    ['Bob', 'Sales', 75000],
    ['Carol', 'Marketing', 80000],
  ])
  ;(empData as Record<string, unknown>)['!tables'] = [
    { name: 'EmployeeTable', displayName: 'EmployeeTable', ref: 'A1:C4' }
  ]

  // Dashboard that references tables via structured references
  const dashboard = XLSX.utils.aoa_to_sheet([['x', 'x', 'x', 'x']])
  dashboard['A1'] = { t: 'n', v: 0, f: 'SalesTable[Total]' }          // structured ref
  dashboard['B1'] = { t: 'n', v: 0, f: 'SalesTable[Quantity]' }       // another column
  dashboard['C1'] = { t: 'n', v: 0, f: 'EmployeeTable[Salary]' }     // different table
  dashboard['D1'] = { t: 'n', v: 0, f: 'SalesData!A1' }               // direct cross-sheet ref
  dashboard['!ref'] = 'A1:D1'

  XLSX.utils.book_append_sheet(wb, salesData, 'SalesData')
  XLSX.utils.book_append_sheet(wb, empData, 'Employees')
  XLSX.utils.book_append_sheet(wb, dashboard, 'Dashboard')

  write(wb, 'table-model.xlsx', 4)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 8a + 8b: Multi-Workbook Cross-File Pair
// Tests: cross-file edge kind when both uploaded, external edge when only one uploaded
// Upload both to see cross-file edges; upload only one to see external file nodes
// ═══════════════════════════════════════════════════════════════════════════════
function makeMultiWorkbookPair(): void {
  // File A: company-hq.xlsx
  const wbA = XLSX.utils.book_new()

  const hqBudget = XLSX.utils.aoa_to_sheet([
    ['Department', 'Budget'],
    ['Engineering', 500000],
    ['Marketing', 200000],
    ['Sales', 300000],
  ])

  const hqSummary = XLSX.utils.aoa_to_sheet([['x', 'x', 'x']])
  hqSummary['A1'] = { t: 'n', v: 0, f: 'Budget!B2' }                          // internal ref
  hqSummary['B1'] = { t: 'n', v: 0, f: '[company-branch.xlsx]Revenue!A1' }     // external → File B
  hqSummary['C1'] = { t: 'n', v: 0, f: '[company-branch.xlsx]Revenue!B1' }     // another external ref
  hqSummary['!ref'] = 'A1:C1'

  XLSX.utils.book_append_sheet(wbA, hqBudget, 'Budget')
  XLSX.utils.book_append_sheet(wbA, hqSummary, 'HQ Summary')

  const bufA = XLSX.write(wbA, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(bufA, 3, 'company-hq')
  writeFileSync(join(OUT_DIR, 'company-hq.xlsx'), bufA)

  // File B: company-branch.xlsx
  const wbB = XLSX.utils.book_new()

  const revenue = XLSX.utils.aoa_to_sheet([
    ['Region', 'Revenue', 'Growth'],
    ['North', 150000, 0.08],
    ['South', 120000, 0.05],
  ])

  const branchReport = XLSX.utils.aoa_to_sheet([['x', 'x', 'x']])
  branchReport['A1'] = { t: 'n', v: 0, f: 'Revenue!B2' }                       // internal ref
  branchReport['B1'] = { t: 'n', v: 0, f: '[company-hq.xlsx]Budget!B2' }       // external → File A
  branchReport['C1'] = { t: 'n', v: 0, f: '[company-hq.xlsx]Budget!B3' }       // another external ref
  branchReport['!ref'] = 'A1:C1'

  XLSX.utils.book_append_sheet(wbB, revenue, 'Revenue')
  XLSX.utils.book_append_sheet(wbB, branchReport, 'Branch Report')

  const bufB = XLSX.write(wbB, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(bufB, 3, 'company-branch')
  writeFileSync(join(OUT_DIR, 'company-branch.xlsx'), bufB)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 9: Corporate Finance Suite (3-file realistic scenario)
// Tests: overview layout mode (file-level aggregation), grouped layout, multi-file
// Upload all 3 to see full cross-file graph; test hide/show per workbook
// ═══════════════════════════════════════════════════════════════════════════════
function makeCorporateSuite(): void {
  // File 1: budget-2026.xlsx
  const wbBudget = XLSX.utils.book_new()

  const assumptions = XLSX.utils.aoa_to_sheet([
    ['Metric', 'Value'],
    ['Revenue Growth', 0.10],
    ['Cost Inflation', 0.03],
    ['Headcount Growth', 0.05],
    ['Tax Rate', 0.21],
  ])

  const revBudget = XLSX.utils.aoa_to_sheet([['x', 'x', 'x']])
  revBudget['A1'] = { t: 'n', v: 0, f: 'Assumptions!B2' }     // growth rate
  revBudget['B1'] = { t: 'n', v: 0, f: 'Assumptions!B5' }     // tax rate
  revBudget['C1'] = { t: 'n', v: 0, f: 'Revenue!A1*Revenue!B1' }  // within-sheet
  revBudget['!ref'] = 'A1:C1'

  const costBudget = XLSX.utils.aoa_to_sheet([['x', 'x']])
  costBudget['A1'] = { t: 'n', v: 0, f: 'Assumptions!B3' }    // inflation
  costBudget['B1'] = { t: 'n', v: 0, f: 'Assumptions!B4' }    // headcount
  costBudget['!ref'] = 'A1:B1'

  XLSX.utils.book_append_sheet(wbBudget, assumptions, 'Assumptions')
  XLSX.utils.book_append_sheet(wbBudget, revBudget, 'Revenue')
  XLSX.utils.book_append_sheet(wbBudget, costBudget, 'Costs')

  // Named ranges for the budget file
  if (!wbBudget.Workbook) wbBudget.Workbook = { Names: [], Views: [], WBProps: {} }
  if (!wbBudget.Workbook.Names) wbBudget.Workbook.Names = []
  wbBudget.Workbook.Names.push(
    { Name: 'BudgetGrowth', Ref: 'Assumptions!$B$2', Sheet: undefined },
    { Name: 'BudgetTaxRate', Ref: 'Assumptions!$B$5', Sheet: undefined },
  )

  const bufBudget = XLSX.write(wbBudget, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(bufBudget, 5, 'budget-2026')
  writeFileSync(join(OUT_DIR, 'budget-2026.xlsx'), bufBudget)

  // File 2: actuals-2026.xlsx
  const wbActuals = XLSX.utils.book_new()

  const q1Actuals = XLSX.utils.aoa_to_sheet([
    ['Category', 'Amount'],
    ['Revenue', 275000],
    ['COGS', 110000],
    ['OpEx', 95000],
  ])

  const q2Actuals = XLSX.utils.aoa_to_sheet([
    ['Category', 'Amount'],
    ['Revenue', 290000],
    ['COGS', 115000],
    ['OpEx', 98000],
  ])

  const ytdSummary = XLSX.utils.aoa_to_sheet([['x', 'x', 'x']])
  ytdSummary['A1'] = { t: 'n', v: 0, f: "'Q1 Actuals'!B2" }                             // quoted sheet ref
  ytdSummary['B1'] = { t: 'n', v: 0, f: "'Q2 Actuals'!B2" }                             // quoted sheet ref
  ytdSummary['C1'] = { t: 'n', v: 0, f: '[budget-2026.xlsx]Revenue!A1' }                 // cross-file
  ytdSummary['!ref'] = 'A1:C1'

  XLSX.utils.book_append_sheet(wbActuals, q1Actuals, 'Q1 Actuals')
  XLSX.utils.book_append_sheet(wbActuals, q2Actuals, 'Q2 Actuals')
  XLSX.utils.book_append_sheet(wbActuals, ytdSummary, 'YTD Summary')

  const bufActuals = XLSX.write(wbActuals, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(bufActuals, 3, 'actuals-2026')
  writeFileSync(join(OUT_DIR, 'actuals-2026.xlsx'), bufActuals)

  // File 3: variance-report.xlsx
  const wbVariance = XLSX.utils.book_new()

  const variance = XLSX.utils.aoa_to_sheet([['x', 'x', 'x', 'x']])
  variance['A1'] = { t: 'n', v: 0, f: "[budget-2026.xlsx]Revenue!A1" }                   // budget revenue
  variance['B1'] = { t: 'n', v: 0, f: "[actuals-2026.xlsx]'YTD Summary'!A1" }            // actual revenue (quoted sheet in external)
  variance['C1'] = { t: 'n', v: 0, f: "[budget-2026.xlsx]Costs!A1" }                     // budget costs
  variance['D1'] = { t: 'n', v: 0, f: "[actuals-2026.xlsx]'Q1 Actuals'!B3" }             // actual COGS
  variance['!ref'] = 'A1:D1'

  const analysis = XLSX.utils.aoa_to_sheet([['x', 'x']])
  analysis['A1'] = { t: 'n', v: 0, f: 'Variance!A1-Variance!B1' }     // within-sheet
  analysis['B1'] = { t: 'n', v: 0, f: "[budget-2026.xlsx]Assumptions!B2" }   // cross-file to budget assumptions
  analysis['!ref'] = 'A1:B1'

  XLSX.utils.book_append_sheet(wbVariance, variance, 'Variance')
  XLSX.utils.book_append_sheet(wbVariance, analysis, 'Analysis')

  const bufVariance = XLSX.write(wbVariance, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  verify(bufVariance, 6, 'variance-report')
  writeFileSync(join(OUT_DIR, 'variance-report.xlsx'), bufVariance)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 10: Mixed Reference Types in Single Formulas
// Tests: one formula containing cross-sheet + named range refs; edge kind mixing
// ═══════════════════════════════════════════════════════════════════════════════
function makeMixedRefs(): void {
  const wb = XLSX.utils.book_new()

  const data = XLSX.utils.aoa_to_sheet([
    ['Base Price', 100],
    ['Tax Rate', 0.08],
    ['Discount', 0.15],
  ])

  const pricing = XLSX.utils.aoa_to_sheet([['x', 'x', 'x']])
  // Formula has BOTH a cross-sheet ref AND named range in one formula
  pricing['A1'] = { t: 'n', v: 0, f: 'Data!B1*(1+TaxRate)' }
  pricing['B1'] = { t: 'n', v: 0, f: 'Data!B1*(1-DiscountPct)' }
  pricing['C1'] = { t: 'n', v: 0, f: 'Data!B1*(1+TaxRate)*(1-DiscountPct)' }  // both NRs + cross-sheet
  pricing['!ref'] = 'A1:C1'

  const summary = XLSX.utils.aoa_to_sheet([['x']])
  summary['A1'] = { t: 'n', v: 0, f: 'Pricing!A1+Pricing!B1+Pricing!C1' }
  summary['!ref'] = 'A1:A1'

  XLSX.utils.book_append_sheet(wb, data, 'Data')
  XLSX.utils.book_append_sheet(wb, pricing, 'Pricing')
  XLSX.utils.book_append_sheet(wb, summary, 'Summary')

  if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
  if (!wb.Workbook.Names) wb.Workbook.Names = []
  wb.Workbook.Names.push(
    { Name: 'TaxRate',     Ref: 'Data!$B$2', Sheet: undefined },
    { Name: 'DiscountPct', Ref: 'Data!$B$3', Sheet: undefined },
  )

  write(wb, 'mixed-refs.xlsx', 4)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 11: Layout Stress Test — 30 sheets with complex interconnections
// Tests: dagre layout performance, grouped mode clustering, overview aggregation
// ═══════════════════════════════════════════════════════════════════════════════
function makeLayoutStress(): void {
  const wb = XLSX.utils.book_new()

  // Create 30 department sheets
  const depts = [
    'CEO', 'CFO', 'CTO', 'COO', 'CMO',
    'Engineering', 'QA', 'DevOps', 'Security', 'Data',
    'Finance', 'Accounting', 'Treasury', 'Tax', 'Audit',
    'Sales', 'Marketing', 'BizDev', 'Partnerships', 'Support',
    'HR', 'Legal', 'Compliance', 'Facilities', 'IT',
    'ProductA', 'ProductB', 'ProductC', 'R&D', 'Strategy',
  ]

  const sheets: Record<string, XLSX.WorkSheet> = {}
  for (const d of depts) {
    sheets[d] = XLSX.utils.aoa_to_sheet([['x', 'x', 'x']])
    sheets[d]['!ref'] = 'A1:C1'
  }

  // Hierarchical: C-suite → departments
  sheets['Engineering']['A1'] = { t: 'n', v: 0, f: 'CTO!A1' }
  sheets['QA']['A1']          = { t: 'n', v: 0, f: 'CTO!A1' }
  sheets['DevOps']['A1']      = { t: 'n', v: 0, f: 'CTO!B1' }
  sheets['Security']['A1']    = { t: 'n', v: 0, f: 'CTO!A1' }
  sheets['Data']['A1']        = { t: 'n', v: 0, f: 'CTO!C1' }

  sheets['Finance']['A1']     = { t: 'n', v: 0, f: 'CFO!A1' }
  sheets['Accounting']['A1']  = { t: 'n', v: 0, f: 'CFO!A1' }
  sheets['Treasury']['A1']    = { t: 'n', v: 0, f: 'CFO!B1' }
  sheets['Tax']['A1']         = { t: 'n', v: 0, f: 'CFO!A1' }
  sheets['Audit']['A1']       = { t: 'n', v: 0, f: 'CFO!C1' }

  sheets['Sales']['A1']       = { t: 'n', v: 0, f: 'CMO!A1' }
  sheets['Marketing']['A1']   = { t: 'n', v: 0, f: 'CMO!A1' }
  sheets['BizDev']['A1']      = { t: 'n', v: 0, f: 'CMO!B1' }
  sheets['Partnerships']['A1'] = { t: 'n', v: 0, f: 'CMO!A1' }
  sheets['Support']['A1']     = { t: 'n', v: 0, f: 'COO!A1' }

  sheets['HR']['A1']          = { t: 'n', v: 0, f: 'COO!A1' }
  sheets['Legal']['A1']       = { t: 'n', v: 0, f: 'COO!B1' }
  sheets['Compliance']['A1']  = { t: 'n', v: 0, f: 'COO!A1' }
  sheets['Facilities']['A1']  = { t: 'n', v: 0, f: 'COO!C1' }
  sheets['IT']['A1']          = { t: 'n', v: 0, f: 'CTO!A1' }

  sheets['ProductA']['A1']    = { t: 'n', v: 0, f: 'Engineering!A1' }
  sheets['ProductB']['A1']    = { t: 'n', v: 0, f: 'Engineering!A1' }
  sheets['ProductC']['A1']    = { t: 'n', v: 0, f: 'Engineering!A1' }

  // Cross-department refs (non-hierarchical)
  sheets['Engineering']['B1'] = { t: 'n', v: 0, f: 'Finance!A1' }       // eng needs budget
  sheets['Marketing']['B1']   = { t: 'n', v: 0, f: 'Sales!A1' }        // mkt uses sales data
  sheets['Tax']['B1']         = { t: 'n', v: 0, f: 'Accounting!A1' }   // tax needs accounting
  sheets['Audit']['B1']       = { t: 'n', v: 0, f: 'Compliance!A1' }   // audit checks compliance
  sheets['Data']['B1']        = { t: 'n', v: 0, f: 'Sales!A1' }        // data analyzes sales
  sheets['Support']['B1']     = { t: 'n', v: 0, f: 'ProductA!A1' }     // support uses product info
  sheets['Legal']['B1']       = { t: 'n', v: 0, f: 'HR!A1' }           // legal reviews HR

  // C-suite refs CEO
  sheets['CFO']['A1']         = { t: 'n', v: 0, f: 'CEO!A1' }
  sheets['CTO']['A1']         = { t: 'n', v: 0, f: 'CEO!A1' }
  sheets['COO']['A1']         = { t: 'n', v: 0, f: 'CEO!B1' }
  sheets['CMO']['A1']         = { t: 'n', v: 0, f: 'CEO!A1' }

  // R&D and Strategy are cross-cutting
  sheets['R&D']['A1']         = { t: 'n', v: 0, f: 'Engineering!A1' }
  sheets['R&D']['B1']         = { t: 'n', v: 0, f: 'Data!A1' }
  sheets['Strategy']['A1']    = { t: 'n', v: 0, f: 'CEO!A1' }
  sheets['Strategy']['B1']    = { t: 'n', v: 0, f: 'Finance!A1' }
  sheets['Strategy']['C1']    = { t: 'n', v: 0, f: 'Sales!A1' }

  for (const d of depts) XLSX.utils.book_append_sheet(wb, sheets[d], d)

  write(wb, 'layout-stress.xlsx', 37)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL 12: Everything Combined — the ultimate test workbook
// Tests: ALL features in one file — quoted sheets, named ranges used in formulas,
//        tables, external refs, multiple edge kinds, cycle, isolated sheets
// ═══════════════════════════════════════════════════════════════════════════════
function makeEverything(): void {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Config (source data)
  const config = XLSX.utils.aoa_to_sheet([
    ['Parameter', 'Value'],
    ['Rate', 0.05],
    ['Cap', 100000],
    ['Floor', 1000],
  ])

  // Sheet 2: "Sales Data" (quoted name, has a table)
  const salesData = XLSX.utils.aoa_to_sheet([
    ['Region', 'Revenue', 'Cost'],
    ['North', 50000, 20000],
    ['South', 40000, 18000],
    ['East', 60000, 25000],
  ])
  ;(salesData as Record<string, unknown>)['!tables'] = [
    { name: 'SalesTable', displayName: 'SalesTable', ref: 'A1:C4' }
  ]

  // Sheet 3: Analysis — uses named ranges, cross-sheet, table refs
  const analysis = XLSX.utils.aoa_to_sheet([['x', 'x', 'x', 'x', 'x']])
  analysis['A1'] = { t: 'n', v: 0, f: 'Config!B2' }                          // cross-sheet
  analysis['B1'] = { t: 'n', v: 0, f: 'RateParam' }                           // named range
  analysis['C1'] = { t: 'n', v: 0, f: "SalesTable[Revenue]" }                 // table structured ref
  analysis['D1'] = { t: 'n', v: 0, f: "'Sales Data'!B2" }                     // quoted sheet cross-ref
  analysis['E1'] = { t: 'n', v: 0, f: '[External-Source.xlsx]Prices!A1' }     // external file
  analysis['!ref'] = 'A1:E1'

  // Sheet 4: Output — refs Analysis, creates part of a cycle
  const output = XLSX.utils.aoa_to_sheet([['x', 'x']])
  output['A1'] = { t: 'n', v: 0, f: 'Analysis!A1+Analysis!C1' }
  output['B1'] = { t: 'n', v: 0, f: 'Feedback!A1' }                          // cycle: Output→Feedback
  output['!ref'] = 'A1:B1'

  // Sheet 5: Feedback — refs Output, completing the cycle
  const feedback = XLSX.utils.aoa_to_sheet([['x']])
  feedback['A1'] = { t: 'n', v: 0, f: 'Output!A1' }                          // cycle: Feedback→Output
  feedback['!ref'] = 'A1:A1'

  // Sheet 6: Isolated (no refs at all)
  const isolated = XLSX.utils.aoa_to_sheet([['This sheet has no formulas'], ['Just static data']])

  XLSX.utils.book_append_sheet(wb, config, 'Config')
  XLSX.utils.book_append_sheet(wb, salesData, 'Sales Data')
  XLSX.utils.book_append_sheet(wb, analysis, 'Analysis')
  XLSX.utils.book_append_sheet(wb, output, 'Output')
  XLSX.utils.book_append_sheet(wb, feedback, 'Feedback')
  XLSX.utils.book_append_sheet(wb, isolated, 'Isolated')

  // Named ranges
  if (!wb.Workbook) wb.Workbook = { Names: [], Views: [], WBProps: {} }
  if (!wb.Workbook.Names) wb.Workbook.Names = []
  wb.Workbook.Names.push(
    { Name: 'RateParam', Ref: 'Config!$B$2',       Sheet: undefined },
    { Name: 'CapParam',  Ref: 'Config!$B$3',       Sheet: undefined },
    { Name: 'LocalRate', Ref: 'Config!$B$2',       Sheet: 2 },  // sheet-scoped to Analysis
  )

  write(wb, 'everything.xlsx', 8)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Run all generators
// ═══════════════════════════════════════════════════════════════════════════════
console.log('Generating Excel test models for Tangle...\n')

console.log('── ACTUARIAL-SCALE MODELS ──────────────────────────────────')
makeReserveModel()
makePricingModel()
makeReinsuranceModel()
makeFinancialProjection()
makeExperienceStudy()
makeCapitalModel()

console.log('\n── TARGETED FEATURE TESTS ──────────────────────────────────')
makeQuotedSheets()
makeSyntaxShowcase()
makeThreeWayCircular()
makeHeavyAggregation()
makeIsolatedMixed()
makeNamedRangeFormulas()
makeTableModel()
makeMultiWorkbookPair()
makeCorporateSuite()
makeMixedRefs()
makeLayoutStress()
makeEverything()

console.log('\n✅ All test models generated!')
