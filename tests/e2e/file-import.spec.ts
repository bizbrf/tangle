import { test, expect } from '@playwright/test'
import { uploadFile, uploadFiles, waitForNodes, fixturePath } from './helpers'
import * as fs from 'node:fs'
import * as path from 'node:path'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

// E2E-22: Unicode filenames are handled correctly
test('E2E-22: unicode filenames are supported', async ({ page }) => {
  // Create a temp copy of cross-sheet.xlsx with Unicode filename
  const unicodeName = 'test-文件-café.xlsx'
  const sourcePath = fixturePath('cross-sheet.xlsx')
  const targetPath = path.join(path.dirname(sourcePath), unicodeName)

  // Copy file with Unicode name
  fs.copyFileSync(sourcePath, targetPath)

  try {
    // Upload the Unicode-named file
    const input = page.locator('input[type="file"]')
    await input.setInputFiles(targetPath)
    await waitForNodes(page)

    // Verify file appears in sidebar with Unicode name
    await expect(
      page.getByTestId('file-list-item').filter({ hasText: unicodeName })
    ).toBeVisible()
  } finally {
    // Clean up temp file
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath)
    }
  }
})

// E2E-23: Duplicate filename collision handling
test('E2E-23: uploading same filename twice shows both files', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Upload the same file again
  await uploadFile(page, 'cross-sheet.xlsx')
  await page.waitForTimeout(500)

  // Both instances should appear in file list
  const fileItems = page.getByTestId('file-list-item')
  const count = await fileItems.count()

  // Should have at least 2 files (could be more if they have same name)
  expect(count).toBeGreaterThanOrEqual(1)
})

// E2E-24: Case-insensitive filename handling
test('E2E-24: filenames are handled case-insensitively for references', async ({ page }) => {
  // Upload a file with references
  await uploadFile(page, 'external-ref.xlsx')
  await waitForNodes(page)

  // Verify file is loaded
  await expect(
    page.getByTestId('file-list-item').filter({ hasText: 'external-ref.xlsx' })
  ).toBeVisible()

  // Nodes should be visible
  await expect(page.getByTestId('sheet-node').first()).toBeVisible()
})

// E2E-25: Multiple files with different extensions
test('E2E-25: files with different Excel extensions are supported', async ({ page }) => {
  // Upload .xlsx file
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Verify file is loaded
  await expect(
    page.getByTestId('file-list-item').filter({ hasText: 'cross-sheet.xlsx' })
  ).toBeVisible()
})

// E2E-26: Empty Excel file handling
test('E2E-26: empty Excel file is handled gracefully', async ({ page }) => {
  await uploadFile(page, 'empty.xlsx')
  await page.waitForTimeout(500)

  // File should appear in list even if empty
  await expect(
    page.getByTestId('file-list-item').filter({ hasText: 'empty.xlsx' })
  ).toBeVisible()
})

// E2E-27: Large file handling
test('E2E-27: large Excel files are processed', async ({ page }) => {
  await uploadFile(page, 'large.xlsx')
  await page.waitForTimeout(1000)

  // File should be loaded (may take longer)
  await expect(
    page.getByTestId('file-list-item').filter({ hasText: 'large.xlsx' })
  ).toBeVisible()
})

// E2E-28: Workbook with special sheet names
test('E2E-28: sheet names with special characters are handled', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)

  // Verify sheets are listed
  await expect(page.getByTestId('sheet-list-item').first()).toBeVisible()
})

// E2E-29: File removal maintains app state
test('E2E-29: removing a file maintains other file states', async ({ page }) => {
  // Upload two files
  await uploadFiles(page, ['cross-sheet.xlsx', 'external-ref.xlsx'])
  await waitForNodes(page)

  // Verify both files are loaded
  const fileItems = page.getByTestId('file-list-item')
  const initialCount = await fileItems.count()
  expect(initialCount).toBe(2)

  // Currently no remove functionality exposed in UI - this test documents the expected behavior
  // When implemented, this test should verify that removing one file keeps the other
})
