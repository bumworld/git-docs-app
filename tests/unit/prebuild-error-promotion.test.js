/**
 * tests/unit/prebuild-error-promotion.test.js
 *
 * prebuild 의 파일 I/O 오류를 빌드 실패로 승격하는 계약 검증.
 *
 * 기존 동작: processor 가 stats.errors 에 오류를 쌓아도 runPrebuild 는 로그만 남기고
 * true 를 반환 → Astro 빌드/배포가 진행되어 문서가 조용히 누락된 채 "성공"으로 기록됐다.
 *
 * 새 계약:
 * - 정상 처리        → true  (기존과 동일)
 * - 빈 source        → false (기존과 동일: "내용 없음"이지 실패가 아님)
 * - 파일 처리 오류   → PrebuildError throw (삭제 정리/캐시 저장/last-source/index·sidebar 생성 전)
 */
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';

import { runPrebuild } from '../../scripts/prebuild.js';
import { runBuild } from '../../scripts/build.js';
import { addBuildHook, clearHooks } from '../../scripts/build-hooks.js';
import { PrebuildError } from '../../scripts/prebuild/utils.js';
import { PATHS } from '../../config/constants.js';

const TMP = path.join(process.cwd(), 'test-tmp-prebuild-errors');
const TEST_SOURCE = path.join(TMP, 'source');
const TEST_DOCS = path.join(TMP, 'docs');
const TEST_DOWNLOADS = path.join(TMP, 'downloads');
const TEST_SIDEBAR = path.join(TMP, 'sidebar.json');
const TEST_CACHE = path.join(TMP, 'prebuild-cache.json');
const TEST_LAST_SOURCE = path.join(TMP, 'data', 'last-source.json');

const ORIGINAL_PATHS = { ...PATHS };

// fs-extra 는 CJS 단일 객체라 processors.js 와 같은 인스턴스를 공유한다.
// 특정 경로에서만 실패하도록 메서드를 갈아끼워 I/O 오류를 결정적으로 주입한다.
const patched = [];
function injectFailure(method, matcher, message) {
  const original = fs[method];
  patched.push([method, original]);
  fs[method] = function (target, ...rest) {
    if (matcher(String(target))) {
      const err = new Error(message);
      err.code = 'EACCES';
      throw err;
    }
    return original.call(this, target, ...rest);
  };
}
function restoreFailures() {
  while (patched.length) {
    const [method, original] = patched.pop();
    fs[method] = original;
  }
}

before(() => {
  // ROOT 를 임시 디렉토리로 돌려 data/last-source.json 이 리포 루트를 오염시키지 않게 한다
  PATHS.ROOT = TMP;
  PATHS.SOURCE = TEST_SOURCE;
  PATHS.DOCS = TEST_DOCS;
  PATHS.DOWNLOADS = TEST_DOWNLOADS;
  PATHS.SIDEBAR_JSON = TEST_SIDEBAR;
  PATHS.PREBUILD_CACHE = TEST_CACHE;
  // runBuild 실패 경로가 리포의 실제 dist 를 건드리지 않도록 임시 경로로 격리
  PATHS.DIST = path.join(TMP, 'dist');
  PATHS.DIST_TEMP = path.join(TMP, 'dist-temp');
  PATHS.DIST_OLD = path.join(TMP, 'dist-old');
  PATHS.DB = path.join(TMP, 'nonexistent.db');
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
  fs.removeSync(TEST_LAST_SOURCE);
});

afterEach(() => {
  restoreFailures();
});

describe('runPrebuild - 기존 반환 계약 유지', () => {
  it('정상 처리 시 true 를 반환한다', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'doc.md'), '# hello\n');
    assert.equal(runPrebuild(), true);
  });

  it('빈 source 는 실패가 아니라 false 를 반환한다', () => {
    assert.equal(runPrebuild(), false);
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'index.md')), '빈 소스는 welcome 페이지를 만든다');
  });
});

