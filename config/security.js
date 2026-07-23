/**
 * Security configuration for file handling
 */

// Potentially dangerous file extensions
export const DANGEROUS_EXTENSIONS = [
  // Executables
  '.exe', '.dll', '.so', '.dylib', '.com', '.bat', '.cmd', '.msi', '.app',
  // Scripts
  '.sh', '.bash', '.zsh', '.ps1', '.vbs', '.wsf',
  // Archives that might contain malware
  '.scr', '.cpl', '.msc',
  // Other dangerous types
  '.jar', '.apk', '.ipa', '.deb', '.rpm',
];

// File extensions that should show security warnings
export const WARNING_EXTENSIONS = [
  ...DANGEROUS_EXTENSIONS,
  '.js', '.mjs', '.cjs',  // JavaScript files
  '.py', '.rb', '.pl',     // Other scripts
  '.zip', '.tar', '.gz', '.7z', '.rar',  // Archives
];

// Check if file is potentially dangerous
export function isDangerousFile(filename) {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return DANGEROUS_EXTENSIONS.includes(ext);
}

// Check if file should show warning
export function shouldWarnFile(filename) {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return WARNING_EXTENSIONS.includes(ext);
}

// Get security warning message for file type
export function getSecurityWarning(filename) {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];

  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return '⚠️ **SECURITY WARNING**: This file is potentially dangerous. Do not run it unless you trust the source.';
  }

  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    return '⚠️ **Caution**: JavaScript file. Review code before using in your projects.';
  }

  if (['.py', '.rb', '.pl', '.sh', '.bash'].includes(ext)) {
    return '⚠️ **Caution**: Script file. Review code before executing.';
  }

  if (['.zip', '.tar', '.gz', '.7z', '.rar'].includes(ext)) {
    return '⚠️ **Caution**: Archive file. Scan for viruses before extracting.';
  }

  return null;
}

// Content Security Policy for iframe sandboxing
export const IFRAME_SANDBOX = 'allow-scripts';

// Stricter sandbox for untrusted content
export const IFRAME_SANDBOX_STRICT = [
  // No allow-scripts - completely disable scripts
  // No allow-same-origin - prevent access to parent
  'allow-downloads',      // Allow downloads only
].join(' ');

// Recommended CSP headers (to be added in server configuration)
export const RECOMMENDED_CSP = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],  // For Mermaid CDN
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'frame-src': ["'self'"],  // Restrict iframe sources
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],  // Prevent clickjacking
};

// Convert CSP object to header string
export function buildCSPHeader(csp = RECOMMENDED_CSP) {
  return Object.entries(csp)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');
}

export function setDownloadSecurityHeaders(res, filePath) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (/\.html?$/i.test(filePath)) {
    res.setHeader('Content-Security-Policy', 'sandbox allow-scripts');
  } else if (/\.svg$/i.test(filePath)) {
    res.setHeader('Content-Security-Policy', 'sandbox');
  }
}
