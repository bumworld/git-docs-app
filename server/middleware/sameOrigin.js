/**
 * /api 변경 요청에 대한 Origin 검사 (CSRF 심층 방어)
 *
 * 1차 방어는 세션 쿠키의 SameSite=lax 이고, 이 미들웨어는 2차 방어다.
 *
 * 정책
 * - POST/PUT/PATCH/DELETE 에만 적용한다. GET/HEAD/OPTIONS 는 통과.
 * - Origin 헤더가 **있을 때만** 검증한다. curl/CLI/서버간 호출과 Origin 을 보내지 않는
 *   오래된 user agent 호환을 위한 선택이며, 따라서 완전한 CSRF 보장은 아니다.
 *   (완전한 보장이 필요하면 별도 CSRF 토큰이나 API 토큰을 도입해야 한다)
 * - Origin 은 scheme+host+port 를 모두 포함하므로 host 만 비교하지 않고
 *   URL 로 파싱한 직렬화 origin 전체를 비교한다. 대소문자/기본 포트/IPv6 표기
 *   정규화는 URL 파서에 맡긴다.
 * - 파싱 실패, `Origin: null`(sandboxed iframe, data: 문서 등)은 fail-closed 로 403.
 *
 * 기대 origin 결정
 * - ALLOWED_ORIGINS 환경변수(콤마 구분)가 있으면 그 목록과만 정확 비교한다. 리버스 프록시
 *   뒤에 있거나 프런트와 API 의 origin 이 다른 배포에서는 이 방식을 권장한다.
 * - 없으면 req.protocol(trust proxy 설정을 반영) + **raw Host 헤더**로 구성한다.
 *   X-Forwarded-Host 를 직접 읽으면 공격자가 Origin 과 같은 값으로 맞춰 검사를
 *   통과시킬 수 있으므로(앱 포트 직접 접근/프록시가 헤더를 덮어쓰지 않는 경우) 쓰지 않는다.
 */

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 문자열을 직렬화된 origin 으로 정규화. 실패하면 null */
function toOrigin(value) {
  try {
    const origin = new URL(value).origin;
    return origin && origin !== 'null' ? origin : null;
  } catch {
    return null;
  }
}

/**
 * ALLOWED_ORIGINS 환경변수(콤마 구분)를 정규화된 origin 배열로 변환.
 *
 * - 값이 비어 있거나 구분자/공백뿐이면 null → 요청 기반 계산으로 폴백 (미설정과 동일 취급)
 * - 항목은 있는데 유효한 origin 이 하나도 없으면 빈 배열 → Origin 이 있는 변경 요청을 모두 차단.
 *   설정 오류를 조용히 완화 정책으로 폴백시키면 운영자가 오탐을 못 잡는다 (fail-closed).
 *   단, Origin 헤더가 없는 요청은 아래 호환 정책에 따라 이 경우에도 통과한다.
 */
export function parseAllowedOrigins(raw) {
  if (!raw) return null;
  const entries = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (entries.length === 0) return null;

  const list = [];
  for (const entry of entries) {
    const origin = toOrigin(entry);
    if (origin) list.push(origin);
    else console.error(`[Security] ALLOWED_ORIGINS 항목을 origin 으로 해석할 수 없습니다: "${entry}" (예: https://wiki.example)`);
  }
  if (list.length === 0) {
    console.error('[Security] ALLOWED_ORIGINS 에 유효한 origin 이 없습니다 — Origin 헤더가 있는 /api 변경 요청을 모두 차단합니다.');
  }
  return list;
}

/** 요청 자신의 origin (프록시 신뢰 설정이 반영된 protocol + raw Host) */
function expectedFromRequest(req) {
  const host = req.headers.host;
  if (!host) return [];
  const origin = toOrigin(`${req.protocol || 'http'}://${host}`);
  return origin ? [origin] : [];
}

function reject(req, res) {
  console.warn(`[Security] Origin 불일치로 차단: ${req.method} ${req.originalUrl || req.url} origin=${req.headers.origin}`);
  return res.status(403).json({ error: 'Invalid request origin' });
}

/**
 * @param {string[]|null} [allowedOrigins] 허용 origin 목록.
 *   null/undefined 면 요청 기반으로 계산하고, 빈 배열이면 Origin 이 있는 변경 요청을 모두 차단한다.
 *   (Origin 헤더가 없는 요청은 어느 경우에도 통과 — 위 호환 정책 참고)
 */
export function createSameOrigin(allowedOrigins) {
  // 빈 배열과 null 은 의미가 다르다: 빈 배열 = "명시적으로 아무 origin 도 허용 안 함"
  const configured = Array.isArray(allowedOrigins)
    ? allowedOrigins.map(toOrigin).filter(Boolean)
    : null;

  return function sameOrigin(req, res, next) {
    if (!MUTATING_METHODS.has(req.method)) return next();

    const originHeader = req.headers.origin;
    if (!originHeader) return next();  // 호환 정책: Origin 이 있을 때만 검증

    const requestOrigin = toOrigin(originHeader);
    if (!requestOrigin) return reject(req, res);

    const expected = configured || expectedFromRequest(req);
    if (expected.includes(requestOrigin)) return next();

    return reject(req, res);
  };
}

export default createSameOrigin(parseAllowedOrigins(process.env.ALLOWED_ORIGINS));
