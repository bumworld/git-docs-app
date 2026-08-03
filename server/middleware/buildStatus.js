/**
 * dist 준비 상태 판정 및 안내 페이지 응답.
 *
 * 판정 우선순위:
 *   1. dist/index.html 이 있으면 정상 서빙 (최신 빌드가 실패해도 기존 사이트 유지 — 롤백 정책)
 *   2. dist 없음 + 빌드 중이거나 결과 없음 → Building 페이지 (3초 자동 리로드)
 *   3. dist 없음 + 마지막 빌드 실패 → 503 실패 페이지 (30초 간격 재시도 리로드)
 *
 * dist 유효성은 파일 개수가 아니라 index.html 존재로 판정한다.
 * (.DS_Store 같은 잔재 파일 때문에 "빌드 완료"로 오인하는 것을 막는다)
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../../config/constants.js';

export const BUILD_STATE = {
  READY: 'ready',
  BUILDING: 'building',
  FAILED: 'failed',
};

const BUILDING_HTML = `<!DOCTYPE html>
<html style="background:#0f172a"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Building...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;min-height:100dvh}
.spinner{width:48px;height:48px;border:4px solid #334155;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1.5rem}
@keyframes spin{to{transform:rotate(360deg)}}
h1{font-size:1.5rem;margin-bottom:0.5rem}
p{color:#94a3b8;font-size:0.9rem}
</style>
<script>setTimeout(()=>location.reload(), 3000)</script>
</head><body style="background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center"><div class="card" style="text-align:center;padding:3rem"><div class="spinner"></div><h1>Building wiki...</h1><p>Page will refresh automatically.</p></div></body></html>`;

function formatTime(finishedAt) {
  if (!finishedAt) return '';
  try {
    return new Date(finishedAt).toLocaleString('ko-KR');
  } catch {
    return '';
  }
}

// 실패 페이지는 내부 경로/에러 로그를 노출하지 않는다. 상세 로그는 관리자 화면에서 확인.
function renderFailedHtml(finishedAt) {
  const when = formatTime(finishedAt);
  return `<!DOCTYPE html>
<html style="background:#0f172a"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>빌드 실패</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;min-height:100dvh}
h1{font-size:1.5rem;margin-bottom:0.75rem}
p{color:#94a3b8;font-size:0.9rem;line-height:1.6}
.icon{font-size:2.5rem;margin-bottom:1rem}
a,button{font:inherit}
.btn{display:inline-block;margin-top:1.5rem;padding:0.6rem 1.2rem;border:1px solid #334155;border-radius:8px;background:#1e293b;color:#e2e8f0;cursor:pointer;text-decoration:none}
.btn:hover{background:#334155}
.admin{margin-top:1rem;font-size:0.85rem}
.admin a{color:#60a5fa}
</style>
<script>setTimeout(()=>location.reload(), 30000)</script>
</head><body style="background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center"><div style="text-align:center;padding:3rem;max-width:32rem">
<div class="icon">⚠️</div>
<h1>빌드 실패</h1>
<p>마지막 빌드가 실패해 표시할 문서가 없습니다.${when ? `<br>완료 시각: ${when}` : ''}</p>
<p>다음 빌드가 성공하면 이 페이지는 자동으로 복구됩니다 (30초마다 재확인).</p>
<button class="btn" onclick="location.reload()">새로고침</button>
<p class="admin">빌드 로그는 <a href="/admin">관리자 페이지</a>에서 확인할 수 있습니다.</p>
</div></body></html>`;
}

/**
 * dist 상태 판정
 * @param {{ distPath?: string, buildRunner?: object|null }} opts
 * @returns {{ state: string, finishedAt?: number }}
 */
export function resolveBuildState({ distPath = PATHS.DIST, buildRunner = null } = {}) {
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    return { state: BUILD_STATE.READY };
  }

  const isBuilding = typeof buildRunner?.isBuilding === 'function' ? buildRunner.isBuilding() : false;
  const last = typeof buildRunner?.getLastResult === 'function' ? buildRunner.getLastResult() : null;

  if (isBuilding || !last) return { state: BUILD_STATE.BUILDING };
  if (last.success === false) return { state: BUILD_STATE.FAILED, finishedAt: last.finishedAt };

  // 마지막 빌드는 성공했는데 dist 가 없는 경우(예: source 가 비어 dist 갱신을 건너뜀) —
  // 다음 빌드를 기다리며 Building 페이지를 보여준다.
  return { state: BUILD_STATE.BUILDING };
}

/**
 * 상태에 맞는 안내 페이지 응답 (BUILDING_HTML 응답 경로를 한 곳으로 모음)
 */
export function sendBuildStatus(res, status) {
  res.set('Cache-Control', 'no-store');
  if (status?.state === BUILD_STATE.FAILED) {
    return res.status(503).send(renderFailedHtml(status.finishedAt));
  }
  return res.send(BUILDING_HTML);
}

/**
 * Express 미들웨어: dist 가 준비되지 않았으면 상태 페이지로 응답한다.
 */
export function buildStatusPage(req, res, next) {
  // API / 정적 에셋 / 관리자 화면은 dist 와 무관하게 동작해야 한다
  if (req.path.startsWith('/api/') || req.path.startsWith('/_assets/') || req.path.startsWith('/admin')) {
    return next();
  }

  const status = resolveBuildState({
    distPath: PATHS.DIST,
    buildRunner: req.app?.locals?.buildRunner || null,
  });

  if (status.state === BUILD_STATE.READY) return next();
  return sendBuildStatus(res, status);
}

/** dist 가 서빙 가능한 상태인지 (index.html 존재) */
export function isDistReady(distPath = PATHS.DIST) {
  return fs.existsSync(path.join(distPath, 'index.html'));
}
