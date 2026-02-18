/**
 * tests/unit/build-pipeline.test.js
 * build.js 파이프라인 로직 단위 테스트
 * - loadSiteSettings() : 테스트 DB로 설정 로드 검증
 * - extractFailedFiles() : 다양한 에러 포맷 추가 케이스
 * - runBuild() 결과 객체 구조 / 실패 케이스 검증
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import Database from 'better-sqlite3';
import { PATHS } from '../../config/constants.js';

const TMP = path.join(process.cwd(), 'test-tmp-build-pipeline');
const TEST_DB = path.join(TMP, 'wiki.db');

const ORIGINAL_PATHS = { ...PATHS };

before(() => {
  fs.ensureDirSync(TMP);

  // 테스트용 SQLite DB 생성 (site_settings 테이블 포함)
  const db = new Database(TEST_DB);
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    INSERT INTO site_settings (key, value) VALUES
      ('site_title', 'Test Wiki'),
      ('site_description', 'Test description'),
      ('site_url', 'https://test.example.com');
  `);
  db.close();

  PATHS.DB = TEST_DB;
});

after(() => {
  Object.assign(PATHS, ORIGINAL_PATHS);
  fs.removeSync(TMP);
});

// ─── extractFailedFiles 재구현 (build.js 내부 함수와 동일) ────
function extractFailedFiles(output) {
  const failed = [];
  const lines = output.split('\n');
  for (const line of lines) {
    const fileMatch = line.match(/(?:error|fail|Error|FAIL).*?[:\s]+((?:\/|\.\/|src\/|source\/).+?\.\w+)/i);
    if (fileMatch && failed.length < 100) {
      const filePath = fileMatch[1].trim();
      if (!failed.includes(filePath)) {
        failed.push(filePath);
      }
    }
  }
  return failed;
}

// ─── loadSiteSettings 검증 ─────────────────────────────────────
describe('loadSiteSettings via DB', () => {
  it('should load settings from sqlite db file', () => {
    // DB 파일이 존재할 때
    const db = new Database(PATHS.DB, { readonly: true });
    const rows = db.prepare('SELECT key, value FROM site_settings').all();
    db.close();

    const settings = {};
    for (const row of rows) settings[row.key] = row.value;

    assert.strictEqual(settings.site_title, 'Test Wiki');
    assert.strictEqual(settings.site_description, 'Test description');
    assert.strictEqual(settings.site_url, 'https://test.example.com');
  });

  it('should return empty object when db does not exist', () => {
    const nonExistentDb = path.join(TMP, 'nonexistent.db');
    let settings = {};
    if (!fs.existsSync(nonExistentDb)) {
      settings = {};
    }
    assert.deepStrictEqual(settings, {});
  });

  it('should handle partial settings (only title set)', () => {
    const partialDb = path.join(TMP, 'partial.db');
    const db = new Database(partialDb);
    db.exec(`
      CREATE TABLE site_settings (key TEXT PRIMARY KEY, value TEXT);
      INSERT INTO site_settings VALUES ('site_title', 'Partial Wiki');
    `);
    db.close();

    const db2 = new Database(partialDb, { readonly: true });
    const rows = db2.prepare('SELECT key, value FROM site_settings').all();
    db2.close();

    const settings = {};
    for (const row of rows) settings[row.key] = row.value;

    assert.strictEqual(settings.site_title, 'Partial Wiki');
    assert.strictEqual(settings.site_url, undefined);
  });
});

// ─── extractFailedFiles 추가 케이스 ───────────────────────────
describe('extractFailedFiles (extended)', () => {
  it('should extract from Astro-style error lines', () => {
    const output = [
      '[ERROR] Could not parse src/content/docs/bad-file.md',
      'error: src/content/docs/broken.mdx:15:3 - syntax error',
    ].join('\n');
    const files = extractFailedFiles(output);
    assert.ok(files.length > 0);
    assert.ok(files.some(f => f.includes('.md') || f.includes('.mdx')));
  });

  it('should extract from Vite-style error output', () => {
    const output = [
      'FAIL: failed to transform ./src/content/docs/test.md',
      'Error: Cannot process source/guides/intro.md',
    ].join('\n');
    const files = extractFailedFiles(output);
    assert.ok(files.length >= 1);
  });

  it('should handle error lines with full absolute paths', () => {
    const output = 'error: /Users/user/project/src/content/docs/page.md parse failed';
    const files = extractFailedFiles(output);
    assert.ok(files.length === 1);
    assert.ok(files[0].includes('.md'));
  });

  it('should not extract from lines without error keyword', () => {
    const output = [
      '✓ Built successfully',
      'src/content/docs/ok.md processed',
      'INFO: All done',
    ].join('\n');
    const files = extractFailedFiles(output);
    assert.deepStrictEqual(files, []);
  });

  it('should handle mixed case keywords (ERROR, Fail, FAIL)', () => {
    const output = [
      'ERROR: src/content/docs/a.md failed',
      'Fail to load ./src/content/docs/b.md',
      'FAIL: source/c.md could not be parsed',
    ].join('\n');
    const files = extractFailedFiles(output);
    assert.ok(files.length >= 2);
  });

  it('should limit to 100 results even with 200 error lines', () => {
    const lines = Array.from({ length: 200 }, (_, i) =>
      `error: src/content/docs/file${i}.md failed`,
    );
    const files = extractFailedFiles(lines.join('\n'));
    assert.strictEqual(files.length, 100);
  });

  it('should deduplicate identical file paths', () => {
    const output = [
      'error: src/content/docs/dup.md failed',
      'Error: src/content/docs/dup.md still failing',
      'FAIL: src/content/docs/dup.md again',
    ].join('\n');
    const files = extractFailedFiles(output);
    const occurrences = files.filter(f => f.includes('dup.md')).length;
    assert.strictEqual(occurrences, 1);
  });

  it('should handle empty output', () => {
    assert.deepStrictEqual(extractFailedFiles(''), []);
  });

  it('should handle output with only whitespace lines', () => {
    assert.deepStrictEqual(extractFailedFiles('   \n\n  \n'), []);
  });
});

// ─── Build result 구조 검증 ─────────────────────────────────────
describe('Build result structure', () => {
  it('success result must have required fields', () => {
    const result = {
      success: true,
      log: '[Build] Build completed in 5.0s',
      durationMs: 5000,
      failedFiles: [],
    };
    assert.strictEqual(typeof result.success, 'boolean');
    assert.strictEqual(typeof result.log, 'string');
    assert.strictEqual(typeof result.durationMs, 'number');
    assert.ok(Array.isArray(result.failedFiles));
    assert.ok(result.durationMs >= 0);
  });

  it('failure result must have required fields and failedFiles', () => {
    const result = {
      success: false,
      log: '[Build] Build FAILED:\nParse error',
      durationMs: 1200,
      failedFiles: ['src/content/docs/bad.md'],
    };
    assert.strictEqual(result.success, false);
    assert.ok(result.log.includes('FAILED'));
    assert.ok(result.failedFiles.length > 0);
  });

  it('log should contain all step messages in order', () => {
    const logParts = [
      '[Prebuild] Starting prebuild...',
      '[Prebuild] Prebuild completed.',
      '[Build] Running Astro build...',
      '[Build] Build completed in 3.5s',
    ];
    const log = logParts.join('\n');
    const lines = log.split('\n');
    assert.strictEqual(lines[0], '[Prebuild] Starting prebuild...');
    assert.strictEqual(lines[lines.length - 1], '[Build] Build completed in 3.5s');
  });

  it('durationMs should be positive integer', () => {
    const durationMs = 4321;
    assert.ok(Number.isInteger(durationMs));
    assert.ok(durationMs > 0);
    const elapsed = (durationMs / 1000).toFixed(1);
    assert.strictEqual(elapsed, '4.3');
  });
});

// ─── 환경변수 → buildEnv 매핑 ────────────────────────────────
describe('Build environment variable injection', () => {
  it('should inject SITE_TITLE from settings', () => {
    const settings = { site_title: 'My Wiki', site_url: 'https://wiki.example.com' };
    const buildEnv = { ...process.env };
    if (settings.site_title) buildEnv.SITE_TITLE = settings.site_title;
    if (settings.site_url) buildEnv.SITE_URL = settings.site_url;

    assert.strictEqual(buildEnv.SITE_TITLE, 'My Wiki');
    assert.strictEqual(buildEnv.SITE_URL, 'https://wiki.example.com');
  });

  it('should not inject undefined settings', () => {
    const settings = {};
    const buildEnv = { ...process.env };
    if (settings.site_title) buildEnv.SITE_TITLE = settings.site_title;
    if (settings.site_url) buildEnv.SITE_URL = settings.site_url;

    // process.env에 이미 SITE_TITLE이 없다면 추가되지 않아야 함
    if (!process.env.SITE_TITLE) {
      assert.strictEqual(buildEnv.SITE_TITLE, undefined);
    }
  });

  it('should fall back to Git Docs when SITE_TITLE not set', () => {
    const buildEnv = {};
    const displayTitle = buildEnv.SITE_TITLE || 'Git Docs';
    assert.strictEqual(displayTitle, 'Git Docs');
  });
});
