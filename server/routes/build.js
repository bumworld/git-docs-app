import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

let buildRunner = null;

function setBuildRunner(runner) {
  buildRunner = runner;
}

router.post('/rebuild', requireAuth, (req, res) => {
  if (!buildRunner) {
    return res.status(500).json({ error: 'Build runner not initialized' });
  }
  console.log(`[Build] Manual rebuild triggered by ${req.user.email}`);
  buildRunner.triggerBuild();
  res.json({ success: true, message: 'Build triggered' });
});

router.get('/status', requireAuth, (req, res) => {
  if (!buildRunner) {
    return res.json({ building: false });
  }
  res.json({ building: buildRunner.isBuilding() });
});

export default router;
export { setBuildRunner };
