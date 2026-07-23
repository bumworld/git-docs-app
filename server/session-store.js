import session from 'express-session';
import { db } from './db.js';
import { SESSION } from '../config/constants.js';

export function deleteExpiredSessions(database = db) {
  return database.prepare("DELETE FROM sessions WHERE datetime(expired) <= datetime('now')").run();
}

export function createSessionStore(database = db) {
  const store = new session.Store();

  store.get = function (sid, callback) {
    try {
      const row = database.prepare(
        "SELECT sess FROM sessions WHERE sid = ? AND datetime(expired) > datetime('now')",
      ).get(sid);
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
      database.prepare(
        'INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = ?, expired = ?'
      ).run(sid, sess, expired, sess, expired);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  };

  store.destroy = function (sid, callback) {
    try {
      database.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  };

  store.touch = function (sid, sessData, callback) {
    try {
      const maxAge = sessData.cookie?.maxAge || 86400000;
      const expired = new Date(Date.now() + maxAge).toISOString();
      database.prepare('UPDATE sessions SET expired = ? WHERE sid = ?').run(expired, sid);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  };

  // Cleanup expired sessions periodically
  const cleanupTimer = setInterval(() => {
    try {
      deleteExpiredSessions(database);
    } catch {
      // ignore cleanup errors
    }
  }, SESSION.CLEANUP_INTERVAL);
  cleanupTimer.unref?.();

  return store;
}
