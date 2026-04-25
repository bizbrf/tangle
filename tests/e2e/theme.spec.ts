import { test, expect } from '@playwright/test'
import { uploadFile, waitForNodes } from './helpers'

test.describe('Themes', () => {
  test('cycles refined → dense → cinematic via toolbar button', async ({ page }) => {
    await page.goto('/')
    await uploadFile(page, 'cross-sheet.xlsx')
    await waitForNodes(page)

    const cycle = page.getByTestId('theme-cycle')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'refined')
    await expect(cycle).toContainText('Refined')

    await cycle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dense')

    await cycle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'cinematic')

    await cycle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'refined')
  })

  test('Ctrl+\\ hotkey cycles themes', async ({ page, browserName }) => {
    // WebKit dispatches Meta on Mac runners; on Linux CI Control is correct.
    const mod = browserName === 'webkit' ? 'Meta' : 'Control'
    await page.goto('/')
    await uploadFile(page, 'cross-sheet.xlsx')
    await waitForNodes(page)

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'refined')
    await page.keyboard.press(`${mod}+Backslash`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dense')
    await page.keyboard.press(`${mod}+Backslash`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'cinematic')
  })

  test('theme choice persists across reload', async ({ page }) => {
    await page.goto('/')
    await uploadFile(page, 'cross-sheet.xlsx')
    await waitForNodes(page)

    await page.getByTestId('theme-cycle').click()
    await page.getByTestId('theme-cycle').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'cinematic')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'cinematic')
    expect(await page.evaluate(() => localStorage.getItem('tangle.theme'))).toBe('cinematic')
  })

  test('cinematic pulse animation collapses under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await uploadFile(page, 'cross-sheet.xlsx')
    await waitForNodes(page)

    // Switch to cinematic and select a node.
    const cycle = page.getByTestId('theme-cycle')
    await cycle.click()
    await cycle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'cinematic')

    const firstNode = page.getByTestId('sheet-node').first()
    await firstNode.click({ force: true })

    // The pulse rule sets animation-duration to 2.4s; reduced-motion overrides
    // to 0.01ms. Read computed value to confirm.
    const dur = await page.evaluate(() => {
      const el = document.querySelector('.react-flow__node.selected') as HTMLElement | null
      if (!el) return null
      return getComputedStyle(el).animationDuration
    })
    expect(dur).not.toBe('2.4s')
  })
})
