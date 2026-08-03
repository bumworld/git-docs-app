/**
 * tests/unit/prebuild-cache.test.js
 * prebuild 캐시 스키마 버전(slugVersion) 무효화 테스트
 *
 * 캐시는 mtime/size 기반이라 슬러그 정규화 알고리즘이 바뀌어도 cache hit 가 나서
 * 옛 규칙으로 만든 목적 파일이 그대로 남을 수 있다. 스키마 버전이 다르면
 * 첫 실행처럼 전체 재처리해야 한다.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';

import { loadCache, saveCache, CACHE_SCHEMA_VERSION } from '../../scripts/prebuild/cache.js';
import { runPrebuild } from '../../scripts/prebuild.js';
import { PATHS } from '../../config/constants.js';

const TMP = path.join(process.cwd(), 'test-tmp-prebuild-cache');
const TEST_SOURCE = path.join(TMP, 'source');
const TEST_DOCS = path.join(TMP, 'docs');
const TEST_DOWNLOADS = path.join(TMP, 'downloads');
const TEST_SIDEBAR = path.join(TMP, 'sidebar.json');
const TEST_CACHE = path.join(TMP, 'prebuild-cache.json');

const ORIGINAL_PATHS = { ...PATHS };

before(() => {
  PATHS.SOURCE = TEST_SOURCE;
  PATHS.DOCS = TEST_DOCS;
  PATHS.DOWNLOADS = TEST_DOWNLOADS;
  PATHS.SIDEBAR_JSON = TEST_SIDEBAR;
  PATHS.PREBUILD_CACHE = TEST_CACHE;
});

after(() => {
  Object.assign(PATHS, ORIGINAL_PATHS);
  fs.removeSync(TMP);
});

beforeEach(() => {
  fs.emptyDirSync(TEST_SOURCE);
  fs.emptyDirSync(TEST_DOCS);
  fs.emptyDirSync(TEST_DOWNLOADS);
  fs.removeSync(TEST_CACHE);
});

describe('cache.js - 스키마 버전', () => {
  it('CACHE_SCHEMA_VERSION 이 노출된다', () => {
    assert.ok(CACHE_SCHEMA_VERSION >= 1);
  });

  it('saveCache 는 현재 스키마 버전을 기록한다', () => {
    saveCache(TEST_CACHE, { 'a.md': { mtime: 1, size: 2, destFiles: [] } }, TEST_SOURCE);
    const raw = fs.readJsonSync(TEST_CACHE);
    assert.equal(raw.slugVersion, CACHE_SCHEMA_VERSION);
    assert.equal(raw.sourceDir, TEST_SOURCE);
  });

  it('버전이 일치하면 캐시 항목을 그대로 반환한다', () => {
    saveCache(TEST_CACHE, { 'a.md': { mtime: 1, size: 2, destFiles: [] } }, TEST_SOURCE);
    const cache = loadCache(TEST_CACHE);
    assert.deepEqual(Object.keys(cache.files), ['a.md']);
    assert.notEqual(cache.versionMismatch, true);
  });

  it('버전이 다르면 캐시를 비운다', () => {
    fs.outputJsonSync(TEST_CACHE, {
      slugVersion: CACHE_SCHEMA_VERSION - 1,
      sourceDir: TEST_SOURCE,
      files: { 'a.md': { mtime: 1, size: 2, destFiles: [] } },
    });
    const cache = loadCache(TEST_CACHE);
    assert.deepEqual(cache.files, {});
    assert.equal(cache.versionMismatch, true);
  });

  it('버전 필드가 없는 구버전 캐시도 비운다', () => {
    fs.outputJsonSync(TEST_CACHE, {
      sourceDir: TEST_SOURCE,
      files: { 'a.md': { mtime: 1, size: 2, destFiles: [] } },
    });
    const cache = loadCache(TEST_CACHE);
    assert.deepEqual(cache.files, {});
    assert.equal(cache.versionMismatch, true);
  });
});

describe('runPrebuild - 캐시 버전 불일치 시 전체 재처리', () => {
  it('구버전 캐시가 있으면 docs 를 초기화하고 전부 다시 만든다', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'doc.md'), '# hello\n');
    runPrebuild();
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'doc.md')));

    // 옛 슬러그 규칙으로 만들어진 잔재 파일
    const stale = path.join(TEST_DOCS, '실행·예약.md');
    fs.outputFileSync(stale, '---\ntitle: "stale"\n---\n');

    // 캐시 버전을 낮춰서 저장 (알고리즘 변경 상황 재현)
    const cached = fs.readJsonSync(TEST_CACHE);
    fs.outputJsonSync(TEST_CACHE, { ...cached, slugVersion: CACHE_SCHEMA_VERSION - 1 });

    runPrebuild();

    assert.equal(fs.existsSync(stale), false, '버전 불일치 시 docs 가 초기화되어야 함');
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'doc.md')), '소스 파일은 재처리되어야 함');
    assert.equal(fs.readJsonSync(TEST_CACHE).slugVersion, CACHE_SCHEMA_VERSION);
  });

  it('증분 실행에서 캐시 hit 파일의 출력 경로가 선점된다', () => {
    // 순회 순서상 먼저 오는 ab.md 를 1차 실행에서 캐시에 올린다
    fs.outputFileSync(path.join(TEST_SOURCE, 'ab.md'), '# first\n');
    runPrebuild();
    const dest = path.join(TEST_DOCS, 'ab.md');
    assert.match(fs.readFileSync(dest, 'utf-8'), /first/);

    // 2차: 같은 슬러그로 수렴하는 파일 추가 — 캐시 hit 파일이 선점 상태여야 한다
    fs.outputFileSync(path.join(TEST_SOURCE, 'a·b.md'), '# second\n');
    runPrebuild();

    assert.match(
      fs.readFileSync(dest, 'utf-8'),
      /first/,
      '캐시 hit 파일이 선점 등록되지 않아 나중 파일이 덮어씀'
    );
  });

  it('증분 결과가 전체 재빌드 결과와 같다 (충돌 승자 일관성)', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'ab.md'), '# first\n');
    fs.outputFileSync(path.join(TEST_SOURCE, 'a·b.md'), '# second\n');

    // 전체 재빌드 (캐시 없음)
    runPrebuild();
    const fullRebuild = fs.readFileSync(path.join(TEST_DOCS, 'ab.md'), 'utf-8');

    // 캐시만 남기고 docs 를 유지한 채 증분 재실행
    runPrebuild();
    const incremental = fs.readFileSync(path.join(TEST_DOCS, 'ab.md'), 'utf-8');

    assert.equal(incremental, fullRebuild);
  });

  it('충돌 승자가 바뀐 뒤 옛 승자를 삭제해도 살아있는 문서가 지워지지 않는다', () => {
    // 1차: ab.md 만 존재 → docs/ab.md 소유
    fs.outputFileSync(path.join(TEST_SOURCE, 'ab.md'), '# old\n');
    runPrebuild();

    // 2차: 순회상 앞서는 a!b.md 추가 → 승자 교체 (ab.md 는 패자)
    fs.outputFileSync(path.join(TEST_SOURCE, 'a!b.md'), '# new\n');
    runPrebuild();
    const dest = path.join(TEST_DOCS, 'ab.md');
    assert.match(fs.readFileSync(dest, 'utf-8'), /new/, '순회 선점 승자가 소유해야 함');

    // 3차: 옛 승자 소스 삭제 → 삭제 추적이 살아있는 문서를 지우면 안 된다
    fs.removeSync(path.join(TEST_SOURCE, 'ab.md'));
    runPrebuild();

    assert.ok(fs.existsSync(dest), '살아있는 소스가 소유한 산출물이 삭제됨');
    assert.match(fs.readFileSync(dest, 'utf-8'), /new/);
  });

  it('충돌 승자가 사라지면 패자가 래퍼 문서로 승격된다', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'a!b.bru'), 'winner');
    fs.outputFileSync(path.join(TEST_SOURCE, 'ab.bru'), 'loser');
    runPrebuild();

    const dest = path.join(TEST_DOCS, 'ab.md');
    assert.match(fs.readFileSync(dest, 'utf-8'), /a!b\.bru/, '승자 래퍼가 생성되어야 함');
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'ab.bru')), '패자 다운로드는 보존');

    // 승자 삭제 → 패자가 캐시 hit 로 남지 않고 재평가되어 승격되어야 한다
    fs.removeSync(path.join(TEST_SOURCE, 'a!b.bru'));
    runPrebuild();

    assert.ok(fs.existsSync(dest), '승자 삭제 후 문서가 사라짐');
    assert.match(fs.readFileSync(dest, 'utf-8'), /ab\.bru/, '패자가 승격되지 않음');
  });

  it('버전이 같으면 증분 모드가 유지된다 (대조군)', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'doc.md'), '# hello\n');
    runPrebuild();

    const leftover = path.join(TEST_DOCS, 'leftover.md');
    fs.outputFileSync(leftover, '---\ntitle: "leftover"\n---\n');

    runPrebuild();

    assert.ok(fs.existsSync(leftover), '증분 모드에서는 docs 를 초기화하지 않음');
  });
});

describe('runPrebuild - 슬러그 사전 검증(preflight)', () => {
  it('정규화 불가 이름이 있으면 기존 산출물을 지우지 않고 실패한다', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'doc.md'), '# hello\n');
    fs.outputFileSync(path.join(TEST_SOURCE, 'file.bru'), 'x');
    runPrebuild();

    const existingDoc = path.join(TEST_DOCS, 'doc.md');
    const existingDownload = path.join(TEST_DOWNLOADS, 'file.bru');
    assert.ok(fs.existsSync(existingDoc));
    assert.ok(fs.existsSync(existingDownload));

    // 정규화 불가 이름 추가 + 구버전 캐시(전체 초기화 경로)로 재현
    fs.outputFileSync(path.join(TEST_SOURCE, '···.bru'), 'x');
    const cached = fs.readJsonSync(TEST_CACHE);
    fs.outputJsonSync(TEST_CACHE, { ...cached, slugVersion: CACHE_SCHEMA_VERSION - 1 });

    assert.throws(() => runPrebuild(), /···/);

    assert.ok(fs.existsSync(existingDoc), 'preflight 실패인데 docs 가 비워짐');
    assert.ok(fs.existsSync(existingDownload), 'preflight 실패인데 downloads 가 비워짐');
  });

  it('오류 메시지에 문제가 되는 모든 이름이 모여서 보고된다', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, '···.bru'), 'x');
    fs.ensureDirSync(path.join(TEST_SOURCE, '###'));
    fs.outputFileSync(path.join(TEST_SOURCE, '###', 'ok.md'), '# ok\n');

    try {
      runPrebuild();
      assert.fail('should throw');
    } catch (err) {
      assert.match(err.message, /···\.bru/);
      assert.match(err.message, /###/);
    }
  });

  it('__static/__raw/_ 프리픽스는 검사 대상이 아니다', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, '__static'));
    fs.outputFileSync(path.join(TEST_SOURCE, '__static', '···.json'), '{}');
    fs.ensureDirSync(path.join(TEST_SOURCE, '_draft'));
    fs.outputFileSync(path.join(TEST_SOURCE, '_draft', '···.md'), '# x\n');
    fs.outputFileSync(path.join(TEST_SOURCE, 'doc.md'), '# hello\n');

    runPrebuild();  // throw 하면 실패

    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'doc.md')));
  });
});
