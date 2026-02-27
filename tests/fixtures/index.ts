// tests/fixtures/index.ts
// Typed fixture paths — import FIXTURES in tests to get correct absolute paths
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURE_DIR = resolve(fileURLToPath(import.meta.url), '..')

export const FIXTURES = {
  crossSheet: resolve(FIXTURE_DIR, 'cross-sheet.xlsx'),
  externalRef: resolve(FIXTURE_DIR, 'external-ref.xlsx'),
  namedRanges: resolve(FIXTURE_DIR, 'named-ranges.xlsx'),
  empty: resolve(FIXTURE_DIR, 'empty.xlsx'),
  large: resolve(FIXTURE_DIR, 'large.xlsx'),
  circular: resolve(FIXTURE_DIR, 'circular.xlsx'),
  malformed: resolve(FIXTURE_DIR, 'malformed.xlsx'),
} as const

export type FixtureName = keyof typeof FIXTURES
