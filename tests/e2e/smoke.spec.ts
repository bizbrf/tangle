import { test, expect } from '@playwright/test'

test('app loads at localhost:5173', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
})

test('app renders the graph panel', async ({ page }) => {
  await page.goto('/')
  // When no files are loaded the graph panel shows the empty state.
  // This confirms React mounted and the right panel rendered correctly.
  await expect(page.getByText('No files loaded')).toBeVisible()
})
