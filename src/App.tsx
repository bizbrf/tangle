import { useState, useCallback, useEffect, useRef } from 'react';
import { FilePanel } from './components/FilePanel/FilePanel';
import { GraphView } from './components/Graph/GraphView';
import { TangleLogo } from './components/ui/TangleLogo';
import { saveFile, loadAllFiles, removeFile, clearAllFiles } from './lib/storage';
import { parseWorkbookFromBuffer } from './lib/parser';
import { resolveImportedWorkbooks } from './components/FilePanel/importUtils';
import { C } from './components/Graph/constants';
import type { WorkbookFile } from './types';

export default function App() {
  const [workbooks, setWorkbooks] = useState<WorkbookFile[]>([]);
  const [highlightedFile, setHighlightedFile] = useState<string | null>(null);
  const [hiddenFiles, setHiddenFiles] = useState<Set<string>>(new Set());
  const [restoredCount, setRestoredCount] = useState(0);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const restoringRef = useRef(false);

  // Restore files from IndexedDB on mount.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (restoringRef.current) return;
      restoringRef.current = true;
      try {
        const stored = await loadAllFiles();
        if (cancelled || stored.length === 0) return;
        const parsed = stored.map((sf) =>
          parseWorkbookFromBuffer(sf.data, sf.name, sf.id),
        );
        const { workbooks: resolved } = resolveImportedWorkbooks([], parsed);
        setWorkbooks(resolved);
        setRestoredCount(resolved.length);
      } catch (err) {
        if (!cancelled) {
          console.warn('[tangle] restore from IndexedDB failed:', err);
          setRestoreError('Could not restore previous files. Starting empty.');
        }
      }
    }
    restore();
    return () => { cancelled = true; };
  }, []);

  const handleWorkbooksChange = useCallback((next: WorkbookFile[]) => {
    setWorkbooks((prev) => {
      const nextNames = new Set(next.map((wb) => wb.name));
      const removedNames = prev.filter((wb) => !nextNames.has(wb.name)).map((wb) => wb.name);
      if (removedNames.length > 0) {
        setHiddenFiles((s) => {
          const copy = new Set(s);
          removedNames.forEach((n) => copy.delete(n));
          return copy;
        });
      }
      // Side-effect IDB cleanup must run outside the pure updater so React 19
      // StrictMode's double-invoke doesn't double-delete.
      const nextIds = new Set(next.map((wb) => wb.id));
      const removedIds = prev.filter((wb) => !nextIds.has(wb.id)).map((wb) => wb.id);
      if (removedIds.length > 0) {
        queueMicrotask(() => {
          for (const id of removedIds) void removeFile(id);
        });
      }
      return next;
    });
  }, []);

  const handleFileSaved = useCallback((id: string, name: string, data: ArrayBuffer) => {
    void saveFile(id, name, data);
  }, []);

  const handleClearAll = useCallback(() => {
    void clearAllFiles();
    setWorkbooks([]);
    setHiddenFiles(new Set());
  }, []);

  const handleLocateFile = useCallback((workbookName: string) => {
    setHighlightedFile(workbookName);
  }, []);

  const handleToggleHidden = useCallback((workbookName: string) => {
    setHiddenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(workbookName)) {
        next.delete(workbookName);
      } else {
        next.add(workbookName);
      }
      return next;
    });
  }, []);

  return (
    <div className="app-shell flex h-screen overflow-hidden" style={{ background: C.bg }}>
      {/* Sidebar */}
      <div
        className="app-sidebar w-72 shrink-0 flex h-full min-h-0 flex-col"
        style={{ background: C.bgPanel, borderRight: `1px solid ${C.border}` }}
      >
        {/* Header */}
        <div
          className="px-5 py-4"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <TangleLogo size={28} showText={true} />
        </div>

        <div className="flex-1 overflow-hidden">
          <FilePanel
            workbooks={workbooks}
            onWorkbooksChange={handleWorkbooksChange}
            onLocateFile={handleLocateFile}
            hiddenFiles={hiddenFiles}
            onToggleHidden={handleToggleHidden}
            onFileSaved={handleFileSaved}
            onClearAll={handleClearAll}
            restoredCount={restoredCount}
            onRestoredDismiss={() => setRestoredCount(0)}
            restoreError={restoreError}
            onRestoreErrorDismiss={() => setRestoreError(null)}
          />
        </div>
      </div>

      {/* Graph canvas */}
      <div className="app-main flex-1 min-w-0 flex flex-col">
        <GraphView
          workbooks={workbooks}
          highlightedFile={highlightedFile}
          onHighlightClear={() => setHighlightedFile(null)}
          hiddenFiles={hiddenFiles}
          onToggleHidden={handleToggleHidden}
        />
      </div>
    </div>
  );
}
