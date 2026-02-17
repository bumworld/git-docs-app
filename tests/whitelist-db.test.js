import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Create a temporary database for testing
const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-whitelist.db');

let db;

before(() => {
  fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

  db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
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

    CREATE TABLE IF NOT EXISTS whitelisted_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      added_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_whitelisted_emails_email ON whitelisted_emails(email);
  `);
});

after(() => {
  if (db) db.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

describe('Whitelisted Emails - CRUD Operations', () => {
  it('should add a whitelisted email', () => {
    const result = db.prepare(
      'INSERT INTO whitelisted_emails (email, added_by, notes) VALUES (?, ?, ?)'
    ).run('test@example.com', 'admin@example.com', 'Test user');

    assert.ok(result.lastInsertRowid > 0);

    const email = db.prepare('SELECT * FROM whitelisted_emails WHERE id = ?').get(result.lastInsertRowid);
    assert.strictEqual(email.email, 'test@example.com');
    assert.strictEqual(email.added_by, 'admin@example.com');
    assert.strictEqual(email.notes, 'Test user');
    assert.ok(email.created_at);
  });

  it('should retrieve all whitelisted emails', () => {
    db.prepare('INSERT INTO whitelisted_emails (email, added_by) VALUES (?, ?)').run('user1@example.com', 'admin');
    db.prepare('INSERT INTO whitelisted_emails (email, added_by) VALUES (?, ?)').run('user2@example.com', 'admin');

    const emails = db.prepare('SELECT * FROM whitelisted_emails ORDER BY created_at DESC').all();
    assert.ok(emails.length >= 2);
    assert.ok(emails.some(e => e.email === 'user1@example.com'));
    assert.ok(emails.some(e => e.email === 'user2@example.com'));
  });

  it('should check if email is whitelisted', () => {
    db.prepare('INSERT INTO whitelisted_emails (email, added_by) VALUES (?, ?)').run('whitelisted@example.com', 'admin');

    const exists = db.prepare('SELECT id FROM whitelisted_emails WHERE email = ?').get('whitelisted@example.com');
    assert.ok(exists);

    const notExists = db.prepare('SELECT id FROM whitelisted_emails WHERE email = ?').get('notwhitelisted@example.com');
    assert.strictEqual(notExists, undefined);
  });

  it('should delete a whitelisted email', () => {
    const result = db.prepare('INSERT INTO whitelisted_emails (email, added_by) VALUES (?, ?)').run('delete-me@example.com', 'admin');
    const id = result.lastInsertRowid;

    db.prepare('DELETE FROM whitelisted_emails WHERE id = ?').run(id);

    const deleted = db.prepare('SELECT * FROM whitelisted_emails WHERE id = ?').get(id);
    assert.strictEqual(deleted, undefined);
  });

  it('should reject duplicate email', () => {
    db.prepare('INSERT INTO whitelisted_emails (email, added_by) VALUES (?, ?)').run('unique@example.com', 'admin');

    assert.throws(() => {
      db.prepare('INSERT INTO whitelisted_emails (email, added_by) VALUES (?, ?)').run('unique@example.com', 'admin');
    }, /UNIQUE constraint failed/);
  });
});

describe('Whitelisted Emails - Auto-Approval Logic', () => {
  it('should create user with active status if email is whitelisted', () => {
    // Add email to whitelist
    db.prepare('INSERT INTO whitelisted_emails (email, added_by) VALUES (?, ?)').run('autoApprove@example.com', 'admin');

    // Check if whitelisted
    const whitelisted = !!db.prepare('SELECT id FROM whitelisted_emails WHERE email = ?').get('autoApprove@example.com');

    // Create user with appropriate status
    const status = whitelisted ? 'active' : 'pending';
    db.prepare(
      'INSERT INTO users (email, name, role, status) VALUES (?, ?, ?, ?)'
    ).run('autoApprove@example.com', 'Auto User', 'user', status);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('autoApprove@example.com');
    assert.strictEqual(user.status, 'active');
    assert.strictEqual(user.role, 'user');
  });

  it('should create user with pending status if email is not whitelisted', () => {
    const email = 'notWhitelisted@example.com';

    // Check if whitelisted (should be false)
    const whitelisted = !!db.prepare('SELECT id FROM whitelisted_emails WHERE email = ?').get(email);
    assert.strictEqual(whitelisted, false);

    // Create user
    const status = whitelisted ? 'active' : 'pending';
    db.prepare(
      'INSERT INTO users (email, name, role, status) VALUES (?, ?, ?, ?)'
    ).run(email, 'Pending User', 'user', status);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    assert.strictEqual(user.status, 'pending');
    assert.strictEqual(user.role, 'user');
  });
});
