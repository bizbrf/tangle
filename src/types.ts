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

// ── Workbook parse error taxonomy ─────────────────────────────────────────────

/**
 * Discriminated kind for workbook-level parse failures.
 *
 * | Kind                        | Meaning                                           |
 * |-----------------------------|---------------------------------------------------|
 * | UNSUPPORTED_FILE            | File extension / format is not supported          |
 * | MALFORMED_WORKBOOK          | SheetJS could not decode the file (corrupt/empty) |
 * | FORMULA_PARSE_ERROR         | Formula text could not be scanned for references  |
 * | EXTERNAL_LINK_RESOLVE_ERROR | External-link index entry could not be resolved   |
 * | FILE_READ_ERROR             | FileReader failed to read the raw bytes           |
 */
export type ParseErrorKind =
  | 'UNSUPPORTED_FILE'
  | 'MALFORMED_WORKBOOK'
  | 'FORMULA_PARSE_ERROR'
  | 'EXTERNAL_LINK_RESOLVE_ERROR'
  | 'FILE_READ_ERROR';

/**
 * Structured error thrown by `parseWorkbook`.
 *
 * Extends the built-in `Error` so it can be caught generically while still
 * carrying typed metadata for diagnostics and user-facing messages.
 */
export class ParseError extends Error {
  readonly kind: ParseErrorKind;
  /** Name of the workbook file being parsed when the error occurred. */
  readonly workbook: string;
  /** Sheet name, if the error is scoped to a particular sheet. */
  readonly sheet?: string;
  /** The raw underlying error, if available. */
  readonly cause?: unknown;

  constructor(opts: {
    kind: ParseErrorKind;
    message: string;
    workbook: string;
    sheet?: string;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = 'ParseError';
    this.kind = opts.kind;
    this.workbook = opts.workbook;
    this.sheet = opts.sheet;
    this.cause = opts.cause;
  }
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
