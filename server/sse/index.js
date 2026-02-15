/**
 * SSE 라우터
 *
 * GET  /api/sse               - SSE 연결 (인증 필요)
 * GET  /api/sse/clients       - 접속자 목록 (admin)
 * POST /api/sse/message       - 전체 메시지 발송 (admin)
 * POST /api/sse/message/:email - 개별 메시지 발송 (admin)
 */

import { Router } from 'express';
import { sseManager } from './manager.js';
import { requireAuth, requireAdmin } from '../middleware/requireAuth.js';
import { emitAdminMessage, emitDirectMessage } from './channels/message.js';

const router = Router();

let buildRunner = null;

function setBuildRunner(runner) {
  buildRunner = runner;
}

// SSE 연결 엔드포인트
router.get('/', requireAuth, (req, res) => {
  // 최대 연결 수 체크
  if (sseManager.getClientCount() >= sseManager.maxClients) {
    return res.status(503).json({ error: 'Too many connections' });
  }

  // SSE 헤더 설정
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 재연결 간격 설정 (5초)
  res.write('retry: 5000\n\n');

  // 채널 구독: admin은 system 포함, 일반 사용자는 build만
  const channels = req.user.role === 'admin'
    ? ['build', 'system']
    : ['build'];

  const clientId = sseManager.addClient(res, req.user, channels);

  // 초기 상태 전송
  const building = buildRunner ? buildRunner.isBuilding() : false;
  const connectedData = {
    building,
    clientCount: sseManager.getClientCount(),
    userCount: sseManager.getUserCount(),
  };
  res.write(`event: connected\ndata: ${JSON.stringify(connectedData)}\n\n`);

  // 30초 keepalive (프록시 타임아웃 방지)
  const keepalive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (e) {
      clearInterval(keepalive);
    }
  }, 30000);

  // 연결 해제 시 정리
  req.on('close', () => {
    clearInterval(keepalive);
    sseManager.removeClient(clientId);
  });
});

// 접속자 목록 API
router.get('/clients', requireAdmin, (req, res) => {
  res.json({
    count: sseManager.getClientCount(),
    userCount: sseManager.getUserCount(),
    users: sseManager.getConnectedUsers(),
  });
});

// 관리자 메시지 발송 API
router.post('/message', requireAdmin, (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const sender = req.user.name || req.user.email;
  emitAdminMessage({ message: message.trim(), sender });

  console.log(`[SSE] Admin message from ${req.user.email}: ${message.trim()}`);
  res.json({ success: true });
});

// 개별 사용자 메시지 발송 API
router.post('/message/:email', requireAdmin, (req, res) => {
  const { message } = req.body;
  const { email } = req.params;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const sender = req.user.name || req.user.email;
  const sent = emitDirectMessage({ email, message: message.trim(), sender });

  if (!sent) {
    return res.json({ success: false, offline: true, message: 'User is not online' });
  }

  console.log(`[SSE] Direct message from ${req.user.email} to ${email}: ${message.trim()}`);
  res.json({ success: true });
});

export default router;
export { setBuildRunner as setSSEBuildRunner };
