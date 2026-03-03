import * as XLSX from 'xlsx';
import type { WorkbookFile, ParsedSheet, SheetReference, SheetWorkload, NamedRange, ExcelTable, ResolverError } from '../types';

// ── Supported Excel file types ───────────────────────────────────────────────
export const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.xlsb'];
export const EXCEL_EXT_RE = /\.(xlsx|xls|xlsm|xlsb)$/i;

// Cell-ref portion supports: A1, $A$1, A1:B2, $A$1:$B$2, A:A, 1:10
const CELL_RE = '(?:\\$?[A-Z]+\\$?\\d+(?::\\$?[A-Z]+\\$?\\d+)?|\\$?[A-Z]+:\\$?[A-Z]+|\\$?\\d+:\\$?\\d+)';
// Unquoted sheet names: start with letter, digit, or underscore, continue with word chars, dots, spaces
const UNQUOTED_SHEET = '[A-Za-z0-9_\\u00C0-\\u024F][\\w. ]*';
// Full reference regex with cell capture
const REF_WITH_CELL_RE = new RegExp(
  `(?:'(?:\\[([^\\]]+)\\])?([^']+)'|(?:\\[([^\\]]+)\\])?(${UNQUOTED_SHEET}))!(${CELL_RE})`,
  'g',
);

// ── External link resolution ────────────────────────────────────────────────

// Excel stores external references as [1], [2], etc. — numeric indices that map
// to externalLink1.xml, externalLink2.xml, etc. inside the xlsx zip.
// The .rels file for each link contains the actual filename.
// File entry from SheetJS bookFiles — could be a raw buffer, a string, or an
// object with a `.content` property (CFB container entry).
interface CfbEntry { content: ArrayBuffer | Uint8Array; [k: string]: unknown }

function readFileEntry(entry: unknown): string | null {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  if (entry instanceof Uint8Array || entry instanceof ArrayBuffer) {
    return new TextDecoder().decode(entry);
  }
  // CFB-style object with .content
  const obj = entry as CfbEntry;
  if (obj.content) {
    if (typeof obj.content === 'string') return obj.content;
    if (obj.content instanceof Uint8Array || obj.content instanceof ArrayBuffer) {
      return new TextDecoder().decode(obj.content);
    }
    // Node Buffer (extends Uint8Array but may not pass instanceof in all contexts)
    if (typeof (obj.content as { toString?: (enc: string) => string }).toString === 'function') {
      return (obj.content as { toString: (enc: string) => string }).toString('utf8');
    }
  }
  return null;
}

export function buildExternalLinkMap(wb: XLSX.WorkBook): Map<string, string> {
  const map = new Map<string, string>(); // "1" → "Assumptions.xlsx"
  const files = (wb as unknown as Record<string, unknown>).files as Record<string, unknown> | undefined;
  if (!files) return map;

  for (let i = 1; i <= 20; i++) {
    const relsPath = `xl/externalLinks/_rels/externalLink${i}.xml.rels`;
    const xml = readFileEntry(files[relsPath]);
    if (!xml) break;

    // Extract Target="..." from Relationship elements
    const targets: string[] = [];
    const relRe = /Target="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = relRe.exec(xml)) !== null) {
      targets.push(m[1]);
    }

    // Pick the shortest/simplest target (relative filename) or fall back to first
    let filename: string | null = null;
    for (const t of targets) {
      const clean = t.replace(/\\/g, '/');
      const basename = clean.split('/').pop() ?? clean;
      if (!filename || (!t.startsWith('file:') && basename.length > 0)) {
        filename = basename;
      }
    }

    if (filename) {
      map.set(String(i), filename);
    }
  }

  return map;
}

// ── Named range extraction ───────────────────────────────────────────────────

