import { Router } from 'express';
import passport from 'passport';
import { loadGoogleConfig, resolveCallbackURL } from '../auth.js';

const router = Router();

// Dynamically resolve callbackURL based on the incoming request's host/protocol
router.get('/google', (req, res, next) => {
  const config = loadGoogleConfig();
  const callbackURL = config ? resolveCallbackURL(config.redirectURIs, req) : '/auth/google/callback';
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    callbackURL,
  })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  const config = loadGoogleConfig();
  const callbackURL = config ? resolveCallbackURL(config.redirectURIs, req) : '/auth/google/callback';
  passport.authenticate('google', {
    failureRedirect: '/login?error=auth_failed',
    callbackURL,
  })(req, res, next);
},
  (req, res) => {
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
  }
);

router.get('/logout', (req, res) => {
  const email = req.user?.email || 'unknown';
  req.logout((err) => {
    if (err) {
      console.error('[Auth] Logout error:', err);
    }
    console.log(`[Auth] Logout: ${email}`);
    req.session.destroy(() => {
      res.redirect('/login');
    });
  });
});

router.get('/me', (req, res) => {
  // DEV_MODE bypass
  if (process.env.DEV_MODE === 'true') {
    return res.json({
      authenticated: true,
      user: { id: 0, email: 'dev@localhost', name: 'Dev User', avatar: '', role: 'admin', status: 'active' },
    });
  }

  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.json({ authenticated: false });
  }
  const { id, email, name, avatar, role, status } = req.user;
  res.json({ authenticated: true, user: { id, email, name, avatar, role, status } });
});

export default router;
