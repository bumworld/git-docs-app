/**
 * tests/unit/build-status-page.test.js
 * dist 준비 상태 판정 및 Building/실패 페이지 응답 테스트
 *
 * - dist 유효 판정은 index.html 존재 여부 (.DS_Store 같은 잔재 파일 오인 방지)
 * - dist 없음 + 빌드 중/결과 없음 → Building 페이지 (3초 리로드)
 * - dist 없음 + 마지막 빌드 실패 → 503 실패 페이지 (no-store, 30초 리로드)
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';

import {
  BUILD_STATE,
  resolveBuildState,
  sendBuildStatus,
  buildStatusPage,
} from '../../server/middleware/buildStatus.js';
import { PATHS } from '../../config/constants.js';

const TMP = path.join(process.cwd(), 'test-tmp-build-status');
const TEST_DIST = path.join(TMP, 'dist');
const ORIGINAL_PATHS = { ...PATHS };

before(() => {
  PATHS.DIST = TEST_DIST;
});

after(() => {
  Object.assign(PATHS, ORIGINAL_PATHS);
  fs.removeSync(TMP);
});

beforeEach(() => {
  fs.emptyDirSync(TEST_DIST);
});

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    set(key, value) {
      if (typeof key === 'object') Object.assign(this.headers, key);
      else this.headers[key] = value;
      return this;
    },
    send(body) { this.body = body; return this; },
  };
}

function makeReq(url = '/', buildRunner = null) {
  return { path: url, app: { locals: { buildRunner } } };
}

const runnerStub = ({ building = false, last = null }) => ({
  isBuilding: () => building,
  getLastResult: () => last,
});

// ─── 상태 판정 ────────────────────────────────────────────────────────────────

describe('resolveBuildState', () => {
  it('dist/index.html 이 있으면 ready', () => {
    fs.outputFileSync(path.join(TEST_DIST, 'index.html'), '<html></html>');
    const state = resolveBuildState({
      distPath: TEST_DIST,
      buildRunner: runnerStub({ last: { success: false, finishedAt: Date.now() } }),
    });
    assert.equal(state.state, BUILD_STATE.READY);
  });

  it('dist 에 파일이 있어도 index.html 이 없으면 ready 가 아니다', () => {
    fs.outputFileSync(path.join(TEST_DIST, '.DS_Store'), 'junk');
    const state = resolveBuildState({ distPath: TEST_DIST, buildRunner: null });
    assert.notEqual(state.state, BUILD_STATE.READY);
  });

  it('dist 없음 + 빌드 중이면 building', () => {
    const state = resolveBuildState({
      distPath: TEST_DIST,
      buildRunner: runnerStub({ building: true, last: { success: false, finishedAt: 1 } }),
    });
    assert.equal(state.state, BUILD_STATE.BUILDING);
  });

  it('dist 없음 + 결과 없음이면 building', () => {
    const state = resolveBuildState({ distPath: TEST_DIST, buildRunner: runnerStub({}) });
    assert.equal(state.state, BUILD_STATE.BUILDING);
  });

  it('buildRunner 가 없으면 building (결과 없음으로 처리)', () => {
    const state = resolveBuildState({ distPath: TEST_DIST, buildRunner: null });
    assert.equal(state.state, BUILD_STATE.BUILDING);
  });

  it('dist 없음 + 마지막 빌드 실패면 failed', () => {
    const finishedAt = Date.now();
    const state = resolveBuildState({
      distPath: TEST_DIST,
      buildRunner: runnerStub({ last: { success: false, finishedAt } }),
    });
    assert.equal(state.state, BUILD_STATE.FAILED);
    assert.equal(state.finishedAt, finishedAt);
  });
});

// ─── 응답 생성 ────────────────────────────────────────────────────────────────

describe('sendBuildStatus', () => {
  it('building 상태는 200 + 3초 리로드 페이지', () => {
    const res = makeRes();
    sendBuildStatus(res, { state: BUILD_STATE.BUILDING });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.match(res.body, /location\.reload\(\),\s*3000/);
  });

  it('failed 상태는 503 + no-store + 30초 리로드', () => {
    const res = makeRes();
    sendBuildStatus(res, { state: BUILD_STATE.FAILED, finishedAt: Date.now() });
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.match(res.body, /빌드 실패/);
    assert.match(res.body, /location\.reload\(\),\s*30000/);
  });

  it('실패 페이지는 내부 경로나 에러 로그를 노출하지 않는다', () => {
    const res = makeRes();
    sendBuildStatus(res, { state: BUILD_STATE.FAILED, finishedAt: Date.now() });
    assert.ok(!res.body.includes('/src/content/docs'));
    assert.ok(!res.body.includes(process.cwd()));
  });
});

// ─── 미들웨어 ─────────────────────────────────────────────────────────────────

describe('buildStatusPage 미들웨어', () => {
  it('dist 가 유효하면 next() 로 통과', () => {
    fs.outputFileSync(path.join(TEST_DIST, 'index.html'), '<html></html>');
    const res = makeRes();
    let nextCalled = false;
    buildStatusPage(makeReq('/', runnerStub({})), res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(res.body, null);
  });

  it('빌드 실패 상태면 503 을 응답한다', () => {
    const res = makeRes();
    let nextCalled = false;
    const req = makeReq('/', runnerStub({ last: { success: false, finishedAt: Date.now() } }));
    buildStatusPage(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
  });

  it('빌드 중이면 Building 페이지를 응답한다', () => {
    const res = makeRes();
    const req = makeReq('/', runnerStub({ building: true }));
    buildStatusPage(req, res, () => assert.fail('next 호출되면 안 됨'));
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Building/);
  });

  it('/api, /_assets, /admin 경로는 항상 통과시킨다', () => {
    for (const p of ['/api/build', '/_assets/app.js', '/admin']) {
      const res = makeRes();
      let nextCalled = false;
      buildStatusPage(makeReq(p, runnerStub({ last: { success: false, finishedAt: 1 } })), res, () => { nextCalled = true; });
      assert.equal(nextCalled, true, `${p} 통과 실패`);
    }
  });
});
