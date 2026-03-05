# Tangle System Design Review & Optimization Recommendations

This document captures practical recommendations to make the current architecture more robust to change, safer under errors, and easier to optimize over time.

## Current strengths

- Clear separation between **data parsing** (`src/lib/parser.ts`), **dependency utilities** (`src/lib/resolver.ts`), and **graph rendering** (`src/components/Graph/GraphView.tsx`).
- Good baseline automated tests in `tests/unit` and `tests/e2e`.
- Structured-reference parsing already has memoization and explicit cache invalidation (`parseStructuredRefsCached`, `clearParseCache`).

## High-impact opportunities

## 1) Split oversized modules into domain-focused units

### Why
- `GraphView.tsx` currently combines URL state persistence, keyboard shortcuts, layout orchestration, focus-mode traversal, styling logic, and selection behavior in one component.
- `parser.ts` contains file decoding, external-link resolution, named range/table extraction, formula scanning, and workbook assembly.

This increases change risk and makes regression bugs more likely because unrelated concerns are co-located.

### Recommendation
Refactor into narrow modules with stable boundaries:

- `src/lib/parsing/`
  - `externalLinks.ts`
  - `namedRanges.ts`
  - `tables.ts`
  - `formulaRefs.ts`
  - `parseWorkbook.ts`
- `src/components/Graph/hooks/`
  - `useUrlGraphState.ts`
  - `useFocusNeighborhood.ts`
  - `useStyledEdges.ts`
  - `useReorganizeLayout.ts`

Use a small index file per folder to expose a minimal public API.

## 2) Introduce an explicit domain model + normalization layer

### Why
Some keys are composed ad hoc (for example string keys like `NR|...` / `TBL|...` during extraction), and normalization (case/extension handling) is repeated. This can create subtle duplicate-node/edge bugs.

### Recommendation
Add a domain identity utility and reuse it everywhere:

- `normalizeWorkbookName(name)`
- `normalizeSheetName(name)`
- `makeSheetId(workbook, sheet)`
- `makeEdgeId(sourceId, targetId, kind)`

Keep all normalization rules in one place and ban ad hoc key building.

## 3) Replace scattered error handling with typed results and error categories

### Why
`parseWorkbook` catches and rejects generic errors. This is safe but can be hard to diagnose/triage.

### Recommendation
Use a discriminated union for parse results:

- `ParseErrorKind = 'UNSUPPORTED_FILE' | 'MALFORMED_WORKBOOK' | 'FORMULA_PARSE_ERROR' | 'EXTERNAL_LINK_RESOLVE_ERROR' | ...`
- Return `Result<T, ParseError>` style objects internally; only convert to thrown errors at UI boundary.
- Include structured metadata (`workbook`, `sheet`, `cell`, raw formula snippet).

This improves recoverability and user messaging and supports telemetry.

## 4) Add performance guardrails for large workbooks

### Why
Formula scanning and repeated regex execution can become expensive at scale.

### Recommendation
- Add micro-benchmarks (fixture-driven) for parser and graph build stages.
- Track timing budgets per stage:
  - decode workbook
  - extract references
  - build graph
  - layout
- Consider offloading parsing to a **Web Worker** for browser responsiveness.
- Prefer incremental graph rebuilds (changed workbook only) rather than full recomputation.

## 5) Use a “ports and adapters” boundary for parser/runtime dependencies

### Why
`xlsx` library use is currently embedded in parsing flow. Tight coupling makes replacement, testing, and fault injection harder.

### Recommendation
Define an adapter interface:

```ts
interface WorkbookReader {
  read(data: ArrayBuffer): WorkbookModel;
}
```

Then keep domain parsing logic independent from SheetJS-specific structures.

## 6) Strengthen resilience with invariants and runtime validation

### Why
AI-generated code often works but may hide edge cases. Defensive checks reduce blast radius.

### Recommendation
- Add lightweight runtime schema validation (for imported workbook metadata and parser outputs).
- Add invariants for graph assumptions (no dangling edges, unique IDs, edge kind enum validity).
- Fail fast in development, degrade gracefully in production.

## 7) Formalize architecture docs + ADRs

### Why
Without explicit design records, future refactors re-open old decisions.

### Recommendation
Add:

- `docs/architecture.md` (current boundaries, data flow, lifecycle)
- `docs/adr/` for key decisions (layout strategy, parser architecture, caching strategy)
- `docs/error-taxonomy.md`

Use lightweight ADRs (1 page each).

## Suggested phased plan

### Phase 1 (1–2 days)
- Extract graph hooks from `GraphView.tsx`.
- Centralize normalization/id helpers.
- Add parse error taxonomy.

### Phase 2 (2–4 days)
- Split parser into parsing submodules.
- Add benchmark harness and timing instrumentation.
- Add invariant checks in graph build pipeline.

### Phase 3 (ongoing)
- Web Worker parsing path.
- Incremental rebuild pipeline.
- ADR documentation discipline for new design choices.

## Recommended external references (high-signal)

- Martin Fowler — **Refactoring** catalog and code smell references.
- Thoughtworks Technology Radar — evolutionary architecture patterns.
- Microsoft — **Well-Architected Framework** (reliability, performance efficiency).
- AWS — **Builders Library** reliability articles (fault isolation, retries, idempotency).
- Google SRE book (error budgets, observability, reliability engineering).
- TypeScript handbook sections on discriminated unions and exhaustiveness checks.
- React docs on separating effects and deriving state.

## Practical success metrics

Track these over time to verify improvement:

- Median and p95 workbook parse time by workbook size bucket.
- Graph layout time and frame drops during interactions.
- Error rate by `ParseErrorKind`.
- Test mutation score / regression rate on parser and graph modules.
- Change failure rate for parser and graph-related PRs.
