import path from 'path';

/**
 * Sanitize a string for use in URL slugs.
 * Keeps: alphanumeric, Korean/CJK/Unicode letters, hyphens, underscores
 * Removes: dots, ()[]{}#&+%@!;,='"`~$^|?*<>:\
 * Collapses multiple hyphens, trims leading/trailing hyphens
 *
 * Note: Dots are removed to match Starlight docsLoader() slug normalization.
 * e.g. "libs.versions" → "libsversions", "build.gradle" → "buildgradle"
 */
function sanitize(str) {
  return str
    .replace(/[\s]+/g, '-')
    .replace(/[.()[\]{}#&+%@!;,='"`~$^|?*<>:\\]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

export function sanitizeSlug(name) {
  const ext = path.extname(name);
  const base = ext ? name.slice(0, -ext.length) : name;
  return sanitize(base);
}

export function sanitizeDirName(name) {
  return sanitize(name);
}

export function generateTitle(filename) {
  const name = path.basename(filename, path.extname(filename));
  return name
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

export function formatFileSize(bytes) {
  if (bytes > 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}
