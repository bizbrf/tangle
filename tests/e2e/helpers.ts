import type { Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Resolve absolute path to a fixture file by filename */
export function fixturePath(filename: string): string {
  return path.resolve(__dirname, '../fixtures', filename)
}

/** Upload a single fixture file via the hidden file input */
export async function uploadFile(page: Page, filename: string): Promise<void> {
  const input = page.locator('input[type="file"]')
  await input.setInputFiles(fixturePath(filename))
}

/** Upload multiple fixture files simultaneously via the hidden file input */
export async function uploadFiles(page: Page, filenames: string[]): Promise<void> {
  const input = page.locator('input[type="file"]')
  await input.setInputFiles(filenames.map(fixturePath))
}

/** Wait for at least one sheet-node to be visible in the graph */
export async function waitForNodes(page: Page): Promise<void> {
  await page.getByTestId('sheet-node').first().waitFor({ state: 'visible', timeout: 10000 })
}

/** Wait for the detail panel to appear (it is conditionally rendered — null when nothing selected) */
export async function waitForDetailPanel(page: Page): Promise<void> {
  await page.getByTestId('detail-panel').waitFor({ state: 'visible', timeout: 5000 })
}

/** Wait for layout to stabilize after a change (deterministic wait) */
export async function waitForLayout(page: Page): Promise<void> {
  // Wait for React Flow to finish layout calculations
  await page.waitForTimeout(500)
}

/** Wait for graph to render and stabilize */
export async function waitForGraphStable(page: Page): Promise<void> {
  await waitForNodes(page)
  await waitForLayout(page)
}

/** Get the current count of visible nodes */
export async function getNodeCount(page: Page): Promise<number> {
  return await page.getByTestId('sheet-node').count()
}

/** Get the current count of visible edges */
export async function getEdgeCount(page: Page): Promise<number> {
  return await page.locator('.react-flow__edge').count()
}

/** Wait for error message to appear */
export async function waitForError(page: Page): Promise<void> {
  await page.getByTestId('upload-error').waitFor({ state: 'visible', timeout: 5000 })
}
