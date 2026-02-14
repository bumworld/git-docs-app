const DEV_MODE = process.env.DEV_MODE === 'true';
const DEV_USER = {
  id: 0,
  email: 'dev@localhost',
  name: 'Dev User',
  avatar: '',
  role: 'admin',
  status: 'active',
};

function requireAuth(req, res, next) {
  if (DEV_MODE) {
    req.user = DEV_USER;
    return next();
  }

  if (!req.isAuthenticated || !req.isAuthenticated()) {
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

function requireAdmin(req, res, next) {
  if (DEV_MODE) {
    req.user = DEV_USER;
    return next();
  }

  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

export { requireAuth, requireAdmin };
