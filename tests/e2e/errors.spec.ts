import { test, expect } from '@playwright/test'
import { uploadFile, waitForNodes } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// E2E-13: Uploading a .txt file shows error message
test('E2E-13: uploading a .txt file shows error message without crash', async ({ page }) => {
  await uploadFile(page, 'not-excel.txt')

  // Error is conditionally rendered — wait for it to appear
  const error = page.getByTestId('upload-error')
  await error.waitFor({ state: 'visible' })

  // Error message should mention Excel files
  await expect(error).toContainText('Excel')

  // App did not crash — file input is still in the DOM
  await expect(page.locator('input[type="file"]')).toBeAttached()
})

// E2E-14: Uploading a corrupt .xlsx file shows error message
test('E2E-14: uploading corrupt .xlsx shows error message', async ({ page }) => {
  await uploadFile(page, 'malformed.xlsx')

  // Error message should appear
  const error = page.getByTestId('upload-error')
  await error.waitFor({ state: 'visible' })
  await expect(error).toBeVisible()
})

// E2E-15: App remains usable after a failed upload
test('E2E-15: app remains usable after failed upload', async ({ page }) => {
  // Upload a valid file first
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Verify good file is visible
  await expect(
    page.getByTestId('file-list-item').filter({ hasText: 'cross-sheet.xlsx' })
  ).toBeVisible()

  // Now upload a corrupt file — this should show an error but NOT remove the good file
  await uploadFile(page, 'malformed.xlsx')

  // Wait for error to appear
  await page.getByTestId('upload-error').waitFor({ state: 'visible' })

  // Good file's nodes should still be visible in the graph
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()

  // Good file should still be in the sidebar
  await expect(
    page.getByTestId('file-list-item').filter({ hasText: 'cross-sheet.xlsx' })
  ).toBeVisible()
})
