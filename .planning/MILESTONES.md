# Milestones

## v1.0.2 Test Infrastructure (Shipped: 2026-02-27)

**Phases completed:** 4 phases, 10 plans
**Files changed:** 69 files, +10,615 / -151 lines
**Timeline:** Feb 25–27, 2026 (3 days)
**Git range:** `3cf9831` → `2d88af3`

**Key accomplishments:**
- Vitest configured with SheetJS CJS inline fix, v8 coverage reporting, and TypeScript/ESLint integration
- Playwright Chromium E2E runner with Vite dev server auto-start and 2 smoke tests
- Seven `.xlsx` test fixtures via SheetJS programmatic generator with read-back verification
- 19 parser unit tests: cross-sheet refs, external file refs, named ranges, workload metrics, error handling, circular refs
- 11 graph unit tests: node counts, edge kind classification (internal/cross-file/external/named-range), layout modes, hidden file exclusion, named range toggle
- 17 Playwright E2E tests: upload flow, layout/filter/hide/focus interactions, detail panel, upload error resilience — all passing

---

