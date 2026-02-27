# Testing Patterns

**Analysis Date:** 2026-02-27

## Test Framework

**Status:** No testing framework currently configured.

**Not Detected:**
- No Jest, Vitest, Mocha, or other test runner in `package.json`
- No test configuration files (`jest.config.js`, `vitest.config.ts`, etc.)
- No test files found in codebase (`*.test.ts`, `*.spec.ts`)
- No test directory structure (`__tests__`, `tests/`)
- No testing libraries in dependencies (no `@testing-library/react`, `@vitest/ui`, etc.)

## Current Testing Status

**Production Code:** Testing is **not implemented**.

The codebase is production-ready with features fully functional, but contains:
- No unit tests
- No integration tests
- No E2E tests
- No test data fixtures or factories
- No mocking framework

## Recommended Testing Setup

If testing is added in the future, the following approach would align with project conventions:

### Suggested Framework
- **Test Runner:** Vitest (modern, TypeScript-first, ESM-native)
- **UI Testing:** React Testing Library (for component integration tests)
- **Assertion:** Vitest built-in assertions or Chai
- **Mocking:** Vitest `vi` mock utilities

### Configuration Template

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

## Code Areas That Would Benefit from Testing

### 1. Parser Module (`src/lib/parser.ts`)

**High Priority:** Complex regex patterns and Excel format handling

**Testable Functions:**
- `extractReferences()` — regex-based formula parsing
- `buildExternalLinkMap()` — external link resolution
- `extractNamedRanges()` — named range parsing
- `readFileEntry()` — binary/text buffer handling

**Test Strategy:**
```typescript
describe('extractReferences', () => {
  it('detects cross-sheet references (SheetName!A1)', () => {
    const sheet = { A1: { f: '=Sheet2!B5' } };
    const { references } = extractReferences(sheet, 'Sheet1', 'file.xlsx', new Map(), new Map());
    expect(references).toHaveLength(1);
    expect(references[0].targetSheet).toBe('Sheet2');
  });

  it('detects external file references ([File.xlsx]Sheet!A1)', () => {
    // Test external link detection
  });

  it('skips within-sheet references (same sheet)', () => {
    const sheet = { A1: { f: '=A2' } };
    const { references, workload } = extractReferences(sheet, 'Sheet1', 'file.xlsx', new Map(), new Map());
    expect(references).toHaveLength(0);
    expect(workload.withinSheetRefs).toBe(1);
  });

  it('aggregates cells per target sheet', () => {
    const sheet = {
      A1: { f: '=Sheet2!B5' },
      A2: { f: '=Sheet2!C3' }
    };
    const { references } = extractReferences(sheet, 'Sheet1', 'file.xlsx', new Map(), new Map());
    expect(references).toHaveLength(1);
    expect(references[0].cells).toContain('B5');
    expect(references[0].cells).toContain('C3');
  });

  it('handles quoted sheet names with spaces', () => {
    const sheet = { A1: { f: "='Sheet Name'!A1" } };
    const { references } = extractReferences(sheet, 'Sheet1', 'file.xlsx', new Map(), new Map());
    expect(references[0].targetSheet).toBe('Sheet Name');
  });

  it('counts workload metrics accurately', () => {
    // Test totalFormulas, crossSheetRefs, crossFileRefs
  });
});
```

### 2. Graph Building (`src/lib/graph.ts`)

**High Priority:** Node/edge creation and layout algorithms

**Testable Functions:**
- `buildGraph()` — main graph construction
- `normWb()` — workbook name normalization
- `stripExcelExt()` — filename cleanup

**Test Strategy:**
```typescript
describe('buildGraph', () => {
  it('creates sheet nodes for all visible workbooks', () => {
    const workbooks = [
      { id: '1', name: 'File1.xlsx', sheets: [{ sheetName: 'Sheet1', references: [] }] }
    ];
    const { nodes } = buildGraph(workbooks);
    expect(nodes).toContainEqual(expect.objectContaining({
      id: expect.stringContaining('Sheet1'),
      data: expect.objectContaining({ sheetName: 'Sheet1' })
    }));
  });

  it('respects hiddenFiles when building graph', () => {
    const workbooks = [
      { id: '1', name: 'File1.xlsx', sheets: [{ sheetName: 'Sheet1', references: [] }] },
      { id: '2', name: 'File2.xlsx', sheets: [{ sheetName: 'Sheet1', references: [] }] }
    ];
    const { nodes } = buildGraph(workbooks, 'graph', new Set(['File2.xlsx']));
    expect(nodes.filter(n => n.data.workbookName === 'File2.xlsx')).toHaveLength(0);
  });

  it('creates edges for sheet references', () => {
    const workbooks = [
      {
        id: '1',
        name: 'File1.xlsx',
        sheets: [{
          sheetName: 'Sheet1',
          references: [{
            sourceCell: 'A1',
            cells: ['B1'],
            formula: '=Sheet2!B1',
            targetSheet: 'Sheet2',
            targetWorkbook: null
          }]
        }, { sheetName: 'Sheet2', references: [] }]
      }
    ];
    const { edges } = buildGraph(workbooks);
    expect(edges).toHaveLength(1);
    expect(edges[0].data.edgeKind).toBe('internal');
  });

  it('creates file nodes for external references', () => {
    // Test external file node creation
  });

  it('distinguishes edge kinds: internal, cross-file, external', () => {
    // Test EdgeKind assignment
  });
});
```

