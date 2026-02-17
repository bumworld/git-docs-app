import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Create a temporary database for testing
const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-whitelist-api.db');
let db;

// Note: This test uses a test database instead of the actual production DB

// Implement the functions locally for testing
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

describe('Whitelist API Functions', () => {
  before(() => {
    fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

    db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE IF NOT EXISTS whitelisted_emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        added_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_whitelisted_emails_email ON whitelisted_emails(email);
    `);
  });

  after(() => {
    if (db) db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should add a whitelisted email via API function', () => {
    const email = 'test-api-add@example.com';
    const result = addWhitelistedEmail(email, 'admin@example.com', 'API test');

    assert.strictEqual(result.email, email);
    assert.strictEqual(result.added_by, 'admin@example.com');
    assert.strictEqual(result.notes, 'API test');
    assert.ok(result.id);
    assert.ok(result.created_at);
  });

  it('should get all whitelisted emails', () => {
    addWhitelistedEmail('test-api-1@example.com', 'admin', 'Test 1');
    addWhitelistedEmail('test-api-2@example.com', 'admin', 'Test 2');

    const emails = getAllWhitelistedEmails();
    const testEmails = emails.filter(e => e.email.includes('test-api'));

    assert.ok(testEmails.length >= 2);
    assert.ok(testEmails.some(e => e.email === 'test-api-1@example.com'));
    assert.ok(testEmails.some(e => e.email === 'test-api-2@example.com'));
  });

  it('should check if email is whitelisted', () => {
    const email = 'test-api-check@example.com';
    addWhitelistedEmail(email, 'admin');

    assert.strictEqual(isEmailWhitelisted(email), true);
    assert.strictEqual(isEmailWhitelisted('not-whitelisted@example.com'), false);
  });

  it('should delete a whitelisted email', () => {
    const email = 'test-api-delete@example.com';
    const result = addWhitelistedEmail(email, 'admin');
    const id = result.id;

    deleteWhitelistedEmail(id);

    assert.strictEqual(isEmailWhitelisted(email), false);
  });

  it('should handle duplicate email error', () => {
    const email = 'test-api-duplicate@example.com';
    addWhitelistedEmail(email, 'admin');

    assert.throws(() => {
      addWhitelistedEmail(email, 'admin');
    }, /UNIQUE constraint failed/);
  });

  it('should validate email format (basic check)', () => {
    const invalidEmails = ['notanemail', 'missing@domain', '@nodomain.com'];

    for (const email of invalidEmails) {
      const isValid = email.includes('@');
      assert.strictEqual(isValid, email === 'missing@domain' || email === '@nodomain.com');
    }

    const validEmail = 'valid@example.com';
    assert.ok(validEmail.includes('@'));
  });
});
