/**
 * tests/unit/oauth-state.test.js
 *
 * OAuth 로그인 CSRF 방어(state) 및 동적 callback URL 해석 검증.
 *
 * - GoogleStrategy 에 state 저장소가 켜져 있어야 공격자가 만든 authorization code 를
 *   피해자 브라우저에 주입하는 로그인 CSRF 를 막을 수 있다.
 * - resolveCallbackURL 은 origin 을 prefix 로 비교하면 wiki.example 요청이
 *   wiki.example.evil.com 등록 URI 와 매칭될 수 있으므로 origin 전체를 비교해야 한다.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';
import http from 'node:http';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import Database from 'better-sqlite3';

import { PATHS } from '../../config/constants.js';
import { createSessionStore } from '../../server/session-store.js';

const TMP = path.join(process.cwd(), 'test-tmp-oauth-state');
const ORIGINAL_GOOGLE_AUTH = PATHS.GOOGLE_AUTH;

// 가짜 google_auth.json 을 만든 뒤 auth.js 를 로드해야 전략이 등록된다
fs.outputJsonSync(path.join(TMP, 'google_auth.json'), {
  web: {
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    redirect_uris: ['http://127.0.0.1/auth/google/callback'],
  },
});
PATHS.GOOGLE_AUTH = path.join(TMP, 'google_auth.json');

const { setupPassport, resolveCallbackURL, loadGoogleConfig } = await import('../../server/auth.js');
const { default: authRoutes } = await import('../../server/routes/auth.js');

// ─── resolveCallbackURL ───────────────────────────────────────────────────────

function reqWith(host, proto = 'https') {
  return { headers: { host, 'x-forwarded-proto': proto }, protocol: proto };
}

describe('resolveCallbackURL', () => {
  it('등록 URI 가 없으면 기본 경로를 반환한다', () => {
    assert.equal(resolveCallbackURL([], reqWith('wiki.example')), '/auth/google/callback');
    assert.equal(resolveCallbackURL(undefined, reqWith('wiki.example')), '/auth/google/callback');
  });

  it('등록 URI 가 하나면 그대로 사용한다', () => {
    const uris = ['https://wiki.example/oauth2/callback'];
    assert.equal(resolveCallbackURL(uris, reqWith('other.example')), uris[0]);
  });

  it('요청 origin 과 일치하는 URI 를 고른다', () => {
    const uris = [
      'http://localhost:3000/auth/google/callback',
      'https://wiki.example/auth/google/callback',
    ];
    assert.equal(resolveCallbackURL(uris, reqWith('wiki.example')), uris[1]);
    assert.equal(resolveCallbackURL(uris, reqWith('localhost:3000', 'http')), uris[0]);
  });

  it('prefix 가 같은 다른 도메인에 오인 매칭되지 않는다', () => {
    const uris = [
      'https://wiki.example.evil.com/auth/google/callback',
      'https://wiki.example/auth/google/callback',
    ];
    assert.equal(
      resolveCallbackURL(uris, reqWith('wiki.example')),
      'https://wiki.example/auth/google/callback',
      'origin 을 prefix 로 비교하면 evil 도메인이 선택된다',
    );
  });

  it('포트와 스킴이 다르면 매칭되지 않는다', () => {
    const uris = [
      'http://localhost:4000/auth/google/callback',
      'http://localhost:3000/auth/google/callback',
    ];
    assert.equal(resolveCallbackURL(uris, reqWith('localhost:3000', 'http')), uris[1]);
    // https://localhost:3000 은 등록되지 않았으므로 첫 URI 로 폴백
    assert.equal(resolveCallbackURL(uris, reqWith('localhost:3000', 'https')), uris[0]);
  });

  it('파싱할 수 없는 등록 URI 가 있어도 예외 없이 동작한다', () => {
    const uris = ['not a url', 'https://wiki.example/auth/google/callback'];
    assert.equal(
      resolveCallbackURL(uris, reqWith('wiki.example')),
      'https://wiki.example/auth/google/callback',
    );
  });
});

// ─── state 통합 검증 ──────────────────────────────────────────────────────────

let server;
let baseUrl;
let sessionDb;
let tokenExchangeCalls = 0;
let verifyCalls = 0;

before(async () => {
  setupPassport();

  const strategy = passport._strategy('google');
  assert.ok(strategy, 'google 전략이 등록되어야 한다');

  // 토큰 교환은 네트워크를 타지 않도록 스텁 — 호출 여부로 state 검증 통과 시점을 판별한다.
  // 항상 실패시키므로 verify 콜백(사용자 생성)까지는 절대 도달하지 않는다.
  strategy._oauth2.getOAuthAccessToken = (code, params, cb) => {
    tokenExchangeCalls++;
    cb(new Error('stubbed token exchange'));
  };
  const originalVerify = strategy._verify;
  strategy._verify = (...args) => { verifyCalls++; return originalVerify.apply(strategy, args); };

  // 실제 앱과 같은 SQLite 세션 스토어를 쓴다 (state 가 직렬화 → 재로드를 거쳐야 하므로
  // MemoryStore 만으로는 저장소 계약이 검증되지 않는다). DB 는 임시 파일로 격리.
  sessionDb = new Database(path.join(TMP, 'sessions.db'));
  sessionDb.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired DATETIME NOT NULL
    );
  `);

  const app = express();
  app.use(session({
    store: createSessionStore(sessionDb),
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { sameSite: 'lax' },
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  // 실제 라우터를 그대로 마운트 (/auth/google, /auth/google/callback)
  app.use('/auth', authRoutes);

  // server/index.js 의 /oauth2/callback 핸들러와 동일한 구성 (동적 callbackURL)
  app.get('/oauth2/callback', (req, res, next) => {
    const config = loadGoogleConfig();
    if (!config) return res.redirect('/login?error=auth_failed');
    const callbackURL = resolveCallbackURL(config.redirectURIs, req);
    passport.authenticate('google', {
      failureRedirect: '/login?error=auth_failed',
      callbackURL,
    })(req, res, next);
  }, (req, res) => res.redirect('/'));

  app.use((err, req, res, next) => res.status(500).send(`error: ${err.message}`));

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
  if (sessionDb) sessionDb.close();
  PATHS.GOOGLE_AUTH = ORIGINAL_GOOGLE_AUTH;
  fs.removeSync(TMP);
});

/** 인증 시작 → { state, cookie } */
async function startAuth() {
  const res = await fetch(`${baseUrl}/auth/google`, { redirect: 'manual' });
  const location = res.headers.get('location');
  const setCookie = res.headers.get('set-cookie');
  const state = new URL(location).searchParams.get('state');
  return { res, location, setCookie, state };
}

