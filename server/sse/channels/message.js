/**
 * 관리자 메시지 채널
 *
 * 관리자가 접속 중인 모든 사용자에게 메시지를 브로드캐스트.
 */

import { sseManager } from '../manager.js';

export function emitAdminMessage({ message, sender }) {
  try {
    sseManager.broadcastAll('admin:message', {
      message,
      sender,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[SSE] Failed to emit admin:message:', e.message);
  }
}

export function emitDirectMessage({ email, message, sender }) {
  try {
    return sseManager.sendToUser(email, 'admin:message', {
      message,
      sender,
      direct: true,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[SSE] Failed to emit direct message:', e.message);
    return false;
  }
}