describe('runPrebuild - I/O 오류 승격', () => {
  it('마크다운 읽기 실패는 PrebuildError 로 빌드를 중단한다', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'ok.md'), '# ok\n');
    fs.outputFileSync(path.join(TEST_SOURCE, 'broken.md'), '# broken\n');
    injectFailure('readFileSync', p => p.endsWith('broken.md'), 'simulated read failure');

    let thrown = null;
    try { runPrebuild(); } catch (err) { thrown = err; }

    assert.ok(thrown instanceof PrebuildError, `PrebuildError 가 아님: ${thrown}`);
    assert.equal(thrown.count, 1);
    assert.equal(thrown.errors.length, 1);
    assert.match(String(thrown.errors[0].file), /broken\.md/);
  });

  it('다운로드 복사 실패도 빌드를 중단한다', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'asset.bin'), 'binary');
    injectFailure('copySync', p => p.endsWith('asset.bin'), 'simulated copy failure');

    assert.throws(() => runPrebuild(), PrebuildError);
  });

  it('오류 발생 시 캐시는 무효화되고 last-source·기존 산출물은 보존된다', () => {
    // 1차: 정상 빌드로 캐시와 산출물을 만든다
    fs.outputFileSync(path.join(TEST_SOURCE, 'keep.md'), '# keep\n');
    fs.outputFileSync(path.join(TEST_SOURCE, 'later.md'), '# later\n');
    assert.equal(runPrebuild(), true);

    const keepDoc = path.join(TEST_DOCS, 'keep.md');
    assert.ok(fs.existsSync(keepDoc));
    const lastSourceBefore = fs.readJsonSync(TEST_LAST_SOURCE);
    const sidebarBefore = fs.readJsonSync(TEST_SIDEBAR);

    // 2차: 소스를 하나 지우고(삭제 정리 대상 발생) 다른 파일 처리에 실패시킨다
    fs.removeSync(path.join(TEST_SOURCE, 'later.md'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'new.md'), '# new\n');
    injectFailure('readFileSync', p => p.endsWith('new.md'), 'simulated read failure');

    assert.throws(() => runPrebuild(), PrebuildError);
    restoreFailures();

    assert.equal(
      fs.existsSync(TEST_CACHE), false,
      '실패한 실행의 캐시가 저장되어서도, 기존 캐시가 남아서도 안 된다 (부분 산출물 재사용 방지)',
    );
    assert.deepEqual(fs.readJsonSync(TEST_LAST_SOURCE), lastSourceBefore, 'last-source 가 갱신되면 안 된다');
    assert.deepEqual(fs.readJsonSync(TEST_SIDEBAR), sidebarBefore, 'sidebar 가 갱신되면 안 된다');
    assert.ok(fs.existsSync(keepDoc), '기존 산출물이 보존되어야 한다');
    assert.ok(
      fs.existsSync(path.join(TEST_DOCS, 'later.md')),
      '실패한 실행에서 삭제 정리가 수행되면 안 된다',
    );
  });

  it('첫 빌드가 실패해도 같은 입력으로 재시도하면 전체 산출물이 복구된다', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'a.md'), '# a\n');
    fs.outputFileSync(path.join(TEST_SOURCE, 'b.md'), '# b\n');
    fs.outputFileSync(path.join(TEST_SOURCE, 'pic.png'), 'PNGDATA');

    injectFailure('readFileSync', p => p.endsWith('b.md'), 'simulated read failure');
    assert.throws(() => runPrebuild(), PrebuildError);
    assert.equal(fs.existsSync(TEST_CACHE), false, '첫 실패 후 캐시가 생기면 안 된다');
    restoreFailures();

    assert.equal(runPrebuild(), true);
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'a.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'b.md')), '재시도 시 실패했던 파일이 복구되어야 한다');
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'pic.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'pic.png')));
    assert.ok(fs.existsSync(TEST_CACHE));
  });

  it('__static 디렉토리 복사 실패 후 재시도하면 정상 복구된다', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'doc.md'), '# doc\n');
    fs.outputFileSync(path.join(TEST_SOURCE, '__static', 'data.json'), '{"a":1}');

    injectFailure('copySync', p => p.endsWith('data.json'), 'simulated static copy failure');
    assert.throws(() => runPrebuild(), PrebuildError);
    restoreFailures();

    assert.equal(runPrebuild(), true);
    assert.ok(
      fs.existsSync(path.join(TEST_DOWNLOADS, 'data.json')),
      '__static 항목이 재시도에서 복사되어야 한다',
    );
  });

  it('__raw 디렉토리 복사 실패도 승격되고 재시도로 복구된다', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'doc.md'), '# doc\n');
    fs.outputFileSync(path.join(TEST_SOURCE, '__raw', 'img.png'), 'RAW');

    injectFailure('copySync', p => p.endsWith('img.png'), 'simulated raw copy failure');
    assert.throws(() => runPrebuild(), PrebuildError);
    restoreFailures();

    assert.equal(runPrebuild(), true);
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, '__raw', 'img.png')));
  });

  it('쓰다 만 산출물이 남아도 다음 실행이 cache hit 로 재사용하지 않는다', () => {
    // 증분 판정은 소스의 mtime/size 와 목적 파일 "존재 여부"만 본다. 소스가 그대로인 채
    // 출력만 절단되면, 캐시를 무효화하지 않는 한 다음 실행이 손상된 파일을 그대로 통과시킨다.
    const FULL = '# complete document body\n\n본문 전체\n';
    fs.outputFileSync(path.join(TEST_SOURCE, 'doc.md'), FULL);
    assert.equal(runPrebuild(), true);

    const dest = path.join(TEST_DOCS, 'doc.md');
    const goodOutput = fs.readFileSync(dest, 'utf-8');
    assert.ok(goodOutput.includes('본문 전체'));

    // 산출물이 유실되어 재처리가 필요한 상태를 만든다 (소스는 그대로)
    fs.removeSync(dest);

    // 재처리 도중 일부만 쓰고 실패 (ENOSPC 등)
    const originalOutput = fs.outputFileSync;
    patched.push(['outputFileSync', originalOutput]);
    fs.outputFileSync = function (target, data, ...rest) {
      if (String(target).endsWith(`${path.sep}doc.md`) && String(target).includes('docs')) {
        originalOutput.call(this, target, String(data).slice(0, 12), 'utf-8');
        throw new Error('simulated ENOSPC during write');
      }
      return originalOutput.call(this, target, data, ...rest);
    };

    assert.throws(() => runPrebuild(), PrebuildError);
    restoreFailures();
    assert.notEqual(fs.readFileSync(dest, 'utf-8'), goodOutput, '이 테스트는 절단된 산출물을 전제로 한다');

    // 입력 변화 없이 재시도 → 손상된 산출물이 복구되어야 한다
    assert.equal(runPrebuild(), true);
    assert.equal(fs.readFileSync(dest, 'utf-8'), goodOutput, '절단된 산출물이 cache hit 로 남았다');
  });

  it('캐시 파일 삭제가 막혀도 무효화되어 손상 산출물이 재사용되지 않는다', () => {
    // 권한/락 등으로 removeSync 가 실패하는 환경에서도 복구 불변식이 유지되어야 한다
    const FULL = '# complete\n\n본문 전체\n';
    fs.outputFileSync(path.join(TEST_SOURCE, 'doc.md'), FULL);
    assert.equal(runPrebuild(), true);

    const dest = path.join(TEST_DOCS, 'doc.md');
    const goodOutput = fs.readFileSync(dest, 'utf-8');
    fs.removeSync(dest);  // 산출물 유실 → 재처리 필요 (소스는 그대로)

    const originalOutput = fs.outputFileSync;
    patched.push(['outputFileSync', originalOutput]);
    fs.outputFileSync = function (target, data, ...rest) {
      if (String(target).endsWith(`${path.sep}doc.md`) && String(target).includes('docs')) {
        originalOutput.call(this, target, String(data).slice(0, 12), 'utf-8');
        throw new Error('simulated ENOSPC during write');
      }
      return originalOutput.call(this, target, data, ...rest);
    };
    injectFailure('removeSync', p => p === TEST_CACHE, 'simulated EACCES on cache removal');

    assert.throws(() => runPrebuild(), PrebuildError);
    restoreFailures();

    // 삭제가 막히면 내용 파괴로라도 무효화되어야 한다
    assert.equal(runPrebuild(), true);
    assert.equal(fs.readFileSync(dest, 'utf-8'), goodOutput, '캐시가 살아남아 손상 산출물이 재사용됐다');
  });

  it('증분 실행에서 실패했던 파일은 다음 실행에서 다시 처리된다', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'stable.md'), '# stable\n');
    assert.equal(runPrebuild(), true);

    fs.outputFileSync(path.join(TEST_SOURCE, 'flaky.md'), '# flaky\n');
    injectFailure('readFileSync', p => p.endsWith('flaky.md'), 'simulated read failure');
    assert.throws(() => runPrebuild(), PrebuildError);
    restoreFailures();

    assert.equal(runPrebuild(), true);
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'flaky.md')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'stable.md')));
    const cache = fs.readJsonSync(TEST_CACHE);
    assert.ok(cache.files['flaky.md'], '복구된 파일이 캐시에 기록되어야 한다');
  });
});

