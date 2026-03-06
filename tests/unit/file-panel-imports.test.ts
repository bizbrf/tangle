import { describe, expect, it } from 'vitest'
import type { WorkbookFile, SheetWorkload } from '../../src/types'
import { formatDuplicateImportNotice, resolveImportedWorkbooks } from '../../src/components/FilePanel/importUtils'

const zeroWorkload: SheetWorkload = {
  totalFormulas: 0, withinSheetRefs: 0, crossSheetRefs: 0, crossFileRefs: 0,
}

function makeWorkbook(name: string, originalName = name): WorkbookFile {
  return {
    id: `${name}-id`,
    name,
    originalName,
    storageName: name,
    namedRanges: [],
    tables: [],
    sheets: [{
      workbookName: name,
      sheetName: 'Sheet1',
      references: [],
      workload: { ...zeroWorkload },
    }],
  }
}

describe('file import helpers', () => {
  it('keeps duplicate uploads and renames the new copy internally', () => {
    const existing = [makeWorkbook('actuals-2026.xlsx')]
    const parsed = [makeWorkbook('actuals-2026.xlsx')]

    const result = resolveImportedWorkbooks(existing, parsed)

    expect(result.workbooks).toHaveLength(1)
    expect(result.workbooks[0].originalName).toBe('actuals-2026.xlsx')
    expect(result.workbooks[0].name).not.toBe('actuals-2026.xlsx')
    expect(result.workbooks[0].storageName).toBe(result.workbooks[0].name)
    expect(result.duplicateOriginalNames).toEqual(['actuals-2026.xlsx'])
  })

  it('treats selecting the same filename again as a duplicate even with case changes', () => {
    const existing = [makeWorkbook('actuals-2026.xlsx', 'Actuals-2026.xlsx')]
    const parsed = [makeWorkbook('actuals-2026.xlsx', 'actuals-2026.xlsx')]

    const result = resolveImportedWorkbooks(existing, parsed)

    expect(result.duplicateOriginalNames).toEqual(['actuals-2026.xlsx'])
  })

  it('returns a user notice only when duplicates were imported', () => {
    expect(formatDuplicateImportNotice([])).toBeNull()
    expect(formatDuplicateImportNotice(['actuals-2026.xlsx'])).toContain('actuals-2026.xlsx')
    expect(formatDuplicateImportNotice(['a.xlsx', 'b.xlsx'])).toContain('"a.xlsx" and "b.xlsx"')
  })
})
