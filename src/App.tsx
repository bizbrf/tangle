import { useState, useCallback } from 'react';
import { FilePanel } from './components/FilePanel/FilePanel';
import { GraphView } from './components/Graph/GraphView';
import { TangleLogo } from './components/ui/TangleLogo';
import type { WorkbookFile } from './types';

export default function App() {
  const [workbooks, setWorkbooks] = useState<WorkbookFile[]>([]);
  const [highlightedFile, setHighlightedFile] = useState<string | null>(null);
  const [hiddenFiles, setHiddenFiles] = useState<Set<string>>(new Set());

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
      return next;
    });
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
    <div className="flex h-full" style={{ background: '#0b0d11' }}>
      {/* Sidebar */}
      <div
        className="w-72 shrink-0 flex flex-col h-full"
        style={{ background: '#0d1017', borderRight: '1px solid #1e2535' }}
      >
        {/* Header */}
        <div
          className="px-5 py-4"
          style={{ borderBottom: '1px solid #1e2535' }}
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
          />
        </div>
      </div>

      {/* Graph canvas */}
      <GraphView
        workbooks={workbooks}
        highlightedFile={highlightedFile}
        onHighlightClear={() => setHighlightedFile(null)}
        hiddenFiles={hiddenFiles}
        onToggleHidden={handleToggleHidden}
      />
    </div>
  );
}