describe('runBuild - prebuild 오류 처리', () => {
  afterEach(() => {
    clearHooks();
    restoreFailures();
  });

  it('prebuild 실패 시 Astro 를 실행하지 않고 failed 결과를 반환한다', async () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'ok.md'), '# ok\n');
    fs.outputFileSync(path.join(TEST_SOURCE, 'broken.md'), '# broken\n');
    // 기존 배포본이 남아있어야 "보존" 을 검증할 수 있다
    fs.outputFileSync(path.join(PATHS.DIST, 'index.html'), '<html>previous</html>');

    const stages = [];
    addBuildHook('pre-prebuild', async () => { stages.push('pre-prebuild'); });
    addBuildHook('post-prebuild', async () => { stages.push('post-prebuild'); });
    addBuildHook('pre-astro', async () => { stages.push('pre-astro'); });
    addBuildHook('on-error', async (ctx) => { stages.push('on-error'); stages.push(ctx.error?.name); });

    injectFailure('readFileSync', p => p.endsWith('broken.md'), 'simulated read failure');
    const result = await runBuild();
    restoreFailures();

    assert.equal(result.success, false);
    assert.deepEqual(stages, ['pre-prebuild', 'on-error', 'PrebuildError'],
      'post-prebuild/pre-astro 훅은 호출되지 않고 on-error 만 호출되어야 한다');
    assert.ok(result.failedFiles.some(f => String(f).includes('broken.md')),
      `failedFiles 에 실패 파일이 있어야 함: ${JSON.stringify(result.failedFiles)}`);
    assert.match(result.log, /FAILED/);
    assert.equal(
      fs.readFileSync(path.join(PATHS.DIST, 'index.html'), 'utf-8'),
      '<html>previous</html>',
      '기존 dist 배포본은 그대로 보존되어야 한다',
    );
  });
});
