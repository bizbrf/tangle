---
created: 2026-02-27T19:50:31.781Z
title: Named range and table popout options
area: ui
files: []
---

## Problem

The app currently shows named ranges and Excel tables as nodes in the graph (via the Tables toggle feature added in quick-1). However, there is no way to "pop out" or drill into the details of a named range or table — users need richer interaction options for these node types. Possible options include: clicking to expand/inspect the range address or table column structure, a popout panel showing range/table metadata, or contextual actions in the detail panel.

## Solution

TBD — explore what "popout options" means in context:
- Could be a detail panel section showing named range address and scope (workbook vs sheet)
- Could be a detail panel section for tables showing column names and data range
- Could be a modal/drawer with full metadata
- Should integrate with the existing detail panel pattern in `src/components/Graph/DetailPanel`
