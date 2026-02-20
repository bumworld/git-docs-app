/**
 * 빌드 스테이지 훅 레지스트리
 *
 * 빌드 파이프라인 각 단계에 pre/post 훅을 등록하여 실행할 수 있습니다.
 * 훅은 async function(ctx) 형태이며, 실패해도 빌드를 멈추지 않습니다.
 *
 * 사용 예:
 *   import { addBuildHook } from './build-hooks.js';
 *   addBuildHook('pre-astro', async (ctx) => {
 *     console.log('Astro 빌드 직전:', ctx.settings.site_title);
 *   });
 *   addBuildHook('post-sync', async (ctx) => {
 *     // CDN 퍼지, 슬랙 알림 등
 *   });
 */

export const STAGES = [
  'pre-prebuild',
  'post-prebuild',
  'pre-astro',
  'post-astro',
  'pre-sync',
  'post-sync',
  'on-error',
];

const _hooks = new Map();

/**
 * 빌드 훅 등록
 * @param {string} stage - 훅을 삽입할 빌드 단계 (STAGES 중 하나)
 * @param {function} fn - async function(ctx) 형태의 핸들러
 * @throws {Error} 알 수 없는 stage명이면 에러
 */
export function addBuildHook(stage, fn) {
  if (!STAGES.includes(stage)) {
    throw new Error(
      `Unknown build stage: "${stage}". Valid stages: ${STAGES.join(', ')}`
    );
  }
  if (!_hooks.has(stage)) _hooks.set(stage, []);
  _hooks.get(stage).push(fn);
}

/**
 * 등록된 훅 순서대로 실행
 * 훅이 실패해도 console.warn 후 다음 훅으로 계속 진행합니다.
 * @param {string} stage - 실행할 빌드 단계
 * @param {object} ctx - 빌드 컨텍스트 (단계별 추가 정보 포함)
 */
export async function runHooks(stage, ctx) {
  const fns = _hooks.get(stage) || [];
  for (const fn of fns) {
    try {
      await fn({ ...ctx, stage });
    } catch (err) {
      console.warn(`[Build] Hook "${stage}" failed: ${err.message}`);
    }
  }
}

/**
 * 등록된 모든 훅 초기화 (테스트 격리용)
 */
export function clearHooks() {
  _hooks.clear();
}

/**
 * 현재 등록된 훅 개수 반환 (테스트/디버깅용)
 * @param {string} [stage] - 특정 단계만 확인 (생략 시 전체 합계)
 * @returns {number}
 */
export function getHookCount(stage) {
  if (stage) return (_hooks.get(stage) || []).length;
  let total = 0;
  for (const fns of _hooks.values()) total += fns.length;
  return total;
}
