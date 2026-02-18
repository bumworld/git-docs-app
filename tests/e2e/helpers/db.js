/**
 * tests/e2e/helpers/db.js
 * E2E 테스트용 SQLite DB 초기화 헬퍼
 */
import Database from 'better-sqlite3';
import path from 'path';

/**
 * 테스트용 DB를 초기화하고 초기 데이터를 삽입한다.
 * @param {string} dbPath - DB 파일 경로
 */
export function initTestDatabase(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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

    CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_builds_status ON builds(status);
    CREATE INDEX IF NOT EXISTS idx_builds_started ON builds(started_at);
  `);

  // 초기 관리자 계정
  db.prepare(`
    INSERT OR IGNORE INTO users (email, name, role, status)
    VALUES (?, ?, 'admin', 'active')
  `).run('admin@test.com', 'Test Admin');

  // 일반 사용자
  db.prepare(`
    INSERT OR IGNORE INTO users (email, name, role, status)
    VALUES (?, ?, 'user', 'active')
  `).run('user@test.com', 'Test User');

  // 기본 사이트 설정
  const defaultSettings = [
    ['site_title', 'E2E Test Wiki'],
    ['site_description', 'Test wiki for E2E testing'],
    ['site_url', 'http://localhost:3001'],
    ['contact_email', 'admin@test.com'],
    ['footer_text', 'Test Footer'],
    ['language', 'ko'],
  ];
  const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }

  // 샘플 빌드 이력
  db.prepare(`
    INSERT INTO builds (status, trigger_type, triggered_by, started_at, finished_at, duration_ms, log)
    VALUES (?, ?, ?, datetime('now', '-10 minutes'), datetime('now', '-9 minutes'), ?, ?)
  `).run('success', 'manual', 'admin@test.com', 60000, '[Build] Build completed in 60.0s');

  db.prepare(`
    INSERT INTO builds (status, trigger_type, triggered_by, started_at, finished_at, duration_ms, log)
    VALUES (?, ?, ?, datetime('now', '-5 minutes'), datetime('now', '-4 minutes'), ?, ?)
  `).run('success', 'watcher', 'system', 45000, '[Build] Build completed in 45.0s');

  db.close();
}