export function extractNamedRanges(wb: XLSX.WorkBook): NamedRange[] {
  const names = (wb.Workbook?.Names ?? []) as Array<{
    Name?: string;
    Ref?: string;
    Sheet?: number;
  }>;
  const ranges: NamedRange[] = [];

  for (const entry of names) {
    if (!entry.Name || !entry.Ref) continue;
    // Skip Excel built-in names like _xlnm.Print_Area
    if (entry.Name.startsWith('_xlnm.') || entry.Name.startsWith('_xlnm\\')) continue;

    const ref = entry.Ref;
    // Parse the ref: could be "Sheet1!A1:B10" or "'Sheet Name'!C3" or just "A1:B10"
    let targetSheet = '';
    let cells = ref;

    const bangIdx = ref.indexOf('!');
    if (bangIdx !== -1) {
      let sheetPart = ref.slice(0, bangIdx);
      cells = ref.slice(bangIdx + 1);
      // Strip surrounding quotes from sheet name
      if (sheetPart.startsWith("'") && sheetPart.endsWith("'")) {
        sheetPart = sheetPart.slice(1, -1);
      }
      targetSheet = sheetPart;
    }

    const scope: 'workbook' | 'sheet' = entry.Sheet != null ? 'sheet' : 'workbook';
    const scopeSheet = entry.Sheet != null ? (wb.SheetNames[entry.Sheet] ?? undefined) : undefined;

    ranges.push({
      name: entry.Name,
      ref,
      targetSheet,
      targetWorkbook: null, // named ranges are local to the workbook
      cells,
      scope,
      scopeSheet,
    });
  }

  return ranges;
}

// ── Excel table extraction ───────────────────────────────────────────────────

export function extractTables(wb: XLSX.WorkBook): ExcelTable[] {
  const tables: ExcelTable[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName] as Record<string, unknown>;
    if (!ws) continue;
    const rawTables = ws['!tables'];
    if (!Array.isArray(rawTables)) continue;
    for (const entry of rawTables as {
      name?: string;
      displayName?: string;
      ref?: string;
      columns?: { name?: string }[];
    }[]) {
      if (!entry.ref) continue;
      const name = entry.displayName ?? entry.name ?? 'Table';
      const rawCols = entry.columns ?? [];
      const columns = rawCols.filter((c) => c.name).map((c) => c.name!);
      tables.push({
        name,
        ref: entry.ref,
        targetSheet: sheetName,
        cells: entry.ref,
        ...(columns.length > 0 && { columns }),
      });
    }
  }
  return tables;
}

// ── Reference extraction ────────────────────────────────────────────────────

