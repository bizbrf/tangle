## Acme Corp Financial Model Builder
## Creates 7 interconnected Excel workbooks using COM automation
## Run: powershell -ExecutionPolicy Bypass -File build-models.ps1

$ErrorActionPreference = "Stop"
$outDir = $PSScriptRoot

Write-Host "Starting Excel COM automation..." -ForegroundColor Cyan
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.ScreenUpdating = $false

function Save-AndClose($wb, $name) {
    $path = Join-Path $outDir $name
    if (Test-Path $path) { Remove-Item $path -Force }
    $wb.SaveAs($path, 51) # xlOpenXMLWorkbook
    $wb.Close($false)
    Write-Host "  Saved: $name" -ForegroundColor Green
}

# ═══════════════════════════════════════════════════════════════
# 1. ASSUMPTIONS.xlsx
# ═══════════════════════════════════════════════════════════════
Write-Host "`n[1/7] Building Assumptions.xlsx..." -ForegroundColor Yellow
$wb = $excel.Workbooks.Add()

# --- Sheet: Global ---
$ws = $wb.Sheets(1)
$ws.Name = "Global"
$headers = @("Parameter", "Value", "Unit", "Notes")
for ($i = 0; $i -lt $headers.Count; $i++) { $ws.Cells(1, $i+1).Value2 = $headers[$i] }

$params = @(
    @("TaxRate", 0.25, "%", "Corporate tax rate"),
    @("GrowthRate", 0.08, "%", "Base revenue growth"),
    @("InflationRate", 0.03, "%", "Annual inflation"),
    @("DiscountRate", 0.10, "%", "WACC for DCF"),
    @("TerminalGrowth", 0.025, "%", "Terminal growth rate"),
    @("FYStart", 2024, "Year", "First projection year"),
    @("ProjectionYears", 5, "Years", "Number of years"),
    @("HeadcountGrowth", 0.10, "%", "Annual hiring growth"),
    @("SalaryInflation", 0.04, "%", "Annual salary increase"),
    @("BenefitsRate", 0.30, "%", "Benefits as pct of salary"),
    @("DebtRate", 0.06, "%", "Interest rate on debt"),
    @("DebtTerm", 10, "Years", "Loan term"),
    @("BaseRevenue", 50000000, "$", "Year 1 revenue"),
    @("BaseCOGS", 20000000, "$", "Year 1 COGS"),
    @("BaseOpEx", 15000000, "$", "Year 1 operating expenses"),
    @("RevenueGrowthHigh", 0.12, "%", "Optimistic scenario"),
    @("RevenueGrowthMid", 0.08, "%", "Base case scenario"),
    @("RevenueGrowthLow", 0.04, "%", "Conservative scenario")
)
for ($r = 0; $r -lt $params.Count; $r++) {
    $ws.Cells($r+2, 1).Value2 = [string]$params[$r][0]
    $ws.Cells($r+2, 2).Value2 = [double]$params[$r][1]
    $ws.Cells($r+2, 3).Value2 = [string]$params[$r][2]
    $ws.Cells($r+2, 4).Value2 = [string]$params[$r][3]
}

# Create Excel Table
$range = $ws.Range("A1:D$($params.Count + 1)")
$table = $ws.ListObjects.Add(1, $range, $null, 1) # xlSrcRange, xlYes
$table.Name = "Assumptions"

# Create Named Ranges for each parameter
for ($r = 0; $r -lt $params.Count; $r++) {
    $name = $params[$r][0]
    $cell = $ws.Cells($r+2, 2).Address($true, $true, 1) # xlA1
    $wb.Names.Add($name, "=Global!$cell") | Out-Null
}

# --- Sheet: Rates ---
$ws2 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws2.Name = "Rates"
$ws2.Cells(1,1).Value2 = "Year"
$ws2.Cells(1,2).Value2 = "Revenue Growth"
$ws2.Cells(1,3).Value2 = "COGS Pct"
$ws2.Cells(1,4).Value2 = "OpEx Growth"
$ws2.Cells(1,5).Value2 = "Headcount Growth"

$multipliers = @(1.0, 1.05, 0.95, 0.90, 0.85)
$cogsRates = @(0.40, 0.39, 0.38, 0.37, 0.37)
$infMult = @(1.0, 1.02, 1.01, 1.0, 0.98)
$hcMult = @(1.0, 0.9, 0.8, 0.7, 0.6)

for ($y = 0; $y -lt 5; $y++) {
    $row = $y + 2
    $ws2.Cells($row, 1).Value2 = [double](2024 + $y)
    $ws2.Cells($row, 2).Formula = "=GrowthRate*$($multipliers[$y])"
    $ws2.Cells($row, 3).Value2 = $cogsRates[$y]
    $ws2.Cells($row, 4).Formula = "=InflationRate*$($infMult[$y])"
    $ws2.Cells($row, 5).Formula = "=HeadcountGrowth*$($hcMult[$y])"
}
$range2 = $ws2.Range("A1:E6")
$table2 = $ws2.ListObjects.Add(1, $range2, $null, 1)
$table2.Name = "YearlyRates"

# --- Sheet: Scenarios ---
$ws3 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws3.Name = "Scenarios"
$ws3.Cells(1,1).Value2 = "Metric"
$ws3.Cells(1,2).Value2 = "Low"
$ws3.Cells(1,3).Value2 = "Base"
$ws3.Cells(1,4).Value2 = "High"

