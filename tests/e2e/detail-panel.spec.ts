import { test, expect } from '@playwright/test'
import { uploadFile, waitForNodes, waitForDetailPanel } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// E2E-10: Clicking a sheet node opens the detail panel with sheet name
test('E2E-10: clicking sheet node opens detail panel', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  const firstNode = page.getByTestId('sheet-node').first()

  // Detail panel should appear (retries click on slower browsers)
  await waitForDetailPanel(page, firstNode)
  await expect(page.getByTestId('detail-panel')).toBeVisible()

  // Panel title should show 'Sheet' (not 'References' or a multi-select count)
  await expect(page.getByTestId('detail-panel-title')).toContainText('Sheet')
})

// E2E-11: Detail panel shows workload metrics
test('E2E-11: detail panel shows workload metrics', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  const firstNode = page.getByTestId('sheet-node').first()
  await waitForDetailPanel(page, firstNode)

  // Workload metrics grid should be visible (only shows for nodes with workload data)
  // cross-sheet.xlsx has formulas, so workload is non-null
  await expect(page.getByTestId('workload-metrics')).toBeVisible()

  // At least one metric label should be visible ('formulas' is always shown)
  await expect(page.getByTestId('workload-metrics')).toContainText('formulas')
})

// E2E-12: Clicking an edge opens the detail panel in References mode.
// We click the wide invisible hit path that WeightedEdge renders for hover —
// it's the only stroke wide enough to hit reliably across browsers.
test('E2E-12: clicking an edge opens detail panel with References header', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Wait for an edge to render, then give layout a frame to settle so React
  // Flow's click handler is wired up before we hit it.
  const edgeGroup = page.locator('.react-flow__edge').first()
  await edgeGroup.waitFor({ state: 'attached' })
  await page.waitForTimeout(200)

  await waitForDetailPanel(page, edgeGroup)
  await expect(page.getByTestId('detail-panel-title')).toContainText('References')
})

test('E2E-31: multi-select panel close button dismisses reliably', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  const nodes = page.getByTestId('sheet-node')
  await nodes.first().click({ force: true })
  // Apply Shift atomically with the click — separate keyboard.down/up races
  // on Linux runners where the Shift release lands before the click registers.
  await nodes.nth(1).click({ force: true, modifiers: ['Shift'] })

  await expect(page.getByTestId('detail-panel-title')).toContainText('selected')
  await page.getByTestId('detail-panel-close').click({ force: true })
  await expect(page.getByTestId('detail-panel')).toBeHidden()
})

test('E2E-32: pane click clears multi-select panel', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  const nodes = page.getByTestId('sheet-node')
  await nodes.first().click({ force: true })
  await nodes.nth(1).click({ force: true, modifiers: ['Shift'] })

  await expect(page.getByTestId('detail-panel-title')).toContainText('selected')
  await page.locator('.react-flow__pane').click({ position: { x: 50, y: 50 }, force: true })
  await expect(page.getByTestId('detail-panel')).toBeHidden()
})
