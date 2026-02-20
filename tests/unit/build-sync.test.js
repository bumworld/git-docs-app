/**
 * build.js - dist 동기화 및 롤백 전략 단위 테스트
 *
 * dist → dist-old 백업, 빌드 실패 시 롤백 조건을 인라인으로 검증합니다.
 * 실제 파일시스템 조작 없이 로직 자체를 검증합니다.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─── dist 동기화 로직 인라인 구현 (build.js 동일 로직) ───────────────────────

/**
 * 성공 경로 동기화 시뮬레이션
 * @param {object} opts
 * @param {boolean} opts.hasContent - source에 파일이 있는지
 * @param {boolean} opts.distHasContent - 기존 dist에 파일이 있는지
 * @returns {{ backedUp: boolean, synced: boolean, skipped: boolean }}
 */
function simulateSyncSuccess({ hasContent, distHasContent }) {
  const result = { backedUp: false, synced: false, skipped: false };

  if (!hasContent) {
    result.skipped = true;
    return result;
  }

  // dist → dist-old 백업
  if (distHasContent) {
    result.backedUp = true;
  }

  // dist-temp → dist
  result.synced = true;
  return result;
}

/**
 * 실패 경로 롤백 시뮬레이션
 * @param {object} opts
 * @param {boolean} opts.distIsEmpty - dist가 비어있는지
 * @param {boolean} opts.distOldExists - dist-old가 있는지
 * @param {boolean} opts.distOldHasContent - dist-old에 파일이 있는지
 * @returns {{ rolledBack: boolean }}
 */
function simulateRollback({ distIsEmpty, distOldExists, distOldHasContent }) {
  if (distIsEmpty && distOldExists && distOldHasContent) {
    return { rolledBack: true };
  }
  return { rolledBack: false };
}

// ─── 성공 경로 테스트 ─────────────────────────────────────────────────────────

describe('build sync - 성공 경로', () => {
  test('hasContent=true, 기존 dist 있음 → dist-old 백업 후 동기화', () => {
    const result = simulateSyncSuccess({ hasContent: true, distHasContent: true });
    assert.equal(result.backedUp, true);
    assert.equal(result.synced, true);
    assert.equal(result.skipped, false);
  });

  test('hasContent=true, 기존 dist 없음 → 백업 없이 바로 동기화', () => {
    const result = simulateSyncSuccess({ hasContent: true, distHasContent: false });
    assert.equal(result.backedUp, false);
    assert.equal(result.synced, true);
    assert.equal(result.skipped, false);
  });

  test('hasContent=false → dist 업데이트 건너뜀 (기존 dist 보존)', () => {
    const result = simulateSyncSuccess({ hasContent: false, distHasContent: true });
    assert.equal(result.skipped, true);
    assert.equal(result.synced, false);
    assert.equal(result.backedUp, false);
  });

  test('hasContent=false, 기존 dist 없음 → 건너뜀', () => {
    const result = simulateSyncSuccess({ hasContent: false, distHasContent: false });
    assert.equal(result.skipped, true);
    assert.equal(result.synced, false);
  });
});

// ─── 실패 경로 롤백 테스트 ────────────────────────────────────────────────────

describe('build sync - 실패 시 롤백 조건', () => {
  test('dist 비어있음 + dist-old 있음 → 롤백 실행', () => {
    const result = simulateRollback({
      distIsEmpty: true,
      distOldExists: true,
      distOldHasContent: true,
    });
    assert.equal(result.rolledBack, true);
  });

  test('dist에 내용 있음 → 롤백 안 함 (기존 dist 유지)', () => {
    const result = simulateRollback({
      distIsEmpty: false,
      distOldExists: true,
      distOldHasContent: true,
    });
    assert.equal(result.rolledBack, false);
  });

  test('dist-old 없음 → 롤백 안 함', () => {
    const result = simulateRollback({
      distIsEmpty: true,
      distOldExists: false,
      distOldHasContent: false,
    });
    assert.equal(result.rolledBack, false);
  });

  test('dist-old 있지만 비어있음 → 롤백 안 함', () => {
    const result = simulateRollback({
      distIsEmpty: true,
      distOldExists: true,
      distOldHasContent: false,
    });
    assert.equal(result.rolledBack, false);
  });

  test('dist 비어있고 dist-old 없음 → 롤백 안 함 (조용히 실패 반환)', () => {
    const result = simulateRollback({
      distIsEmpty: true,
      distOldExists: false,
      distOldHasContent: false,
    });
    assert.equal(result.rolledBack, false);
  });
});

// ─── 정책 요약 검증 ───────────────────────────────────────────────────────────

describe('build sync - 정책 일관성', () => {
  test('hasContent=false 시 dist-old 백업 안 함 (소스 비어있을 때 기존 dist 완전 보존)', () => {
    // hasContent=false이면 백업/동기화 모두 건너뜀
    const result = simulateSyncSuccess({ hasContent: false, distHasContent: true });
    assert.equal(result.backedUp, false);
    assert.equal(result.skipped, true);
  });

  test('성공 빌드 시 rollback 조건 (distIsEmpty=false) → 롤백 미발생', () => {
    // 빌드 성공 후 dist에 내용이 있으면 (정상 상태) 롤백 로직 진입 안 함
    const result = simulateRollback({ distIsEmpty: false, distOldExists: true, distOldHasContent: true });
    assert.equal(result.rolledBack, false);
  });
});
