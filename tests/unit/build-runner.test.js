/**
 * tests/unit/build-runner.test.js
 * createBuildRunner()의 마지막 빌드 결과 추적(getLastResult) 테스트
 *
 * 빌드가 실패해 dist 가 만들어지지 않으면 서버가 Building 페이지를 무한 리로드하므로,
 * 러너는 마지막 빌드 결과(성공/실패)를 항상 기록해야 한다.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';
import { PATHS } from '../../config/constants.js';

const TMP = path.join(process.cwd(), 'test-tmp-build-runner');
const ORIGINAL_PATHS = { ...PATHS };

// server/db.js 는 import 시점에 PATHS.DB 로 SQLite 를 여므로,
// watcher.js 를 동적 import 하기 전에 임시 경로로 바꿔 실제 DB 를 건드리지 않는다.
let createBuildRunner;

before(async () => {
  fs.ensureDirSync(TMP);
  PATHS.DATA = TMP;
  PATHS.DB = path.join(TMP, 'test-runner.db');
  ({ createBuildRunner } = await import('../../scripts/watcher.js'));
});

after(() => {
  Object.assign(PATHS, ORIGINAL_PATHS);
  fs.removeSync(TMP);
});

const okResult = { success: true, durationMs: 10, log: 'ok', failedFiles: [] };
const failResult = { success: false, durationMs: 10, log: 'boom', failedFiles: ['a.md'] };

describe('createBuildRunner - getLastResult', () => {
  it('빌드 전에는 결과가 없다', () => {
    const runner = createBuildRunner({ runBuild: async () => okResult });
    assert.equal(runner.getLastResult(), null);
  });

  it('성공 시 success: true 를 기록한다', async () => {
    const runner = createBuildRunner({ runBuild: async () => okResult });
    await runner.triggerBuild('manual', 'test');

    const last = runner.getLastResult();
    assert.equal(last.success, true);
    assert.equal(typeof last.finishedAt, 'number');
    assert.ok(last.finishedAt <= Date.now());
    assert.equal(runner.isBuilding(), false);
  });

  it('runBuild 가 실패 결과를 반환하면 success: false 를 기록한다', async () => {
    const runner = createBuildRunner({ runBuild: async () => failResult });
    await runner.triggerBuild('manual', 'test');

    const last = runner.getLastResult();
    assert.equal(last.success, false);
    assert.equal(typeof last.finishedAt, 'number');
    assert.equal(runner.isBuilding(), false);
  });

  it('runBuild 가 throw 해도 success: false 를 기록한다', async () => {
    const runner = createBuildRunner({
      runBuild: async () => { throw new Error('astro exploded'); },
    });
    await runner.triggerBuild('manual', 'test');

    const last = runner.getLastResult();
    assert.equal(last.success, false);
    assert.equal(runner.isBuilding(), false);
  });

  it('빌드 중에는 isBuilding() 이 true 이고 결과 기록은 완료 후에 갱신된다', async () => {
    let seenBuilding = null;
    let seenResult = 'unset';
    const runner = createBuildRunner({
      runBuild: async () => {
        seenBuilding = runner.isBuilding();
        seenResult = runner.getLastResult();
        return okResult;
      },
    });

    await runner.triggerBuild('manual', 'test');

    assert.equal(seenBuilding, true);
    assert.equal(seenResult, null, '빌드 중에는 이전 결과(없음)가 유지되어야 함');
    assert.equal(runner.getLastResult().success, true);
  });

  it('실패 후 성공하면 결과가 갱신된다', async () => {
    let shouldFail = true;
    const runner = createBuildRunner({
      runBuild: async () => (shouldFail ? failResult : okResult),
    });

    await runner.triggerBuild('manual', 'test');
    assert.equal(runner.getLastResult().success, false);

    shouldFail = false;
    await runner.triggerBuild('manual', 'test');
    assert.equal(runner.getLastResult().success, true);
  });

  it('triggerBuild 는 Promise 를 반환한다 (기존 계약)', () => {
    const runner = createBuildRunner({ runBuild: async () => okResult });
    const p = runner.triggerBuild('manual', 'test');
    assert.ok(p instanceof Promise);
    return p;
  });
});
