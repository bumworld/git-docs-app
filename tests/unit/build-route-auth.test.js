/**
 * tests/unit/build-route-auth.test.js
 * POST /api/rebuild 권한 검증 — 관리자만 수동 빌드를 트리거할 수 있어야 한다.
 *
 * DEV_MODE 는 requireAuth 모듈이 import 되는 시점에 캡처되므로,
 * 라우터를 동적 import 하기 전에 반드시 해제해야 한다.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'node:http';

delete process.env.DEV_MODE;

const { default: buildRouter, setBuildRunner } = await import('../../server/routes/build.js');

let currentUser = null;
let triggerCalls = [];
let server;
let baseUrl;

const fakeRunner = {
  isBuilding: () => false,
  triggerBuild: (type, by) => { triggerCalls.push([type, by]); },
};

before(async () => {
  setBuildRunner(fakeRunner);

  const app = express();
  app.use((req, res, next) => {
    req.isAuthenticated = () => currentUser !== null;
    if (currentUser) req.user = currentUser;
    next();
  });
  app.use('/api', buildRouter);

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    // 미소비 응답 body 로 keep-alive 소켓이 남으면 close() 가 지연된다
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
});

beforeEach(() => {
  currentUser = null;
  triggerCalls = [];
});

async function post(path) {
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST' });
  await res.clone().arrayBuffer();  // body 소비 → 소켓 즉시 반환
  return res;
}

describe('POST /api/rebuild 권한', () => {
  it('DEV_MODE 가 꺼진 상태에서 실행되어야 한다', () => {
    assert.notStrictEqual(process.env.DEV_MODE, 'true');
  });

  it('미인증 요청은 401', async () => {
    const res = await post('/api/rebuild');
    assert.strictEqual(res.status, 401);
    assert.deepStrictEqual(await res.json(), { error: 'Not authenticated' });
    assert.deepStrictEqual(triggerCalls, []);
  });

  it('active 일반 사용자는 403', async () => {
    currentUser = { email: 'user@example.com', role: 'user', status: 'active' };
    const res = await post('/api/rebuild');
    assert.strictEqual(res.status, 403);
    assert.deepStrictEqual(await res.json(), { error: 'Admin access required' });
    assert.deepStrictEqual(triggerCalls, []);
  });

  it('pending 사용자는 403', async () => {
    currentUser = { email: 'pending@example.com', role: 'admin', status: 'pending' };
    const res = await post('/api/rebuild');
    assert.strictEqual(res.status, 403);
    assert.deepStrictEqual(triggerCalls, []);
  });

  it('blocked 사용자는 403', async () => {
    currentUser = { email: 'blocked@example.com', role: 'admin', status: 'blocked' };
    const res = await post('/api/rebuild');
    assert.strictEqual(res.status, 403);
    assert.deepStrictEqual(triggerCalls, []);
  });

  it('active 관리자는 200 이며 triggerBuild 가 호출된다', async () => {
    currentUser = { email: 'admin@example.com', role: 'admin', status: 'active' };
    const res = await post('/api/rebuild');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { success: true, message: 'Build triggered' });
    assert.deepStrictEqual(triggerCalls, [['manual', 'admin@example.com']]);
  });
});

describe('GET /api/status 는 일반 사용자도 접근 가능', () => {
  it('active 일반 사용자는 200 + { building }', async () => {
    currentUser = { email: 'user@example.com', role: 'user', status: 'active' };
    const res = await fetch(`${baseUrl}/api/status`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { building: false });
  });
});