### 3. React Components

**Moderate Priority:** Component behavior and integration

**FilePanel Component (`src/components/FilePanel/FilePanel.tsx`):**
```typescript
describe('FilePanel', () => {
  it('handles Excel file upload', async () => {
    render(<FilePanel workbooks={[]} onWorkbooksChange={vi.fn()} />);
    const input = screen.getByDisplayValue(/multiple/);
    const file = new File(['test'], 'test.xlsx', { type: 'application/vnd.ms-excel' });

    await userEvent.upload(input, file);
    // Verify file parsing initiated
  });

  it('expands/collapses file to show sheets', async () => {
    const workbook = {
      id: '1',
      name: 'File.xlsx',
      sheets: [{ sheetName: 'Sheet1', references: [] }]
    };
    render(<FilePanel workbooks={[workbook]} onWorkbooksChange={vi.fn()} />);

    const chevron = screen.getByRole('button'); // chevron button
    await userEvent.click(chevron);
    expect(screen.getByText('Sheet1')).toBeVisible();
  });

  it('removes workbook on delete click', async () => {
    const onWorkbooksChange = vi.fn();
    const workbook = { id: '1', name: 'File.xlsx', sheets: [] };
    render(<FilePanel workbooks={[workbook]} onWorkbooksChange={onWorkbooksChange} />);

    // Click delete button
    const closeBtn = screen.getByTitle(/remove/i);
    await userEvent.click(closeBtn);
    expect(onWorkbooksChange).toHaveBeenCalledWith([]);
  });

  it('calls onLocateFile when locate button clicked', async () => {
    const onLocateFile = vi.fn();
    const workbook = { id: '1', name: 'File.xlsx', sheets: [] };
    render(<FilePanel workbooks={[workbook]} onLocateFile={onLocateFile} />);

    const locateBtn = screen.getByTitle(/Locate/);
    await userEvent.click(locateBtn);
    expect(onLocateFile).toHaveBeenCalledWith('File.xlsx');
  });
});
```

**App Component (`src/App.tsx`):**
```typescript
describe('App', () => {
  it('renders file panel and graph view', () => {
    render(<App />);
    expect(screen.getByText('tangle')).toBeInTheDocument();
    // Graph canvas should be present
  });

  it('passes workbook state to both panels', () => {
    // Test prop drilling and state synchronization
  });

  it('cleans up hidden files when workbook removed', () => {
    // Test the handleWorkbooksChange cleanup logic
  });
});
```

## Test Data / Fixtures

**Not yet created**, but should include:

```typescript
// src/test/fixtures/workbooks.ts
export const singleSheetWorkbook: WorkbookFile = {
  id: '1',
  name: 'Simple.xlsx',
  sheets: [{
    workbookName: 'Simple.xlsx',
    sheetName: 'Sheet1',
    references: [],
    workload: {
      totalFormulas: 0,
      withinSheetRefs: 0,
      crossSheetRefs: 0,
      crossFileRefs: 0
    }
  }],
  namedRanges: []
};

export const multiSheetWithReferences: WorkbookFile = {
  id: '2',
  name: 'Complex.xlsx',
  sheets: [
    {
      workbookName: 'Complex.xlsx',
      sheetName: 'Data',
      references: [
        {
          sourceCell: 'A1',
          cells: ['B5'],
          formula: '=Summary!B5',
          targetSheet: 'Summary',
          targetWorkbook: null
        }
      ],
      workload: { /* ... */ }
    }
  ],
  namedRanges: []
};

export const externalFileReference: SheetReference = {
  sourceCell: 'A1',
  cells: ['C3:C10'],
  formula: '=[External.xlsx]Prices!C3:C10',
  targetSheet: 'Prices',
  targetWorkbook: 'External.xlsx'
};
```

## Coverage Goals

If testing is implemented:

**Recommended Targets:**
- `src/lib/parser.ts` — 95%+ (critical formula parsing)
- `src/lib/graph.ts` — 90%+ (node/edge building logic)
- `src/components/` — 70%+ (UI component interactions)
- `src/types.ts` — N/A (type-only file)

**Critical Paths to Cover:**
1. Excel reference regex detection (parser.ts)
2. External file link resolution (parser.ts)
3. Named range detection (parser.ts)
4. Graph building with hidden files (graph.ts)
5. Edge kind classification (graph.ts)
6. File upload and parsing (FilePanel.tsx)

## Notes on Current Architecture

**Why Testing is Feasible:**
- Core logic isolated in `lib/` modules with pure functions
- React components are presentational with simple state management
- No backend dependencies or API calls to mock

**Challenges to Address:**
- SheetJS (`xlsx`) file parsing requires actual Excel files or mocked binary data
- React Flow integration requires testing in JSDOM with proper setup
- Design heavy component (FilePanel) needs user interaction testing

---

*Testing analysis: 2026-02-27*
