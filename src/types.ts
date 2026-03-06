export interface SheetReference {
  targetWorkbook: string | null; // null = same workbook
  targetSheet: string;
  cells: string[];
  formula: string;
  sourceCell: string;
  namedRangeName?: string; // set when this ref was detected via a named range
  tableName?: string;      // set when this ref was detected via an Excel table
  is3DRef?: boolean;       // true when ref spans multiple sheets (e.g. Sheet1:Sheet3!A1)
  sheetRangeEnd?: string;  // end sheet name for 3D refs
  isSpill?: boolean;       // true when ref uses spill operator (#)
  structuredRef?: StructuredRef; // parsed structured table reference details
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
export type StructuredRefKind = 'table-column' | 'relative' | 'query-result' | 'headers' | 'all' | 'totals' | 'this-row' | 'data';

/**
 * A parsed structured reference extracted from an Excel formula.
 * Examples:
 *   - TableName[ColumnName]        → kind: 'table-column'
 *   - QueryName.Result[Col]        → kind: 'query-result'
 *   - [@ColumnName]                → kind: 'relative'
 *   - TableName[[#Headers],[Col]]  → kind: 'headers'
 *   - TableName[[#All]]            → kind: 'all'
 *   - TableName[[#Totals]]         → kind: 'totals'
 *   - TableName[[#This Row],[Col]] → kind: 'this-row'
 *   - TableName[[#Data]]           → kind: 'data'
 */
export interface StructuredRef {
  kind: StructuredRefKind;
  tableName: string;    // table or query name (empty string for relative refs)
  columnName?: string;  // column name if specified
  specifier?: string;   // e.g. '#Headers', '#All', '#Totals', '#This Row', '#Data'
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
  /** Canonical internal identifier (collision-resolved, OS-safe). Equals `storageName` after import. Used for graph IDs and hide/highlight state. */
  name: string;
  /** Original filename as provided by the user / OS (used for UI display only). */
  originalName: string;
  /** OS-safe, sanitized storage name derived from `originalName`. Collision-resolved on import. */
  storageName: string;
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
