import { test, expect } from '@playwright/test'
import { uploadFile, waitForNodes, waitForDetailPanel } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('graph controls toggle layouts, directions, keyboard shortcuts, and fit view', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  const layoutGraph = page.getByTestId('layout-graph')
  const layoutOverview = page.getByTestId('layout-overview')
  const layoutGrouped = page.getByTestId('layout-grouped')
  const directionTB = page.getByTestId('direction-TB')

  await expect(layoutGraph).toHaveAttribute('aria-pressed', 'true')

  await layoutOverview.click()
  await expect(layoutOverview).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('sheet-node')).toHaveCount(1)

  await page.keyboard.press('KeyG')
  await expect(layoutGraph).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('sheet-node')).toHaveCount(2)

  await layoutGrouped.click()
  await expect(layoutGrouped).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.react-flow__node[data-id^="[cluster]"]')).toHaveCount(1)

  await directionTB.click()
  const nodes = page.getByTestId('sheet-node')
  const firstBox = await nodes.nth(0).boundingBox()
  const secondBox = await nodes.nth(1).boundingBox()
  expect(firstBox && secondBox).toBeTruthy()
  await expect(directionTB).toHaveAttribute('aria-pressed', 'true')
  const tbFirst = await nodes.nth(0).boundingBox()
  const tbSecond = await nodes.nth(1).boundingBox()
  expect(Math.abs((tbFirst!.y - tbSecond!.y))).toBeGreaterThan(Math.abs(tbFirst!.x - tbSecond!.x))

  await page.locator('.react-flow__controls-zoomin').click()
  await page.locator('.react-flow__controls-zoomin').click()
  const transformBefore = await page.locator('.react-flow__viewport').evaluate((el) => (el as HTMLElement).style.transform)
  await page.getByTestId('fit-view').click()
  const transformAfter = await page.locator('.react-flow__viewport').evaluate((el) => (el as HTMLElement).style.transform)
  expect(transformBefore).not.toBe(transformAfter)
})

test('reorganizer reflows layout while keeping pinned nodes fixed', async ({ page }) => {
  await uploadFile(page, 'wide.xlsx')
  await waitForNodes(page)

  const nodes = page.getByTestId('sheet-node')
  const pinned = nodes.nth(0)
  const free = nodes.nth(1)

  await pinned.click({ force: true })
  await waitForDetailPanel(page)
  await page.getByTestId('pin-toggle').click()

  const pinnedBefore = await pinned.boundingBox()
  const freeBefore = await free.boundingBox()

  await page.getByTestId('reorganize-layout').click()
  await page.getByTestId('direction-TB').click()
  await page.waitForTimeout(400)

  const pinnedAfter = await pinned.boundingBox()
  const freeAfter = await free.boundingBox()

  const pinnedDelta = Math.abs(pinnedAfter!.x - pinnedBefore!.x) + Math.abs(pinnedAfter!.y - pinnedBefore!.y)
  const freeDelta = Math.abs(freeAfter!.x - freeBefore!.x) + Math.abs(freeAfter!.y - freeBefore!.y)

  expect(freeDelta).toBeGreaterThan(10)
  expect(pinnedDelta).toBeLessThan(freeDelta)
})

test('layout state persists via URL after reload', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  await page.getByTestId('layout-grouped').click()
  await page.getByTestId('direction-TB').click()

  const urlWithState = page.url()
  await page.reload()

  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  await expect(page.getByTestId('layout-grouped')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('direction-TB')).toHaveAttribute('aria-pressed', 'true')
  expect(page.url()).toContain(new URL(urlWithState).search)
})
