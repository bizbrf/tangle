/**
 * Filename sanitization, normalization, collision handling, and display/storage mapping.
 *
 * Goals:
 *  - NFC-normalize Unicode filenames.
 *  - Strip invalid / OS-unsafe characters.
 *  - Prevent reserved names (Windows: CON, PRN, AUX, NUL, COM1-9, LPT1-9).
 *  - Block path traversal (absolute paths, "../").
 *  - Enforce a maximum base-name length (200 chars).
 *  - Deterministic collision handling: append "_<hash6>" before the extension.
 *  - Separate display name (originalName) from storage name (sanitizedName).
 */

/** Maximum byte-safe length for the base name (without extension). */
const MAX_BASE_LENGTH = 200;

/**
 * Characters that are illegal in filenames on Windows, macOS, or Linux.
 * Includes: \ / : * ? " < > | and control characters (0x00–0x1F).
 */
// eslint-disable-next-line no-control-regex
const INVALID_CHARS_RE = /[\\/:*?"<>|\x00-\x1F]/g;

/**
 * Windows reserved device names (case-insensitive).
 * Matching the base name (before extension) exactly.
 */
const RESERVED_NAMES_RE = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

/**
 * Strip leading/trailing dots and spaces (Windows does not allow them).
 */
const LEADING_TRAILING_DOT_SPACE_RE = /^[\s.]+|[\s.]+$/g;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Split a filename into { base, ext }. Extension includes the leading dot. */
export function splitExt(filename: string): { base: string; ext: string } {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) {
    return { base: filename, ext: '' };
  }
  return {
    base: filename.slice(0, lastDot),
    ext: filename.slice(lastDot),
  };
}

/**
 * Produce a short, deterministic 6-character hex hash of a string.
 * Uses a djb2-style hash — good enough for collision disambiguation.
 */
export function shortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h, 33) ^ input.charCodeAt(i);
    h = h >>> 0; // keep 32-bit unsigned
  }
  return h.toString(16).padStart(8, '0').slice(-6);
}

// ── Core sanitizer ────────────────────────────────────────────────────────────

/**
 * Sanitize a single filename string.
 *
 * Steps:
 * 1. NFC-normalize.
 * 2. Extract the real extension from the original basename (strip trailing
 *    garbage first so "report.xlsx..." → ext=".xlsx", not "...").
 * 3. Strip path separators / traversal sequences (path-traversal prevention).
 * 4. Isolate the base by removing the extension from the end.
 * 5. Remove illegal characters from the base.
 * 6. Collapse consecutive whitespace.
 * 7. Strip leading/trailing dots and spaces from the base.
 * 8. Handle reserved names.
 * 9. Enforce max base length.
 * 10. Fallback to "file" if base is empty.
 * 11. Reassemble: base + ext.
 */
export function sanitizeFilename(filename: string): string {
  // 1. NFC normalize
  const name = filename.normalize('NFC');

  // 2. Derive a clean extension from the original basename.
  //    Strip trailing dots/spaces before splitting so "file.xlsx..." → ".xlsx".
  const rawBasename = name.replace(/\\/g, '/').split('/').pop() ?? name;
  const ext = splitExt(rawBasename.replace(/[.\s]+$/, '')).ext;

  // 3. Block path traversal: take only the last path component.
  let base = name.replace(/\\/g, '/');
  const slashIdx = base.lastIndexOf('/');
  if (slashIdx >= 0) {
    base = base.slice(slashIdx + 1);
  }
  // Strip Windows drive letters (e.g. "C:")
  base = base.replace(/^[A-Za-z]:/, '');

  // 4. Remove the extension from the base so we sanitize only the name part.
  //    For "  report.xlsx  ": find ".xlsx" in base and remove it (with surrounding noise).
  if (ext) {
    const extIdx = base.lastIndexOf(ext);
    if (extIdx >= 0) {
      base = base.slice(0, extIdx) + base.slice(extIdx + ext.length);
    }
  }

  // 5. Remove illegal characters
  base = base.replace(INVALID_CHARS_RE, '');

  // 6. Collapse consecutive whitespace
  base = base.replace(/\s+/g, ' ');

  // 7. Strip leading/trailing dots and spaces
  base = base.replace(LEADING_TRAILING_DOT_SPACE_RE, '');

  // 8. Reserved name handling — append underscore to base
  if (RESERVED_NAMES_RE.test(base)) {
    base += '_';
  }

  // 9. Enforce max base length (truncate if too long)
  if (base.length > MAX_BASE_LENGTH) {
    base = base.slice(0, MAX_BASE_LENGTH);
  }

  // 10. Fallback if empty
  if (base.length === 0) {
    base = 'file';
  }

  return base + ext;
}

// ── Collision handler ─────────────────────────────────────────────────────────

/**
 * Given a desired sanitized filename and a Set of already-used names,
 * return a unique name by appending "_<hash6>" before the extension if needed.
 *
 * The hash seed is the original unsanitized name (passed as `originalName`),
 * which ensures that two different original names that sanitize to the same
 * result can still produce distinct hashes. If the hash-suffixed name is also
 * taken, the seed is extended with an incrementing counter until a unique name
 * is found, guaranteeing termination.
 */
export function resolveCollision(
  sanitized: string,
  used: Set<string>,
  originalName?: string,
): string {
  if (!used.has(sanitized)) {
    return sanitized;
  }
  const { base, ext } = splitExt(sanitized);
  const seed = originalName ?? sanitized;
  let candidate = `${base}_${shortHash(seed)}${ext}`;
  let attempt = 1;
  while (used.has(candidate)) {
    candidate = `${base}_${shortHash(seed + String(attempt))}${ext}`;
    attempt++;
  }
  return candidate;
}

// ── FileNameEntry ─────────────────────────────────────────────────────────────

export interface FileNameEntry {
  /** The original filename as provided by the user / OS. */
  originalName: string;
  /** Sanitized, OS-safe storage name (may differ from originalName). */
  sanitizedName: string;
  /** Stable internal identifier (UUID or similar). */
  internalId: string;
  /** ISO timestamp of when the entry was created. */
  createdAt: string;
}

/**
 * Create a FileNameEntry for a file being imported.
 *
 * @param originalName  Raw filename from the browser File object.
 * @param internalId    Stable ID (e.g. crypto.randomUUID()).
 * @param usedNames     Set of sanitized names already in use (mutated in-place
 *                      to register the new name so callers don't need to track).
 */
export function createFileNameEntry(
  originalName: string,
  internalId: string,
  usedNames: Set<string>,
): FileNameEntry {
  const sanitized = sanitizeFilename(originalName);
  const unique = resolveCollision(sanitized, usedNames, originalName);
  usedNames.add(unique);
  return {
    originalName,
    sanitizedName: unique,
    internalId,
    createdAt: new Date().toISOString(),
  };
}
