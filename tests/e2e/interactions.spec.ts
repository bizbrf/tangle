import { test, expect } from '@playwright/test'
import { uploadFile, waitForNodes, waitForDetailPanel } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// E2E-05: Switching layout mode updates graph node count
test('E2E-05: switching to Overview mode reduces node count', async ({ page }) => {
  // cross-sheet.xlsx has 2 sheets (Sheet1 + Sheet2) — in graph mode = 2 nodes, overview = 1 node
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Count in Graph mode (default) — should be 2 for a 2-sheet workbook
  const graphCount = await page.getByTestId('sheet-node').count()
  expect(graphCount).toBeGreaterThan(1)

  // Switch to Overview mode — one node per workbook
  await page.getByTestId('layout-overview').click()

  // Overview should have exactly 1 node (1 per uploaded workbook, no external refs)
  await expect(page.getByTestId('sheet-node')).toHaveCount(1)
})

// E2E-06: Toggling edge kind filter removes those edges from graph
test('E2E-06: toggling edge filter removes edges from graph', async ({ page }) => {
  await uploadFile(page, 'external-ref.xlsx')
  await waitForNodes(page)

  // Capture edge count before toggle (external edges visible by default)
  const edgesBefore = await page.locator('.react-flow__edge').count()
  expect(edgesBefore).toBeGreaterThan(0)

  // Toggle external edges off
  await page.getByTestId('edge-filter-external').click()

  // After toggle, edge count should decrease (React Flow removes edge elements from DOM)
  // Use not.toHaveCount — Playwright retries until assertion passes
  await expect(page.locator('.react-flow__edge')).not.toHaveCount(edgesBefore)

  // Toggle back on — edges should be restored
  await page.getByTestId('edge-filter-external').click()

  // Edge count should return to the original count
  await expect(page.locator('.react-flow__edge')).toHaveCount(edgesBefore)
})

// E2E-07: Eye icon hides file's nodes from graph
test('E2E-07: clicking eye icon hides file nodes from graph', async ({ page }) => {
  await uploadFile(page, 'external-ref.xlsx')
  await waitForNodes(page)

  const nodesBefore = await page.getByTestId('sheet-node').count()
  expect(nodesBefore).toBeGreaterThan(0)

  // Eye button is opacity-0 group-hover:opacity-100 — hover the file row first
  const fileRow = page.getByTestId('file-list-item').first()
  await fileRow.hover()
  await fileRow.getByTestId('eye-toggle').click()

  // After hiding, nodes from that file should be gone
  // external-ref.xlsx is the only uploaded file, so 0 nodes expected
  await expect(page.getByTestId('sheet-node')).toHaveCount(0)
})

// E2E-08: Eye icon re-show restores hidden nodes
test('E2E-08: clicking eye icon again restores hidden nodes', async ({ page }) => {
  await uploadFile(page, 'external-ref.xlsx')
  await waitForNodes(page)

  const nodesBefore = await page.getByTestId('sheet-node').count()

  // Hide
  const fileRow = page.getByTestId('file-list-item').first()
  await fileRow.hover()
  await fileRow.getByTestId('eye-toggle').click()
  await expect(page.getByTestId('sheet-node')).toHaveCount(0)

  // Re-show (hover again before clicking toggle)
  await fileRow.hover()
  await fileRow.getByTestId('eye-toggle').click()

  // Nodes should return to original count
  await expect(page.getByTestId('sheet-node')).toHaveCount(nodesBefore)
})

// E2E-09: Focus mode activates when clicking Focus button in detail panel
test('E2E-09: clicking Focus activates focus mode panel', async ({ page }) => {
  await uploadFile(page, 'external-ref.xlsx')
  await waitForNodes(page)

  // Click first sheet node (may need force: true for RF canvas overlay)
  const firstNode = page.getByTestId('sheet-node').first()
  await firstNode.click({ force: true })

  // Wait for detail panel to appear
  await waitForDetailPanel(page)

  // Click Focus button in detail panel
  // The button text is 'Focus' (or 'Focused' if already focused)
  await page.getByRole('button', { name: 'Focus' }).click()

  // Focus panel should appear (data-testid="focus-panel")
  await expect(page.getByTestId('focus-panel')).toBeVisible()
})

// E2E-10: Reorganize button is visible and triggers layout reflow
test('E2E-10: Reorganize button triggers graph layout reflow', async ({ page }) => {
  // Use wide.xlsx (10 sheets) so there are parallel same-rank nodes whose order
  // the seed-based shuffle will change, producing measurable position deltas.
  await uploadFile(page, 'wide.xlsx')
  await waitForNodes(page)

  // Reorganize button must be present in the toolbar
  const reorganizeBtn = page.getByTestId('reorganize')
  await expect(reorganizeBtn).toBeVisible()

  // Capture node count before reorganize
  const nodesBeforeCount = await page.getByTestId('sheet-node').count()
  expect(nodesBeforeCount).toBeGreaterThan(0)

  // Capture graph-space positions by parsing the `transform: translate(x, y)` style
  // on the ReactFlow node wrappers (.react-flow__node). These are graph-space coordinates
  // that are not affected by fitView()'s viewport pan/zoom changes.
  const getGraphPositions = () =>
    page.$$eval('.react-flow__node[data-id]', (wrappers: Element[]) =>
      wrappers.map(el => {
        const style = (el as HTMLElement).style.transform
        const m = style.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/)
        return m ? { id: el.getAttribute('data-id')!, x: parseFloat(m[1]), y: parseFloat(m[2]) } : null
      }).filter(Boolean) as { id: string; x: number; y: number }[]
    )

  const positionsBefore = await getGraphPositions()
  expect(positionsBefore.length).toBe(nodesBeforeCount)

  // Click Reorganize — should not throw and graph should still show same number of nodes
  await reorganizeBtn.click()

  // Poll until at least one node moves in graph space. Using expect.poll avoids a
  // fixed waitForTimeout and is robust against fitView() changing screen coordinates.
  const epsilon = 1
  await expect.poll(async () => {
    const positionsAfter = await getGraphPositions()
    return positionsBefore.some(before => {
      const after = positionsAfter.find(p => p.id === before.id)
      if (!after) return false
      return Math.abs(before.x - after.x) > epsilon || Math.abs(before.y - after.y) > epsilon
    })
  }, { timeout: 3000 }).toBe(true)

  // Nodes should still be present after reorganize (no nodes lost)
  await expect(page.getByTestId('sheet-node')).toHaveCount(nodesBeforeCount)
})
