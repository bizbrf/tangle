import { test, expect } from '@playwright/test'
import * as XLSX from 'xlsx'
import { uploadFile, uploadWorkbook, waitForNodes } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('handles unicode, reserved names, and duplicate filename collisions', async ({ page }) => {
  await uploadFile(page, 'cross-sheet.xlsx')
  await waitForNodes(page)
  await expect(page.getByTestId('file-list-item')).toHaveCount(1)

  await page.locator('input[type="file"]').setInputFiles([])
  await uploadFile(page, 'cross-sheet.xlsx')
  await expect(page.getByTestId('upload-error')).toBeVisible()
  await expect(page.getByTestId('upload-error')).toContainText('Skipped duplicate filename')
  await expect(page.getByTestId('file-list-item')).toHaveCount(1)

  const unicodeWb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(unicodeWb, XLSX.utils.aoa_to_sheet([['ok']]), 'Sheet1')
  await uploadWorkbook(page, 'unicodé-测试.xlsx', unicodeWb)
  await waitForNodes(page)
  await expect(page.getByTestId('file-list-item').filter({ hasText: 'unicodé-测试.xlsx' })).toBeVisible()

  const reservedWb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(reservedWb, XLSX.utils.aoa_to_sheet([['ok']]), 'Sheet1')
  await uploadWorkbook(page, 'CON.xlsx', reservedWb)
  await waitForNodes(page)
  await expect(page.getByTestId('file-list-item').filter({ hasText: 'CON-file.xlsx' })).toBeVisible()
})

test('structured references create table nodes and surface formulas', async ({ page }) => {
  const wb = XLSX.utils.book_new()
  const data = XLSX.utils.aoa_to_sheet([
    ['Amount'],
    [100],
  ])
  const dataWithTables = data as XLSX.WorkSheet & { '!tables'?: { name?: string; displayName?: string; ref?: string }[] }
  dataWithTables['!tables'] = [{ name: 'Sales', displayName: 'Sales', ref: 'A1:A2' }]
  const calc = XLSX.utils.aoa_to_sheet([['placeholder']])
  calc['A1'] = { t: 'n', v: 0, f: 'Sales[Amount]' }
  XLSX.utils.book_append_sheet(wb, data, 'Data')
  XLSX.utils.book_append_sheet(wb, calc, 'Calc')

  await uploadWorkbook(page, 'structured.xlsx', wb)
  await waitForNodes(page)

  await page.getByRole('button', { name: 'Tables' }).click()
  const tableNode = page.getByTestId('sheet-node').filter({ hasText: 'Sales' })
  await expect(tableNode).toBeVisible()

  const edge = page.locator('.react-flow__edge').first()
  await edge.click({ force: true })
  await expect(page.getByTestId('detail-panel-title')).toContainText('References')
  await expect(page.getByTestId('detail-panel')).toContainText('Sales[Amount]')
})
