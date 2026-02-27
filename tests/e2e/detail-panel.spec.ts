import { test, expect } from '@playwright/test'
import { uploadFile, waitForNodes, waitForDetailPanel } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// E2E-10: Clicking a sheet node opens the detail panel with sheet name
test('E2E-10: clicking sheet node opens detail panel', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Click the first sheet node (force: true bypasses RF canvas overlay)
  await page.getByTestId('sheet-node').first().click({ force: true })

  // Detail panel should appear
  await waitForDetailPanel(page)
  await expect(page.getByTestId('detail-panel')).toBeVisible()

  // Panel title should show 'Sheet' (not 'References' or a multi-select count)
  await expect(page.getByTestId('detail-panel-title')).toContainText('Sheet')
})

// E2E-11: Detail panel shows workload metrics
test('E2E-11: detail panel shows workload metrics', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  await page.getByTestId('sheet-node').first().click({ force: true })
  await waitForDetailPanel(page)

  // Workload metrics grid should be visible (only shows for nodes with workload data)
  // cross-sheet.xlsx has formulas, so workload is non-null
  await expect(page.getByTestId('workload-metrics')).toBeVisible()

  // At least one metric label should be visible ('formulas' is always shown)
  await expect(page.getByTestId('workload-metrics')).toContainText('formulas')
})

// E2E-12: Clicking an edge opens the detail panel in References mode
test('E2E-12: clicking an edge opens detail panel with References header', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // React Flow edges: try clicking the edge label badge (pointerEvents: 'all')
  // The edge label badge appears for edges with refCount > 1 as a positioned div
  // For single-ref edges, fall back to clicking the SVG path via .react-flow__edge
  const edgeLabel = page.locator('.react-flow__edge-label').first()
  const edgePath = page.locator('.react-flow__edge').first()

  // Check if edge labels exist (multi-ref edges); otherwise click the SVG edge
  const labelCount = await edgeLabel.count()
  if (labelCount > 0) {
    await edgeLabel.first().click({ force: true })
  } else {
    await edgePath.first().click({ force: true })
  }

  // Detail panel should show References mode
  await waitForDetailPanel(page)
  await expect(page.getByTestId('detail-panel-title')).toContainText('References')
})
