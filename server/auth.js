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
  const origin = `${proto}://${host}`;

  const match = redirectURIs.find(uri => uri.startsWith(origin));
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
