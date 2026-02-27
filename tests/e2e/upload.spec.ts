import { test, expect } from '@playwright/test'
import { uploadFile, uploadFiles, waitForNodes } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// E2E-01: Filename appears in sidebar after upload
test('E2E-01: filename appears in sidebar after upload', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)
  await expect(
    page.getByTestId('file-list-item').filter({ hasText: 'cross-sheet.xlsx' })
  ).toBeVisible()
})

// E2E-02: Uploaded file's sheets are listed in sidebar (FilePanel auto-expands on upload)
test('E2E-02: sheet list appears in sidebar after upload', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  // FilePanel auto-expands on upload — no click needed
  await expect(page.getByTestId('sheet-list-item').first()).toBeVisible()
})

// E2E-03: Graph canvas renders at least one node after upload
test('E2E-03: graph renders at least one node after upload', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()
})

// E2E-04: Multiple files upload and all appear in sidebar and graph
test('E2E-04: multiple files upload and appear in sidebar and graph', async ({ page }) => {
  await uploadFiles(page, ['cross-sheet.xlsx', 'external-ref.xlsx'])
  await waitForNodes(page)
  await expect(page.getByTestId('file-list-item')).toHaveCount(2)
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()
})