function cookieHeader(setCookie) {
  return (setCookie || '').split(';')[0];
}

describe('OAuth state - 인증 시작', () => {
  it('Google 리다이렉트에 비어있지 않은 state 가 포함된다', async () => {
    const { res, location, state } = await startAuth();
    assert.equal(res.status, 302);
    assert.equal(new URL(location).host, 'accounts.google.com');
    assert.ok(state && state.length > 0, `state 가 없음: ${location}`);
  });

  it('state 저장을 위해 세션 쿠키가 발급된다 (saveUninitialized:false 와 호환)', async () => {
    const { setCookie } = await startAuth();
    assert.ok(setCookie && /connect\.sid=/.test(setCookie), `세션 쿠키 미발급: ${setCookie}`);
  });

  it('요청마다 다른 state 를 발급한다', async () => {
    const a = await startAuth();
    const b = await startAuth();
    assert.notEqual(a.state, b.state);
  });

  it('발급한 state 가 SQLite 세션 스토어에 저장된다', async () => {
    const { state } = await startAuth();
    const rows = sessionDb.prepare('SELECT sess FROM sessions').all();
    const stored = rows.map(r => r.sess).join('\n');
    assert.ok(stored.includes(state), 'state 가 세션 레코드에 직렬화되어야 한다');
  });
});

