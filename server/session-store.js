import session from 'express-session';
import { db } from './db.js';
import { SESSION } from '../config/constants.js';

export function createSessionStore() {
  const store = new session.Store();

  store.get = function (sid, callback) {
    try {
      const row = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > datetime(\'now\')').get(sid);
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (err) {
      callback(err);
    }
  };

  store.set = function (sid, sessData, callback) {
    try {
      const maxAge = sessData.cookie?.maxAge || 86400000;
      const expired = new Date(Date.now() + maxAge).toISOString();
      const sess = JSON.stringify(sessData);
      db.prepare(
        'INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = ?, expired = ?'
      ).run(sid, sess, expired, sess, expired);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  };

  store.destroy = function (sid, callback) {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  };

  store.touch = function (sid, sessData, callback) {
    try {
      const maxAge = sessData.cookie?.maxAge || 86400000;
      const expired = new Date(Date.now() + maxAge).toISOString();
      db.prepare('UPDATE sessions SET expired = ? WHERE sid = ?').run(expired, sid);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  };

  // Cleanup expired sessions periodically
  setInterval(() => {
    try {
      db.prepare("DELETE FROM sessions WHERE expired <= datetime('now')").run();
    } catch {
      // ignore cleanup errors
    }
  }, SESSION.CLEANUP_INTERVAL);

  return store;
}
