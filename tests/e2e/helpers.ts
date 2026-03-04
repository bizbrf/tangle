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
  await page.getByTestId('sheet-node').first().waitFor({ state: 'visible' })
}

/**
 * Wait for the detail panel to appear.
 * When `clickTarget` is provided the helper retries the click up to 3 times
 * (with a short per-attempt timeout) so that slower browsers like Firefox
 * don't time-out when the initial click doesn't register.
 */
export async function waitForDetailPanel(
  page: Page,
  clickTarget?: import('@playwright/test').Locator,
): Promise<void> {
  const panel = page.getByTestId('detail-panel')

  if (!clickTarget) {
    await panel.waitFor({ state: 'visible' })
    return
  }

  const maxRetries = 3
  for (let i = 0; i < maxRetries; i++) {
    await clickTarget.click({ force: true })
    try {
      await panel.waitFor({ state: 'visible', timeout: 5000 })
      return
    } catch {
      if (i === maxRetries - 1) throw new Error('Detail panel did not appear after retrying node click')
    }
  }
}
