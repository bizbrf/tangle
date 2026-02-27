// File upload helper for E2E tests — implemented in Phase 4
// Stub created here to establish the directory structure

import type { Page } from '@playwright/test'

/**
 * Uploads a fixture file via the hidden <input type="file"> element.
 * Phase 4 will implement this fully once E2E upload tests are written.
 */
export async function uploadFile(page: Page, fixturePath: string): Promise<void> {
  const input = page.locator('input[type="file"]')
  await input.setInputFiles(fixturePath)
}
