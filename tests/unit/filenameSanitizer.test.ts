// tests/unit/filenameSanitizer.test.ts
// Covers: sanitization, normalization, collisions, and Unicode edge cases.
import { describe, it, expect } from 'vitest'
import {
  sanitizeFilename,
  resolveCollision,
  createFileNameEntry,
  splitExt,
  shortHash,
} from '../../src/lib/filenameSanitizer'

// ── splitExt ──────────────────────────────────────────────────────────────────

describe('splitExt', () => {
  it('splits a standard extension', () => {
    expect(splitExt('report.xlsx')).toEqual({ base: 'report', ext: '.xlsx' })
  })

  it('splits a double extension (keeps last)', () => {
    expect(splitExt('archive.tar.gz')).toEqual({ base: 'archive.tar', ext: '.gz' })
  })

  it('returns no ext for dotfiles (leading dot)', () => {
    // Leading dot: ".gitignore" → base=".gitignore", ext=""
    expect(splitExt('.gitignore')).toEqual({ base: '.gitignore', ext: '' })
  })

  it('returns no ext for names without dot', () => {
    expect(splitExt('README')).toEqual({ base: 'README', ext: '' })
  })

  it('handles empty string', () => {
    expect(splitExt('')).toEqual({ base: '', ext: '' })
  })
})

// ── shortHash ─────────────────────────────────────────────────────────────────

describe('shortHash', () => {
  it('returns a 6-character hex string', () => {
    const h = shortHash('hello')
    expect(h).toHaveLength(6)
    expect(/^[0-9a-f]+$/.test(h)).toBe(true)
  })

  it('is deterministic for the same input', () => {
    expect(shortHash('budget.xlsx')).toBe(shortHash('budget.xlsx'))
  })

  it('differs for different inputs', () => {
    expect(shortHash('a')).not.toBe(shortHash('b'))
  })
})

// ── sanitizeFilename ──────────────────────────────────────────────────────────

describe('sanitizeFilename — basic', () => {
  it('preserves a simple safe filename', () => {
    expect(sanitizeFilename('report.xlsx')).toBe('report.xlsx')
  })

  it('preserves the file extension', () => {
    expect(sanitizeFilename('Q4 Budget.xlsx')).toBe('Q4 Budget.xlsx')
  })

  it('collapses multiple spaces to one', () => {
    expect(sanitizeFilename('my   file.xlsx')).toBe('my file.xlsx')
  })

  it('strips leading and trailing spaces', () => {
    expect(sanitizeFilename('  report.xlsx  ')).toBe('report.xlsx')
  })

  it('strips leading and trailing dots', () => {
    expect(sanitizeFilename('...report.xlsx...')).toBe('report.xlsx')
  })
})

describe('sanitizeFilename — illegal characters', () => {
  it('removes backslash (treated as path separator, keeps basename)', () => {
    // Backslash is converted to a forward slash for path traversal prevention;
    // only the basename portion after the last separator is kept.
    expect(sanitizeFilename('fi\\le.xlsx')).toBe('le.xlsx')
  })

  it('removes colon', () => {
    expect(sanitizeFilename('my:file.xlsx')).toBe('myfile.xlsx')
  })

  it('removes asterisk, question mark, quotes, angle brackets, pipe', () => {
    expect(sanitizeFilename('fi*le?.xlsx')).toBe('file.xlsx')
    expect(sanitizeFilename('file<name>.xlsx')).toBe('filename.xlsx')
    expect(sanitizeFilename('"quoted".xlsx')).toBe('quoted.xlsx')
    expect(sanitizeFilename('pipe|file.xlsx')).toBe('pipefile.xlsx')
  })

  it('strips control characters', () => {
    expect(sanitizeFilename('fi\x00le\x1Fname.xlsx')).toBe('filename.xlsx')
  })
})

describe('sanitizeFilename — path traversal', () => {
  it('strips absolute Unix path', () => {
    expect(sanitizeFilename('/etc/passwd')).toBe('passwd')
  })

  it('strips path traversal sequences', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd')
  })

  it('strips Windows absolute path', () => {
    expect(sanitizeFilename('C:\\Users\\file.xlsx')).toBe('file.xlsx')
  })

  it('strips forward-slash directory prefix', () => {
    expect(sanitizeFilename('some/dir/report.xlsx')).toBe('report.xlsx')
  })
})

describe('sanitizeFilename — reserved names', () => {
  it('appends underscore to Windows reserved name CON', () => {
    expect(sanitizeFilename('CON')).toBe('CON_')
  })

  it('handles reserved name with extension: NUL.xlsx', () => {
    expect(sanitizeFilename('NUL.xlsx')).toBe('NUL_.xlsx')
  })

  it('handles COM1.xlsx', () => {
    expect(sanitizeFilename('COM1.xlsx')).toBe('COM1_.xlsx')
  })

  it('handles LPT9', () => {
    expect(sanitizeFilename('LPT9')).toBe('LPT9_')
  })

  it('is case-insensitive for reserved names', () => {
    expect(sanitizeFilename('con.xlsx')).toBe('con_.xlsx')
    expect(sanitizeFilename('Prn.xlsx')).toBe('Prn_.xlsx')
  })

  it('does not alter non-reserved names similar to reserved ones', () => {
    // "CONSOLE" is not reserved
    expect(sanitizeFilename('CONSOLE.xlsx')).toBe('CONSOLE.xlsx')
  })
})

