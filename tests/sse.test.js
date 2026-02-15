import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createSSEManager } from '../server/sse/manager.js';

// Mock response object (writable stream)
function createMockRes() {
  const written = [];
  let closed = false;
  return {
    write(data) {
      if (closed) throw new Error('Response closed');
      written.push(data);
      return true;
    },
    close() { closed = true; },
    getWritten() { return written; },
    getLastEvent() {
      if (written.length === 0) return null;
      const last = written[written.length - 1];
      const eventMatch = last.match(/^event: (.+)\n/);
      const dataMatch = last.match(/^data: (.+)\n/m);
      return {
        event: eventMatch ? eventMatch[1] : null,
        data: dataMatch ? JSON.parse(dataMatch[1]) : null,
      };
    },
  };
}

describe('SSEManager', () => {
  let manager;

  beforeEach(() => {
    manager = createSSEManager({ maxClients: 10 });
  });

  it('should add and remove clients', () => {
    const res = createMockRes();
    const user = { id: 1, email: 'test@test.com', name: 'Test', avatar: '', role: 'user' };

    const id = manager.addClient(res, user, ['build']);
    assert.ok(id !== null);
    assert.strictEqual(manager.getClientCount(), 1);

    manager.removeClient(id);
    assert.strictEqual(manager.getClientCount(), 0);
  });

  it('should broadcast to channel subscribers only', () => {
    const res1 = createMockRes();
    const res2 = createMockRes();
    const user1 = { id: 1, email: 'a@test.com', name: 'A', avatar: '', role: 'admin' };
    const user2 = { id: 2, email: 'b@test.com', name: 'B', avatar: '', role: 'user' };

    manager.addClient(res1, user1, ['build', 'system']);
    manager.addClient(res2, user2, ['build']);

    // system 채널 broadcast → res1만 받아야 함
    // (addClient 시 clients:update가 이미 system에 전송됨)
    const res1Before = res1.getWritten().length;
    const res2Before = res2.getWritten().length;

    manager.broadcast('system', 'test:event', { msg: 'hello' });

    // res1은 system 구독 → 받음
    assert.ok(res1.getWritten().length > res1Before);
    // res2는 system 미구독 → 변화 없음
    assert.strictEqual(res2.getWritten().length, res2Before);
  });

  it('should broadcastAll to all clients', () => {
    const res1 = createMockRes();
    const res2 = createMockRes();
    const user1 = { id: 1, email: 'a@test.com', name: 'A', avatar: '', role: 'user' };
    const user2 = { id: 2, email: 'b@test.com', name: 'B', avatar: '', role: 'user' };

    manager.addClient(res1, user1, ['build']);
    manager.addClient(res2, user2, []);

    const res1Before = res1.getWritten().length;
    const res2Before = res2.getWritten().length;

    manager.broadcastAll('admin:message', { message: 'hi' });

    assert.ok(res1.getWritten().length > res1Before);
    assert.ok(res2.getWritten().length > res2Before);
  });

  it('should handle write failures gracefully (service isolation)', () => {
    const res1 = createMockRes();
    const res2 = createMockRes();
    const user1 = { id: 1, email: 'a@test.com', name: 'A', avatar: '', role: 'user' };
    const user2 = { id: 2, email: 'b@test.com', name: 'B', avatar: '', role: 'user' };

    manager.addClient(res1, user1, ['build']);
    manager.addClient(res2, user2, ['build']);
    assert.strictEqual(manager.getClientCount(), 2);

    // res1 연결 끊김 시뮬레이션
    res1.close();

    // broadcast 시 res1 write 실패 → res1만 제거, res2는 정상
    manager.broadcast('build', 'build:start', { buildId: 1 });

    assert.strictEqual(manager.getClientCount(), 1);
    // res2는 이벤트를 받았어야 함
    const lastEvent = res2.getLastEvent();
    assert.strictEqual(lastEvent.event, 'build:start');
    assert.strictEqual(lastEvent.data.buildId, 1);
  });

  it('should track connected users with deduplication', () => {
    const res1 = createMockRes();
    const res2 = createMockRes();
    const user = { id: 1, email: 'same@test.com', name: 'Same', avatar: '', role: 'user' };

    // 같은 사용자 두 개의 탭
    manager.addClient(res1, user, ['build']);
    manager.addClient(res2, user, ['build']);

    assert.strictEqual(manager.getClientCount(), 2);  // 연결 수: 2
    assert.strictEqual(manager.getUserCount(), 1);     // 사용자 수: 1

    const users = manager.getConnectedUsers();
    assert.strictEqual(users.length, 1);
    assert.strictEqual(users[0].email, 'same@test.com');
  });

  it('should enforce maxClients limit', () => {
    const user = { id: 1, email: 'test@test.com', name: 'Test', avatar: '', role: 'user' };
    const smallManager = createSSEManager({ maxClients: 2 });

    const res1 = createMockRes();
    const res2 = createMockRes();
    const res3 = createMockRes();

    const id1 = smallManager.addClient(res1, user, []);
    const id2 = smallManager.addClient(res2, user, []);
    const id3 = smallManager.addClient(res3, user, []);

    assert.ok(id1 !== null);
    assert.ok(id2 !== null);
    assert.strictEqual(id3, null);  // 초과 → 거부
    assert.strictEqual(smallManager.getClientCount(), 2);
  });

  it('should emit clients:update on add/remove to system channel', () => {
    const adminRes = createMockRes();
    const adminUser = { id: 1, email: 'admin@test.com', name: 'Admin', avatar: '', role: 'admin' };
    manager.addClient(adminRes, adminUser, ['build', 'system']);

    // admin은 system 채널 구독 → clients:update 이벤트 수신
    const lastEvent = adminRes.getLastEvent();
    assert.strictEqual(lastEvent.event, 'clients:update');
    assert.strictEqual(lastEvent.data.count, 1);
    assert.strictEqual(lastEvent.data.userCount, 1);

    // 새 사용자 추가 → clients:update 다시 수신
    const userRes = createMockRes();
    const normalUser = { id: 2, email: 'user@test.com', name: 'User', avatar: '', role: 'user' };
    manager.addClient(userRes, normalUser, ['build']);

    const updatedEvent = adminRes.getLastEvent();
    assert.strictEqual(updatedEvent.event, 'clients:update');
    assert.strictEqual(updatedEvent.data.count, 2);
    assert.strictEqual(updatedEvent.data.userCount, 2);
  });

  it('should send to specific client', () => {
    const res = createMockRes();
    const user = { id: 1, email: 'test@test.com', name: 'Test', avatar: '', role: 'user' };
    const id = manager.addClient(res, user, []);

    const before = res.getWritten().length;
    manager.send(id, 'custom:event', { key: 'value' });

    assert.ok(res.getWritten().length > before);
    const lastEvent = res.getLastEvent();
    assert.strictEqual(lastEvent.event, 'custom:event');
    assert.strictEqual(lastEvent.data.key, 'value');
  });

  it('should handle send to non-existent client', () => {
    // 예외 발생하지 않아야 함
    assert.doesNotThrow(() => {
      manager.send(999, 'test', { data: 1 });
    });
  });

  it('should return correct SSE format', () => {
    const res = createMockRes();
    const user = { id: 1, email: 'test@test.com', name: 'Test', avatar: '', role: 'user' };
    manager.addClient(res, user, ['build']);

    manager.broadcast('build', 'build:start', { buildId: 42 });

    const written = res.getWritten();
    const buildEvent = written.find(w => w.includes('build:start'));
    assert.ok(buildEvent);
    assert.ok(buildEvent.startsWith('event: build:start\n'));
    assert.ok(buildEvent.includes('data: '));
    assert.ok(buildEvent.endsWith('\n\n'));
  });
});

