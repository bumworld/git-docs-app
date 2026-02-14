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

    CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
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
  db.prepare(
    'INSERT INTO users (email, name, avatar, role, status) VALUES (?, ?, ?, ?, ?)'
  ).run(profile.email, profile.name, profile.avatar, 'user', 'pending');
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
  getSetting,
  getAllSettings,
  setSetting,
  updateSettings,
};
