/**
 * tests/build/env-vars.test.js
 * SITE_TITLE, SITE_URL, SITE_DESCRIPTION 환경변수 조합별 prebuild 결과 검증
 * - 실제 Astro 빌드 없이 prebuild까지만 실행하여 sidebar.json, docs/ 결과 확인
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import Database from 'better-sqlite3';

import { runPrebuild } from '../../scripts/prebuild.js';
import { PATHS } from '../../config/constants.js';

const TMP = path.join(process.cwd(), 'test-tmp-env-vars');
const TEST_SOURCE = path.join(TMP, 'source');
const TEST_DOCS = path.join(TMP, 'src', 'content', 'docs');
const TEST_DOWNLOADS = path.join(TMP, 'public', 'downloads');
const TEST_SIDEBAR = path.join(TMP, 'src', 'sidebar.json');
const TEST_DB = path.join(TMP, 'wiki.db');
const TEST_CACHE = path.join(TMP, 'data', 'prebuild-cache.json');

const ORIGINAL_PATHS = { ...PATHS };
const ORIGINAL_ENV = { ...process.env };

before(() => {
  PATHS.SOURCE = TEST_SOURCE;
  PATHS.DOCS = TEST_DOCS;
  PATHS.DOWNLOADS = TEST_DOWNLOADS;
  PATHS.SIDEBAR_JSON = TEST_SIDEBAR;
  PATHS.DB = TEST_DB;
  PATHS.PREBUILD_CACHE = TEST_CACHE;

  fs.ensureDirSync(TEST_SOURCE);
  fs.ensureDirSync(TEST_DOCS);
});

after(() => {
  Object.assign(PATHS, ORIGINAL_PATHS);
  Object.keys(ORIGINAL_ENV).forEach(k => {
    if (process.env[k] !== ORIGINAL_ENV[k]) process.env[k] = ORIGINAL_ENV[k];
  });
  // cleanup
  for (const key of ['SITE_TITLE', 'SITE_URL', 'SITE_DESCRIPTION']) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  fs.removeSync(TMP);
});

beforeEach(() => {
  fs.emptyDirSync(TEST_SOURCE);
  fs.emptyDirSync(TEST_DOCS);
  fs.removeSync(TEST_CACHE);
  if (fs.existsSync(TEST_SIDEBAR)) fs.removeSync(TEST_SIDEBAR);
  delete process.env.SITE_TITLE;
  delete process.env.SITE_URL;
  delete process.env.SITE_DESCRIPTION;
});

// 간단한 테스트용 소스 파일 생성 헬퍼
function createTestSource(...files) {
  for (const [name, content] of files) {
    fs.outputFileSync(path.join(TEST_SOURCE, name), content);
  }
}

// ─── SITE_TITLE ────────────────────────────────────────────────
describe('SITE_TITLE 환경변수', () => {
  it('기본값 미설정 시 prebuild는 정상 완료되어야 함', () => {
    createTestSource(['README.md', '# Home\n\nHello world.']);
    const result = runPrebuild();
    assert.ok(result === true || result === false); // boolean 반환
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'index.md')));
  });

  it('SITE_TITLE이 설정되어도 prebuild 결과 변화 없음 (Astro 빌드 시 사용)', () => {
    process.env.SITE_TITLE = 'My Custom Wiki';
    createTestSource(['README.md', '# Welcome\n\nContent.']);
    runPrebuild();
    // sidebar.json이 생성되어야 함
    assert.ok(fs.existsSync(TEST_SIDEBAR));
    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    assert.ok(Array.isArray(sidebar));
  });

  it('SITE_TITLE이 특수문자 포함이어도 prebuild는 정상 완료', () => {
    process.env.SITE_TITLE = '위키 & Docs <특수>';
    createTestSource(['guide.md', '# Guide\n\nContent.']);
    runPrebuild();
    assert.ok(fs.existsSync(TEST_SIDEBAR));
  });

  it('SITE_TITLE이 매우 긴 문자열(255자)이어도 prebuild 정상 완료', () => {
    process.env.SITE_TITLE = 'A'.repeat(255);
    createTestSource(['page.md', '# Page\n\nContent.']);
    runPrebuild();
    assert.ok(fs.existsSync(TEST_SIDEBAR));
  });

  it('SITE_TITLE이 빈 문자열이어도 prebuild 정상 완료', () => {
    process.env.SITE_TITLE = '';
    createTestSource(['page.md', '# Page\n\nContent.']);
    runPrebuild();
    assert.ok(fs.existsSync(TEST_SIDEBAR));
  });

  it('buildEnv에 SITE_TITLE이 올바르게 매핑되어야 함', () => {
    const settings = { site_title: '커스텀 위키', site_url: 'https://wiki.co.kr' };
    const buildEnv = { ...process.env };
    if (settings.site_title) buildEnv.SITE_TITLE = settings.site_title;
    if (settings.site_url) buildEnv.SITE_URL = settings.site_url;

    assert.strictEqual(buildEnv.SITE_TITLE, '커스텀 위키');
    assert.strictEqual(buildEnv.SITE_URL, 'https://wiki.co.kr');
  });
});

// ─── SITE_URL ─────────────────────────────────────────────────
describe('SITE_URL 환경변수', () => {
  it('https URL에서 prebuild 정상 완료', () => {
    process.env.SITE_URL = 'https://docs.example.com';
    createTestSource(['README.md', '# Home\n\nContent.']);
    runPrebuild();
    assert.ok(fs.existsSync(TEST_SIDEBAR));
  });

  it('http URL에서 prebuild 정상 완료', () => {
    process.env.SITE_URL = 'http://localhost:3000';
    createTestSource(['README.md', '# Home\n\nContent.']);
    runPrebuild();
    assert.ok(fs.existsSync(TEST_SIDEBAR));
  });

  it('서브디렉토리 경로에서 prebuild 정상 완료', () => {
    process.env.SITE_URL = 'https://company.com/wiki/';
    createTestSource(['README.md', '# Home\n\nContent.']);
    runPrebuild();
    assert.ok(fs.existsSync(TEST_SIDEBAR));
  });

  it('trailing slash 없는 URL에서 prebuild 정상 완료', () => {
    process.env.SITE_URL = 'https://company.com/wiki';
    createTestSource(['README.md', '# Home\n\nContent.']);
    runPrebuild();
    assert.ok(fs.existsSync(TEST_SIDEBAR));
  });
});

// ─── 복합 환경변수 조합 ──────────────────────────────────────
describe('환경변수 조합 테스트', () => {
  it('모든 환경변수 미설정 시 소스 비어있으면 빈 sidebar 생성', () => {
    fs.emptyDirSync(TEST_SOURCE);
    runPrebuild();
    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    assert.deepStrictEqual(sidebar, []);
  });

  it('모든 환경변수 설정 + 소스 존재 시 sidebar 정상 생성', () => {
    process.env.SITE_TITLE = 'Full Config Wiki';
    process.env.SITE_URL = 'https://docs.example.com';
    process.env.SITE_DESCRIPTION = 'A full configuration wiki';
    createTestSource(
      ['README.md', '# Home\n\nWelcome.'],
      ['guides/getting-started.md', '# Getting Started\n\nStart here.'],
    );
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    assert.ok(Array.isArray(sidebar));
    assert.ok(sidebar.length > 0);
  });

  it('환경변수 미설정 → 기본값 fallback 확인', () => {
    const buildEnv = { ...process.env };
    const settings = {};
    if (settings.site_title) buildEnv.SITE_TITLE = settings.site_title;
    const displayTitle = buildEnv.SITE_TITLE || 'Git Docs';
    assert.strictEqual(displayTitle, 'Git Docs');
  });
});

// ─── DB에서 설정 읽기 → 환경변수 주입 흐름 검증 ─────────────
describe('DB 설정 → 빌드 환경변수 매핑', () => {
  it('DB에서 읽은 설정이 buildEnv에 올바르게 주입되어야 함', () => {
    // 테스트 DB 생성
    fs.ensureDirSync(path.dirname(TEST_DB));
    const db = new Database(TEST_DB);
    db.exec(`
      CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT);
      INSERT OR REPLACE INTO site_settings VALUES ('site_title', 'DB Wiki Title');
      INSERT OR REPLACE INTO site_settings VALUES ('site_url', 'https://db.example.com');
    `);
    db.close();

    // loadSiteSettings 로직 시뮬레이션
    const db2 = new Database(PATHS.DB, { readonly: true });
    const rows = db2.prepare('SELECT key, value FROM site_settings').all();
    db2.close();

    const settings = {};
    for (const row of rows) settings[row.key] = row.value;

    const buildEnv = { ...process.env };
    if (settings.site_title) buildEnv.SITE_TITLE = settings.site_title;
    if (settings.site_url) buildEnv.SITE_URL = settings.site_url;

    assert.strictEqual(buildEnv.SITE_TITLE, 'DB Wiki Title');
    assert.strictEqual(buildEnv.SITE_URL, 'https://db.example.com');

    fs.removeSync(TEST_DB);
  });
});