$ws3.Cells(2,1).Value2 = "Revenue Growth"
$ws3.Cells(2,2).Formula = "=RevenueGrowthLow"
$ws3.Cells(2,3).Formula = "=RevenueGrowthMid"
$ws3.Cells(2,4).Formula = "=RevenueGrowthHigh"

$ws3.Cells(3,1).Value2 = "Tax Rate"
$ws3.Cells(3,2).Formula = "=TaxRate+0.05"
$ws3.Cells(3,3).Formula = "=TaxRate"
$ws3.Cells(3,4).Formula = "=TaxRate-0.03"

$ws3.Cells(4,1).Value2 = "Discount Rate"
$ws3.Cells(4,2).Formula = "=DiscountRate+0.02"
$ws3.Cells(4,3).Formula = "=DiscountRate"
$ws3.Cells(4,4).Formula = "=DiscountRate-0.02"

$ws3.Cells(5,1).Value2 = "Terminal Growth"
$ws3.Cells(5,2).Formula = "=TerminalGrowth-0.005"
$ws3.Cells(5,3).Formula = "=TerminalGrowth"
$ws3.Cells(5,4).Formula = "=TerminalGrowth+0.005"

# 3D reference
$ws3.Cells(7,1).Value2 = "3D Sum Check"
$ws3.Cells(7,2).Formula = "=SUM('Global:Scenarios'!B2)"

# Remove extra default sheets
while ($wb.Sheets.Count -gt 3) {
    $wb.Sheets($wb.Sheets.Count).Delete()
}

Save-AndClose $wb "Assumptions.xlsx"

# ═══════════════════════════════════════════════════════════════
# 2. REVENUE-MODEL.xlsx
# ═══════════════════════════════════════════════════════════════
Write-Host "`n[2/7] Building Revenue-Model.xlsx..." -ForegroundColor Yellow
$wb = $excel.Workbooks.Add()

# --- Products ---
$ws = $wb.Sheets(1)
$ws.Name = "Products"
$headers = @("ProductID","Product Name","Category","Base Price","Launch Year","Status")
for ($i = 0; $i -lt $headers.Count; $i++) { $ws.Cells(1,$i+1).Value2 = $headers[$i] }
$products = @(
    @("P001","Enterprise Suite","Software",50000,2020,"Active"),
    @("P002","Cloud Platform","SaaS",2500,2022,"Active"),
    @("P003","Analytics Pro","Add-on",15000,2023,"Active"),
    @("P004","Mobile SDK","Developer",800,2024,"Beta"),
    @("P005","Consulting Hours","Services",250,2020,"Active")
)
for ($r = 0; $r -lt $products.Count; $r++) {
    for ($c = 0; $c -lt 6; $c++) { $ws.Cells($r+2,$c+1).Value2 = $products[$r][$c] }
}
$tbl = $ws.ListObjects.Add(1, $ws.Range("A1:F6"), $null, 1)
$tbl.Name = "ProductList"

# --- Volume ---
$ws2 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws2.Name = "Volume"
$ws2.Cells(1,1).Value2 = "Product"
$years = @(2024,2025,2026,2027,2028)
for ($i = 0; $i -lt 5; $i++) { $ws2.Cells(1,$i+2).Value2 = $years[$i] }

$baseVols = @(200, 5000, 800, 100, 10000)
$growthMult = @(1.0, 1.5, 1.2, 2.0, 0.5)
for ($r = 0; $r -lt 5; $r++) {
    $ws2.Cells($r+2, 1).Value2 = $products[$r][1]
    $ws2.Cells($r+2, 2).Value2 = $baseVols[$r]
    for ($y = 1; $y -lt 5; $y++) {
        $col = [char](66 + $y) # C, D, E, F
        $prevCol = [char](65 + $y) # B, C, D, E
        $row = $r + 2
        $ws2.Cells($row, $y+2).Formula = "=$($prevCol)$($row)*(1+'[Assumptions.xlsx]Rates'!B$($y+1)*$($growthMult[$r]))"
    }
}

# --- Pricing ---
$ws3 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws3.Name = "Pricing"
$ws3.Cells(1,1).Value2 = "Product"
for ($i = 0; $i -lt 5; $i++) { $ws3.Cells(1,$i+2).Value2 = $years[$i] }
for ($r = 0; $r -lt 5; $r++) {
    $row = $r + 2
    $ws3.Cells($row, 1).Value2 = $products[$r][1]
    $ws3.Cells($row, 2).Formula = "=XLOOKUP(A$row,Products!A:A,Products!D:D)"
    for ($y = 1; $y -lt 5; $y++) {
        $col = [char](66 + $y)
        $prevCol = [char](65 + $y)
        $ws3.Cells($row, $y+2).Formula = "=$($prevCol)$($row)*(1+'[Assumptions.xlsx]Global'!`$B`$5)"
    }
}

# --- Revenue ---
$ws4 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws4.Name = "Revenue"
$ws4.Cells(1,1).Value2 = "Product"
for ($i = 0; $i -lt 5; $i++) { $ws4.Cells(1,$i+2).Value2 = $years[$i] }
$ws4.Cells(1,7).Value2 = "Total"
for ($r = 0; $r -lt 5; $r++) {
    $row = $r + 2
    $ws4.Cells($row, 1).Value2 = $products[$r][1]
    for ($y = 0; $y -lt 5; $y++) {
        $col = [char](66 + $y)
        $ws4.Cells($row, $y+2).Formula = "=Volume!$($col)$($row)*Pricing!$($col)$($row)"
    }
    $ws4.Cells($row, 7).Formula = "=SUM(B$($row):F$($row))"
}
$ws4.Cells(7, 1).Value2 = "Total"
for ($y = 0; $y -lt 5; $y++) {
    $col = [char](66 + $y)
    $ws4.Cells(7, $y+2).Formula = "=SUM($($col)2:$($col)6)"
}
$ws4.Cells(7, 7).Formula = "=SUM(B7:F7)"

