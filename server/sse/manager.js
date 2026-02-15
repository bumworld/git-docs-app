/**
 * SSE Manager - 범용 Server-Sent Events 연결 관리자
 *
 * 채널 기반 구독으로 확장 가능한 실시간 이벤트 시스템.
 * Express에 의존하지 않는 순수 데이터 구조.
 */

class SSEManager {
  constructor(options = {}) {
    this.clients = new Map();  // id → { res, user, channels, connectedAt }
    this.nextId = 1;
    this.maxClients = options.maxClients || 1000;
  }

  /**
   * 클라이언트 등록
   * @param {object} res - Express response object (writable stream)
   * @param {object} user - { id, email, name, avatar, role }
   * @param {string[]} channels - 구독할 채널 목록
   * @returns {number} clientId
   */
  addClient(res, user, channels = []) {
    if (this.clients.size >= this.maxClients) {
      return null;
    }

    const id = this.nextId++;
    this.clients.set(id, {
      res,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
      },
      channels,
      connectedAt: new Date().toISOString(),
    });

    // 접속자 변경 알림 (system 채널)
    this._broadcastClientsUpdate();

    return id;
  }

  /**
   * 클라이언트 제거
   * @param {number} id - clientId
   */
  removeClient(id) {
    if (!this.clients.has(id)) return;
    this.clients.delete(id);
    this._broadcastClientsUpdate();
  }

  /**
   * 특정 채널 구독 클라이언트에게 이벤트 전송
   * 개별 write 실패 시 해당 클라이언트만 제거 (서비스 격리)
   */
  broadcast(channel, event, data) {
    const payload = this._formatSSE(event, data);
    const failed = [];

    for (const [id, client] of this.clients) {
      if (!client.channels.includes(channel)) continue;
      try {
        client.res.write(payload);
      } catch (e) {
        failed.push(id);
      }
    }

    for (const id of failed) {
      this.clients.delete(id);
    }
    if (failed.length > 0) {
      this._broadcastClientsUpdate();
    }
  }

  /**
   * 전체 클라이언트에게 이벤트 전송
   */
  broadcastAll(event, data) {
    const payload = this._formatSSE(event, data);
    const failed = [];

    for (const [id, client] of this.clients) {
      try {
        client.res.write(payload);
      } catch (e) {
        failed.push(id);
      }
    }

    for (const id of failed) {
      this.clients.delete(id);
    }
    if (failed.length > 0) {
      this._broadcastClientsUpdate();
    }
  }

  /**
   * 특정 클라이언트에게 이벤트 전송
   */
  send(clientId, event, data) {
    const client = this.clients.get(clientId);
    if (!client) return;
    try {
      client.res.write(this._formatSSE(event, data));
    } catch (e) {
      this.clients.delete(clientId);
    }
  }

  /**
   * 특정 사용자(email)의 모든 연결에 이벤트 전송
   * @returns {boolean} 해당 사용자에게 전달되었는지 여부
   */
  sendToUser(email, event, data) {
    const payload = this._formatSSE(event, data);
    const failed = [];
    let sent = false;

    for (const [id, client] of this.clients) {
      if (client.user.email !== email) continue;
      try {
        client.res.write(payload);
        sent = true;
      } catch (e) {
        failed.push(id);
      }
    }

    for (const id of failed) {
      this.clients.delete(id);
    }
    if (failed.length > 0) {
      this._broadcastClientsUpdate();
    }
    return sent;
  }

  /**
   * 특정 사용자가 현재 접속 중인지 확인
   */
  isUserOnline(email) {
    for (const [, client] of this.clients) {
      if (client.user.email === email) return true;
    }
    return false;
  }

  /**
   * 접속 중인 사용자 목록 (email 기준 중복 제거)
   */
  getConnectedUsers() {
    const seen = new Map();
    for (const [, client] of this.clients) {
      const email = client.user.email;
      if (!seen.has(email)) {
        seen.set(email, {
          email: client.user.email,
          name: client.user.name,
          avatar: client.user.avatar,
          role: client.user.role,
          connectedAt: client.connectedAt,
        });
      }
    }
    return Array.from(seen.values());
  }

  /**
   * 전체 연결 수 (탭 수 기준, 중복 포함)
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * 고유 사용자 수
   */
  getUserCount() {
    const emails = new Set();
    for (const [, client] of this.clients) {
      emails.add(client.user.email);
    }
    return emails.size;
  }

  /**
   * SSE 프로토콜 형식으로 데이터 직렬화
   */
  _formatSSE(event, data) {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  /**
   * 접속자 변경 시 system 채널로 업데이트 broadcast
   */
  _broadcastClientsUpdate() {
    const data = {
      count: this.getClientCount(),
      userCount: this.getUserCount(),
      users: this.getConnectedUsers(),
    };
    const payload = this._formatSSE('clients:update', data);
    for (const [id, client] of this.clients) {
      if (!client.channels.includes('system')) continue;
      try {
        client.res.write(payload);
      } catch (e) {
        // 여기서는 제거하지 않음 (재귀 방지)
      }
    }
  }
}

// 싱글턴 인스턴스
export const sseManager = new SSEManager();

// 테스트용: 새 인스턴스 생성 팩토리
export function createSSEManager(options) {
  return new SSEManager(options);
}
