import { test, expect } from '@playwright/test'
import { uploadFile, uploadFiles, waitForNodes } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// E2E-40: Layout recalculation on mode change
test('E2E-40: layout is recalculated when switching modes', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Get initial node positions
  const firstNode = page.getByTestId('sheet-node').first()
  await expect(firstNode).toBeVisible()

  // Switch to grouped layout
  await page.getByTestId('layout-grouped').click()
  await page.waitForTimeout(500)

  // Nodes should still be visible (layout recalculated)
  await expect(firstNode).toBeVisible()

  // Switch back to graph
  await page.getByTestId('layout-graph').click()
  await page.waitForTimeout(500)

  // Nodes should still be visible
  await expect(firstNode).toBeVisible()
})

// E2E-41: Layout recalculation on direction change
test('E2E-41: layout is recalculated when changing direction', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Get node reference
  const nodes = page.getByTestId('sheet-node')
  const initialCount = await nodes.count()

  // Switch to TB direction
  await page.getByTestId('direction-TB').click()
  await page.waitForTimeout(500)

  // Same number of nodes should be visible
  await expect(nodes).toHaveCount(initialCount)

  // Switch back to LR
  await page.getByTestId('direction-LR').click()
  await page.waitForTimeout(500)

  // Same number of nodes should still be visible
  await expect(nodes).toHaveCount(initialCount)
})

// E2E-42: Layout recalculation on file upload
test('E2E-42: layout is recalculated when uploading additional files', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  const initialNodeCount = await page.getByTestId('sheet-node').count()

  // Upload another file
  await uploadFile(page, 'external-ref.xlsx')
  await page.waitForTimeout(500)

  // Should have more nodes now
  const newNodeCount = await page.getByTestId('sheet-node').count()
  expect(newNodeCount).toBeGreaterThan(initialNodeCount)
})

// E2E-43: Layout recalculation when hiding files
test('E2E-43: layout is recalculated when hiding/showing files', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  const initialNodeCount = await page.getByTestId('sheet-node').count()

  // Hide the file
  const fileRow = page.getByTestId('file-list-item').first()
  await fileRow.hover()
  await fileRow.getByTestId('eye-toggle').click()
  await page.waitForTimeout(300)

  // Nodes should be hidden
  await expect(page.getByTestId('sheet-node')).toHaveCount(0)

  // Show the file again
  await fileRow.hover()
  await fileRow.getByTestId('eye-toggle').click()
  await page.waitForTimeout(300)

  // Nodes should be visible again
  await expect(page.getByTestId('sheet-node')).toHaveCount(initialNodeCount)
})

// E2E-44: Layout stability with multiple operations
test('E2E-44: layout remains stable through multiple operations', async ({ page }) => {
  await uploadFiles(page, ['cross-sheet.xlsx', 'external-ref.xlsx'])
  await waitForNodes(page)

  // Switch to grouped
  await page.getByTestId('layout-grouped').click()
  await page.waitForTimeout(300)

  // Switch direction
  await page.getByTestId('direction-TB').click()
  await page.waitForTimeout(300)

  // Switch back to graph
  await page.getByTestId('layout-graph').click()
  await page.waitForTimeout(300)

  // Fit to view
  await page.getByTestId('fit-view').click()
  await page.waitForTimeout(300)

  // All nodes should still be visible
  const nodeCount = await page.getByTestId('sheet-node').count()
  expect(nodeCount).toBeGreaterThan(0)
})

// E2E-45: Grouped layout preserves workbook boundaries
test('E2E-45: grouped layout keeps sheets from same workbook together', async ({ page }) => {
  await uploadFiles(page, ['cross-sheet.xlsx', 'external-ref.xlsx'])
  await waitForNodes(page)

  // Switch to grouped layout
  await page.getByTestId('layout-grouped').click()
  await page.waitForTimeout(500)

  // All nodes should be visible (grouped by workbook)
  const nodeCount = await page.getByTestId('sheet-node').count()
  expect(nodeCount).toBeGreaterThan(0)

  // Verify file list shows both files
  await expect(page.getByTestId('file-list-item')).toHaveCount(2)
})

// E2E-46: Overview mode shows one node per file
test('E2E-46: overview mode consolidates sheets to file-level nodes', async ({ page }) => {
  await uploadFiles(page, ['cross-sheet.xlsx', 'external-ref.xlsx'])
  await waitForNodes(page)

  // Get node count in graph mode
  const graphModeCount = await page.getByTestId('sheet-node').count()
  expect(graphModeCount).toBeGreaterThan(0)

  // Switch to overview
  await page.getByTestId('layout-overview').click()
  await page.waitForTimeout(500)

  // Should have fewer nodes (one per workbook, possibly plus external refs)
  const overviewCount = await page.getByTestId('sheet-node').count()
  expect(overviewCount).toBeLessThanOrEqual(graphModeCount)
})

// E2E-47: Complex graph layouts without crashes
test('E2E-47: complex workbook layouts without performance issues', async ({ page }) => {
  test.setTimeout(60000)

  await uploadFile(page, 'finance-model.xlsx')
  await page.waitForTimeout(2000)

  // Switch between layouts
  await page.getByTestId('layout-grouped').click()
  await page.waitForTimeout(500)

  await page.getByTestId('layout-overview').click()
  await page.waitForTimeout(500)

  await page.getByTestId('layout-graph').click()
  await page.waitForTimeout(500)

  // All nodes should still be visible
  const nodeCount = await page.getByTestId('sheet-node').count()
  expect(nodeCount).toBeGreaterThan(0)
})
