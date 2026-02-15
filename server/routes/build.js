import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/requireAuth.js';
import { getBuilds, getBuildById, getBuildStats } from '../db.js';

const router = Router();

let buildRunner = null;

function setBuildRunner(runner) {
  buildRunner = runner;
}

router.post('/rebuild', requireAuth, (req, res) => {
  if (!buildRunner) {
    return res.status(500).json({ error: 'Build runner not initialized' });
  }
  if (buildRunner.isBuilding()) {
    return res.status(409).json({ error: 'Build already in progress' });
  }
  const triggeredBy = req.user ? req.user.email : 'unknown';
  console.log(`[Build] Manual rebuild triggered by ${triggeredBy}`);
  buildRunner.triggerBuild('manual', triggeredBy);
  res.json({ success: true, message: 'Build triggered' });
});

router.get('/status', requireAuth, (req, res) => {
  if (!buildRunner) {
    return res.json({ building: false });
  }
  res.json({ building: buildRunner.isBuilding() });
});

// Build history endpoints (admin only)
router.get('/builds/stats', requireAdmin, (req, res) => {
  const stats = getBuildStats();
  res.json(stats);
});

router.get('/builds/:id', requireAdmin, (req, res) => {
  const build = getBuildById(parseInt(req.params.id));
  if (!build) {
    return res.status(404).json({ error: 'Build not found' });
  }
  res.json(build);
});

router.get('/builds', requireAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.trigger_type) filters.trigger_type = req.query.trigger_type;
  const builds = getBuilds(limit, offset, filters);
  const stats = getBuildStats();
  res.json({ builds, stats, limit, offset });
});

export default router;
export { setBuildRunner };
