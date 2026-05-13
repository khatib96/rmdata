import * as path from 'path';

/** True if resolved `candidate` is the same path as `rootDir` or lies inside it (handles Windows case). */
export function isPathInsideDirectory(rootDir: string, candidate: string): boolean {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(candidate);
  if (resolved === root) return true;
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return resolved.length >= prefix.length && resolved.toLowerCase().startsWith(prefix.toLowerCase());
}

/**
 * Joins root with a relative path and returns the absolute path only if it stays inside root.
 * Rejects absolute paths, drive-relative segments, and `..` escapes.
 */
export function resolveSafePathUnderRoot(rootDir: string, relativePath: string): string | null {
  if (relativePath == null || typeof relativePath !== 'string') return null;
  if (path.isAbsolute(relativePath)) return null;
  const normalized = path.normalize(relativePath);
  if (normalized.startsWith('..') || normalized.includes(`${path.sep}..${path.sep}`) || normalized.endsWith(`${path.sep}..`)) {
    return null;
  }
  const full = path.resolve(rootDir, normalized);
  return isPathInsideDirectory(rootDir, full) ? full : null;
}

/** Basename only: letters, digits, underscore, hyphen, and a single extension block. */
export function sanitizeImageFilename(filename: string): string | null {
  const base = path.basename(String(filename || '')).trim();
  if (!base || base.length > 200) return null;
  if (!/^[a-zA-Z0-9_.-]+\.(jpe?g|png|gif|webp)$/i.test(base)) return null;
  if (base.includes('..')) return null;
  return base;
}
