import { useRef, useState, useEffect } from 'react';
import type { WorkbookFile } from '../../types';
import { parseWorkbookFromBuffer, EXCEL_EXTENSIONS } from '../../lib/parser';
import { formatDuplicateImportNotice, resolveImportedWorkbooks } from './importUtils';
import { C, alpha } from '../Graph/constants';

interface FilePanelProps {
  workbooks: WorkbookFile[];
  onWorkbooksChange: (workbooks: WorkbookFile[]) => void;
  onLocateFile?: (workbookName: string) => void;
  hiddenFiles?: Set<string>;
  onToggleHidden?: (workbookName: string) => void;
  onFileSaved?: (id: string, name: string, data: ArrayBuffer) => void;
  onClearAll?: () => void;
  restoredCount?: number;
  onRestoredDismiss?: () => void;
  restoreError?: string | null;
  onRestoreErrorDismiss?: () => void;
}

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

export function FilePanel({ workbooks, onWorkbooksChange, onLocateFile, hiddenFiles, onToggleHidden, onFileSaved, onClearAll, restoredCount, onRestoredDismiss, restoreError, onRestoreErrorDismiss }: FilePanelProps) {
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss the restored banner after 4 seconds
  useEffect(() => {
    if (!restoredCount || restoredCount <= 0) return;
    const timer = setTimeout(() => {
      onRestoredDismiss?.();
    }, 4000);
    return () => clearTimeout(timer);
  }, [restoredCount, onRestoredDismiss]);

  /** Read a File as ArrayBuffer. */
  function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsArrayBuffer(file);
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setNotice(null);
    const excelFiles = Array.from(files).filter((f) =>
      EXCEL_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)),
    );
    if (excelFiles.length === 0) {
      setError('Only Excel files (.xlsx, .xls, .xlsm, .xlsb) are supported.');
      return;
    }
    // Read + parse each file independently so one bad file doesn't drop the batch.
    const settled = await Promise.allSettled(
      excelFiles.map(async (f) => ({
        file: f,
        buffer: await readFileAsBuffer(f),
      })),
    );

    const succeeded: { file: File; buffer: ArrayBuffer; parsed: WorkbookFile }[] = [];
    const failures: string[] = [];

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === 'rejected') {
        console.warn(`[tangle] read ${excelFiles[i].name}:`, result.reason);
        failures.push(excelFiles[i].name);
        continue;
      }
      try {
        const parsed = parseWorkbookFromBuffer(result.value.buffer, result.value.file.name, crypto.randomUUID());
        succeeded.push({ file: result.value.file, buffer: result.value.buffer, parsed });
      } catch (err) {
        console.warn(`[tangle] parse ${result.value.file.name}:`, err);
        failures.push(result.value.file.name);
      }
    }

    if (succeeded.length > 0) {
      const parsedList = succeeded.map((s) => s.parsed);
      const { workbooks: resolved, duplicateOriginalNames } = resolveImportedWorkbooks(workbooks, parsedList);
      onWorkbooksChange([...workbooks, ...resolved]);
      setNotice(formatDuplicateImportNotice(duplicateOriginalNames));
      setExpanded((prev) => {
        const next = new Set(prev);
        resolved.forEach((wb) => next.add(wb.id));
        return next;
      });
      if (onFileSaved) {
        for (let i = 0; i < resolved.length; i++) {
          onFileSaved(resolved[i].id, succeeded[i].file.name, succeeded[i].buffer);
        }
      }
    }

    if (failures.length > 0) {
      setError(
        failures.length === 1
          ? `Could not load "${failures[0]}".`
          : `Could not load ${failures.length} files: ${failures.slice(0, 3).join(', ')}${failures.length > 3 ? ', …' : ''}`,
      );
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
    <div className="flex flex-col h-full" style={{ background: C.bgPanel }}>

      {/* Upload zone */}
      <div className="p-3">
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed p-5 cursor-pointer transition-all duration-200"
          style={
            dragging
              ? {
                  borderColor: C.accent,
                  background: C.accentGlowFaint,
                  boxShadow: `inset 0 0 24px ${C.accentGlowFaint}`,
                }
              : {
                  borderColor: C.border,
                  background: 'transparent',
                }
          }
          onMouseEnter={(e) => {
            if (!dragging) {
              (e.currentTarget as HTMLElement).style.borderColor = C.accent;
              (e.currentTarget as HTMLElement).style.background = C.accentGlowFaint;
            }
          }}
          onMouseLeave={(e) => {
            if (!dragging) {
              (e.currentTarget as HTMLElement).style.borderColor = C.border;
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
          onClick={() => {
            if (inputRef.current) inputRef.current.value = '';
            inputRef.current?.click();
          }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5"
            style={{ background: C.surface, color: dragging ? C.accent : C.textMuted }}
          >
            <IconUpload />
          </div>
          <p className="text-xs text-center leading-relaxed" style={{ color: C.textSecondary }}>
            Drop <span style={{ color: C.textPrimary, fontWeight: 600 }}>Excel</span> files here
            <br />
            <span style={{ color: C.accent, opacity: dragging ? 1 : 0.7 }}>
              or click to browse
            </span>
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.xlsb"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <p data-testid="upload-error" className="mx-3 mb-2 text-xs px-2 py-1.5 rounded-lg"
          style={{ color: C.accent, background: C.accentDim, border: `1px solid ${C.accentGlow}` }}>
          {error}
        </p>
      )}

      {notice && (
        <p data-testid="upload-notice" className="mx-3 mb-2 text-xs px-2 py-1.5 rounded-lg"
          style={{ color: C.amber, background: C.amberDim, border: `1px solid ${alpha(C.amber, 25)}` }}>
          {notice}
        </p>
      )}

      {restoredCount != null && restoredCount > 0 && (
        <p data-testid="restored-notice" className="mx-3 mb-2 text-xs px-2 py-1.5 rounded-lg transition-opacity duration-500"
          style={{ color: C.emerald, background: C.emeraldDim, border: `1px solid ${alpha(C.emerald, 25)}` }}>
          {restoredCount} {restoredCount === 1 ? 'file' : 'files'} restored from last session
        </p>
      )}

      {restoreError && (
        <div data-testid="restore-error" className="mx-3 mb-2 text-xs px-2 py-1.5 rounded-lg flex items-start gap-2"
          style={{ color: C.amber, background: C.amberDim, border: `1px solid ${alpha(C.amber, 25)}` }}>
          <span className="flex-1">{restoreError}</span>
          {onRestoreErrorDismiss && (
            <button onClick={onRestoreErrorDismiss} aria-label="Dismiss" style={{ color: C.amber, opacity: 0.7 }}>
              <IconClose />
            </button>
          )}
        </div>
      )}

      {/* Divider + label */}
      {workbooks.length > 0 && (
        <div className="flex items-center gap-2 px-4 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.textMuted }}>
            Files
          </span>
          <div className="flex-1 h-px" style={{ background: C.border }} />
          {onClearAll && (
            <button
              data-testid="clear-all-files"
              className="text-[10px] font-semibold transition-colors duration-150"
              style={{ color: C.textMuted }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = C.accent)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = C.textMuted)}
              onClick={onClearAll}
              title="Clear all saved files"
            >
              Clear all
            </button>
          )}
          <span className="text-[10px] font-semibold" style={{ color: C.textMuted }}>
            {workbooks.length}
          </span>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {workbooks.length === 0 ? (
          <p className="text-[11px] text-center mt-3" style={{ color: C.textMuted }}>
            No files yet.
          </p>
        ) : (
          workbooks.map((wb) => (
            <div key={wb.id} className="mb-0.5">
              {/* File row */}
              <div
                data-testid="file-list-item"
                className="group relative flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-all duration-150"
                style={{ color: C.textSecondary }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = C.surface;
                  (e.currentTarget as HTMLElement).style.color = C.textPrimary;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = C.textSecondary;
                }}
                onClick={() => toggleExpand(wb.id)}
              >
                {/* Left accent flash */}
                <div
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full transition-opacity duration-150 opacity-0 group-hover:opacity-100"
                  style={{ background: C.accent }}
                />
                <div className="flex items-center gap-2 min-w-0 pl-1">
                  <span style={{ color: C.textMuted }}>
                    <IconChevron open={expanded.has(wb.id)} />
                  </span>
                  <span style={{ color: C.accent, opacity: 0.7 }}>
                    <IconFile />
                  </span>
                  <span className="text-sm font-medium truncate" style={{ opacity: hiddenFiles?.has(wb.name) ? 0.4 : 1 }}>{wb.originalName}</span>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                  {onToggleHidden && (
                    <button
                      data-testid="eye-toggle"
                      className="rounded p-0.5"
                      style={{ color: hiddenFiles?.has(wb.name) ? C.accent : C.textMuted }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = hiddenFiles?.has(wb.name) ? C.accent : C.textSecondary)}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = hiddenFiles?.has(wb.name) ? C.accent : C.textMuted)}
                      onClick={(e) => { e.stopPropagation(); onToggleHidden(wb.name); }}
                      title={hiddenFiles?.has(wb.name) ? 'Show in graph' : 'Hide from graph'}
                    >
                      <IconEye hidden={!!hiddenFiles?.has(wb.name)} />
                    </button>
                  )}
                  {onLocateFile && (
                    <button
                      className="rounded p-0.5"
                      style={{ color: C.textMuted }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = C.indigo)}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = C.textMuted)}
                      onClick={(e) => { e.stopPropagation(); onLocateFile(wb.name); }}
                      title="Locate in graph"
                    >
                      <IconLocate />
                    </button>
                  )}
                  <button
                    className="rounded p-0.5"
                    style={{ color: C.textMuted }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = C.accent)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = C.textMuted)}
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
                      data-testid="sheet-list-item"
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-150 cursor-default"
                      style={{ color: C.textMuted }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = C.surface;
                        (e.currentTarget as HTMLElement).style.color = C.textSecondary;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = C.textMuted;
                      }}
                    >
                      <IconSheet />
                      <span className="text-xs truncate flex-1">{sheet.sheetName}</span>
                      {sheet.references.length > 0 && (
                        <span
                          className="text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded-full"
                          style={{ color: C.accent, background: C.accentDim }}
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
