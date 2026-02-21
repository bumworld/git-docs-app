import Database from 'better-sqlite3';
import fs from 'fs';
import { PATHS } from '../config/constants.js';

if (!fs.existsSync(PATHS.DATA)) {
  fs.mkdirSync(PATHS.DATA, { recursive: true });
}

const db = new Database(PATHS.DB);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('active', 'pending', 'blocked')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'success', 'failed')),
      trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK(trigger_type IN ('manual', 'watcher', 'settings', 'startup')),
      triggered_by TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME,
      duration_ms INTEGER,
      log TEXT DEFAULT '',
      failed_files TEXT
    );

    CREATE TABLE IF NOT EXISTS whitelisted_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      added_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS user_bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      page_path TEXT NOT NULL,
      page_title TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, page_path)
    );

    CREATE TABLE IF NOT EXISTS user_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      page_path TEXT NOT NULL,
      page_title TEXT NOT NULL DEFAULT '',
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, page_path)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_builds_started_at ON builds(started_at);
    CREATE INDEX IF NOT EXISTS idx_whitelisted_emails_email ON whitelisted_emails(email);
    CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user ON user_bookmarks(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_history_user ON user_history(user_id, viewed_at);
  `);

  const defaultSettings = {
    'site_title': 'Git Docs',
    'site_description': 'Documentation Wiki',
    'contact_email': '',
    'footer_text': '',
    'language': 'en',
  };

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)'
  );

  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }
}

function seedAdmin(email) {
  if (!email) return;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!existing) {
    db.prepare(
      'INSERT INTO users (email, name, role, status) VALUES (?, ?, ?, ?)'
    ).run(email, 'Admin', 'admin', 'active');
    console.log(`[DB] Admin user registered: ${email}`);
  } else {
    db.prepare(
      'UPDATE users SET role = ?, status = ? WHERE email = ?'
    ).run('admin', 'active', email);
  }
}

// User queries
function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function createOrUpdateUser(profile) {
  const existing = findUserByEmail(profile.email);
  if (existing) {
    db.prepare(
      'UPDATE users SET name = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?'
    ).run(profile.name, profile.avatar, profile.email);
    return findUserByEmail(profile.email);
  }

  // Check if email is whitelisted
  const whitelisted = isEmailWhitelisted(profile.email);
  const status = whitelisted ? 'active' : 'pending';

  db.prepare(
    'INSERT INTO users (email, name, avatar, role, status) VALUES (?, ?, ?, ?, ?)'
  ).run(profile.email, profile.name, profile.avatar, 'user', status);

  // Log if auto-approved
  if (whitelisted) {
    console.log(`[Auth] Auto-approved whitelisted email: ${profile.email}`);
  }

  return findUserByEmail(profile.email);
}

function getAllUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
}

function updateUserStatus(id, status) {
  db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
  return findUserById(id);
}

function updateUserRole(id, role) {
  db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, id);
  return findUserById(id);
}

function deleteUser(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

function getPendingUsers() {
  return db.prepare('SELECT * FROM users WHERE status = ? ORDER BY created_at DESC').all('pending');
}

// Whitelisted emails queries
function getAllWhitelistedEmails() {
  return db.prepare('SELECT * FROM whitelisted_emails ORDER BY created_at DESC').all();
}

function addWhitelistedEmail(email, addedBy, notes) {
  db.prepare(
    'INSERT INTO whitelisted_emails (email, added_by, notes) VALUES (?, ?, ?)'
  ).run(email, addedBy, notes || '');
  return db.prepare('SELECT * FROM whitelisted_emails WHERE email = ?').get(email);
}

function deleteWhitelistedEmail(id) {
  db.prepare('DELETE FROM whitelisted_emails WHERE id = ?').run(id);
}

function isEmailWhitelisted(email) {
  const row = db.prepare('SELECT id FROM whitelisted_emails WHERE email = ?').get(email);
  return !!row;
}

// Build queries
function createBuild(triggerType, triggeredBy) {
  const result = db.prepare(
    'INSERT INTO builds (status, trigger_type, triggered_by) VALUES (?, ?, ?)'
  ).run('running', triggerType, triggeredBy || 'system');
  return result.lastInsertRowid;
}

function updateBuildSuccess(id, log, durationMs, failedFiles) {
  db.prepare(
    'UPDATE builds SET status = ?, log = ?, duration_ms = ?, failed_files = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run('success', log || '', durationMs, failedFiles ? JSON.stringify(failedFiles) : null, id);
}

function updateBuildFailed(id, log, durationMs, failedFiles) {
  db.prepare(
    'UPDATE builds SET status = ?, log = ?, duration_ms = ?, failed_files = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run('failed', log || '', durationMs, failedFiles ? JSON.stringify(failedFiles) : null, id);
}

function getBuilds(limit = 50, offset = 0, filters = {}) {
  let where = [];
  let params = [];
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  if (filters.trigger_type) {
    where.push('trigger_type = ?');
    params.push(filters.trigger_type);
  }
  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(
    `SELECT id, status, trigger_type, triggered_by, started_at, finished_at, duration_ms, failed_files,
     SUBSTR(log, 1, 2000) as log_preview
     FROM builds ${whereClause} ORDER BY started_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
  return rows.map(r => ({
    ...r,
    failed_files: r.failed_files ? JSON.parse(r.failed_files) : [],
  }));
}

