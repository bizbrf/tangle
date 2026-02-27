---
phase: 01-infrastructure
plan: 01
subsystem: testing
tags: [vitest, typescript, eslint, coverage, jsdom]

# Dependency graph
requires: []
provides:
  - Vitest unit test runner with SheetJS (xlsx) CJS compatibility fix
  - npm scripts for test, test:watch, test:coverage, test:e2e, fixtures:generate
  - tsconfig.test.json giving test files their own TypeScript context with vitest/globals types
  - ESLint test-file override using globals.node and tsconfig.test.json
affects:
  - 01-02 (fixture generator)
  - 01-03 (Playwright E2E setup)
  - 02-parser-tests
  - 02-graph-tests

# Tech tracking
tech-stack:
  added:
    - vitest@^4.0.18
    - "@vitest/coverage-v8@^4.0.18"
    - jsdom@^28.1.0
  patterns:
    - Separate vitest.config.ts (not merged into vite.config.ts)
    - server.deps.inline for CJS packages in Vitest ESM context
    - Per-tsconfig ESLint project references for test vs. app files

key-files:
  created:
    - vitest.config.ts
    - tsconfig.test.json
  modified:
    - package.json
    - tsconfig.node.json
    - eslint.config.js

key-decisions:
  - "environment: 'node' not jsdom — parser.ts/graph.ts need no DOM, node avoids overhead"
  - "server.deps.inline: ['xlsx'] — xlsx@0.18.5 is CJS; without this Vitest throws ERR_REQUIRE_ESM"
  - "Separate vitest.config.ts from vite.config.ts — keeps build and test configs independently evolvable"
  - "tsconfig.test.json extends tsconfig.node.json — test files run in Node context, not browser context"
  - "Removed triple-slash reference from vitest.config.ts — ESLint @typescript-eslint/triple-slash-reference rule disallows it; import from vitest/config is sufficient"
  - "Added src-tauri/target to ESLint globalIgnores — Tauri build artifacts were failing parse as JS"

patterns-established:
  - "Test configs isolated: tsconfig.test.json for type-awareness, eslint override for lint rules"
  - "Pre-register all npm scripts in initial setup even if targets (Playwright, fixture generator) aren't built yet"

requirements-completed: [INFRA-01, INFRA-02, INFRA-05, INFRA-06, INFRA-07]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 1 Plan 01: Vitest Test Runner Setup Summary

**Vitest configured with xlsx CJS inline fix, v8 coverage reporting, and TypeScript/ESLint integration for test files**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T10:05:36Z
- **Completed:** 2026-02-27T10:08:06Z
- **Tasks:** 2
- **Files modified:** 5 (vitest.config.ts created, tsconfig.test.json created, package.json, tsconfig.node.json, eslint.config.js)

## Accomplishments
- Installed vitest, @vitest/coverage-v8, and jsdom; all three registered in devDependencies
- Created vitest.config.ts with `server.deps.inline: ['xlsx']` to resolve SheetJS CJS/ESM conflict
- Created tsconfig.test.json giving test files vitest/globals types without polluting app tsconfig
- Added test-file ESLint override using globals.node and parserOptions.project pointing to tsconfig.test.json
- Registered all five npm scripts: test, test:watch, test:coverage, test:e2e, fixtures:generate

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Vitest and create vitest.config.ts** - `c165794` (chore)
2. **Task 2: Update TypeScript configs and ESLint for test files** - `89e989c` (chore)

**Plan metadata:** _(final commit hash added after docs commit)_

## Files Created/Modified
- `vitest.config.ts` - Vitest runner config; node environment, xlsx inline, v8 coverage on src/lib/**
- `tsconfig.test.json` - Test TypeScript context; extends tsconfig.node.json, adds vitest/globals types
- `package.json` - Five test scripts added; vitest/coverage-v8/jsdom added to devDependencies
- `tsconfig.node.json` - include array extended to cover vitest.config.ts and playwright.config.ts
- `eslint.config.js` - Test-file override added; src-tauri/target added to globalIgnores

## Decisions Made
- Used `environment: 'node'` (not jsdom) — parser.ts and graph.ts have no DOM dependency; node avoids jsdom overhead
- Used `server.deps.inline: ['xlsx']` — xlsx@0.18.5 is CommonJS; Vitest's ESM transform fails without this flag
- Kept vitest.config.ts separate from vite.config.ts — independent evolution of build vs. test settings
- Removed triple-slash `/// <reference types="vitest/config" />` — ESLint `@typescript-eslint/triple-slash-reference` rule flags it; importing from `vitest/config` is the correct approach for Vitest 4.x

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed triple-slash reference from vitest.config.ts**
- **Found during:** Task 2 (ESLint verification)
- **Issue:** `/// <reference types="vitest/config" />` triggers `@typescript-eslint/triple-slash-reference` lint error; plan specified this line but it violates the existing ESLint config
- **Fix:** Removed the triple-slash line; `import { defineConfig } from 'vitest/config'` already provides full type inference without it
- **Files modified:** vitest.config.ts
- **Verification:** `npm run lint` exits 0
- **Committed in:** 89e989c (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added src-tauri/target to ESLint globalIgnores**
- **Found during:** Task 2 (ESLint verification)
- **Issue:** Tauri release build artifacts in `src-tauri/target/` contain binary/generated JS files that ESLint was attempting to parse, causing 4 parse errors unrelated to our changes
- **Fix:** Added `'src-tauri/target'` to `globalIgnores` in eslint.config.js
- **Files modified:** eslint.config.js
- **Verification:** `npm run lint` exits 0 with no errors
- **Committed in:** 89e989c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 missing critical ignore)
**Impact on plan:** Both fixes necessary for `npm run lint` to exit 0. No scope creep — the changes are minimal and directly related to the plan's stated success criteria.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test runner is fully configured; `npm test` will execute any test file placed in `tests/unit/**/*.test.ts`
- `npm run test:coverage` will generate HTML coverage report in `coverage/` for `src/lib/**/*.ts`
- Ready for Phase 1 Plan 02: fixture generator and first unit tests

---
*Phase: 01-infrastructure*
*Completed: 2026-02-27*

## Self-Check: PASSED

- vitest.config.ts: FOUND
- tsconfig.test.json: FOUND
- 01-01-SUMMARY.md: FOUND
- Commit c165794 (Task 1): FOUND
- Commit 89e989c (Task 2): FOUND
