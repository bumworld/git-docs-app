import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import fs from 'fs';
import path from 'path';
import { findUserById, createOrUpdateUser } from './db.js';
import { PATHS } from '../config/constants.js';

function loadGoogleConfig() {
  const confPath = PATHS.GOOGLE_AUTH;
  if (!fs.existsSync(confPath)) {
    console.error(`[Auth] ${confPath} not found. Google OAuth will not work.`);
    return null;
  }
  const raw = fs.readFileSync(confPath, 'utf-8');
  const config = JSON.parse(raw);

  // Support both direct format and Google Cloud Console download format
  const web = config.web || config;
  return {
    clientID: web.client_id,
    clientSecret: web.client_secret,
    // Store all redirect URIs for dynamic matching
    redirectURIs: web.redirect_uris || [],
    callbackURL: web.redirect_uris
      ? web.redirect_uris[0]
      : web.callback_url || '/auth/google/callback',
  };
}

/**
 * Find the best matching callback URL from redirect_uris based on the incoming request.
 * Matches by protocol + host + port so the same google_auth.json works across
 * multiple domains / ports (e.g. localhost:3000 dev, wiki.example.com prod).
 */
function resolveCallbackURL(redirectURIs, req) {
  if (!redirectURIs || redirectURIs.length === 0) {
    return '/auth/google/callback';
  }
  if (redirectURIs.length === 1) {
    return redirectURIs[0];
  }

  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';

  // origin 을 prefix 로 비교하면 wiki.example 요청이 wiki.example.evil.com 등록 URI 와
  // 매칭될 수 있다. URL 로 파싱해 scheme+host+port 전체(origin)를 정확히 비교한다.
  let origin;
  try {
    origin = new URL(`${proto}://${host}`).origin;
  } catch {
    return redirectURIs[0];
  }

  const match = redirectURIs.find(uri => {
    try {
      return new URL(uri).origin === origin;
    } catch {
      return false;  // 잘못 등록된 URI 는 매칭 대상에서 제외
    }
  });
  return match || redirectURIs[0];
}

function setupPassport() {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    const user = findUserById(id);
    done(null, user || false);
  });

  const googleConfig = loadGoogleConfig();

  if (!googleConfig) {
    console.warn('[Auth] Skipping Google OAuth setup - no config found.');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: googleConfig.clientID,
        clientSecret: googleConfig.clientSecret,
        // Use first URI as default; dynamic override happens in auth route
        callbackURL: googleConfig.callbackURL,
        // Enable request access so we can resolve callback dynamically
        passReqToCallback: true,
        // 로그인 CSRF 방어: 인증 시작 시 세션에 nonce(state)를 저장하고 콜백에서 대조한다.
        // 공격자가 자신의 authorization code 를 피해자 브라우저에 주입해 계정을 바꿔치기하는
        // 공격을 토큰 교환 이전 단계에서 차단한다.
        // (express-session 이 passport 보다 먼저 설치되어 있고, state 저장이 세션을 변경하므로
        //  saveUninitialized:false 여도 인증 시작 응답에서 쿠키가 발급된다)
        // 주의: 세션당 state 는 하나만 보관되므로 같은 브라우저에서 여러 탭으로 동시에
        //       로그인을 시작하면 마지막 시작만 성공한다(보안 결함 아님, UX 제약).
        state: true,
      },
      (req, accessToken, refreshToken, profile, done) => {
        const user = createOrUpdateUser({
          email: profile.emails[0].value,
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value || '',
        });
        done(null, user);
      }
    )
  );

}

export { setupPassport, loadGoogleConfig, resolveCallbackURL };
