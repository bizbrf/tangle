import { useRef, useState } from 'react';
import type { WorkbookFile } from '../../types';
import { parseWorkbook, EXCEL_EXTENSIONS } from '../../lib/parser';

interface FilePanelProps {
  workbooks: WorkbookFile[];
  onWorkbooksChange: (workbooks: WorkbookFile[]) => void;
  onLocateFile?: (workbookName: string) => void;
  hiddenFiles?: Set<string>;
  onToggleHidden?: (workbookName: string) => void;
}

let nextId = 1;

// ── Icon helpers ──────────────────────────────────────────────────────────────

function IconUpload() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function IconSheet() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      fill="currentColor" viewBox="0 0 20 20"
    >
      <path d="M6 6l8 4-8 4V6z" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

function IconLocate() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M12 2v4m0 12v4M2 12h4m12 0h4" />
    </svg>
  );
}

function IconEye({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function FilePanel({ workbooks, onWorkbooksChange, onLocateFile, hiddenFiles, onToggleHidden }: FilePanelProps) {
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const excelFiles = Array.from(files).filter((f) =>
      EXCEL_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)),
    );
    if (excelFiles.length === 0) {
      setError('Only Excel files (.xlsx, .xls, .xlsm, .xlsb) are supported.');
      return;
    }
    try {
      const parsed = await Promise.all(
        excelFiles.map((f) => parseWorkbook(f, String(nextId++))),
      );
      onWorkbooksChange([...workbooks, ...parsed]);
      setExpanded((prev) => {
        const next = new Set(prev);
        parsed.forEach((wb) => next.add(wb.id));
        return next;
      });
    } catch {
      setError('Failed to parse one or more files.');
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeWorkbook(id: string) {
    setExpanded((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    onWorkbooksChange(workbooks.filter((wb) => wb.id !== id));
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0d1017' }}>

      {/* Upload zone */}
      <div className="p-3">
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed p-5 cursor-pointer transition-all duration-200"
          style={
            dragging
              ? {
                  borderColor: 'rgba(232,68,90,0.6)',
                  background: 'rgba(232,68,90,0.07)',
                  boxShadow: 'inset 0 0 24px rgba(232,68,90,0.1)',
                }
              : {
                  borderColor: '#1e2535',
                  background: 'transparent',
                }
          }
          onMouseEnter={(e) => {
            if (!dragging) {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,68,90,0.35)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(232,68,90,0.04)';
            }
          }}
          onMouseLeave={(e) => {
            if (!dragging) {
              (e.currentTarget as HTMLElement).style.borderColor = '#1e2535';
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5"
            style={{ background: '#131720', color: dragging ? '#e8445a' : '#4a5568' }}
          >
            <IconUpload />
          </div>
          <p className="text-xs text-center leading-relaxed" style={{ color: '#7b8799' }}>
            Drop <span style={{ color: '#edf0f5', fontWeight: 600 }}>Excel</span> files here
            <br />
            <span style={{ color: dragging ? '#e8445a' : '#e8445a', opacity: dragging ? 1 : 0.7 }}>
              or click to browse
            </span>
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.xlsb"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="mx-3 mb-2 text-xs px-2 py-1.5 rounded-lg"
          style={{ color: '#e8445a', background: 'rgba(232,68,90,0.1)', border: '1px solid rgba(232,68,90,0.2)' }}>
          {error}
        </p>
      )}

      {/* Divider + label */}
      {workbooks.length > 0 && (
        <div className="flex items-center gap-2 px-4 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#3d4a5c' }}>
            Files
          </span>
          <div className="flex-1 h-px" style={{ background: '#1e2535' }} />
          <span className="text-[10px] font-semibold" style={{ color: '#3d4a5c' }}>
            {workbooks.length}
          </span>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {workbooks.length === 0 ? (
          <p className="text-[11px] text-center mt-3" style={{ color: '#3d4a5c' }}>
            No files yet.
          </p>
        ) : (
          workbooks.map((wb) => (
            <div key={wb.id} className="mb-0.5">
              {/* File row */}
              <div
                className="group relative flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-all duration-150"
                style={{ color: '#7b8799' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#131720';
                  (e.currentTarget as HTMLElement).style.color = '#edf0f5';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = '#7b8799';
                }}
                onClick={() => toggleExpand(wb.id)}
              >
                {/* Left accent flash */}
                <div
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full transition-opacity duration-150 opacity-0 group-hover:opacity-100"
                  style={{ background: '#e8445a' }}
                />
                <div className="flex items-center gap-2 min-w-0 pl-1">
                  <span style={{ color: '#3d4a5c' }}>
                    <IconChevron open={expanded.has(wb.id)} />
                  </span>
                  <span style={{ color: '#e8445a', opacity: 0.7 }}>
                    <IconFile />
                  </span>
                  <span className="text-sm font-medium truncate" style={{ opacity: hiddenFiles?.has(wb.name) ? 0.4 : 1 }}>{wb.name}</span>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                  {onToggleHidden && (
                    <button
                      className="rounded p-0.5"
                      style={{ color: hiddenFiles?.has(wb.name) ? '#e8445a' : '#4a5568' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = hiddenFiles?.has(wb.name) ? '#e8445a' : '#7b8799')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = hiddenFiles?.has(wb.name) ? '#e8445a' : '#4a5568')}
                      onClick={(e) => { e.stopPropagation(); onToggleHidden(wb.name); }}
                      title={hiddenFiles?.has(wb.name) ? 'Show in graph' : 'Hide from graph'}
                    >
                      <IconEye hidden={!!hiddenFiles?.has(wb.name)} />
                    </button>
                  )}
                  {onLocateFile && (
                    <button
                      className="rounded p-0.5"
                      style={{ color: '#4a5568' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#818cf8')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4a5568')}
                      onClick={(e) => { e.stopPropagation(); onLocateFile(wb.name); }}
                      title="Locate in graph"
                    >
                      <IconLocate />
                    </button>
                  )}
                  <button
                    className="rounded p-0.5"
                    style={{ color: '#4a5568' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#e8445a')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4a5568')}
                    onClick={(e) => { e.stopPropagation(); removeWorkbook(wb.id); }}
                  >
                    <IconClose />
                  </button>
                </div>
              </div>

              {/* Sheet list */}
              {expanded.has(wb.id) && (
                <div className="ml-6 mt-0.5 mb-1 space-y-0.5">
                  {wb.sheets.map((sheet) => (
                    <div
                      key={sheet.sheetName}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-150 cursor-default"
                      style={{ color: '#4a5568' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = '#131720';
                        (e.currentTarget as HTMLElement).style.color = '#7b8799';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = '#4a5568';
                      }}
                    >
                      <IconSheet />
                      <span className="text-xs truncate flex-1">{sheet.sheetName}</span>
                      {sheet.references.length > 0 && (
                        <span
                          className="text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded-full"
                          style={{ color: '#e8445a', background: 'rgba(232,68,90,0.12)' }}
                        >
                          {sheet.references.length}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
