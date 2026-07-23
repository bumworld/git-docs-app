import { findUserByEmail } from '../db.js';

const DEV_MODE = process.env.DEV_MODE === 'true';

// DEV_MODE: DB에서 실제 dev 유저 id를 사용 (FOREIGN KEY 호환)
let _devUser = null;
function getDevUser() {
  if (!_devUser) {
    _devUser = findUserByEmail('dev@localhost') || {
      id: 0, email: 'dev@localhost', name: 'Dev User', avatar: '', role: 'admin', status: 'active',
    };
  }
  return _devUser;
}

function requireAuth(req, res, next) {
  if (DEV_MODE) {
    req.user = getDevUser();
    return next();
  }

  if (!req.isAuthenticated || !req.isAuthenticated()) {
    console.log(`[Auth] requireAuth failed: ${req.method} ${req.path} - not authenticated`);
    return res.redirect('/login');
  }

  if (req.user.status === 'pending') {
    return res.redirect('/pending');
  }

  if (req.user.status === 'blocked') {
    return res.status(403).send('Access denied. Your account has been blocked.');
  }

  next();
}

// API 라우트용: redirect 대신 JSON 401 반환 (fetch에서 r.json() 오류 방지)
function requireAuthAPI(req, res, next) {
  if (DEV_MODE) {
    req.user = getDevUser();
    return next();
  }

  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.status === 'pending') {
    return res.status(403).json({ error: 'Account pending approval' });
  }

  if (req.user.status === 'blocked') {
    return res.status(403).json({ error: 'Account blocked' });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (DEV_MODE) {
    req.user = getDevUser();
    return next();
  }

  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.status === 'pending') {
    return res.status(403).json({ error: 'Account pending approval' });
  }

  if (req.user.status === 'blocked') {
    return res.status(403).json({ error: 'Account blocked' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

export { requireAuth, requireAuthAPI, requireAdmin };