describe('OAuth state - 콜백 검증', () => {
  it('state 가 없으면 토큰 교환 전에 실패한다', async () => {
    const { setCookie } = await startAuth();
    const before = tokenExchangeCalls;

    const res = await fetch(`${baseUrl}/auth/google/callback?code=attacker-code`, {
      headers: { Cookie: cookieHeader(setCookie) },
      redirect: 'manual',
    });

    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/login?error=auth_failed');
    assert.equal(tokenExchangeCalls, before, 'state 없이 토큰 교환이 시도되면 안 된다');
    assert.equal(verifyCalls, 0, 'verify 콜백이 호출되면 안 된다');
  });

  it('state 가 불일치하면 토큰 교환 전에 실패한다', async () => {
    const { setCookie } = await startAuth();
    const before = tokenExchangeCalls;

    const res = await fetch(`${baseUrl}/auth/google/callback?code=attacker-code&state=forged-state`, {
      headers: { Cookie: cookieHeader(setCookie) },
      redirect: 'manual',
    });

    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/login?error=auth_failed');
    assert.equal(tokenExchangeCalls, before, '불일치 state 로 토큰 교환이 시도되면 안 된다');
    assert.equal(verifyCalls, 0, 'verify 콜백이 호출되면 안 된다');
  });

  it('세션 쿠키가 없으면 (다른 브라우저 주입) 실패한다', async () => {
    const { state } = await startAuth();
    const before = tokenExchangeCalls;

    const res = await fetch(`${baseUrl}/auth/google/callback?code=attacker-code&state=${state}`, {
      redirect: 'manual',
    });

    assert.notEqual(res.headers.get('location'), '/');
    assert.equal(tokenExchangeCalls, before, '세션 없이 토큰 교환이 시도되면 안 된다');
    assert.equal(verifyCalls, 0);
  });

  it('같은 세션 + 같은 state 면 state 단계를 통과해 토큰 교환까지 진행된다', async () => {
    const { setCookie, state } = await startAuth();
    const before = tokenExchangeCalls;

    await fetch(`${baseUrl}/auth/google/callback?code=valid-code&state=${state}`, {
      headers: { Cookie: cookieHeader(setCookie) },
      redirect: 'manual',
    });

    assert.equal(tokenExchangeCalls, before + 1, 'state 가 일치하면 토큰 교환이 시도되어야 한다');
    assert.equal(verifyCalls, 0, '스텁이 토큰 교환을 실패시키므로 verify 는 호출되지 않는다');
  });
});

// /oauth2/callback 은 /auth/google/callback 과 다른 경로지만 같은 전략·같은 세션을 쓴다.
// 동적 callbackURL 이 state 저장소 키를 바꾸지 않는지 확인한다.
describe('OAuth state - /oauth2/callback 경로', () => {
  it('state 불일치면 토큰 교환 전에 실패한다', async () => {
    const { setCookie } = await startAuth();
    const before = tokenExchangeCalls;

    const res = await fetch(`${baseUrl}/oauth2/callback?code=attacker-code&state=forged`, {
      headers: { Cookie: cookieHeader(setCookie) },
      redirect: 'manual',
    });

    assert.equal(res.headers.get('location'), '/login?error=auth_failed');
    assert.equal(tokenExchangeCalls, before);
    assert.equal(verifyCalls, 0);
  });

  it('state 가 일치하면 토큰 교환까지 진행된다', async () => {
    const { setCookie, state } = await startAuth();
    const before = tokenExchangeCalls;

    await fetch(`${baseUrl}/oauth2/callback?code=valid-code&state=${state}`, {
      headers: { Cookie: cookieHeader(setCookie) },
      redirect: 'manual',
    });

    assert.equal(tokenExchangeCalls, before + 1, '다른 콜백 경로에서도 state 가 검증·통과되어야 한다');
  });
});