describe('sanitizeFilename — Unicode / NFC normalization', () => {
  it('NFC-normalizes a composed Unicode name', () => {
    // 'café' can be NFD (e + combining acute) or NFC (é precomposed)
    const nfd = 'cafe\u0301.xlsx' // NFD form
    const nfc = 'caf\u00E9.xlsx'  // NFC form
    expect(sanitizeFilename(nfd)).toBe(nfc)
  })

  it('preserves CJK characters', () => {
    expect(sanitizeFilename('预算表.xlsx')).toBe('预算表.xlsx')
  })

  it('preserves Arabic characters', () => {
    expect(sanitizeFilename('ميزانية.xlsx')).toBe('ميزانية.xlsx')
  })

  it('preserves emoji in filenames', () => {
    // Emoji are valid in filenames on most systems
    expect(sanitizeFilename('report🎉.xlsx')).toBe('report🎉.xlsx')
  })
})

describe('sanitizeFilename — max length', () => {
  it('truncates base name longer than 200 characters', () => {
    const longBase = 'a'.repeat(250)
    const result = sanitizeFilename(longBase + '.xlsx')
    const { base } = splitExt(result)
    expect(base.length).toBeLessThanOrEqual(200)
    expect(result.endsWith('.xlsx')).toBe(true)
  })
})

describe('sanitizeFilename — empty / all-illegal input', () => {
  it('falls back to "file" for an empty string', () => {
    expect(sanitizeFilename('')).toBe('file')
  })

  it('falls back to "file" when all characters are illegal', () => {
    expect(sanitizeFilename('***???')).toBe('file')
  })

  it('falls back to "file" preserving extension', () => {
    expect(sanitizeFilename('***.xlsx')).toBe('file.xlsx')
  })
})

// ── resolveCollision ──────────────────────────────────────────────────────────

describe('resolveCollision', () => {
  it('returns the name unchanged when no collision', () => {
    const used = new Set<string>()
    expect(resolveCollision('budget.xlsx', used)).toBe('budget.xlsx')
  })

  it('appends hash suffix on collision', () => {
    const used = new Set(['budget.xlsx'])
    const result = resolveCollision('budget.xlsx', used)
    expect(result).not.toBe('budget.xlsx')
    expect(result).toMatch(/^budget_[0-9a-f]{6}\.xlsx$/)
  })

  it('is deterministic — same collision produces same result', () => {
    const r1 = resolveCollision('budget.xlsx', new Set(['budget.xlsx']))
    const r2 = resolveCollision('budget.xlsx', new Set(['budget.xlsx']))
    expect(r1).toBe(r2)
  })

  it('preserves extension on collision', () => {
    const used = new Set(['report.xlsm'])
    const result = resolveCollision('report.xlsm', used)
    expect(result.endsWith('.xlsm')).toBe(true)
  })

  it('handles name without extension', () => {
    const used = new Set(['README'])
    const result = resolveCollision('README', used)
    expect(result).toMatch(/^README_[0-9a-f]{6}$/)
  })
})

// ── createFileNameEntry ───────────────────────────────────────────────────────

describe('createFileNameEntry', () => {
  it('creates an entry with all required fields', () => {
    const used = new Set<string>()
    const entry = createFileNameEntry('My Report.xlsx', 'id-001', used)
    expect(entry.originalName).toBe('My Report.xlsx')
    expect(entry.sanitizedName).toBe('My Report.xlsx')
    expect(entry.internalId).toBe('id-001')
    expect(entry.createdAt).toBeTruthy()
    // ISO timestamp
    expect(() => new Date(entry.createdAt)).not.toThrow()
  })

  it('registers the sanitized name in usedNames', () => {
    const used = new Set<string>()
    createFileNameEntry('budget.xlsx', 'id-001', used)
    expect(used.has('budget.xlsx')).toBe(true)
  })

  it('resolves collision when same sanitized name already used', () => {
    const used = new Set<string>()
    const e1 = createFileNameEntry('budget.xlsx', 'id-001', used)
    const e2 = createFileNameEntry('budget.xlsx', 'id-002', used)

    expect(e1.sanitizedName).toBe('budget.xlsx')
    expect(e2.sanitizedName).not.toBe('budget.xlsx')
    expect(e2.sanitizedName).toMatch(/^budget_[0-9a-f]{6}\.xlsx$/)
    // Both entries still show the original name
    expect(e1.originalName).toBe('budget.xlsx')
    expect(e2.originalName).toBe('budget.xlsx')
  })

  it('three identical filenames all get unique sanitized names', () => {
    const used = new Set<string>()
    const e1 = createFileNameEntry('data.xlsx', 'id-001', used)
    const e2 = createFileNameEntry('data.xlsx', 'id-002', used)
    const e3 = createFileNameEntry('data.xlsx', 'id-003', used)

    const names = [e1.sanitizedName, e2.sanitizedName, e3.sanitizedName]
    const unique = new Set(names)
    // Collision resolution must guarantee all three are distinct.
    expect(unique.size).toBe(3)
  })

  it('sanitizes illegal characters and stores originalName unchanged', () => {
    const used = new Set<string>()
    const entry = createFileNameEntry('fi*le?.xlsx', 'id-001', used)
    expect(entry.originalName).toBe('fi*le?.xlsx')
    expect(entry.sanitizedName).toBe('file.xlsx')
  })

  it('handles Unicode filename — originalName is preserved, sanitized is NFC', () => {
    const nfd = 'cafe\u0301.xlsx'
    const nfc = 'caf\u00E9.xlsx'
    const used = new Set<string>()
    const entry = createFileNameEntry(nfd, 'id-001', used)
    expect(entry.originalName).toBe(nfd)
    expect(entry.sanitizedName).toBe(nfc)
  })
})
