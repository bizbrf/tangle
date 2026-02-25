export interface SheetReference {
  targetWorkbook: string | null; // null = same workbook
  targetSheet: string;
  cells: string[];
  formula: string;
  sourceCell: string;
  namedRangeName?: string; // set when this ref was detected via a named range
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
