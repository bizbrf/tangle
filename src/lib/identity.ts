/**
 * Domain identity utilities — canonical normalization and ID construction.
 *
 * All key building for workbook names, sheet IDs, and edge IDs flows through
 * these helpers so that normalization rules live in exactly one place.
 */

import { EXCEL_EXT_RE } from './parser';

// ── Normalization ──────────────────────────────────────────────────────────────

/**
 * Normalize a workbook name for fuzzy / case-insensitive matching.
 *
 * - Extracts the filename from Excel bracket notation (e.g. `[FileB.xlsx]` → `FileB.xlsx`).
 * - Strips known Excel extensions (`.xlsx`, `.xls`, `.xlsm`, `.xlsb`).
 * - Lowercases for case-insensitive comparison.
 *
 * @example
 * normalizeWorkbookName('[Budget.xlsx]') // → 'budget'
 * normalizeWorkbookName('Budget.xlsx')   // → 'budget'
 */
export function normalizeWorkbookName(name: string): string {
  let n = name;
  const bracketMatch = n.match(/\[([^\]]+)\]/);
  if (bracketMatch) n = bracketMatch[1];
  return n.replace(EXCEL_EXT_RE, '').toLowerCase();
}

// ── ID factories ───────────────────────────────────────────────────────────────

/**
 * Stable node ID for a sheet inside a workbook.
 *
 * @example
 * makeSheetId('Budget.xlsx', 'Assumptions') // → 'Budget.xlsx::Assumptions'
 */
export function makeSheetId(workbookName: string, sheetName: string): string {
  return `${workbookName}::${sheetName}`;
}

/**
 * Stable node ID for a whole-file node (used in overview / overview-style nodes).
 *
 * @example
 * makeFileId('Budget.xlsx') // → '[file]Budget.xlsx'
 */
export function makeFileId(workbookName: string): string {
  return `[file]${workbookName}`;
}

/**
 * Stable edge ID from a source node ID to a target node ID.
 *
 * @example
 * makeEdgeId('A::Sheet1', 'B::Sheet2') // → 'A::Sheet1->B::Sheet2'
 */
export function makeEdgeId(sourceId: string, targetId: string): string {
  return `${sourceId}->${targetId}`;
}
