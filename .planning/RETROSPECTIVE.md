# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Test Infrastructure

**Shipped:** 2026-02-27
**Phases:** 4 | **Plans:** 10 | **Timeline:** 3 days (Feb 25–27)

### What Was Built
- Vitest unit test suite (43 tests) for parser.ts and graph.ts
- Playwright E2E suite (17 tests) covering upload flow, feature interactions, detail panel, and error handling
- Seven programmatic `.xlsx` test fixtures via SheetJS with read-back verification
- `data-testid` instrumentation added to FilePanel and GraphView for stable E2E selectors

### What Worked
- Splitting `vitest.config.ts` from `vite.config.ts` cleanly resolved TypeScript context conflicts on the first try — the research phase identified this pattern upfront
- `server.deps.inline: ['xlsx']` fix worked exactly as expected — no time lost debugging SheetJS/ESM issues
- `data-testid` attributes as a dedicated instrumentation phase (04-01) before writing tests proved clean — zero selector rewrites across 17 E2E tests
- Playwright's `webServer` config auto-starting the Vite dev server made the E2E suite fully self-contained
- Programmatic fixtures with read-back verification caught issues immediately and gave tests a reliable, documented input set

### What Was Inefficient
- Milestone audit ran before Phases 3 and 4 were complete, producing a stale `gaps_found` result that had to be manually overridden at milestone completion
- Plan 04-01 (instrumentation) could have been done as part of 04-02 setup — the separation added a small extra plan boundary

### Patterns Established
- **Separate Vitest/Vite configs**: Always keep `vitest.config.ts` independent — never merge into `vite.config.ts`
- **SheetJS inline fix**: `server.deps.inline: ['xlsx']` is the standard fix for SheetJS in Vitest
- **data-testid before E2E**: Add test IDs as a distinct step before writing Playwright specs
- **Fixture generator script**: Programmatic `.xlsx` generation via SheetJS in `tests/fixtures/generate.ts` with read-back assertions

### Key Lessons
1. Run `/gsd:audit-milestone` only after all phases are complete — a mid-milestone audit produces stale gap reports
2. Research phase investment pays off: identifying the 5 Vitest/SheetJS/Playwright pitfalls upfront eliminated all setup friction
3. Instrumentation as a named phase gives future tests a stable foundation — `data-testid` attributes are cheap to add and invaluable for E2E stability

### Cost Observations
- Model mix: ~100% sonnet
- Sessions: ~4 sessions
- Notable: Planning phases (research + plan checker) cost was justified — zero plan revisions needed during execution

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 Test Infrastructure | 4 | 10 | First test milestone — established all testing patterns |

### Cumulative Quality

| Milestone | Unit Tests | E2E Tests | Fixtures |
|-----------|------------|-----------|----------|
| v1.0 | 43 | 17 | 7 |

### Top Lessons (Verified Across Milestones)

1. Research phase upfront investment eliminates setup friction — identify known pitfalls before writing any code
2. `data-testid` attributes as a dedicated instrumentation step before E2E tests produces zero selector rewrites
