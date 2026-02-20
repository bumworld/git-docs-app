import { Router } from 'express';
import {
  getAllWhitelistedEmails,
  addWhitelistedEmail,
  deleteWhitelistedEmail,
} from '../db.js';
import { requireAdmin } from '../middleware/requireAuth.js';
import {
  listUsers,
  listPendingUsers,
  getUserStats,
  changeUserStatus,
  changeUserRole,
  removeUser,
} from '../services/users.service.js';
import {
  getSettings,
  filterAndUpdateSettings,
  triggerRebuildIfNeeded,
  isValidEmail,
} from '../services/settings.service.js';

const router = Router();

router.use(requireAdmin);

// ─── Users ────────────────────────────────────────────────────────────────────

router.get('/users', (req, res) => {
  res.json(listUsers());
});

router.get('/users/pending', (req, res) => {
  res.json(listPendingUsers());
});

router.put('/users/:id/status', (req, res) => {
  const result = changeUserStatus(req.params.id, req.body.status, req.user);
  if (!result.success) return res.status(result.code).json({ error: result.error });
  res.json(result.user);
});

router.put('/users/:id/role', (req, res) => {
  const result = changeUserRole(req.params.id, req.body.role, req.user);
  if (!result.success) return res.status(result.code).json({ error: result.error });
  res.json(result.user);
});

router.delete('/users/:id', (req, res) => {
  const result = removeUser(req.params.id, req.user);
  if (!result.success) return res.status(result.code).json({ error: result.error });
  res.json({ success: true });
});

// ─── Whitelisted Emails ───────────────────────────────────────────────────────

router.get('/whitelisted-emails', (req, res) => {
  res.json(getAllWhitelistedEmails());
});

router.post('/whitelisted-emails', (req, res) => {
  const { email, notes } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const newEmail = addWhitelistedEmail(email, req.user.email, notes);
    console.log(`[Admin] ${req.user.email} added whitelisted email: ${email}`);
    res.json(newEmail);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Email already whitelisted' });
    }
    res.status(500).json({ error: 'Failed to add email' });
  }
});

router.delete('/whitelisted-emails/:id', (req, res) => {
  deleteWhitelistedEmail(req.params.id);
  console.log(`[Admin] ${req.user.email} removed whitelisted email #${req.params.id}`);
  res.json({ success: true });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  res.json(getSettings());
});

let _buildRunner = null;
function setBuildRunner(runner) { _buildRunner = runner; }

router.put('/settings', (req, res) => {
  const result = filterAndUpdateSettings(req.body);
  if (!result.success) return res.status(result.code).json({ error: result.error });
  console.log(`[Admin] ${req.user.email} updated settings: ${Object.keys(result.updates).join(', ')}`);
  triggerRebuildIfNeeded(result.updates, req.user, _buildRunner);
  res.json(getSettings());
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get('/stats', (req, res) => {
  res.json(getUserStats());
});

export default router;
export { setBuildRunner as setAdminBuildRunner };
