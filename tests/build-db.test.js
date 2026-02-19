import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Create a unique temporary database for each test run to avoid parallel conflicts
const TEST_DB_PATH = path.join(process.cwd(), 'data', `test-builds-${process.pid}.db`);

// We need to set up the DB manually since importing db.js would use the real DB
let db;

before(() => {
  fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

  db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_builds_started_at ON builds(started_at);
  `);
});

after(() => {
  if (db) db.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

describe('Build DB Schema', () => {
  it('should create a build record with running status', () => {
    const result = db.prepare(
      'INSERT INTO builds (status, trigger_type, triggered_by) VALUES (?, ?, ?)'
    ).run('running', 'manual', 'test@example.com');

    assert.ok(result.lastInsertRowid > 0);
    const build = db.prepare('SELECT * FROM builds WHERE id = ?').get(result.lastInsertRowid);
    assert.strictEqual(build.status, 'running');
    assert.strictEqual(build.trigger_type, 'manual');
    assert.strictEqual(build.triggered_by, 'test@example.com');
    assert.ok(build.started_at);
  });

  it('should update build to success', () => {
    const result = db.prepare(
      'INSERT INTO builds (status, trigger_type, triggered_by) VALUES (?, ?, ?)'
    ).run('running', 'watcher', 'system');
    const id = result.lastInsertRowid;

    db.prepare(
      'UPDATE builds SET status = ?, log = ?, duration_ms = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('success', 'Build completed', 5000, id);

    const build = db.prepare('SELECT * FROM builds WHERE id = ?').get(id);
    assert.strictEqual(build.status, 'success');
    assert.strictEqual(build.log, 'Build completed');
    assert.strictEqual(build.duration_ms, 5000);
    assert.ok(build.finished_at);
  });

  it('should update build to failed with failed_files', () => {
    const result = db.prepare(
      'INSERT INTO builds (status, trigger_type, triggered_by) VALUES (?, ?, ?)'
    ).run('running', 'settings', 'admin@example.com');
    const id = result.lastInsertRowid;

    const failedFiles = ['src/content/docs/test.md', 'src/content/docs/broken.md'];
    db.prepare(
      'UPDATE builds SET status = ?, log = ?, duration_ms = ?, failed_files = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('failed', 'Build failed: syntax error', 3000, JSON.stringify(failedFiles), id);

    const build = db.prepare('SELECT * FROM builds WHERE id = ?').get(id);
    assert.strictEqual(build.status, 'failed');
    assert.deepStrictEqual(JSON.parse(build.failed_files), failedFiles);
    assert.strictEqual(build.duration_ms, 3000);
  });

  it('should reject invalid status', () => {
    assert.throws(() => {
      db.prepare(
        'INSERT INTO builds (status, trigger_type, triggered_by) VALUES (?, ?, ?)'
      ).run('invalid', 'manual', 'test@example.com');
    });
  });

  it('should reject invalid trigger_type', () => {
    assert.throws(() => {
      db.prepare(
        'INSERT INTO builds (status, trigger_type, triggered_by) VALUES (?, ?, ?)'
      ).run('running', 'invalid', 'test@example.com');
    });
  });

  it('should list builds ordered by started_at DESC', () => {
    // Clear existing builds
    db.prepare('DELETE FROM builds').run();

    // Insert multiple builds
    for (let i = 0; i < 5; i++) {
      db.prepare(
        'INSERT INTO builds (status, trigger_type, triggered_by, log) VALUES (?, ?, ?, ?)'
      ).run('success', 'manual', 'test@example.com', `Build ${i} log`);
    }

    const builds = db.prepare('SELECT * FROM builds ORDER BY started_at DESC LIMIT 3').all();
    assert.strictEqual(builds.length, 3);
    // Latest ID should be first
    assert.ok(builds[0].id >= builds[1].id);
  });

  it('should filter builds by status', () => {
    db.prepare('DELETE FROM builds').run();

    db.prepare('INSERT INTO builds (status, trigger_type, triggered_by) VALUES (?, ?, ?)').run('success', 'manual', 'test@example.com');
    db.prepare('INSERT INTO builds (status, trigger_type, triggered_by) VALUES (?, ?, ?)').run('failed', 'watcher', 'system');
    db.prepare('INSERT INTO builds (status, trigger_type, triggered_by) VALUES (?, ?, ?)').run('success', 'settings', 'admin@example.com');

    const successBuilds = db.prepare("SELECT * FROM builds WHERE status = ?").all('success');
    assert.strictEqual(successBuilds.length, 2);

    const failedBuilds = db.prepare("SELECT * FROM builds WHERE status = ?").all('failed');
    assert.strictEqual(failedBuilds.length, 1);
  });

  it('should filter builds by trigger_type', () => {
    const manualBuilds = db.prepare("SELECT * FROM builds WHERE trigger_type = ?").all('manual');
    assert.strictEqual(manualBuilds.length, 1);

    const watcherBuilds = db.prepare("SELECT * FROM builds WHERE trigger_type = ?").all('watcher');
    assert.strictEqual(watcherBuilds.length, 1);
  });

  it('should calculate build stats', () => {
    const total = db.prepare('SELECT COUNT(*) as count FROM builds').get().count;
    const success = db.prepare("SELECT COUNT(*) as count FROM builds WHERE status = 'success'").get().count;
    const failed = db.prepare("SELECT COUNT(*) as count FROM builds WHERE status = 'failed'").get().count;

    assert.strictEqual(total, 3);
    assert.strictEqual(success, 2);
    assert.strictEqual(failed, 1);
  });

  it('should cleanup old builds keeping specified count', () => {
    db.prepare('DELETE FROM builds').run();

    // Insert 10 builds
    for (let i = 0; i < 10; i++) {
      db.prepare(
        'INSERT INTO builds (status, trigger_type, triggered_by) VALUES (?, ?, ?)'
      ).run('success', 'manual', 'test@example.com');
    }

    const beforeCount = db.prepare('SELECT COUNT(*) as count FROM builds').get().count;
    assert.strictEqual(beforeCount, 10);

    // Keep only 5
    db.prepare(
      'DELETE FROM builds WHERE id NOT IN (SELECT id FROM builds ORDER BY started_at DESC LIMIT ?)'
    ).run(5);

    const afterCount = db.prepare('SELECT COUNT(*) as count FROM builds').get().count;
    assert.strictEqual(afterCount, 5);
  });

  it('should handle null failed_files gracefully', () => {
    db.prepare('DELETE FROM builds').run();

    db.prepare(
      'INSERT INTO builds (status, trigger_type, triggered_by) VALUES (?, ?, ?)'
    ).run('success', 'manual', 'test@example.com');

    const build = db.prepare('SELECT * FROM builds LIMIT 1').get();
    assert.strictEqual(build.failed_files, null);

    // Parsing null should be handled by application code
    const failedFiles = build.failed_files ? JSON.parse(build.failed_files) : [];
    assert.deepStrictEqual(failedFiles, []);
  });

  it('should handle startup trigger type', () => {
    const result = db.prepare(
      'INSERT INTO builds (status, trigger_type, triggered_by) VALUES (?, ?, ?)'
    ).run('running', 'startup', 'system');

    const build = db.prepare('SELECT * FROM builds WHERE id = ?').get(result.lastInsertRowid);
    assert.strictEqual(build.trigger_type, 'startup');
    assert.strictEqual(build.triggered_by, 'system');
  });
});

describe('Build Log Preview', () => {
  it('should truncate log preview with SUBSTR', () => {
    db.prepare('DELETE FROM builds').run();

    const longLog = 'x'.repeat(5000);
    db.prepare(
      'INSERT INTO builds (status, trigger_type, triggered_by, log) VALUES (?, ?, ?, ?)'
    ).run('success', 'manual', 'test@example.com', longLog);

    const build = db.prepare(
      'SELECT SUBSTR(log, 1, 2000) as log_preview FROM builds LIMIT 1'
    ).get();
    assert.strictEqual(build.log_preview.length, 2000);
  });
});