# --- Mix Analysis ---
$ws5 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws5.Name = "Mix Analysis"
$ws5.Cells(1,1).Value2 = "Product"
$ws5.Cells(1,2).Value2 = "2024 Mix"
$ws5.Cells(1,3).Value2 = "2028 Mix"
$ws5.Cells(1,4).Value2 = "Mix Shift"
$ws5.Cells(1,5).Value2 = "CAGR"
for ($r = 0; $r -lt 5; $r++) {
    $row = $r + 2
    $ws5.Cells($row, 1).Value2 = $products[$r][1]
    $ws5.Cells($row, 2).Formula = "=Revenue!B$row/Revenue!B7"
    $ws5.Cells($row, 3).Formula = "=Revenue!F$row/Revenue!F7"
    $ws5.Cells($row, 4).Formula = "=C$row-B$row"
    $ws5.Cells($row, 5).Formula = "=(Pricing!F$row/Pricing!B$row)^(1/4)-1"
}
# LET formula
$ws5.Cells(8, 1).Value2 = "Revenue CAGR"
$ws5.Cells(8, 2).Formula = "=LET(rev2024,Revenue!B7,rev2028,Revenue!F7,cagr,(rev2028/rev2024)^(1/4)-1,cagr)"

while ($wb.Sheets.Count -gt 5) { $wb.Sheets($wb.Sheets.Count).Delete() }
Save-AndClose $wb "Revenue-Model.xlsx"

# ═══════════════════════════════════════════════════════════════
# 3. PEOPLE.xlsx
# ═══════════════════════════════════════════════════════════════
Write-Host "`n[3/7] Building People.xlsx..." -ForegroundColor Yellow
$wb = $excel.Workbooks.Add()

$ws = $wb.Sheets(1)
$ws.Name = "Headcount"
$headers = @("Department","Role","2024 HC","2025 HC","2026 HC","2027 HC","2028 HC","Avg Salary","Seniority")
for ($i = 0; $i -lt $headers.Count; $i++) { $ws.Cells(1,$i+1).Value2 = $headers[$i] }

$staff = @(
    @("Engineering","Developer",25,120000,"Mid",1.0),
    @("Engineering","QA",8,95000,"Mid",0.8),
    @("Engineering","DevOps",5,130000,"Senior",0.6),
    @("Engineering","Manager",4,150000,"Senior",0.3),
    @("Sales","Account Exec",15,85000,"Mid",1.2),
    @("Sales","SDR",10,55000,"Junior",1.5),
    @("Sales","Manager",3,140000,"Senior",0.2),
    @("Marketing","Content",4,75000,"Mid",0.7),
    @("Marketing","Demand Gen",3,90000,"Mid",0.9),
    @("G&A","Finance",3,110000,"Senior",0.3),
    @("G&A","HR",2,85000,"Mid",0.2),
    @("G&A","Legal",2,130000,"Senior",0.1),
    @("Executive","C-Suite",4,250000,"Executive",0)
)
for ($r = 0; $r -lt $staff.Count; $r++) {
    $row = $r + 2
    $ws.Cells($row,1).Value2 = $staff[$r][0]
    $ws.Cells($row,2).Value2 = $staff[$r][1]
    $ws.Cells($row,3).Value2 = $staff[$r][2]
    $ws.Cells($row,8).Value2 = $staff[$r][3]
    $ws.Cells($row,9).Value2 = $staff[$r][4]
    if ($staff[$r][5] -gt 0) {
        for ($y = 1; $y -lt 5; $y++) {
            $col = [char](67 + $y) # D,E,F,G
            $prevCol = [char](66 + $y)
            $ws.Cells($row, $y+3).Formula = "=ROUND($($prevCol)$($row)*(1+'[Assumptions.xlsx]Global'!`$B`$10*$($staff[$r][5])),0)"
        }
    } else {
        # Executive: flat
        $ws.Cells($row,4).Value2 = 4; $ws.Cells($row,5).Value2 = 4; $ws.Cells($row,6).Value2 = 5; $ws.Cells($row,7).Value2 = 5
    }
}
$tbl = $ws.ListObjects.Add(1, $ws.Range("A1:I$($staff.Count+1)"), $null, 1)
$tbl.Name = "Staff"

