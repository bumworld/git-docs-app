# Security Guide

This document outlines the security considerations and measures implemented in the Git Docs application.

## 🔒 Security Features

### 1. File Upload Handling

#### Executable Files (.exe, .sh, .bat, etc.)
- **Status**: ⚠️ Downloadable but with warnings
- **Protection**: Files are stored in `/downloads` directory with download-only links
- **Warning**: Red danger callout displayed to users before download
- **Risk**: Users can still download and execute these files locally

#### JavaScript Files (.js, .mjs, .cjs)
- **Status**: ⚠️ Downloadable with caution notice
- **Protection**: Not executed in browser context
- **Warning**: Yellow caution callout displayed
- **Usage**: Safe for code review, but users should inspect before using

#### HTML Files (.html, .htm)
- **Status**: 🟡 Sandboxed iframe display
- **Protection**:
  - Displayed in `<iframe>` with `sandbox` attribute
  - Sandbox allows: `allow-scripts`, `allow-same-origin`
  - Cannot access parent window in most cases
- **Warning**: Security notice displayed above iframe
- **Risk**: Limited XSS risk if iframe breaks sandbox

#### Markdown with Inline HTML
- **Status**: 🟡 Passed through to Astro/Starlight
- **Protection**: Relies on Astro's built-in sanitization
- **Risk**: XSS possible if Astro doesn't sanitize properly
- **Recommendation**: Avoid allowing untrusted users to upload markdown

### 2. Content Security Policy (CSP)

The application provides recommended CSP headers in `config/security.js`:

```javascript
{
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'frame-src': ["'self'"],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"]
}
```

**Note**: These headers must be configured at the server level (Express, Nginx, etc.)

### 3. Path Traversal Prevention

- File paths are sanitized using `sanitizeSlug()` function
- Directory names are processed through `sanitizeDirName()`
- Special characters and path traversal attempts (`../`) are removed
- Null bytes are rejected by the filesystem

### 4. File Type Warnings

The system automatically displays warnings for:

| File Type | Warning Level | Message |
|-----------|---------------|---------|
| .exe, .dll, .sh, .bat | 🔴 DANGER | "This file is potentially dangerous. Do not run it unless you trust the source." |
| .js, .mjs, .cjs | 🟡 CAUTION | "JavaScript file. Review code before using in your projects." |
| .py, .rb, .sh | 🟡 CAUTION | "Script file. Review code before executing." |
| .zip, .tar, .gz | 🟡 CAUTION | "Archive file. Scan for viruses before extracting." |
| .html, .htm | 🟡 NOTICE | "This HTML file is displayed in a sandboxed iframe." |

## 🛡️ Security Recommendations

### For Administrators

1. **Enable Authentication**
   - Configure Google OAuth in `conf/google_auth.json`
   - Restrict upload permissions to trusted users only

2. **Configure CSP Headers**
   ```javascript
   // In server/index.js or reverse proxy config
   app.use((req, res, next) => {
     res.setHeader('Content-Security-Policy', buildCSPHeader());
     next();
   });
   ```

3. **Add File Type Restrictions**
   - Edit `config/security.js` to block specific file types
   - Implement server-side file type validation

4. **Enable Virus Scanning**
   - Integrate ClamAV or similar for uploaded files
   - Scan files before copying to `public/downloads`

5. **Implement Rate Limiting**
   - Prevent abuse of file upload functionality
   - Use Express rate limiter middleware

6. **Regular Updates**
   - Keep dependencies updated: `npm audit fix`
   - Monitor security advisories for Astro and Starlight

### For Users

1. **Be Cautious with Downloads**
   - Only download files from trusted sources
   - Pay attention to security warnings
   - Scan downloaded files with antivirus software

2. **Verify HTML Content**
   - HTML files run in sandboxed iframes but may still execute scripts
   - Open in new window to inspect before trusting

3. **Review Code Files**
   - Always review `.js`, `.sh`, `.py` files before executing
   - Check for suspicious network requests or file operations

## 🔍 Security Testing

Run security tests:
```bash
npm test tests/security.test.js
```

Tests cover:
- Executable file handling
- XSS in HTML iframes
- XSS in Markdown
- Path traversal attempts
- File size bombs
- Binary files with text extensions

## 📋 Security Checklist

- [x] Executable files show danger warnings
- [x] HTML files are sandboxed in iframes
- [x] Script files show caution notices
- [x] Path traversal is prevented
- [x] File size limits are handled gracefully
- [ ] CSP headers configured in production
- [ ] Virus scanning enabled
- [ ] Rate limiting implemented
- [ ] Authentication enabled
- [ ] Regular security audits performed

## 🚨 Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public issue
2. Email security details to the administrator
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [iframe sandbox attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox)
- [Astro Security](https://docs.astro.build/en/guides/security/)

---

**Last Updated**: 2026-02-16
**Version**: 1.0.0