function getBuildById(id) {
  const row = db.prepare('SELECT * FROM builds WHERE id = ?').get(id);
  if (row && row.failed_files) {
    row.failed_files = JSON.parse(row.failed_files);
  } else if (row) {
    row.failed_files = [];
  }
  return row;
}

function getBuildStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM builds').get().count;
  const success = db.prepare("SELECT COUNT(*) as count FROM builds WHERE status = 'success'").get().count;
  const failed = db.prepare("SELECT COUNT(*) as count FROM builds WHERE status = 'failed'").get().count;
  const running = db.prepare("SELECT COUNT(*) as count FROM builds WHERE status = 'running'").get().count;
  const avgDuration = db.prepare("SELECT AVG(duration_ms) as avg FROM builds WHERE status = 'success' AND duration_ms IS NOT NULL").get().avg;
  return {
    total,
    success,
    failed,
    running,
    avg_duration_ms: avgDuration ? Math.round(avgDuration) : 0,
  };
}

function cleanupOldBuilds({ keepFull = 100, keepMeta = 200 } = {}) {
  // 101~200번째 빌드: 로그만 잘라내기 (메타데이터 보존)
  const archived = db.prepare(`
    UPDATE builds
    SET log = '[log archived]'
    WHERE id NOT IN (SELECT id FROM builds ORDER BY started_at DESC LIMIT ?)
      AND id IN (SELECT id FROM builds ORDER BY started_at DESC LIMIT ?)
      AND log != '[log archived]'
      AND log != ''
  `).run(keepFull, keepMeta);
  if (archived.changes > 0) {
    console.log(`[DB] Archived logs for ${archived.changes} old build(s)`);
  }

  // 200건 초과: 완전 삭제
  const count = db.prepare('SELECT COUNT(*) as count FROM builds').get().count;
  if (count > keepMeta) {
    db.prepare(
      `DELETE FROM builds WHERE id NOT IN (SELECT id FROM builds ORDER BY started_at DESC LIMIT ?)`
    ).run(keepMeta);
    console.log(`[DB] Deleted old builds, kept ${keepMeta} of ${count}`);
  }
}

// Settings queries
function getSetting(key) {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function getAllSettings() {
  const rows = db.prepare('SELECT * FROM site_settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
  ).run(key, value, value);
}

function updateSettings(settingsObj) {
  const update = db.prepare(
    'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
  );
  const batch = db.transaction((entries) => {
    for (const [key, value] of entries) {
      update.run(key, value, value);
    }
  });
  batch(Object.entries(settingsObj));
}

// Dev user seeding (DEV_MODE 전용)
function seedDevUser() {
  db.prepare(
    'INSERT OR IGNORE INTO users (email, name, role, status) VALUES (?, ?, ?, ?)'
  ).run('dev@localhost', 'Dev User', 'admin', 'active');
}

// Bookmark queries
function getBookmarks(userId) {
  return db.prepare(
    'SELECT * FROM user_bookmarks WHERE user_id = ? ORDER BY created_at DESC LIMIT 200'
  ).all(userId);
}

function addBookmark(userId, path, title) {
  db.prepare(
    'INSERT OR IGNORE INTO user_bookmarks (user_id, page_path, page_title) VALUES (?, ?, ?)'
  ).run(userId, path, title);
}

function removeBookmark(userId, path) {
  db.prepare(
    'DELETE FROM user_bookmarks WHERE user_id = ? AND page_path = ?'
  ).run(userId, path);
}

// History queries
function getHistory(userId, limit = 20) {
  return db.prepare(
    'SELECT * FROM user_history WHERE user_id = ? ORDER BY viewed_at DESC LIMIT ?'
  ).all(userId, limit);
}

function upsertHistory(userId, path, title) {
  db.prepare(`
    INSERT INTO user_history (user_id, page_path, page_title, viewed_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, page_path) DO UPDATE SET
      page_title = excluded.page_title,
      viewed_at = CURRENT_TIMESTAMP
  `).run(userId, path, title);

  // 최대 20개 유지
  db.prepare(`
    DELETE FROM user_history
    WHERE user_id = ?
      AND id NOT IN (
        SELECT id FROM user_history WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 20
      )
  `).run(userId, userId);
}

function removeHistory(userId, path) {
  db.prepare(
    'DELETE FROM user_history WHERE user_id = ? AND page_path = ?'
  ).run(userId, path);
}

function clearHistory(userId) {
  db.prepare('DELETE FROM user_history WHERE user_id = ?').run(userId);
}

export {
  db,
  initializeDatabase,
  seedAdmin,
  findUserByEmail,
  findUserById,
  createOrUpdateUser,
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getPendingUsers,
  getAllWhitelistedEmails,
  addWhitelistedEmail,
  deleteWhitelistedEmail,
  isEmailWhitelisted,
  getSetting,
  getAllSettings,
  setSetting,
  updateSettings,
  createBuild,
  updateBuildSuccess,
  updateBuildFailed,
  getBuilds,
  getBuildById,
  getBuildStats,
  cleanupOldBuilds,
  seedDevUser,
  getBookmarks,
  addBookmark,
  removeBookmark,
  getHistory,
  upsertHistory,
  removeHistory,
  clearHistory,
};