# --- Compensation ---
$ws2 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws2.Name = "Compensation"
$ws2.Cells(1,1).Value2 = "Department"
$ws2.Cells(1,2).Value2 = "Role"
for ($i = 0; $i -lt 5; $i++) { $ws2.Cells(1,$i+3).Value2 = 2024+$i }
for ($r = 0; $r -lt $staff.Count; $r++) {
    $row = $r + 2
    $ws2.Cells($row,1).Value2 = $staff[$r][0]
    $ws2.Cells($row,2).Value2 = $staff[$r][1]
    for ($y = 0; $y -lt 5; $y++) {
        $col = [char](67 + $y)
        $hcCol = [char](67 + $y)
        $ws2.Cells($row, $y+3).Formula = "=Headcount!$($hcCol)$($row)*Headcount!H$($row)*(1+'[Assumptions.xlsx]Global'!`$B`$11)^$y*(1+'[Assumptions.xlsx]Global'!`$B`$12)"
    }
}
# Dept totals
$depts = @("Engineering","Sales","Marketing","G&A","Executive")
$totalRow = $staff.Count + 3
$ws2.Cells($totalRow, 1).Value2 = "Department Totals"
for ($d = 0; $d -lt $depts.Count; $d++) {
    $dRow = $totalRow + 1 + $d
    $ws2.Cells($dRow, 1).Value2 = $depts[$d]
    for ($y = 0; $y -lt 5; $y++) {
        $col = [char](67 + $y)
        $ws2.Cells($dRow, $y+3).Formula = "=SUMIFS($($col)2:$($col)$($staff.Count+1),`$A`$2:`$A`$$($staff.Count+1),`"$($depts[$d])`")"
    }
}

# --- Summary ---
$ws3 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws3.Name = "Summary"
$ws3.Cells(1,1).Value2 = "Department"
$ws3.Cells(1,2).Value2 = "2024 HC"
$ws3.Cells(1,3).Value2 = "2024 Cost"
$ws3.Cells(1,4).Value2 = "2028 HC"
$ws3.Cells(1,5).Value2 = "2028 Cost"
for ($d = 0; $d -lt $depts.Count; $d++) {
    $row = $d + 2
    $ws3.Cells($row, 1).Value2 = $depts[$d]
    $ws3.Cells($row, 2).Formula = "=SUMIFS(Headcount!C:C,Headcount!A:A,`"$($depts[$d])`")"
    $ws3.Cells($row, 3).Formula = "=Compensation!C$($totalRow + 1 + $d)"
    $ws3.Cells($row, 4).Formula = "=SUMIFS(Headcount!G:G,Headcount!A:A,`"$($depts[$d])`")"
    $ws3.Cells($row, 5).Formula = "=Compensation!G$($totalRow + 1 + $d)"
}
$ws3.Cells(7, 1).Value2 = "Total"
$ws3.Cells(7, 2).Formula = "=SUM(B2:B6)"
$ws3.Cells(7, 3).Formula = "=SUM(C2:C6)"
$ws3.Cells(7, 4).Formula = "=SUM(D2:D6)"
$ws3.Cells(7, 5).Formula = "=SUM(E2:E6)"

while ($wb.Sheets.Count -gt 3) { $wb.Sheets($wb.Sheets.Count).Delete() }
Save-AndClose $wb "People.xlsx"

# ═══════════════════════════════════════════════════════════════
# 4. COST-MODEL.xlsx
# ═══════════════════════════════════════════════════════════════
Write-Host "`n[4/7] Building Cost-Model.xlsx..." -ForegroundColor Yellow
$wb = $excel.Workbooks.Add()

$ws = $wb.Sheets(1)
$ws.Name = "COGS"
$ws.Cells(1,1).Value2 = "Category"
for ($i = 0; $i -lt 5; $i++) { $ws.Cells(1,$i+2).Value2 = 2024+$i }

$ws.Cells(2,1).Value2 = "Hosting & Infrastructure"
$ws.Cells(3,1).Value2 = "Support Staff"
$ws.Cells(4,1).Value2 = "Third-Party Licenses"
$ws.Cells(5,1).Value2 = "Payment Processing"
$ws.Cells(6,1).Value2 = "Total COGS"
$ws.Cells(7,1).Value2 = "Gross Margin %"

for ($y = 0; $y -lt 5; $y++) {
    $col = [char](66 + $y)
    $rateRow = $y + 2
    $ws.Cells(2, $y+2).Formula = "='[Revenue-Model.xlsx]Revenue'!$($col)7*'[Assumptions.xlsx]Rates'!C$rateRow*0.5"
    $ws.Cells(3, $y+2).Formula = "='[People.xlsx]Compensation'!$($col)16"
    $ws.Cells(4, $y+2).Formula = "='[Revenue-Model.xlsx]Revenue'!$($col)7*0.05"
    $ws.Cells(5, $y+2).Formula = "='[Revenue-Model.xlsx]Revenue'!$($col)7*0.02"
    $ws.Cells(6, $y+2).Formula = "=SUM($($col)2:$($col)5)"
    $ws.Cells(7, $y+2).Formula = "=1-($($col)6/'[Revenue-Model.xlsx]Revenue'!$($col)7)"
}

# --- OpEx ---
$ws2 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws2.Name = "OpEx"
$ws2.Cells(1,1).Value2 = "Category"
for ($i = 0; $i -lt 5; $i++) { $ws2.Cells(1,$i+2).Value2 = 2024+$i }

$opexCats = @("People - Engineering","People - Sales","People - Marketing","People - G&A","People - Executive",
              "Rent & Facilities","Software & Tools","Travel","Marketing Spend","Professional Fees","Insurance")
for ($c = 0; $c -lt $opexCats.Count; $c++) { $ws2.Cells($c+2, 1).Value2 = $opexCats[$c] }
$ws2.Cells(13, 1).Value2 = "Total OpEx"

for ($y = 0; $y -lt 5; $y++) {
    $col = [char](66 + $y)
    # People costs from People.xlsx Summary
    for ($d = 0; $d -lt 5; $d++) {
        $ws2.Cells($d+2, $y+2).Formula = "='[People.xlsx]Summary'!$($col)$($d+2)"
    }
    # Non-people costs
    if ($y -eq 0) {
        $ws2.Cells(7, 2).Value2 = 2000000
        $ws2.Cells(8, 2).Value2 = 500000
        $ws2.Cells(9, 2).Value2 = 300000
        $ws2.Cells(10, 2).Formula = "='[Revenue-Model.xlsx]Revenue'!B7*0.08"
        $ws2.Cells(11, 2).Value2 = 400000
        $ws2.Cells(12, 2).Value2 = 200000
    } else {
        $prevCol = [char](65 + $y)
        $ws2.Cells(7, $y+2).Formula = "=$($prevCol)7*(1+'[Assumptions.xlsx]Global'!`$B`$5)"
        $ws2.Cells(8, $y+2).Formula = "=$($prevCol)8*(1+'[Assumptions.xlsx]Global'!`$B`$5*1.5)"
        $ws2.Cells(9, $y+2).Formula = "=$($prevCol)9*(1+'[Assumptions.xlsx]Global'!`$B`$5*0.8)"
        $ws2.Cells(10, $y+2).Formula = "='[Revenue-Model.xlsx]Revenue'!$($col)7*0.08"
        $ws2.Cells(11, $y+2).Formula = "=$($prevCol)11*(1+'[Assumptions.xlsx]Global'!`$B`$5)"
        $ws2.Cells(12, $y+2).Formula = "=$($prevCol)12*(1+'[Assumptions.xlsx]Global'!`$B`$5*0.5)"
    }
    $ws2.Cells(13, $y+2).Formula = "=SUM($($col)2:$($col)12)"
}

# --- Trends ---
$ws3 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws3.Name = "Trends"
$ws3.Cells(1,1).Value2 = "Metric"
for ($i = 0; $i -lt 5; $i++) { $ws3.Cells(1,$i+2).Value2 = 2024+$i }
$ws3.Cells(1,7).Value2 = "CAGR"
$ws3.Cells(2,1).Value2 = "Total COGS"
$ws3.Cells(3,1).Value2 = "Total OpEx"
for ($y = 0; $y -lt 5; $y++) {
    $col = [char](66+$y)
    $ws3.Cells(2,$y+2).Formula = "=COGS!$($col)6"
    $ws3.Cells(3,$y+2).Formula = "=OpEx!$($col)13"
}
$ws3.Cells(2,7).Formula = "=LET(s,B2,e,F2,n,4,(e/s)^(1/n)-1)"
$ws3.Cells(3,7).Formula = "=LET(s,B3,e,F3,n,4,(e/s)^(1/n)-1)"

while ($wb.Sheets.Count -gt 3) { $wb.Sheets($wb.Sheets.Count).Delete() }
Save-AndClose $wb "Cost-Model.xlsx"

# ═══════════════════════════════════════════════════════════════
# 5. FINANCIALS.xlsx
# ═══════════════════════════════════════════════════════════════
Write-Host "`n[5/7] Building Financials.xlsx..." -ForegroundColor Yellow
$wb = $excel.Workbooks.Add()

# --- P&L ---
$ws = $wb.Sheets(1)
$ws.Name = "P&L"
$ws.Cells(1,1).Value2 = "Line Item"
for ($i = 0; $i -lt 5; $i++) { $ws.Cells(1,$i+2).Value2 = 2024+$i }

$plItems = @("Revenue","COGS","Gross Profit","Gross Margin %","Operating Expenses","EBITDA","D&A","EBIT","Interest Expense","EBT","Income Tax","Net Income","Net Margin %")
for ($r = 0; $r -lt $plItems.Count; $r++) { $ws.Cells($r+2,1).Value2 = $plItems[$r] }

for ($y = 0; $y -lt 5; $y++) {
    $col = [char](66+$y)
    $ws.Cells(2,$y+2).Formula = "='[Revenue-Model.xlsx]Revenue'!$($col)7"
    $ws.Cells(3,$y+2).Formula = "='[Cost-Model.xlsx]COGS'!$($col)6"
    $ws.Cells(4,$y+2).Formula = "=$($col)2-$($col)3"
    $ws.Cells(5,$y+2).Formula = "=$($col)4/$($col)2"
    $ws.Cells(6,$y+2).Formula = "='[Cost-Model.xlsx]OpEx'!$($col)13"
    $ws.Cells(7,$y+2).Formula = "=$($col)4-$($col)6"
    $ws.Cells(8,$y+2).Formula = "=$($col)2*0.03"
    $ws.Cells(9,$y+2).Formula = "=$($col)7-$($col)8"
    $ws.Cells(10,$y+2).Formula = "=BalanceSheet!$($col)10*'[Assumptions.xlsx]Global'!`$B`$13"
    $ws.Cells(11,$y+2).Formula = "=$($col)9-$($col)10"
    $ws.Cells(12,$y+2).Formula = "=MAX(0,$($col)11*'[Assumptions.xlsx]Global'!`$B`$3)"
    $ws.Cells(13,$y+2).Formula = "=$($col)11-$($col)12"
    $ws.Cells(14,$y+2).Formula = "=$($col)13/$($col)2"
}

# --- BalanceSheet ---
$ws2 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws2.Name = "BalanceSheet"
$ws2.Cells(1,1).Value2 = "Line Item"
for ($i = 0; $i -lt 5; $i++) { $ws2.Cells(1,$i+2).Value2 = 2024+$i }

$bsItems = @("Assets","Cash","Accounts Receivable","PP&E","Total Assets","","Liabilities","Accounts Payable","Accrued Expenses","Long-term Debt","Total Liabilities","","Equity","Retained Earnings","Total Equity","Total L+E")
for ($r = 0; $r -lt $bsItems.Count; $r++) { $ws2.Cells($r+2,1).Value2 = $bsItems[$r] }

for ($y = 0; $y -lt 5; $y++) {
    $col = [char](66+$y)
    $prevCol = [char](65+$y)
    $ws2.Cells(3,$y+2).Formula = "=CashFlow!$($col)17"
    $ws2.Cells(4,$y+2).Formula = "='P&L'!$($col)2/4"
    if ($y -eq 0) {
        $ws2.Cells(5,$y+2).Value2 = 5000000
        $ws2.Cells(11,$y+2).Value2 = 10000000
        $ws2.Cells(15,$y+2).Formula = "='P&L'!$($col)13"
    } else {
        $ws2.Cells(5,$y+2).Formula = "=$($prevCol)5-'P&L'!$($col)8+1000000"
        $ws2.Cells(11,$y+2).Formula = "=$($prevCol)11-$($prevCol)11/'[Assumptions.xlsx]Global'!`$B`$14"
        $ws2.Cells(15,$y+2).Formula = "=$($prevCol)15+'P&L'!$($col)13"
    }
    $ws2.Cells(6,$y+2).Formula = "=SUM($($col)3:$($col)5)"
    $ws2.Cells(9,$y+2).Formula = "='[Cost-Model.xlsx]COGS'!$($col)6/6"
    $ws2.Cells(10,$y+2).Formula = "='[Cost-Model.xlsx]OpEx'!$($col)13/12"
    $ws2.Cells(12,$y+2).Formula = "=SUM($($col)9:$($col)11)"
    $ws2.Cells(16,$y+2).Formula = "=$($col)15"
    $ws2.Cells(17,$y+2).Formula = "=$($col)12+$($col)16"
}

# --- CashFlow ---
$ws3 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws3.Name = "CashFlow"
$ws3.Cells(1,1).Value2 = "Line Item"
for ($i = 0; $i -lt 5; $i++) { $ws3.Cells(1,$i+2).Value2 = 2024+$i }

$cfItems = @("Operating Activities","Net Income","D&A","Change in AR","Change in AP","Operating Cash Flow","","Investing Activities","CapEx","Investing Cash Flow","","Financing Activities","Debt Repayment","Financing Cash Flow","","Net Cash Flow","Beginning Cash","Ending Cash")
for ($r = 0; $r -lt $cfItems.Count; $r++) { $ws3.Cells($r+2,1).Value2 = $cfItems[$r] }

for ($y = 0; $y -lt 5; $y++) {
    $col = [char](66+$y)
    $prevCol = [char](65+$y)
    $ws3.Cells(3,$y+2).Formula = "='P&L'!$($col)13"
    $ws3.Cells(4,$y+2).Formula = "='P&L'!$($col)8"
    if ($y -eq 0) {
        $ws3.Cells(5,$y+2).Formula = "=-BalanceSheet!$($col)4"
        $ws3.Cells(6,$y+2).Formula = "=BalanceSheet!$($col)9"
        $ws3.Cells(10,$y+2).Value2 = -1000000
        $ws3.Cells(18,$y+2).Value2 = 5000000
    } else {
        $ws3.Cells(5,$y+2).Formula = "=-(BalanceSheet!$($col)4-BalanceSheet!$($prevCol)4)"
        $ws3.Cells(6,$y+2).Formula = "=BalanceSheet!$($col)9-BalanceSheet!$($prevCol)9"
        $ws3.Cells(10,$y+2).Formula = "=-1000000*(1+'[Assumptions.xlsx]Global'!`$B`$5)^$y"
        $ws3.Cells(18,$y+2).Formula = "=$($prevCol)17+$($prevCol)19"
    }
    $ws3.Cells(7,$y+2).Formula = "=SUM($($col)3:$($col)6)"
    $ws3.Cells(11,$y+2).Formula = "=$($col)10"
    $ws3.Cells(14,$y+2).Formula = "=-BalanceSheet!$($col)11/'[Assumptions.xlsx]Global'!`$B`$14"
    $ws3.Cells(15,$y+2).Formula = "=$($col)14"
    $ws3.Cells(17,$y+2).Formula = "=$($col)7+$($col)11+$($col)15"
    $ws3.Cells(19,$y+2).Formula = "=$($col)17+$($col)18"
}

# --- Ratios ---
$ws4 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws4.Name = "Ratios"
$ws4.Cells(1,1).Value2 = "Ratio"
for ($i = 0; $i -lt 5; $i++) { $ws4.Cells(1,$i+2).Value2 = 2024+$i }
$ratioNames = @("Gross Margin","EBITDA Margin","Net Margin","ROE","Debt/Equity","Current Ratio")
for ($r = 0; $r -lt $ratioNames.Count; $r++) { $ws4.Cells($r+2,1).Value2 = $ratioNames[$r] }
for ($y = 0; $y -lt 5; $y++) {
    $col = [char](66+$y)
    $ws4.Cells(2,$y+2).Formula = "='P&L'!$($col)5"
    $ws4.Cells(3,$y+2).Formula = "='P&L'!$($col)7/'P&L'!$($col)2"
    $ws4.Cells(4,$y+2).Formula = "='P&L'!$($col)14"
    $ws4.Cells(5,$y+2).Formula = "='P&L'!$($col)13/BalanceSheet!$($col)16"
    $ws4.Cells(6,$y+2).Formula = "=BalanceSheet!$($col)11/BalanceSheet!$($col)16"
    $ws4.Cells(7,$y+2).Formula = "=(BalanceSheet!$($col)3+BalanceSheet!$($col)4)/(BalanceSheet!$($col)9+BalanceSheet!$($col)10)"
}

while ($wb.Sheets.Count -gt 4) { $wb.Sheets($wb.Sheets.Count).Delete() }
Save-AndClose $wb "Financials.xlsx"

# ═══════════════════════════════════════════════════════════════
# 6. VALUATION.xlsx
# ═══════════════════════════════════════════════════════════════
Write-Host "`n[6/7] Building Valuation.xlsx..." -ForegroundColor Yellow
$wb = $excel.Workbooks.Add()

$ws = $wb.Sheets(1)
$ws.Name = "DCF"
$ws.Cells(1,1).Value2 = "Line Item"
for ($i = 0; $i -lt 5; $i++) { $ws.Cells(1,$i+2).Value2 = 2024+$i }
$ws.Cells(1,7).Value2 = "Terminal"

$dcfItems = @("Free Cash Flow","Discount Factor","PV of FCF","","Terminal Value","PV of Terminal","","Sum of PV(FCF)","PV of Terminal","Enterprise Value","Less: Debt","Plus: Cash","Equity Value")
for ($r = 0; $r -lt $dcfItems.Count; $r++) { $ws.Cells($r+2,1).Value2 = $dcfItems[$r] }

for ($y = 0; $y -lt 5; $y++) {
    $col = [char](66+$y)
    $yr = $y + 1
    $ws.Cells(2,$y+2).Formula = "='[Financials.xlsx]CashFlow'!$($col)7+'[Financials.xlsx]CashFlow'!$($col)11"
    $ws.Cells(3,$y+2).Formula = "=1/(1+'[Assumptions.xlsx]Global'!`$B`$6)^$yr"
    $ws.Cells(4,$y+2).Formula = "=$($col)2*$($col)3"
}
$ws.Cells(6,7).Formula = "=F2*(1+'[Assumptions.xlsx]Global'!`$B`$7)/('[Assumptions.xlsx]Global'!`$B`$6-'[Assumptions.xlsx]Global'!`$B`$7)"
$ws.Cells(7,7).Formula = "=G6*F3"
$ws.Cells(9,2).Formula = "=SUM(B4:F4)"
$ws.Cells(10,2).Formula = "=G7"
$ws.Cells(11,2).Formula = "=B9+B10"
$ws.Cells(12,2).Formula = "=-'[Financials.xlsx]BalanceSheet'!B11"
$ws.Cells(13,2).Formula = "='[Financials.xlsx]BalanceSheet'!B3"
$ws.Cells(14,2).Formula = "=B11+B12+B13"

# --- Sensitivity ---
$ws2 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws2.Name = "Sensitivity"
$ws2.Cells(1,1).Value2 = "WACC \ TG"
$tgRates = @(0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04)
for ($c = 0; $c -lt 7; $c++) { $ws2.Cells(1,$c+2).Value2 = $tgRates[$c] }
$waccRates = @(0.08, 0.09, 0.10, 0.11, 0.12, 0.13, 0.14)
for ($r = 0; $r -lt 7; $r++) {
    $ws2.Cells($r+2, 1).Value2 = $waccRates[$r]
    for ($c = 0; $c -lt 7; $c++) {
        $row = $r + 2
        $colLetter = [char](66+$c)
        $ws2.Cells($row,$c+2).Formula = "=LET(wacc,`$A$row,tg,$($colLetter)`$1,fcf,DCF!F2,tv,fcf*(1+tg)/(wacc-tg),pvTV,tv/(1+wacc)^5,pvFCF,DCF!B9,debt,DCF!B12,cash,DCF!B13,pvFCF+pvTV+debt+cash)"
    }
}

# --- Comparables ---
$ws3 = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets($wb.Sheets.Count))
$ws3.Name = "Comparables"
$ws3.Cells(1,1).Value2 = "Company"
$ws3.Cells(1,2).Value2 = "Revenue ($M)"
$ws3.Cells(1,3).Value2 = "EBITDA ($M)"
$ws3.Cells(1,4).Value2 = "EV ($M)"
$ws3.Cells(1,5).Value2 = "EV/Revenue"
$ws3.Cells(1,6).Value2 = "EV/EBITDA"

