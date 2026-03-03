export interface SheetReference {
  targetWorkbook: string | null; // null = same workbook
  targetSheet: string;
  cells: string[];
  formula: string;
  sourceCell: string;
  namedRangeName?: string; // set when this ref was detected via a named range
  tableName?: string;      // set when this ref was detected via an Excel table
}

export interface NamedRange {
  name: string;
  ref: string;           // raw Ref string from workbook, e.g. "Sheet1!A1:B10"
  targetSheet: string;
  targetWorkbook: string | null;
  cells: string;         // cell/range portion, e.g. "A1:B10"
  scope: 'workbook' | 'sheet';
  scopeSheet?: string;   // sheet name when scope is 'sheet'
}

export interface ExcelTable {
  name: string;         // displayName if available, else name
  ref: string;          // raw range, e.g. "A1:D10"
  targetSheet: string;  // sheet where table is defined
  cells: string;        // same as ref (the cell range)
  columns?: string[];   // column header names extracted from table metadata
}

// ── Formula reference error taxonomy ─────────────────────────────────────────

export type FormulaRefErrorKind =
  | 'MISSING_TABLE'
  | 'MISSING_COLUMN'
  | 'AMBIGUOUS_NAME'
  | 'CIRCULAR_DEP'
  | 'INVALID_REF';

export interface FormulaRefError {
  kind: FormulaRefErrorKind;
  message: string;    // user-friendly description
  detail?: string;    // structured internal detail
  formula?: string;   // the formula containing the bad reference
  ref?: string;       // the specific reference token that failed
}

// ── Structured reference types ────────────────────────────────────────────────

/** Kind of structured reference found in a formula */
export type StructuredRefKind = 'table-column' | 'relative' | 'query-result';

/**
 * A parsed structured reference extracted from an Excel formula.
 * Examples:
 *   - TableName[ColumnName]  → kind: 'table-column'
 *   - QueryName.Result[Col]  → kind: 'query-result'
 *   - [@ColumnName]          → kind: 'relative'
 */
export interface StructuredRef {
  kind: StructuredRefKind;
  tableName: string;    // table or query name (empty string for relative refs)
  columnName?: string;  // column name if specified
  rawRef: string;       // the exact text matched in the formula
}

export interface ParsedSheet {
  workbookName: string;
  sheetName: string;
  references: SheetReference[];
  workload: SheetWorkload;
}

export interface WorkbookFile {
  id: string;
  name: string;
  sheets: ParsedSheet[];
  namedRanges: NamedRange[];
  tables: ExcelTable[];
}

export interface SheetWorkload {
  totalFormulas: number;
  withinSheetRefs: number;
  crossSheetRefs: number;
  crossFileRefs: number;
}

export interface EdgeReference {
  sourceCell: string;
  targetCells: string[];
  formula: string;
}
