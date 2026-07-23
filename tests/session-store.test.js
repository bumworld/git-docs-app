import { after, before, describe, it } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import * as sessionStoreModule from '../server/session-store.js';

let database;

before(() => {
  database = new Database(':memory:');
  database.exec(`
    CREATE TABLE sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired DATETIME NOT NULL
    )
  `);
});

after(() => {
  database.close();
});

function getSession(store, sid) {
  return new Promise((resolve, reject) => {
    store.get(sid, (error, session) => {
      if (error) reject(error);
      else resolve(session);
    });
  });
}

function createStoreWithoutTimer() {
  const originalSetInterval = global.setInterval;
  global.setInterval = () => ({ unref() {} });
  try {
    return sessionStoreModule.createSessionStore(database);
  } finally {
    global.setInterval = originalSetInterval;
  }
}

describe('SQLite session expiry', () => {
  it('loads a future ISO-formatted session from the provided database', async () => {
    const sid = 'future-session';
    const session = { cookie: {}, user: 'test' };
    database.prepare('INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)')
      .run(sid, JSON.stringify(session), new Date(Date.now() + 60_000).toISOString());

    assert.deepEqual(await getSession(createStoreWithoutTimer(), sid), session);
  });

  it('does not load an expired ISO-formatted session from earlier today', async () => {
    const sid = 'expired-session';
    database.prepare('INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)')
      .run(sid, JSON.stringify({ cookie: {} }), new Date(Date.now() - 60_000).toISOString());

    assert.equal(await getSession(createStoreWithoutTimer(), sid), null);
  });

  it('deletes expired ISO-formatted sessions from the provided database', () => {
    assert.equal(typeof sessionStoreModule.deleteExpiredSessions, 'function');

    sessionStoreModule.deleteExpiredSessions(database);

    assert.equal(
      database.prepare('SELECT sid FROM sessions WHERE sid = ?').get('expired-session'),
      undefined,
    );
    assert.ok(database.prepare('SELECT sid FROM sessions WHERE sid = ?').get('future-session'));
  });
});