$comps = @(
    @("Competitor A",100,25,500),
    @("Competitor B",250,60,1200),
    @("Competitor C",75,15,300),
    @("Competitor D",500,120,3000)
)
for ($r = 0; $r -lt $comps.Count; $r++) {
    $row = $r + 2
    for ($c = 0; $c -lt 4; $c++) { $ws3.Cells($row,$c+1).Value2 = $comps[$r][$c] }
    $ws3.Cells($row, 5).Formula = "=D$row/B$row"
    $ws3.Cells($row, 6).Formula = "=D$row/C$row"
}
$ws3.Cells(6,1).Value2 = "Median"
$ws3.Cells(6,5).Formula = "=MEDIAN(E2:E5)"
$ws3.Cells(6,6).Formula = "=MEDIAN(F2:F5)"
$ws3.Cells(8,1).Value2 = "Acme via EV/Rev"
$ws3.Cells(8,2).Formula = "='[Financials.xlsx]P&L'!B2/1000000*E6"
$ws3.Cells(9,1).Value2 = "Acme via EV/EBITDA"
$ws3.Cells(9,2).Formula = "='[Financials.xlsx]P&L'!B7/1000000*F6"

while ($wb.Sheets.Count -gt 3) { $wb.Sheets($wb.Sheets.Count).Delete() }
Save-AndClose $wb "Valuation.xlsx"