describe('Build Channel', () => {
  // build 채널은 sseManager 싱글턴을 사용하므로, 독립적으로 함수 테스트
  it('should not throw when no clients connected', async () => {
    // 동적 import로 실제 채널 함수 테스트
    const { emitBuildStart, emitBuildComplete } = await import('../server/sse/channels/build.js');

    assert.doesNotThrow(() => {
      emitBuildStart({ buildId: 1, triggerType: 'manual', triggeredBy: 'test@test.com' });
    });

    assert.doesNotThrow(() => {
      emitBuildComplete({ buildId: 1, success: true, triggerType: 'manual', triggeredBy: 'test@test.com', durationMs: 5000 });
    });
  });

  it('should emit build:start with correct data structure', () => {
    const manager = createSSEManager();
    const res = createMockRes();
    const user = { id: 1, email: 'test@test.com', name: 'Test', avatar: '', role: 'user' };
    manager.addClient(res, user, ['build']);

    manager.broadcast('build', 'build:start', {
      buildId: 42,
      triggerType: 'manual',
      triggeredBy: 'admin@test.com',
      timestamp: '2026-02-15T10:00:00.000Z',
    });

    const lastEvent = res.getLastEvent();
    assert.strictEqual(lastEvent.event, 'build:start');
    assert.strictEqual(lastEvent.data.buildId, 42);
    assert.strictEqual(lastEvent.data.triggerType, 'manual');
    assert.strictEqual(lastEvent.data.triggeredBy, 'admin@test.com');
    assert.ok(lastEvent.data.timestamp);
  });

  it('should emit build:complete with success', () => {
    const manager = createSSEManager();
    const res = createMockRes();
    const user = { id: 1, email: 'test@test.com', name: 'Test', avatar: '', role: 'user' };
    manager.addClient(res, user, ['build']);

    manager.broadcast('build', 'build:complete', {
      buildId: 42,
      success: true,
      triggerType: 'manual',
      triggeredBy: 'admin@test.com',
      durationMs: 5000,
      timestamp: '2026-02-15T10:00:05.000Z',
    });

    const lastEvent = res.getLastEvent();
    assert.strictEqual(lastEvent.event, 'build:complete');
    assert.strictEqual(lastEvent.data.success, true);
    assert.strictEqual(lastEvent.data.durationMs, 5000);
  });

  it('should emit build:complete with failure', () => {
    const manager = createSSEManager();
    const res = createMockRes();
    const user = { id: 1, email: 'test@test.com', name: 'Test', avatar: '', role: 'user' };
    manager.addClient(res, user, ['build']);

    manager.broadcast('build', 'build:complete', {
      buildId: 43,
      success: false,
      triggerType: 'watcher',
      triggeredBy: 'system',
      durationMs: 3000,
      timestamp: '2026-02-15T10:00:03.000Z',
    });

    const lastEvent = res.getLastEvent();
    assert.strictEqual(lastEvent.data.success, false);
    assert.strictEqual(lastEvent.data.triggerType, 'watcher');
  });
});