export function extractReferences(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  workbookName: string,
  linkMap: Map<string, string>,
  namedRangeMap: Map<string, NamedRange>,
  tableMap: Map<string, ExcelTable> = new Map(),
): { references: SheetReference[]; workload: SheetWorkload } {
  const refs: SheetReference[] = [];
  const workload: SheetWorkload = { totalFormulas: 0, withinSheetRefs: 0, crossSheetRefs: 0, crossFileRefs: 0 };
  if (!sheet) return { references: refs, workload };

  const selfSheet = sheetName.toLowerCase();
  const selfWb = workbookName.toLowerCase().replace(EXCEL_EXT_RE, '');

  // Build a single combined regex for all named range names: \b(Name1|Name2|...)\b(?!\()
  // The (?!\() avoids matching function calls like SUM()
  let namedRangeRe: RegExp | null = null;
  if (namedRangeMap.size > 0) {
    const escaped = Array.from(namedRangeMap.values()).map((nr) =>
      nr.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    namedRangeRe = new RegExp(`\\b(${escaped.join('|')})\\b(?!\\()`, 'gi');
  }

  // Build a regex for Excel table names.
  // Matches:
  //   TableName[ColumnSpec]  — structured ref (group 1 = name, group 2 = column spec)
  //   TableName\b            — bare table reference not followed by ( (group 1 = name, group 2 = undefined)
  // Handles dot-notation names (e.g. QueryName.Result) automatically via escaped name.
  let tableRe: RegExp | null = null;
  if (tableMap.size > 0) {
    const escaped = Array.from(tableMap.values()).map((t) =>
      t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    tableRe = new RegExp(
      `\\b(${escaped.join('|')})(?:\\[([^\\]@#]+)\\]|\\b(?!\\())`,
      'gi',
    );
  }

  for (const [cellAddr, cell] of Object.entries(sheet)) {
    if (cellAddr.startsWith('!') || !cell || typeof cell !== 'object') continue;
    const formula: string | undefined = (cell as XLSX.CellObject).f;
    if (!formula) continue;

    workload.totalFormulas++;

    REF_WITH_CELL_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    // Group matches per (workbook, sheet) pair within this formula
    const byTarget = new Map<string, SheetReference>();

    while ((match = REF_WITH_CELL_RE.exec(formula)) !== null) {
      const [, wbQuoted, sheetQuoted, wbUnquoted, sheetUnquoted, cellRange] = match;
      let targetWorkbook = wbQuoted ?? wbUnquoted ?? null;
      const targetSheet = sheetQuoted ?? sheetUnquoted;

      if (!targetSheet) continue;

      // Resolve numeric external link indices: [1] → actual filename
      if (targetWorkbook && linkMap.has(targetWorkbook)) {
        targetWorkbook = linkMap.get(targetWorkbook)!;
      }

      // Skip self-sheet references (case-insensitive), but count them
      const tgtSheet = targetSheet.toLowerCase();
      if (!targetWorkbook && tgtSheet === selfSheet) {
        workload.withinSheetRefs++;
        continue;
      }
      if (targetWorkbook) {
        const tgtWb = targetWorkbook.toLowerCase().replace(EXCEL_EXT_RE, '');
        if (tgtWb === selfWb && tgtSheet === selfSheet) {
          workload.withinSheetRefs++;
          continue;
        }
      }

      const key = `${targetWorkbook ?? ''}|${targetSheet}`;
      if (!byTarget.has(key)) {
        byTarget.set(key, {
          targetWorkbook,
          targetSheet,
          cells: [],
          formula,
          sourceCell: cellAddr,
        });
      }
      byTarget.get(key)!.cells.push(cellRange);
    }

    // Second pass: detect named range references in this formula
    if (namedRangeRe) {
      namedRangeRe.lastIndex = 0;
      let nrMatch: RegExpExecArray | null;
      while ((nrMatch = namedRangeRe.exec(formula)) !== null) {
        const matchedName = nrMatch[0];
        const nr = namedRangeMap.get(matchedName.toLowerCase());
        if (!nr) continue;
        // Skip if the named range targets the same sheet (within-sheet ref)
        if (!nr.targetWorkbook && nr.targetSheet.toLowerCase() === selfSheet) {
          workload.withinSheetRefs++;
          continue;
        }
        const key = `NR|${nr.name}|${nr.targetWorkbook ?? ''}|${nr.targetSheet}`;
        if (!byTarget.has(key)) {
          byTarget.set(key, {
            targetWorkbook: nr.targetWorkbook,
            targetSheet: nr.targetSheet,
            cells: [nr.cells],
            formula,
            sourceCell: cellAddr,
            namedRangeName: nr.name,
          });
        }
      }
    }

    // Third pass: detect Excel table structured references in this formula
    if (tableRe) {
      tableRe.lastIndex = 0;
      let tMatch: RegExpExecArray | null;
      while ((tMatch = tableRe.exec(formula)) !== null) {
        const matchedName = tMatch[1];
        const columnSpec = tMatch[2]?.trim(); // undefined for bare table refs
        const table = tableMap.get(matchedName.toLowerCase());
        if (!table) continue;
        // Tables are local to the workbook; skip if same sheet as source
        if (table.targetSheet.toLowerCase() === selfSheet) {
          workload.withinSheetRefs++;
          continue;
        }
        const key = `TBL|${table.name}|${table.targetSheet}`;
        if (!byTarget.has(key)) {
          byTarget.set(key, {
            targetWorkbook: null,
            targetSheet: table.targetSheet,
            cells: [table.cells],
            formula,
            sourceCell: cellAddr,
            tableName: table.name,
            ...(columnSpec !== undefined && columnSpec !== '' && { columnName: columnSpec }),
          });
        }
      }
    }

    // Fourth pass: detect implicit [@ColumnName] relative row references.
    // These always refer to the current row of the enclosing table — always within-sheet.
    {
      const relRowRe = /\[@([^\]]+)\]/g;
      while (relRowRe.exec(formula) !== null) {
        workload.withinSheetRefs++;
      }
    }

    for (const ref of byTarget.values()) {
      if (ref.targetWorkbook) {
        workload.crossFileRefs++;
      } else {
        workload.crossSheetRefs++;
      }
      refs.push(ref);
    }
  }

  return { references: refs, workload };
}

// ── Structured reference resolver ────────────────────────────────────────────

/**
 * Build a map of lowercase table name → set of lowercase column names.
 * Used with resolveStructuredRefs() to detect missing column references.
 */
export function buildColumnsByTable(tables: ExcelTable[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const t of tables) {
    if (t.columns && t.columns.length > 0) {
      map.set(t.name.toLowerCase(), new Set(t.columns.map((c) => c.toLowerCase())));
    }
  }
  return map;
}

/**
 * Validate structured references in a formula against the provided tableMap.
 * Returns an array of ResolverError for any missing tables, missing columns, or
 * ambiguous names detected. Pass columnsByTable (from buildColumnsByTable) to
 * enable column-level validation; omit to skip column checks.
 *
 * Handles:
 *  - TableName[ColumnName]
 *  - QueryName.Result[ColumnName]  (dot-notation table names)
 *  - [@ColumnName]                 (relative row refs — always valid, no table needed)
 */
export function resolveStructuredRefs(
  formula: string,
  tableMap: Map<string, ExcelTable>,
  columnsByTable?: Map<string, Set<string>>,
): ResolverError[] {
  const errors: ResolverError[] = [];
  if (!formula) return errors;

  // Build a set of normalized names that appear more than once (ambiguous across tables).
  // Two different table names that normalize the same → ambiguous.
  const nameCount = new Map<string, number>();
  for (const t of tableMap.values()) {
    const key = t.name.toLowerCase();
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }

  // Match structured refs: Name[ColumnSpec] where Name can include dots (dot-notation).
  // Excludes [@...] (relative) and [#...] (special like [#All]).
  // Requires at least one valid column character (not ], @, or #) throughout.
  const structuredRe = /\b([A-Za-z_][\w.]*)\[([^\]@#]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = structuredRe.exec(formula)) !== null) {
    const rawName = match[1];
    const columnSpec = match[2].trim();
    const key = rawName.toLowerCase();

    if (!tableMap.has(key)) {
      errors.push({
        kind: 'missing-table',
        message: `Table '${rawName}' not found`,
        tableName: rawName,
        formula,
      });
      continue;
    }

    if ((nameCount.get(key) ?? 0) > 1) {
      errors.push({
        kind: 'ambiguous-name',
        message: `Table name '${rawName}' is ambiguous`,
        tableName: rawName,
        formula,
      });
      continue;
    }

    if (columnsByTable) {
      const cols = columnsByTable.get(key);
      if (cols && !cols.has(columnSpec.toLowerCase())) {
        errors.push({
          kind: 'missing-column',
          message: `Column '${columnSpec}' not found in table '${rawName}'`,
          tableName: rawName,
          columnName: columnSpec,
          formula,
        });
      }
    }
  }

  return errors;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function parseWorkbook(file: File, fileId: string): Promise<WorkbookFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Use ArrayBuffer + bookFiles to access raw zip entries for external link resolution
        const wb = XLSX.read(data, { type: 'array', cellFormula: true, bookFiles: true });
        const linkMap = buildExternalLinkMap(wb);
        const namedRanges = extractNamedRanges(wb);
        // Build lookup map: lowercase name → NamedRange
        const namedRangeMap = new Map<string, NamedRange>();
        for (const nr of namedRanges) {
          namedRangeMap.set(nr.name.toLowerCase(), nr);
        }
        const tables = extractTables(wb);
        // Build lookup map: lowercase name → ExcelTable
        const tableMap = new Map<string, ExcelTable>();
        for (const t of tables) {
          tableMap.set(t.name.toLowerCase(), t);
        }
        const sheets: ParsedSheet[] = wb.SheetNames.map((sheetName) => {
          const { references, workload } = extractReferences(wb.Sheets[sheetName], sheetName, file.name, linkMap, namedRangeMap, tableMap);
          return { workbookName: file.name, sheetName, references, workload };
        });
        resolve({ id: fileId, name: file.name, sheets, namedRanges, tables });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}
