export interface SheetReference {
  targetWorkbook: string | null; // null = same workbook
  targetSheet: string;
  cells: string[];
  formula: string;
  sourceCell: string;
  namedRangeName?: string;  // set when this ref was detected via a named range
  tableName?: string;       // set when this ref was detected via an Excel table
  columnName?: string;      // column referenced in a structured ref (TableName[Column])
  isRelativeRef?: boolean;  // true for [@ColumnName] implicit current-row references
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
  columns?: string[];   // column names extracted from table definition (if available)
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

// ── Formula reference resolver types ─────────────────────────────────────────

export type ResolverErrorKind =
  | 'missing-table'
  | 'missing-column'
  | 'ambiguous-name'
  | 'circular-dependency';

export interface ResolverError {
  kind: ResolverErrorKind;
  message: string;
  tableName?: string;
  columnName?: string;
  sourceCell?: string;
  formula?: string;
}
