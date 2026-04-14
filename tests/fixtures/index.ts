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
  unicodeName: resolve(FIXTURE_DIR, '财务数据.xlsx'),
  structuredRef: resolve(FIXTURE_DIR, 'structured-ref.xlsx'),
  specialSheets: resolve(FIXTURE_DIR, 'special-sheets.xlsx'),
  manyExternals: resolve(FIXTURE_DIR, 'many-externals.xlsx'),
  mixedRefs: resolve(FIXTURE_DIR, 'mixed-refs.xlsx'),
  falsePositives: resolve(FIXTURE_DIR, 'false-positives.xlsx'),
  shadowedNames: resolve(FIXTURE_DIR, 'shadowed-names.xlsx'),
  longFormulas: resolve(FIXTURE_DIR, 'long-formulas.xlsx'),
  deepChains: resolve(FIXTURE_DIR, 'deep-chains.xlsx'),
  quotedSpecials: resolve(FIXTURE_DIR, 'quoted-specials.xlsx'),
  nestedFunctions: resolve(FIXTURE_DIR, 'nested-functions.xlsx'),
  numericExternalLinks: resolve(FIXTURE_DIR, 'numeric-external-links.xlsx'),
} as const

export type FixtureName = keyof typeof FIXTURES
