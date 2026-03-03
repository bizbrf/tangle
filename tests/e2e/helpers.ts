import type { Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as XLSX from 'xlsx'

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

/** Upload an in-memory workbook with a custom filename */
export async function uploadWorkbook(page: Page, name: string, workbook: XLSX.WorkBook): Promise<void> {
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const input = page.locator('input[type="file"]')
  await input.setInputFiles({
    name,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  })
}

/** Wait for at least one sheet-node to be visible in the graph */
export async function waitForNodes(page: Page): Promise<void> {
  await page.getByTestId('sheet-node').first().waitFor({ state: 'visible' })
}

/** Wait for the detail panel to appear (it is conditionally rendered — null when nothing selected) */
export async function waitForDetailPanel(page: Page): Promise<void> {
  await page.getByTestId('detail-panel').waitFor({ state: 'visible' })
}
