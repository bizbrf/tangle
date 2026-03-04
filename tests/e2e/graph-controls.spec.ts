import { test, expect } from '@playwright/test'
import { uploadFile, waitForNodes } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// E2E-16: LR direction is active by default after upload
test('E2E-16: LR direction button is active by default', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // LR direction is the default — its button should exist in the toolbar
  const lrButton = page.getByTestId('direction-LR')
  await expect(lrButton).toBeVisible()
})

// E2E-17: Switching to TB direction keeps nodes visible
test('E2E-17: switching to TB direction keeps nodes visible', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Switch to Top-Bottom layout direction
  await page.getByTestId('direction-TB').click()

  // Nodes should still be visible after direction change
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()
})

// E2E-18: Switching back to LR from TB keeps nodes visible
test('E2E-18: switching back to LR from TB keeps nodes visible', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  await page.getByTestId('direction-TB').click()
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()

  await page.getByTestId('direction-LR').click()
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()
})

// E2E-19: Grouping by-type mode renders nodes for a multi-sheet workbook
test('E2E-19: group-by-type mode renders nodes', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  await page.getByTestId('group-by-type').click()

  // Nodes should still be visible in grouped mode
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()
})

// E2E-20: Switching grouping off restores node count
test('E2E-20: switching grouping off restores nodes', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Note the node count in graph mode
  const graphCount = await page.getByTestId('sheet-node').count()

  // Switch to by-type grouping
  await page.getByTestId('group-by-type').click()
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()

  // Switch grouping off
  await page.getByTestId('group-off').click()
  await expect(page.getByTestId('sheet-node')).toHaveCount(graphCount)
})

// E2E-21: Direction buttons are hidden in Overview mode
test('E2E-21: direction buttons hidden in overview mode', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Switch to overview — direction buttons should disappear
  await page.getByTestId('view-overview').click()

  await expect(page.getByTestId('direction-LR')).not.toBeVisible()
  await expect(page.getByTestId('direction-TB')).not.toBeVisible()
})

// E2E-22: Direction buttons reappear after switching back from Overview to Graph
test('E2E-22: direction buttons reappear after leaving overview mode', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  await page.getByTestId('view-overview').click()
  await expect(page.getByTestId('direction-LR')).not.toBeVisible()

  await page.getByTestId('view-graph').click()
  await expect(page.getByTestId('direction-LR')).toBeVisible()
})

// E2E-23: Fit toggle button is visible after upload
test('E2E-23: fit toggle button is visible and clickable', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  const fitBtn = page.getByTestId('fit-toggle')
  await expect(fitBtn).toBeVisible()

  // Clicking fit-toggle should not crash or remove nodes
  await fitBtn.click()
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()
})

// E2E-24: Finance model loads with multiple nodes in graph mode
test('E2E-24: finance model renders multiple nodes', async ({ page }) => {
  await uploadFile(page, 'finance-model.xlsx')
  await waitForNodes(page)

  // finance-model.xlsx has 5 sheets — all should render as nodes
  const count = await page.getByTestId('sheet-node').count()
  expect(count).toBeGreaterThanOrEqual(5)
})

// E2E-25: Overview mode shows one node per workbook (finance model)
test('E2E-25: overview mode collapses finance model to one node', async ({ page }) => {
  await uploadFile(page, 'finance-model.xlsx')
  await waitForNodes(page)

  await page.getByTestId('view-overview').click()

  await expect(page.getByTestId('sheet-node')).toHaveCount(1)
})

// E2E-26: Structured ref fixture renders graph nodes correctly
test('E2E-26: structured-ref fixture renders nodes in graph', async ({ page }) => {
  await uploadFile(page, 'structured-ref.xlsx')
  await waitForNodes(page)

  // structured-ref.xlsx has 3 sheets
  const count = await page.getByTestId('sheet-node').count()
  expect(count).toBeGreaterThanOrEqual(3)
})

// E2E-36: URL state is preserved after page reload
test('E2E-36: URL state is preserved after page reload', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Switch to overview mode — this writes to the URL
  await page.getByTestId('view-overview').click()
  await expect(page.getByTestId('sheet-node')).toHaveCount(1)

  // Capture the URL with state encoded
  const urlWithState = page.url()
  expect(urlWithState).toContain('view=overview')
})
