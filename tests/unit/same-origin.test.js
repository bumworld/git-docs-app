/**
 * tests/unit/same-origin.test.js
 *
 * /api 변경 요청(POST/PUT/PATCH/DELETE)에 대한 Origin 검사 (CSRF 심층 방어).
 *
 * SameSite=lax 쿠키가 1차 방어이고 이 미들웨어는 2차 방어다.
 * - Origin 이 있으면 scheme+host+port 전체(직렬화된 origin)를 비교한다.
 * - 기대 origin 은 ALLOWED_ORIGINS 환경변수가 있으면 그 목록, 없으면
 *   req.protocol + raw Host 헤더로 계산한다. X-Forwarded-Host 를 직접 읽으면
 *   공격자가 Origin 과 같은 값으로 맞춰 우회할 수 있으므로 사용하지 않는다.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import { createSameOrigin } from '../../server/middleware/sameOrigin.js';

let server;
let port;
let allowedOrigins;   // createSameOrigin 에 넘길 목록 (undefined = 요청 기반 계산)

before(async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api', (req, res, next) => createSameOrigin(allowedOrigins)(req, res, next));
  app.all('/api/thing', (req, res) => res.json({ ok: true, method: req.method }));

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});

after(async () => {
  if (server) {
    // undici 는 keep-alive 소켓을 재사용하므로 명시적으로 끊지 않으면
    // server.close() 가 idle 타임아웃까지 대기해 테스트 종료가 지연된다.
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
});

beforeEach(() => {
  allowedOrigins = undefined;
});

function selfOrigin() {
  return `http://127.0.0.1:${port}`;
}

async function request(method, headers = {}) {
  const res = await fetch(`${selfOrigin()}/api/thing`, { method, headers });
  // 응답 body 를 소비해야 소켓이 즉시 반환된다 (미소비 시 teardown 지연)
  if (method !== 'HEAD') await res.clone().arrayBuffer();
  return res;
}

async function assertForbidden(res) {
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: 'Invalid request origin' });
}

describe('sameOrigin - 안전한 메서드', () => {
  it('GET 은 임의의 Origin 이어도 통과한다', async () => {
    const res = await request('GET', { Origin: 'https://evil.example' });
    assert.equal(res.status, 200);
  });

  it('HEAD/OPTIONS 도 통과한다', async () => {
    assert.equal((await request('HEAD', { Origin: 'https://evil.example' })).status, 200);
    assert.equal((await request('OPTIONS', { Origin: 'https://evil.example' })).status, 200);
  });
});

describe('sameOrigin - 변경 메서드', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    it(`${method} + 같은 origin 은 통과한다`, async () => {
      const res = await request(method, { Origin: selfOrigin() });
      assert.equal(res.status, 200);
    });

    it(`${method} + 다른 host 는 403`, async () => {
      await assertForbidden(await request(method, { Origin: 'https://evil.example' }));
    });
  }

  it('Origin 헤더가 없으면 통과한다 (curl/서버간 호출 호환)', async () => {
    const res = await request('POST');
    assert.equal(res.status, 200);
  });

  it('같은 host 라도 scheme 이 다르면 403', async () => {
    await assertForbidden(await request('POST', { Origin: `https://127.0.0.1:${port}` }));
  });

  it('같은 host 라도 포트가 다르면 403', async () => {
    await assertForbidden(await request('POST', { Origin: `http://127.0.0.1:${port + 1}` }));
  });

  it('Origin: null 은 403', async () => {
    await assertForbidden(await request('POST', { Origin: 'null' }));
  });

  it('파싱할 수 없는 Origin 은 403', async () => {
    await assertForbidden(await request('POST', { Origin: 'not-a-url' }));
  });

  it('공격자가 X-Forwarded-Host 를 Origin 과 맞춰도 403', async () => {
    await assertForbidden(await request('POST', {
      Origin: 'https://evil.example',
      'X-Forwarded-Host': 'evil.example',
    }));
  });

  it('공격자가 X-Forwarded-Proto 로 스킴을 위조해도 host 가 다르면 403', async () => {
    await assertForbidden(await request('POST', {
      Origin: 'https://evil.example',
      'X-Forwarded-Host': 'evil.example',
      'X-Forwarded-Proto': 'https',
    }));
  });
});

describe('sameOrigin - ALLOWED_ORIGINS 설정', () => {
  it('설정된 origin 과 정확히 일치하면 통과한다', async () => {
    allowedOrigins = ['https://wiki.example', 'http://localhost:3000'];
    const res = await request('POST', { Origin: 'https://wiki.example' });
    assert.equal(res.status, 200);
  });

  it('설정 목록에 없으면 요청 host 와 같아도 403', async () => {
    allowedOrigins = ['https://wiki.example'];
    await assertForbidden(await request('POST', { Origin: selfOrigin() }));
  });

  it('설정된 origin 의 서브도메인/prefix 는 통과하지 않는다', async () => {
    allowedOrigins = ['https://wiki.example'];
    await assertForbidden(await request('POST', { Origin: 'https://wiki.example.evil.com' }));
  });

  it('trailing slash/대문자 host 를 정규화해 비교한다', async () => {
    allowedOrigins = ['https://WIKI.example/'];
    const res = await request('POST', { Origin: 'https://wiki.example' });
    assert.equal(res.status, 200);
  });

  it('기본 포트를 명시해도 같은 origin 으로 본다', async () => {
    allowedOrigins = ['https://wiki.example:443'];
    const res = await request('POST', { Origin: 'https://wiki.example' });
    assert.equal(res.status, 200);
  });
});

describe('parseAllowedOrigins', () => {
  it('콤마 구분 문자열을 목록으로 만든다', async () => {
    const { parseAllowedOrigins } = await import('../../server/middleware/sameOrigin.js');
    assert.deepEqual(
      parseAllowedOrigins(' https://a.example , https://b.example:8443 '),
      ['https://a.example', 'https://b.example:8443'],
    );
  });

  it('빈 값이나 구분자뿐인 값이면 null 을 반환한다 (미설정 취급 → 요청 기반 계산)', async () => {
    const { parseAllowedOrigins } = await import('../../server/middleware/sameOrigin.js');
    assert.equal(parseAllowedOrigins(''), null);
    assert.equal(parseAllowedOrigins(undefined), null);
    assert.equal(parseAllowedOrigins('  ,  '), null);
  });

  it('파싱할 수 없는 항목은 버린다', async () => {
    const { parseAllowedOrigins } = await import('../../server/middleware/sameOrigin.js');
    assert.deepEqual(parseAllowedOrigins('nonsense, https://ok.example'), ['https://ok.example']);
  });

  it('값은 있는데 전부 잘못됐으면 빈 배열을 반환한다 (완화 폴백 금지)', async () => {
    const { parseAllowedOrigins } = await import('../../server/middleware/sameOrigin.js');
    // 예: scheme 없이 host 만 적은 설정 오류
    assert.deepEqual(parseAllowedOrigins('wiki.example'), []);
  });
});

describe('sameOrigin - 설정 오류는 fail-closed', () => {
  it('ALLOWED_ORIGINS 가 전부 무효면 Origin 이 붙은 요청은 같은 origin 이어도 403', async () => {
    allowedOrigins = [];  // parseAllowedOrigins('wiki.example') 의 결과와 동일
    await assertForbidden(await request('POST', { Origin: selfOrigin() }));
  });

  it('설정 오류여도 GET 과 Origin 없는 요청은 통과한다 (Origin 이 있을 때만 검증하는 호환 정책)', async () => {
    allowedOrigins = [];
    assert.equal((await request('GET', { Origin: selfOrigin() })).status, 200);
    assert.equal((await request('POST')).status, 200);
  });
});