# ═══════════════════════════════════════════════════════════════
# 7. DASHBOARD.xlsx
# ═══════════════════════════════════════════════════════════════
Write-Host "`n[7/7] Building Dashboard.xlsx..." -ForegroundColor Yellow
$wb = $excel.Workbooks.Add()

$ws = $wb.Sheets(1)
$ws.Name = "KPIs"
$ws.Cells(1,1).Value2 = "KPI"
for ($i = 0; $i -lt 5; $i++) { $ws.Cells(1,$i+2).Value2 = 2024+$i }
$ws.Cells(1,7).Value2 = "5Y CAGR"

$kpis = @(
    "Revenue", "Revenue Growth", "Gross Profit", "Gross Margin %", "EBITDA",
    "EBITDA Margin %", "Net Income", "Net Margin %", "Free Cash Flow", "Cash Balance",
    "", "PEOPLE", "Total Headcount", "Revenue/Employee", "Total People Cost",
    "People Cost % Rev", "", "COSTS", "COGS", "COGS % Revenue",
    "Total OpEx", "OpEx % Revenue", "", "VALUATION", "Enterprise Value",
    "Equity Value", "EV/Revenue", "EV/EBITDA", "", "KEY ASSUMPTIONS",
    "Growth Rate", "Tax Rate", "Discount Rate", "Terminal Growth"
)
for ($r = 0; $r -lt $kpis.Count; $r++) { $ws.Cells($r+2,1).Value2 = $kpis[$r] }

