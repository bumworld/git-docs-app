/**
 * tests/unit/processors.test.js
 * 각 파일 프로세서 함수를 독립적으로 테스트
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';

import {
  createStats,
  processMarkdownFile,
  processHtmlFolder,
  processHtmlFile,
  processImageFile,
  processAssetFile,
  processTextNoExtFile,
} from '../../scripts/prebuild/processors.js';
import { sanitizeSlug, sanitizeDirName, generateTitle, formatFileSize } from '../../scripts/prebuild/utils.js';
import {
  isDangerousFile,
  shouldWarnFile,
  getSecurityWarning,
  DANGEROUS_EXTENSIONS,
  WARNING_EXTENSIONS,
} from '../../config/security.js';
import { PATHS } from '../../config/constants.js';

const TMP = path.join(process.cwd(), 'test-tmp-processors');
const TEST_SOURCE = path.join(TMP, 'source');
const TEST_DOCS = path.join(TMP, 'docs');
const TEST_DOWNLOADS = path.join(TMP, 'downloads');

const ORIGINAL_PATHS = { ...PATHS };

before(() => {
  PATHS.DOCS = TEST_DOCS;
  PATHS.DOWNLOADS = TEST_DOWNLOADS;
  fs.ensureDirSync(TEST_SOURCE);
  fs.ensureDirSync(TEST_DOCS);
  fs.ensureDirSync(TEST_DOWNLOADS);
});

after(() => {
  Object.assign(PATHS, ORIGINAL_PATHS);
  fs.removeSync(TMP);
});

beforeEach(() => {
  fs.emptyDirSync(TEST_DOCS);
  fs.emptyDirSync(TEST_DOWNLOADS);
});

// ─── createStats ───────────────────────────────────────────────
describe('createStats', () => {
  it('should return a zero-initialized stats object', () => {
    const stats = createStats();
    assert.strictEqual(stats.processed, 0);
    assert.strictEqual(stats.skipped, 0);
    assert.deepStrictEqual(stats.errors, []);
    assert.deepStrictEqual(stats.byType, { markdown: 0, html: 0, image: 0, asset: 0, textNoExt: 0, static: 0 });
    assert.deepStrictEqual(stats.largeFiles, []);
    assert.deepStrictEqual(stats.longPaths, []);
    assert.deepStrictEqual(stats.collisions, []);
    assert.ok(stats.usedPaths instanceof Set);
  });
});

// ─── processMarkdownFile ────────────────────────────────────────
describe('processMarkdownFile', () => {
  it('should inject title and sidebar frontmatter when missing', () => {
    const src = path.join(TEST_SOURCE, 'hello-world.md');
    const dest = path.join(TEST_DOCS, 'hello-world.md');
    fs.outputFileSync(src, '# Hello\n\nContent here.');

    const stats = createStats();
    processMarkdownFile(src, dest, stats);

    assert.ok(fs.existsSync(dest));
    const parsed = matter(fs.readFileSync(dest, 'utf-8'));
    assert.ok(parsed.data.title);
    assert.ok(parsed.data.sidebar);
    assert.strictEqual(stats.processed, 1);
    assert.strictEqual(stats.byType.markdown, 1);
  });

  it('should preserve existing frontmatter title', () => {
    const src = path.join(TEST_SOURCE, 'custom-title.md');
    const dest = path.join(TEST_DOCS, 'custom-title.md');
    fs.outputFileSync(src, '---\ntitle: "My Custom Title"\n---\n\nContent.');

    const stats = createStats();
    processMarkdownFile(src, dest, stats);

    const parsed = matter(fs.readFileSync(dest, 'utf-8'));
    assert.strictEqual(parsed.data.title, 'My Custom Title');
  });

  it('should handle invalid YAML frontmatter gracefully', () => {
    const src = path.join(TEST_SOURCE, 'bad-yaml.md');
    const dest = path.join(TEST_DOCS, 'bad-yaml.md');
    // YAML 파서가 깨질 수 있는 코드 블록이 섞인 frontmatter
    fs.outputFileSync(src, '---\ntitle: "Test"\nunbalanced: [brackets\n---\n\nContent.');

    const stats = createStats();
    processMarkdownFile(src, dest, stats);

    // 실패해도 파일은 생성되어야 함
    assert.ok(fs.existsSync(dest));
    assert.strictEqual(stats.processed, 1);
  });

  it('should handle empty file', () => {
    const src = path.join(TEST_SOURCE, 'empty.md');
    const dest = path.join(TEST_DOCS, 'empty.md');
    fs.outputFileSync(src, '');

    const stats = createStats();
    processMarkdownFile(src, dest, stats);

    assert.ok(fs.existsSync(dest));
    assert.strictEqual(stats.processed, 1);
  });

  it('should handle Korean filename in title generation', () => {
    const src = path.join(TEST_SOURCE, '한글-파일.md');
    const dest = path.join(TEST_DOCS, '한글-파일.md');
    fs.outputFileSync(src, '내용입니다.');

    const stats = createStats();
    processMarkdownFile(src, dest, stats);

    const parsed = matter(fs.readFileSync(dest, 'utf-8'));
    assert.ok(parsed.data.title);
    assert.ok(parsed.data.title.includes('한글'));
  });

  it('should handle unicode emoji in content', () => {
    const src = path.join(TEST_SOURCE, 'emoji.md');
    const dest = path.join(TEST_DOCS, 'emoji.md');
    fs.outputFileSync(src, '# 🚀 이모지 테스트\n\n내용 🎉');

    const stats = createStats();
    processMarkdownFile(src, dest, stats);

    assert.ok(fs.existsSync(dest));
    const content = fs.readFileSync(dest, 'utf-8');
    assert.ok(content.includes('🚀') || content.includes('🎉'));
  });

  it('should count errors when source file does not exist', () => {
    const src = path.join(TEST_SOURCE, 'nonexistent.md');
    const dest = path.join(TEST_DOCS, 'nonexistent.md');

    const stats = createStats();
    processMarkdownFile(src, dest, stats);

    assert.strictEqual(stats.errors.length, 1);
    assert.strictEqual(stats.processed, 0);
  });
});

// ─── processHtmlFolder ─────────────────────────────────────────
describe('processHtmlFolder', () => {
  it('should create iframe wrapper markdown and copy folder to downloads', () => {
    const srcDir = path.join(TEST_SOURCE, 'my-app');
    fs.ensureDirSync(srcDir);
    fs.outputFileSync(path.join(srcDir, 'index.html'), '<html><body>App</body></html>');
    fs.outputFileSync(path.join(srcDir, 'style.css'), 'body { color: red; }');

    const destMd = path.join(TEST_DOCS, 'my-app.md');
    const stats = createStats();
    processHtmlFolder(srcDir, destMd, 'my-app', stats);

    assert.ok(fs.existsSync(destMd));
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'my-app', 'index.html')));

    const content = fs.readFileSync(destMd, 'utf-8');
    assert.ok(content.includes('iframe'));
    assert.ok(content.includes('/downloads/my-app/'));
    assert.ok(content.includes('sandbox'));
    assert.strictEqual(stats.byType.html, 1);
  });

  it('should not process folder without index.html', () => {
    const srcDir = path.join(TEST_SOURCE, 'no-index');
    fs.ensureDirSync(srcDir);
    fs.outputFileSync(path.join(srcDir, 'README.md'), '# No index');

    const destMd = path.join(TEST_DOCS, 'no-index.md');
    const stats = createStats();
    processHtmlFolder(srcDir, destMd, 'no-index', stats);

    assert.ok(!fs.existsSync(destMd));
    assert.strictEqual(stats.processed, 0);
  });

  it('should include security caution notice', () => {
    const srcDir = path.join(TEST_SOURCE, 'app-with-scripts');
    fs.ensureDirSync(srcDir);
    fs.outputFileSync(path.join(srcDir, 'index.html'), '<html><script>alert(1)</script></html>');

    const destMd = path.join(TEST_DOCS, 'app-with-scripts.md');
    const stats = createStats();
    processHtmlFolder(srcDir, destMd, 'app-with-scripts', stats);

    const content = fs.readFileSync(destMd, 'utf-8');
    assert.ok(content.includes('Security Notice') || content.includes('sandboxed'));
  });
});

// ─── processHtmlFile ───────────────────────────────────────────
describe('processHtmlFile', () => {
  it('should create markdown wrapper and copy html to downloads', () => {
    const srcFile = path.join(TEST_SOURCE, 'page.html');
    fs.outputFileSync(srcFile, '<html><body>Page</body></html>');

    const stats = createStats();
    processHtmlFile(srcFile, TEST_DOCS, TEST_DOWNLOADS, 'page.html', stats);

    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'page.html')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'page.md')));

    const content = fs.readFileSync(path.join(TEST_DOCS, 'page.md'), 'utf-8');
    assert.ok(content.includes('iframe'));
    assert.ok(content.includes('/downloads/page.html'));
    assert.strictEqual(stats.byType.html, 1);
  });

  it('should sanitize filename for markdown slug', () => {
    const srcFile = path.join(TEST_SOURCE, 'my page (1).html');
    fs.outputFileSync(srcFile, '<html><body>Page</body></html>');

    const stats = createStats();
    processHtmlFile(srcFile, TEST_DOCS, TEST_DOWNLOADS, 'my page (1).html', stats);

    // 슬러그가 정규화되어야 함 (공백, 괄호 제거)
    const files = fs.readdirSync(TEST_DOCS);
    assert.ok(files.some(f => f.endsWith('.md')));
  });
});

// ─── processImageFile ──────────────────────────────────────────
describe('processImageFile', () => {
  it('should create image wrapper markdown with download and view links', () => {
    const srcFile = path.join(TEST_SOURCE, 'photo.png');
    // 최소 PNG 픽셀 (1x1)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
    fs.outputFileSync(srcFile, pngBuffer);

    const stats = createStats();
    processImageFile(srcFile, 'photo.png', stats);

    const destMd = path.join(TEST_DOCS, 'photo.md');
    assert.ok(fs.existsSync(destMd));
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'photo.png')));

    const content = fs.readFileSync(destMd, 'utf-8');
    assert.ok(content.includes('<img'));
    assert.ok(content.includes('/downloads/photo.png'));
    assert.ok(content.includes('Download'));
    assert.strictEqual(stats.byType.image, 1);
  });

  it('should handle image in subdirectory', () => {
    const srcFile = path.join(TEST_SOURCE, 'diagrams/flow.svg');
    fs.ensureDirSync(path.dirname(srcFile));
    fs.outputFileSync(srcFile, '<svg><text>Flow</text></svg>');

    const stats = createStats();
    processImageFile(srcFile, 'diagrams/flow.svg', stats);

    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'diagrams', 'flow.svg')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'diagrams', 'flow.md')));
    assert.strictEqual(stats.byType.image, 1);
  });
});

// ─── processAssetFile ──────────────────────────────────────────
describe('processAssetFile', () => {
  it('should create asset wrapper with no warning for json file', () => {
    const srcFile = path.join(TEST_SOURCE, 'config.json');
    fs.outputFileSync(srcFile, '{"key": "value"}');

    const stats = createStats();
    processAssetFile(srcFile, 'config.json', stats);

    const destMd = path.join(TEST_DOCS, 'config.md');
    assert.ok(fs.existsSync(destMd));

    const content = fs.readFileSync(destMd, 'utf-8');
    assert.ok(content.includes('config.json'));
    assert.ok(!content.includes('SECURITY WARNING'));
    assert.strictEqual(stats.byType.asset, 1);
  });

  it('should show security warning for .exe file', () => {
    const srcFile = path.join(TEST_SOURCE, 'setup.exe');
    fs.outputFileSync(srcFile, 'fake exe content');

    const stats = createStats();
    processAssetFile(srcFile, 'setup.exe', stats);

    const content = fs.readFileSync(path.join(TEST_DOCS, 'setup.md'), 'utf-8');
    assert.ok(content.includes('SECURITY WARNING') || content.includes('dangerous'));
    assert.ok(content.includes('Download'));
  });

  it('should show caution warning for .js file', () => {
    const srcFile = path.join(TEST_SOURCE, 'script.js');
    fs.outputFileSync(srcFile, 'console.log("hello")');

    const stats = createStats();
    processAssetFile(srcFile, 'script.js', stats);

    const content = fs.readFileSync(path.join(TEST_DOCS, 'script.md'), 'utf-8');
    assert.ok(content.includes('Caution') || content.includes('caution') || content.includes('Warning'));
  });

  it('should include code preview for text-like files (yaml)', () => {
    const srcFile = path.join(TEST_SOURCE, 'config.yaml');
    fs.outputFileSync(srcFile, 'server:\n  port: 8080\n');

    const stats = createStats();
    processAssetFile(srcFile, 'config.yaml', stats);

    const content = fs.readFileSync(path.join(TEST_DOCS, 'config.md'), 'utf-8');
    assert.ok(content.includes('```'));
    assert.ok(content.includes('port: 8080'));
  });

  it('should truncate preview for large text files (>20KB)', () => {
    const srcFile = path.join(TEST_SOURCE, 'large.json');
    const largeJson = JSON.stringify({ data: 'x'.repeat(25 * 1024) });
    fs.outputFileSync(srcFile, largeJson);

    const stats = createStats();
    processAssetFile(srcFile, 'large.json', stats);

    const content = fs.readFileSync(path.join(TEST_DOCS, 'large.md'), 'utf-8');
    // 잘렸다는 안내 메시지가 있어야 함
    assert.ok(content.includes('파일 내용이 더') || content.includes('다운로드 링크'));
  });

  it('should show file size in wrapper', () => {
    const srcFile = path.join(TEST_SOURCE, 'data.csv');
    fs.outputFileSync(srcFile, 'name,age\nAlice,30\n');

    const stats = createStats();
    processAssetFile(srcFile, 'data.csv', stats);

    const content = fs.readFileSync(path.join(TEST_DOCS, 'data.md'), 'utf-8');
    assert.ok(content.includes('KB') || content.includes('MB') || content.includes('Size'));
  });
});

// ─── processTextNoExtFile ──────────────────────────────────────
describe('processTextNoExtFile', () => {
  it('should wrap plain text file in code block', () => {
    const srcFile = path.join(TEST_SOURCE, 'Makefile');
    const destFile = path.join(TEST_DOCS, 'makefile.md');
    fs.outputFileSync(srcFile, 'all:\n\techo "done"\n');

    const stats = createStats();
    processTextNoExtFile(srcFile, destFile, stats);

    assert.ok(fs.existsSync(destFile));
    const content = fs.readFileSync(destFile, 'utf-8');
    assert.ok(content.includes('```'));
    assert.ok(content.includes('echo'));
  });

  it('should truncate large text files', () => {
    const srcFile = path.join(TEST_SOURCE, 'bigfile');
    const destFile = path.join(TEST_DOCS, 'bigfile.md');
    fs.outputFileSync(srcFile, 'line\n'.repeat(10000));

    const stats = createStats();
    processTextNoExtFile(srcFile, destFile, stats);

    const content = fs.readFileSync(destFile, 'utf-8');
    assert.ok(content.includes('파일이 길어') || content.includes('일부만'));
  });
});

// ─── sanitizeSlug ──────────────────────────────────────────────
describe('sanitizeSlug (additional cases)', () => {
  it('should handle dots in filename', () => {
    // sanitizeSlug strips the last extension first, then removes remaining dots
    // 'build.gradle.kts' → strip '.kts' → 'build.gradle' → remove dots → 'buildgradle'
    assert.strictEqual(sanitizeSlug('build.gradle.kts'), 'buildgradle');
    // 'package.json' → strip '.json' → 'package'
    assert.strictEqual(sanitizeSlug('package.json'), 'package');
  });

  it('should collapse multiple hyphens', () => {
    assert.strictEqual(sanitizeSlug('a--b--c.md'), 'a-b-c');
  });

  it('should trim leading/trailing hyphens', () => {
    assert.strictEqual(sanitizeSlug('-leading.md'), 'leading');
    assert.strictEqual(sanitizeSlug('trailing-.md'), 'trailing');
  });

  it('should keep unicode letters', () => {
    assert.strictEqual(sanitizeSlug('日本語.md'), '日本語');
    assert.strictEqual(sanitizeSlug('Ärger.md'), 'Ärger');
  });

  it('should remove special chars: []#&+%@!;', () => {
    assert.strictEqual(sanitizeSlug('test[1].md'), 'test1');
    assert.strictEqual(sanitizeSlug('test#section.md'), 'testsection');
  });
});

// ─── sanitizeDirName ───────────────────────────────────────────
describe('sanitizeDirName (additional cases)', () => {
  it('should normalize spaces to hyphens', () => {
    assert.strictEqual(sanitizeDirName('My Docs'), 'My-Docs');
  });

  it('should collapse consecutive hyphens', () => {
    assert.strictEqual(sanitizeDirName('foo  bar'), 'foo-bar');
  });

  it('should remove dots from directory names', () => {
    assert.strictEqual(sanitizeDirName('v1.0.0'), 'v100');
  });
});

// ─── generateTitle ─────────────────────────────────────────────
describe('generateTitle (additional cases)', () => {
  it('should split camelCase', () => {
    assert.strictEqual(generateTitle('myApiFile.md'), 'my Api File');
  });

  it('should replace underscores with spaces', () => {
    assert.strictEqual(generateTitle('quick_start_guide.md'), 'quick start guide');
  });

  it('should handle no extension', () => {
    assert.strictEqual(generateTitle('README'), 'README');
  });
});

// ─── formatFileSize ────────────────────────────────────────────
describe('formatFileSize', () => {
  it('should format bytes less than 1MB as KB', () => {
    const result = formatFileSize(512 * 1024);
    assert.ok(result.includes('KB'));
  });

  it('should format bytes >= 1MB as MB', () => {
    const result = formatFileSize(2 * 1024 * 1024);
    assert.ok(result.includes('MB'));
  });
});

// ─── Security functions ─────────────────────────────────────────
describe('isDangerousFile', () => {
  it('should identify dangerous executables', () => {
    for (const ext of ['.exe', '.dll', '.bat', '.sh', '.msi']) {
      assert.ok(isDangerousFile(`file${ext}`), `Expected ${ext} to be dangerous`);
    }
  });

  it('should not flag safe files as dangerous', () => {
    for (const name of ['document.md', 'image.png', 'data.json', 'config.yaml']) {
      assert.ok(!isDangerousFile(name), `Expected ${name} NOT to be dangerous`);
    }
  });
});

describe('shouldWarnFile', () => {
  it('should warn for JS and archive files', () => {
    for (const name of ['script.js', 'lib.mjs', 'archive.zip', 'backup.tar']) {
      assert.ok(shouldWarnFile(name), `Expected ${name} to trigger warning`);
    }
  });

  it('should not warn for plain content files', () => {
    for (const name of ['readme.md', 'logo.png', 'styles.css']) {
      assert.ok(!shouldWarnFile(name), `Expected ${name} NOT to trigger warning`);
    }
  });
});

describe('getSecurityWarning', () => {
  it('should return SECURITY WARNING string for executables', () => {
    const warning = getSecurityWarning('program.exe');
    assert.ok(warning);
    assert.ok(warning.includes('SECURITY WARNING'));
  });

  it('should return Caution for JS files', () => {
    const warning = getSecurityWarning('app.js');
    assert.ok(warning);
    assert.ok(warning.toLowerCase().includes('caution') || warning.includes('Caution'));
  });

  it('should return Caution for archive files', () => {
    const warning = getSecurityWarning('backup.zip');
    assert.ok(warning);
  });

  it('should return null for safe files', () => {
    assert.strictEqual(getSecurityWarning('readme.md'), null);
    assert.strictEqual(getSecurityWarning('photo.jpg'), null);
    assert.strictEqual(getSecurityWarning('data.json'), null);
  });

  it('should cover all DANGEROUS_EXTENSIONS', () => {
    for (const ext of DANGEROUS_EXTENSIONS) {
      const warning = getSecurityWarning(`file${ext}`);
      assert.ok(warning, `Expected warning for ${ext}`);
    }
  });
});