describe('Message Channel', () => {
  it('should broadcast admin message to all clients', () => {
    const manager = createSSEManager();
    const res1 = createMockRes();
    const res2 = createMockRes();
    const user1 = { id: 1, email: 'a@test.com', name: 'A', avatar: '', role: 'user' };
    const user2 = { id: 2, email: 'b@test.com', name: 'B', avatar: '', role: 'user' };

    manager.addClient(res1, user1, ['build']);
    manager.addClient(res2, user2, []);

    manager.broadcastAll('admin:message', {
      message: 'Server maintenance in 10 minutes',
      sender: 'Admin',
      timestamp: '2026-02-15T10:00:00.000Z',
    });

    // 둘 다 받아야 함
    const event1 = res1.getLastEvent();
    const event2 = res2.getLastEvent();
    assert.strictEqual(event1.event, 'admin:message');
    assert.strictEqual(event1.data.message, 'Server maintenance in 10 minutes');
    assert.strictEqual(event2.event, 'admin:message');
    assert.strictEqual(event2.data.sender, 'Admin');
  });

  it('should include sender and timestamp', () => {
    const manager = createSSEManager();
    const res = createMockRes();
    const user = { id: 1, email: 'test@test.com', name: 'Test', avatar: '', role: 'user' };
    manager.addClient(res, user, []);

    manager.broadcastAll('admin:message', {
      message: 'Hello',
      sender: 'Admin User',
      timestamp: '2026-02-15T12:30:00.000Z',
    });

    const lastEvent = res.getLastEvent();
    assert.strictEqual(lastEvent.data.sender, 'Admin User');
    assert.strictEqual(lastEvent.data.timestamp, '2026-02-15T12:30:00.000Z');
  });

  it('should not throw when broadcasting with no clients', async () => {
    const { emitAdminMessage } = await import('../server/sse/channels/message.js');

    assert.doesNotThrow(() => {
      emitAdminMessage({ message: 'test', sender: 'Admin' });
    });
  });
});
