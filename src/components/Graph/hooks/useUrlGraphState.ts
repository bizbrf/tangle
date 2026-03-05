/**
 * useUrlGraphState — persists graph control state (view mode, layout direction,
 * grouping mode, and fit-on-change) to/from URL search parameters.
 *
 * Reading from the URL on mount means the user can share or bookmark a specific
 * graph configuration. Writing back on every change keeps the URL in sync so the
 * browser history / back-button works as expected.
 */

import { useCallback, useMemo, useState } from 'react';
import type { LayoutDirection, GroupingMode } from '../../../lib/graph';
import type { ViewMode } from '../Toolbar';

export interface UrlGraphState {
  viewMode: ViewMode;
  layoutDirection: LayoutDirection;
  groupingMode: GroupingMode;
  fitEnabled: boolean;
  setViewMode: (m: ViewMode) => void;
  setLayoutDirection: (d: LayoutDirection) => void;
  setGroupingMode: (g: GroupingMode) => void;
  toggleFit: () => void;
}

function readUrlParams(): { viewMode: ViewMode; dir: LayoutDirection; grouping: GroupingMode; fit: boolean } {
  const p = new URLSearchParams(window.location.search);
  const viewMode = (p.get('view') === 'overview' ? 'overview' : 'graph') as ViewMode;
  const dir = (p.get('dir') === 'TB' ? 'TB' : 'LR') as LayoutDirection;
  const rawGroup = p.get('group') ?? 'off';
  const grouping = (['off', 'by-type', 'by-table'].includes(rawGroup) ? rawGroup : 'off') as GroupingMode;
  const fit = p.get('fit') !== 'false';
  return { viewMode, dir, grouping, fit };
}

function writeUrlParams(viewMode: ViewMode, dir: LayoutDirection, grouping: GroupingMode, fit: boolean) {
  const p = new URLSearchParams(window.location.search);
  p.set('view', viewMode);
  p.set('dir', dir);
  p.set('group', grouping);
  p.set('fit', String(fit));
  const newUrl = `${window.location.pathname}?${p.toString()}${window.location.hash}`;
  window.history.replaceState(null, '', newUrl);
}

export function useUrlGraphState(): UrlGraphState {
  const initialParams = useMemo(() => readUrlParams(), []);
  const [viewMode, setViewModeRaw] = useState<ViewMode>(initialParams.viewMode);
  const [layoutDirection, setLayoutDirectionRaw] = useState<LayoutDirection>(initialParams.dir);
  const [groupingMode, setGroupingModeRaw] = useState<GroupingMode>(initialParams.grouping);
  const [fitEnabled, setFitEnabledRaw] = useState<boolean>(initialParams.fit);

  const setViewMode = useCallback((m: ViewMode) => {
    setViewModeRaw(m);
    writeUrlParams(m, layoutDirection, groupingMode, fitEnabled);
  }, [layoutDirection, groupingMode, fitEnabled]);

  const setLayoutDirection = useCallback((d: LayoutDirection) => {
    setLayoutDirectionRaw(d);
    writeUrlParams(viewMode, d, groupingMode, fitEnabled);
  }, [viewMode, groupingMode, fitEnabled]);

  const setGroupingMode = useCallback((g: GroupingMode) => {
    setGroupingModeRaw(g);
    writeUrlParams(viewMode, layoutDirection, g, fitEnabled);
  }, [viewMode, layoutDirection, fitEnabled]);

  const toggleFit = useCallback(() => {
    setFitEnabledRaw((f) => {
      const next = !f;
      writeUrlParams(viewMode, layoutDirection, groupingMode, next);
      return next;
    });
  }, [viewMode, layoutDirection, groupingMode]);

  return {
    viewMode,
    layoutDirection,
    groupingMode,
    fitEnabled,
    setViewMode,
    setLayoutDirection,
    setGroupingMode,
    toggleFit,
  };
}
