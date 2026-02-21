import express from 'express';
import { requireAuthAPI } from '../middleware/requireAuth.js';
import {
  getBookmarks, addBookmark, removeBookmark,
  getHistory, upsertHistory, removeHistory, clearHistory,
} from '../db.js';

const router = express.Router();

router.use(requireAuthAPI);

// ─── 북마크 ──────────────────────────────────────────

router.get('/bookmarks', (req, res) => {
  const bookmarks = getBookmarks(req.user.id);
  res.json({ bookmarks });
});

router.post('/bookmarks', (req, res) => {
  const { path, title } = req.body;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path required' });
  }
  addBookmark(req.user.id, path.slice(0, 500), (title || '').slice(0, 500));
  res.json({ ok: true });
});

router.delete('/bookmarks', (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ error: 'path required' });
  removeBookmark(req.user.id, path);
  res.json({ ok: true });
});

// ─── 히스토리 ─────────────────────────────────────────

router.get('/history', (req, res) => {
  const history = getHistory(req.user.id);
  res.json({ history });
});

router.post('/history', (req, res) => {
  const { path, title } = req.body;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path required' });
  }
  upsertHistory(req.user.id, path.slice(0, 500), (title || '').slice(0, 500));
  res.json({ ok: true });
});

router.delete('/history', (req, res) => {
  const { path } = req.body;
  if (path) {
    removeHistory(req.user.id, path);
  } else {
    clearHistory(req.user.id);
  }
  res.json({ ok: true });
});

export default router;
