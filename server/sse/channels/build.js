/**
 * 빌드 이벤트 채널
 *
 * watcher.js에서 호출하여 빌드 상태를 SSE 클라이언트에게 전달.
 * SSE 내부 구조 변경 시 이 인터페이스만 유지하면 watcher에 영향 없음.
 */

import { sseManager } from '../manager.js';

export function emitBuildStart({ buildId, triggerType, triggeredBy }) {
  try {
    sseManager.broadcast('build', 'build:start', {
      buildId: buildId || null,
      triggerType,
      triggeredBy,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[SSE] Failed to emit build:start:', e.message);
  }
}

export function emitBuildComplete({ buildId, success, triggerType, triggeredBy, durationMs }) {
  try {
    sseManager.broadcast('build', 'build:complete', {
      buildId: buildId || null,
      success,
      triggerType,
      triggeredBy,
      durationMs: durationMs || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[SSE] Failed to emit build:complete:', e.message);
  }
}
