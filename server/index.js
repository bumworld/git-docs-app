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

// Wiki content (dist/) - requires authentication
app.use('/', requireAuth, express.static(PATHS.DIST, {
  extensions: ['html'],
}));

// Fallback for SPA-like routes within dist
app.use('/', requireAuth, (req, res) => {
  const indexPath = path.join(PATHS.DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Page not found. Run a build first.');
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
