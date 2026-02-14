import { Router } from 'express';
import {
  getAllUsers,
  findUserById,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getPendingUsers,
  getAllSettings,
  updateSettings,
} from '../db.js';
import { requireAdmin } from '../middleware/requireAuth.js';

const router = Router();
const INITIAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

router.use(requireAdmin);

function isInitialAdmin(userId) {
  if (!INITIAL_ADMIN_EMAIL) return false;
  const user = findUserById(userId);
  return user && user.email === INITIAL_ADMIN_EMAIL;
}

// Users - include protected flag for frontend
router.get('/users', (req, res) => {
  const users = getAllUsers().map(u => ({
    ...u,
    protected: u.email === INITIAL_ADMIN_EMAIL,
  }));
  res.json(users);
});

router.get('/users/pending', (req, res) => {
  const users = getPendingUsers();
  res.json(users);
});

router.put('/users/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['active', 'pending', 'blocked'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (isInitialAdmin(req.params.id) && status !== 'active') {
    return res.status(403).json({ error: 'Cannot block or deactivate the initial admin' });
  }
  const user = updateUserStatus(req.params.id, status);
  console.log(`[Admin] ${req.user.email} changed user #${req.params.id} (${user.email}) status → ${status}`);
  res.json(user);
});

router.put('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (isInitialAdmin(req.params.id) && role !== 'admin') {
    return res.status(403).json({ error: 'Cannot remove admin role from the initial admin' });
  }
  const user = updateUserRole(req.params.id, role);
  console.log(`[Admin] ${req.user.email} changed user #${req.params.id} (${user.email}) role → ${role}`);
  res.json(user);
});

router.delete('/users/:id', (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  if (isInitialAdmin(req.params.id)) {
    return res.status(403).json({ error: 'Cannot delete the initial admin' });
  }
  const target = findUserById(req.params.id);
  deleteUser(req.params.id);
  console.log(`[Admin] ${req.user.email} deleted user #${req.params.id} (${target?.email || 'unknown'})`);
  res.json({ success: true });
});

// Settings
router.get('/settings', (req, res) => {
  const settings = getAllSettings();
  res.json(settings);
});

let buildRunner = null;
function setBuildRunner(runner) { buildRunner = runner; }

router.put('/settings', (req, res) => {
  const allowedKeys = ['site_title', 'site_description', 'contact_email', 'footer_text', 'language'];
  const updates = {};
  for (const key of allowedKeys) {
    if (req.body[key] !== undefined) {
      updates[key] = String(req.body[key]);
    }
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid settings provided' });
  }
  updateSettings(updates);
  console.log(`[Admin] ${req.user.email} updated settings: ${Object.keys(updates).join(', ')}`);

  // Auto-rebuild if title or description changed (they are baked into static HTML)
  if (updates.site_title !== undefined || updates.site_description !== undefined) {
    if (buildRunner) {
      console.log('[Admin] Settings changed, triggering rebuild...');
      buildRunner.triggerBuild();
    }
  }

  res.json(getAllSettings());
});

// Stats
router.get('/stats', (req, res) => {
  const users = getAllUsers();
  res.json({
    total_users: users.length,
    active_users: users.filter(u => u.status === 'active').length,
    pending_users: users.filter(u => u.status === 'pending').length,
    blocked_users: users.filter(u => u.status === 'blocked').length,
    admin_users: users.filter(u => u.role === 'admin').length,
  });
});

export default router;
export { setBuildRunner as setAdminBuildRunner };
