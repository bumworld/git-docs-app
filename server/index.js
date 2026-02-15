import express from 'express';
import session from 'express-session';
import passport from 'passport';
import path from 'path';
import fs from 'fs';
import { initializeDatabase, seedAdmin, getAllSettings } from './db.js';
import { setupPassport, loadGoogleConfig, resolveCallbackURL } from './auth.js';
import { createSessionStore } from './session-store.js';
import authRoutes from './routes/auth.js';
import adminRoutes, { setAdminBuildRunner } from './routes/admin.js';
import buildRoutes, { setBuildRunner } from './routes/build.js';
import { requireAuth } from './middleware/requireAuth.js';
import { createBuildRunner } from '../scripts/watcher.js';
import { PATHS, SESSION } from '../config/constants.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const DEV_MODE = process.env.DEV_MODE === 'true';
const SESSION_SECRET = process.env.SESSION_SECRET || 'git-docs-secret-' + Math.random().toString(36).slice(2);

// Initialize database
initializeDatabase();
if (ADMIN_EMAIL) {
  seedAdmin(ADMIN_EMAIL);
}

// Setup Passport
setupPassport();

const app = express();

// Trust reverse proxy (nginx, etc.) for correct protocol/IP detection
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: createSessionStore(),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: SESSION.MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: 'auto',
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const user = req.user ? req.user.email : '-';
    // Skip noisy static asset logs
    if (req.path.startsWith('/_assets/') || req.path.startsWith('/favicon')) return;
    console.log(`[HTTP] ${req.method} ${req.path} ${res.statusCode} ${ms}ms ${user}`);
  });
  next();
});

// Inject site settings into all responses
app.use((req, res, next) => {
  res.locals.settings = getAllSettings();
  next();
});

// Public routes
app.use('/auth', authRoutes);

// OAuth2 callback (matches redirect_uris like /oauth2/callback from google_auth.json)
app.get('/oauth2/callback', (req, res, next) => {
  const config = loadGoogleConfig();
  if (!config) {
    return res.redirect('/login?error=auth_failed');
  }
  const callbackURL = resolveCallbackURL(config.redirectURIs, req);
  passport.authenticate('google', {
    failureRedirect: '/login?error=auth_failed',
    callbackURL,
  })(req, res, next);
}, (req, res) => {
  if (req.user.status === 'pending') {
    console.log(`[Auth] Login pending: ${req.user.email}`);
    return res.redirect('/pending');
  }
  if (req.user.status === 'blocked') {
    console.log(`[Auth] Login blocked: ${req.user.email}`);
    return res.redirect('/login?error=blocked');
  }
  console.log(`[Auth] Login success: ${req.user.email} (${req.user.role})`);
  res.redirect('/');
});

// Login page
app.get('/login', (req, res) => {
  const loginPage = path.join(PATHS.ADMIN_UI, 'login.html');
  if (fs.existsSync(loginPage)) {
    res.sendFile(loginPage);
  } else {
    res.send('<h1>Login</h1><a href="/auth/google">Sign in with Google</a>');
  }
});

// Pending page
app.get('/pending', (req, res) => {
  const pendingPage = path.join(PATHS.ADMIN_UI, 'pending.html');
  if (fs.existsSync(pendingPage)) {
    res.sendFile(pendingPage);
  } else {
    res.send('<h1>Access Pending</h1><p>Your account is awaiting admin approval.</p><a href="/auth/logout">Logout</a>');
  }
});

// API: site settings (public, for header/footer rendering)
app.get('/api/settings', (req, res) => {
  const settings = getAllSettings();
  res.json({
    site_title: settings.site_title,
    site_description: settings.site_description,
    contact_email: settings.contact_email,
    footer_text: settings.footer_text,
  });
});

// Static assets from dist/ - served WITHOUT auth (CSS, JS, fonts, images are not sensitive)
// This prevents white screen on mobile when session cookie is not sent with subresource requests
app.use('/_assets', express.static(path.join(PATHS.DIST, '_assets'), {
  maxAge: '1y',
  immutable: true,
}));
app.use('/favicon.svg', (req, res, next) => {
  const faviconPath = path.join(PATHS.DIST, 'favicon.svg');
  if (fs.existsSync(faviconPath)) {
    return res.sendFile(faviconPath);
  }
  next();
});
app.use('/pagefind', express.static(path.join(PATHS.DIST, 'pagefind')));

// Build API
app.use('/api', buildRoutes);

// Admin API
app.use('/api/admin', adminRoutes);

// Admin UI
app.use('/admin', requireAuth, (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send('Admin access required');
  }
  next();
}, express.static(PATHS.ADMIN_UI));

// Downloads (files from source/ that are not markdown/html)
app.use('/downloads', requireAuth, express.static(PATHS.DOWNLOADS));

// Building page - shown when a build is in progress or dist is empty
const BUILDING_HTML = `<!DOCTYPE html>
<html style="background:#0f172a"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Building...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;min-height:100dvh}
.spinner{width:48px;height:48px;border:4px solid #334155;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1.5rem}
@keyframes spin{to{transform:rotate(360deg)}}
h1{font-size:1.5rem;margin-bottom:0.5rem}
p{color:#94a3b8;font-size:0.9rem}
</style>
<script>setTimeout(()=>location.reload(),3000)</script>
</head><body style="background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center"><div class="card" style="text-align:center;padding:3rem"><div class="spinner"></div><h1>Building wiki...</h1><p>Page will refresh automatically.</p></div></body></html>`;

function serveBuildingPage(req, res, next) {
  // Skip API and static asset requests
  if (req.path.startsWith('/api/') || req.path.startsWith('/_assets/') || req.path.startsWith('/admin')) {
    return next();
  }
  const distEmpty = !fs.existsSync(PATHS.DIST) || fs.readdirSync(PATHS.DIST).length === 0;
  if (app.locals.buildRunner?.isBuilding() || distEmpty) {
    return res.send(BUILDING_HTML);
  }
  next();
}

// Wiki content (dist/) - requires authentication
app.use('/', requireAuth, serveBuildingPage, express.static(PATHS.DIST, {
  extensions: ['html'],
}));

// Fallback for SPA-like routes within dist
app.use('/', requireAuth, serveBuildingPage, (req, res) => {
  const indexPath = path.join(PATHS.DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(BUILDING_HTML);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Git Docs App running on port ${PORT}`);
  console.log(`[Server] Admin email: ${ADMIN_EMAIL || '(not set)'}`);
  if (DEV_MODE) {
    console.log(`[Server] ⚠ DEV_MODE enabled - authentication bypassed`);
  }

  // Start file watcher and build runner
  const buildRunner = createBuildRunner();
  app.locals.buildRunner = buildRunner;
  setBuildRunner(buildRunner);
  setAdminBuildRunner(buildRunner);
  buildRunner.startWatching();

  // Run initial build if dist is empty
  const distFiles = fs.existsSync(PATHS.DIST) ? fs.readdirSync(PATHS.DIST) : [];
  if (distFiles.length === 0) {
    console.log('[Server] dist/ is empty, triggering initial build...');
    buildRunner.triggerBuild();
  }
});