for ($y = 0; $y -lt 5; $y++) {
    $col = [char](66+$y)
    $ws.Cells(2,$y+2).Formula  = "='[Revenue-Model.xlsx]Revenue'!$($col)7"
    $ws.Cells(4,$y+2).Formula  = "='[Financials.xlsx]P&L'!$($col)4"
    $ws.Cells(5,$y+2).Formula  = "='[Financials.xlsx]P&L'!$($col)5"
    $ws.Cells(6,$y+2).Formula  = "='[Financials.xlsx]P&L'!$($col)7"
    $ws.Cells(7,$y+2).Formula  = "='[Financials.xlsx]P&L'!$($col)7/'[Financials.xlsx]P&L'!$($col)2"
    $ws.Cells(8,$y+2).Formula  = "='[Financials.xlsx]P&L'!$($col)13"
    $ws.Cells(9,$y+2).Formula  = "='[Financials.xlsx]P&L'!$($col)14"
    $ws.Cells(10,$y+2).Formula = "='[Financials.xlsx]CashFlow'!$($col)7+'[Financials.xlsx]CashFlow'!$($col)11"
    $ws.Cells(11,$y+2).Formula = "='[Financials.xlsx]BalanceSheet'!$($col)3"
    $ws.Cells(14,$y+2).Formula = "='[People.xlsx]Summary'!$($col)7"
    $ws.Cells(15,$y+2).Formula = "='[Revenue-Model.xlsx]Revenue'!$($col)7/'[People.xlsx]Summary'!$($col)7"
    $ws.Cells(16,$y+2).Formula = "='[People.xlsx]Summary'!$($col)3"
    $ws.Cells(17,$y+2).Formula = "=$($col)16/$($col)2"
    $ws.Cells(20,$y+2).Formula = "='[Cost-Model.xlsx]COGS'!$($col)6"
    $ws.Cells(21,$y+2).Formula = "=$($col)20/$($col)2"
    $ws.Cells(22,$y+2).Formula = "='[Cost-Model.xlsx]OpEx'!$($col)13"
    $ws.Cells(23,$y+2).Formula = "=$($col)22/$($col)2"
    if ($y -gt 0) {
        $prevCol = [char](65+$y)
        $ws.Cells(3,$y+2).Formula = "=$($col)2/$($prevCol)2-1"
    }
}
# CAGR
$ws.Cells(2,7).Formula = "=(F2/B2)^(1/4)-1"
$ws.Cells(4,7).Formula = "=(F4/B4)^(1/4)-1"
$ws.Cells(6,7).Formula = "=(F6/B6)^(1/4)-1"
$ws.Cells(8,7).Formula = "=(F8/B8)^(1/4)-1"

