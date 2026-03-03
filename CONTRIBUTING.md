# Contributing to Tangle

Thank you for your interest in contributing to Tangle! This document provides guidelines for developing and testing the project.

## Development Setup

1. **Prerequisites**
   - Node.js 20 or higher
   - npm (comes with Node.js)

2. **Install Dependencies**
   ```bash
   npm ci
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   The app will be available at http://localhost:5173

## Testing

Tangle has two types of automated tests: unit tests and end-to-end (E2E) tests.

### Unit Tests

Unit tests verify individual functions and modules in isolation.

```bash
# Run all unit tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

Unit tests are located in `tests/unit/` and use Vitest as the test runner.

### End-to-End (E2E) Tests

E2E tests verify the full application behavior in a real browser using Playwright.

#### Running E2E Tests

```bash
# Run all E2E tests across all browsers
npm run test:e2e

# Run on specific browser
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=firefox
npm run test:e2e -- --project=webkit

# Run specific test file
npm run test:e2e tests/e2e/smoke.spec.ts

# Run tests in UI mode (interactive)
npx playwright test --ui

# Debug specific test
npx playwright test --debug tests/e2e/smoke.spec.ts
```

#### First-Time Setup

Install Playwright browsers:
```bash
npx playwright install --with-deps
```

#### E2E Test Organization

E2E tests are located in `tests/e2e/` and organized by feature:

- `smoke.spec.ts` - Basic app loading and rendering
- `upload.spec.ts` - File upload functionality
- `interactions.spec.ts` - User interactions (layout modes, filtering)
- `detail-panel.spec.ts` - Detail panel and focus mode
- `errors.spec.ts` - Error handling
- `graph-controls.spec.ts` - Graph controls (direction, fit-to-view, grouping)
- `file-import.spec.ts` - File import features (Unicode, collisions)
- `formula-references.spec.ts` - Named ranges and formula references
- `layout-reorganizer.spec.ts` - Layout recalculation and stability

#### Test Fixtures

Test Excel files are located in `tests/fixtures/`. These files cover various scenarios:

- `cross-sheet.xlsx` - Cross-sheet references
- `external-ref.xlsx` - External file references
- `named-ranges.xlsx` - Named range definitions
- `circular.xlsx` - Circular reference detection
- `finance-model.xlsx` - Complex workbook with many formulas
- `large.xlsx` - Performance testing
- `empty.xlsx` - Edge case handling
- `malformed.xlsx` - Error handling

#### Writing New E2E Tests

1. Create a new spec file in `tests/e2e/` or add to existing file
2. Use helper functions from `tests/e2e/helpers.ts`:
   - `uploadFile(page, filename)` - Upload a test fixture
   - `waitForNodes(page)` - Wait for graph nodes to render
   - `waitForDetailPanel(page)` - Wait for detail panel
   - `waitForLayout(page)` - Wait for layout to stabilize

3. Example test structure:
```typescript
import { test, expect } from '@playwright/test'
import { uploadFile, waitForNodes } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('description of what is being tested', async ({ page }) => {
  await uploadFile(page, 'test-fixture.xlsx')
  await waitForNodes(page)

  // Your test assertions
  await expect(page.getByTestId('some-element')).toBeVisible()
})
```

#### Test Artifacts

When tests fail, Playwright automatically captures:
- **Screenshots** - Visual state at time of failure
- **Videos** - Recording of the entire test
- **Traces** - Detailed timeline of actions and network activity

Access artifacts:
```bash
# View HTML report with artifacts
npx playwright show-report

# View specific trace file
npx playwright show-trace test-results/path-to-trace.zip
```

In CI, artifacts are uploaded to GitHub Actions and retained for 30 days.

#### Test Determinism

To ensure stable, flake-free tests:

1. **Wait for elements** using Playwright's built-in waiting:
   ```typescript
   await expect(element).toBeVisible()
   ```

2. **Use test IDs** for reliable selectors:
   ```typescript
   page.getByTestId('element-name')
   ```

3. **Wait for layout** after operations that trigger recalculation:
   ```typescript
   await waitForLayout(page)
   ```

4. **Avoid hardcoded timeouts** except for layout animations (use minimal timeouts)

#### CI Configuration

E2E tests run in CI on every pull request across Chromium, Firefox, and WebKit. The configuration is in `.github/workflows/ci.yml`.

## Code Quality

### Linting

```bash
npm run lint
```

### Type Checking

```bash
npx tsc -b --noEmit
```

### Building

```bash
npm run build
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run tests to ensure they pass
5. Commit your changes with clear messages
6. Push to your fork
7. Open a pull request with a description of changes

## Questions?

If you have questions about contributing, please open an issue on GitHub.
