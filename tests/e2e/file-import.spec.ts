import { test, expect } from '@playwright/test'
import { uploadFile, uploadFiles, waitForNodes } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// E2E-27: Unicode filename (财务数据.xlsx) appears in sidebar after upload
test('E2E-27: unicode filename appears in sidebar after upload', async ({ page }) => {
  await uploadFile(page, '财务数据.xlsx')
  await waitForNodes(page)

  // The filename should appear in the file list
  await expect(
    page.getByTestId('file-list-item').filter({ hasText: '财务数据' })
  ).toBeVisible()
})

// E2E-28: Unicode filename fixture renders graph nodes
test('E2E-28: unicode filename fixture renders graph nodes', async ({ page }) => {
  await uploadFile(page, '财务数据.xlsx')
  await waitForNodes(page)

  // At least one node should be visible
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()
})

// E2E-29: Uploading the same file twice adds two entries (collision)
test('E2E-29: uploading the same file twice adds two sidebar entries', async ({ page }) => {
  await uploadFiles(page, ['cross-sheet.xlsx', 'cross-sheet.xlsx'])
  await waitForNodes(page)

  // Both entries should appear (the app appends without deduplication)
  const items = page.getByTestId('file-list-item').filter({ hasText: 'cross-sheet.xlsx' })
  await expect(items).toHaveCount(2)
})

// E2E-30: Removing one duplicate still leaves the other in the sidebar
test('E2E-30: removing one duplicate leaves the other intact', async ({ page }) => {
  await uploadFiles(page, ['cross-sheet.xlsx', 'cross-sheet.xlsx'])
  await waitForNodes(page)

  // Hover the first file row to reveal the close button
  const firstRow = page.getByTestId('file-list-item').filter({ hasText: 'cross-sheet.xlsx' }).first()
  await firstRow.hover()

  // Click the close (×) button — it is the last button in the action group
  // The close button has no testid; target it as the last button in the row
  const closeBtn = firstRow.locator('button').last()
  await closeBtn.click()

  // One entry should remain
  await expect(
    page.getByTestId('file-list-item').filter({ hasText: 'cross-sheet.xlsx' })
  ).toHaveCount(1)
})

// E2E-31: Structured-ref fixture uploads without error
test('E2E-31: structured-ref fixture uploads without error', async ({ page }) => {
  await uploadFile(page, 'structured-ref.xlsx')
  await waitForNodes(page)

  // No error shown
  await expect(page.getByTestId('upload-error')).not.toBeVisible()

  // Filename in sidebar
  await expect(
    page.getByTestId('file-list-item').filter({ hasText: 'structured-ref' })
  ).toBeVisible()
})

// E2E-32: Empty workbook uploads without error and shows filename
test('E2E-32: empty workbook uploads without error', async ({ page }) => {
  await uploadFile(page, 'empty.xlsx')

  // Empty workbook may not render nodes (0 cross-sheet refs), but no error should appear
  await expect(page.getByTestId('upload-error')).not.toBeVisible()

  // Filename should appear in sidebar
  await expect(
    page.getByTestId('file-list-item').filter({ hasText: 'empty.xlsx' })
  ).toBeVisible()
})

// E2E-33: Circular reference fixture uploads without crashing
test('E2E-33: circular reference fixture uploads without crash', async ({ page }) => {
  await uploadFile(page, 'circular.xlsx')
  await waitForNodes(page)

  // App should not crash — nodes should still render
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()
  await expect(page.getByTestId('upload-error')).not.toBeVisible()
})

// E2E-34: Hub-and-spoke uploads and renders external reference nodes
test('E2E-34: hub-and-spoke renders external reference nodes', async ({ page }) => {
  await uploadFile(page, 'hub-and-spoke.xlsx')
  await waitForNodes(page)

  // hub-and-spoke has 5 external file refs — should render multiple nodes
  const count = await page.getByTestId('sheet-node').count()
  expect(count).toBeGreaterThan(1)
})

// E2E-35: Non-Excel file shows error and upload input remains available
test('E2E-35: non-excel file shows error, input still available', async ({ page }) => {
  await uploadFile(page, 'not-excel.txt')

  const error = page.getByTestId('upload-error')
  await error.waitFor({ state: 'visible' })
  await expect(error).toContainText('Excel')

  // File input still present — app not crashed
  await expect(page.locator('input[type="file"]')).toBeAttached()
})