# Valuation (static — just year 1)
$ws.Cells(26,2).Formula = "='[Valuation.xlsx]DCF'!B11"
$ws.Cells(27,2).Formula = "='[Valuation.xlsx]DCF'!B14"
$ws.Cells(28,2).Formula = "=B26/B2"
$ws.Cells(29,2).Formula = "=B26/B6"

# Key Assumptions
$ws.Cells(32,2).Formula = "='[Assumptions.xlsx]Global'!B4"
$ws.Cells(33,2).Formula = "='[Assumptions.xlsx]Global'!B3"
$ws.Cells(34,2).Formula = "='[Assumptions.xlsx]Global'!B6"
$ws.Cells(35,2).Formula = "='[Assumptions.xlsx]Global'!B7"

# LET formula referencing multiple files
$ws.Cells(37,1).Value2 = "Quick Net Income Check"
$ws.Cells(37,2).Formula = "=LET(rev,'[Revenue-Model.xlsx]Revenue'!B7,cogs,'[Cost-Model.xlsx]COGS'!B6,opex,'[Cost-Model.xlsx]OpEx'!B13,tax,'[Assumptions.xlsx]Global'!B3,ebt,rev-cogs-opex,ni,ebt*(1-tax),ni)"

while ($wb.Sheets.Count -gt 1) { $wb.Sheets($wb.Sheets.Count).Delete() }
Save-AndClose $wb "Dashboard.xlsx"

# ═══════════════════════════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════════════════════════
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
[System.GC]::Collect()

Write-Host "`nAll 7 workbooks created successfully!" -ForegroundColor Cyan
Write-Host "Files in: $outDir" -ForegroundColor Cyan
