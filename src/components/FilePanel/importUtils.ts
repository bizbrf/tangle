import type { WorkbookFile } from '../../types'
import { resolveCollision } from '../../lib/filenameSanitizer'

function normalizeImportedName(name: string): string {
  return name.normalize('NFC').toLowerCase()
}

export function resolveImportedWorkbooks(
  existingWorkbooks: WorkbookFile[],
  parsedWorkbooks: WorkbookFile[],
): { workbooks: WorkbookFile[]; duplicateOriginalNames: string[] } {
  const usedStorageNames = new Set(existingWorkbooks.map((wb) => wb.storageName))
  const seenOriginalNames = new Set(existingWorkbooks.map((wb) => normalizeImportedName(wb.originalName)))
  const duplicateOriginalNames = new Set<string>()

  const workbooks = parsedWorkbooks.map((wb) => {
    const normalizedOriginalName = normalizeImportedName(wb.originalName)
    if (seenOriginalNames.has(normalizedOriginalName)) {
      duplicateOriginalNames.add(wb.originalName)
    }

    const unique = resolveCollision(wb.storageName, usedStorageNames, wb.originalName)
    usedStorageNames.add(unique)
    seenOriginalNames.add(normalizedOriginalName)

    return { ...wb, storageName: unique, name: unique }
  })

  return {
    workbooks,
    duplicateOriginalNames: Array.from(duplicateOriginalNames.values()),
  }
}

export function formatDuplicateImportNotice(duplicateOriginalNames: string[]): string | null {
  if (duplicateOriginalNames.length === 0) return null

  if (duplicateOriginalNames.length === 1) {
    return `Added another copy of ${duplicateOriginalNames[0]}. It stays loaded and was renamed internally so both copies can coexist.`
  }

  const quoted = duplicateOriginalNames.map((name) => `"${name}"`)
  const list = quoted.length === 2
    ? quoted.join(' and ')
    : `${quoted.slice(0, -1).join(', ')}, and ${quoted.at(-1)}`

  return `Added duplicate files ${list}. They stay loaded and were renamed internally so each copy can coexist.`
}
