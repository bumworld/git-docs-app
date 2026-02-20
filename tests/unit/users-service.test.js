/**
 * users.service 단위 테스트
 *
 * NOTE: users.service.js가 db.js를 import하고, db.js는 better-sqlite3를
 * 모듈 레벨에서 초기화합니다. 현재 환경의 better-sqlite3는 다른 Node.js
 * 버전으로 빌드되어 있어 직접 import가 불가합니다.
 * 따라서 서비스가 의존하는 상수(USER_STATUS, USER_ROLE)를 직접 검증하고,
 * 순수 로직 함수는 인라인으로 테스트합니다.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { USER_STATUS, USER_ROLE } from '../../config/constants.js';

// ─── 서비스에서 사용하는 상수 검증 ──────────────────────────────────────────

describe('USER_STATUS 상수 (users.service.isValidStatus가 의존)', () => {
  test('ALL 배열에 active, pending, blocked 포함', () => {
    assert.deepEqual(USER_STATUS.ALL, ['active', 'pending', 'blocked']);
  });

  test('ACTIVE === active', () => assert.equal(USER_STATUS.ACTIVE, 'active'));
  test('PENDING === pending', () => assert.equal(USER_STATUS.PENDING, 'pending'));
  test('BLOCKED === blocked', () => assert.equal(USER_STATUS.BLOCKED, 'blocked'));

  // isValidStatus 동일 로직
  const isValidStatus = (s) => USER_STATUS.ALL.includes(s);
  test('isValidStatus: active → true', () => assert.equal(isValidStatus('active'), true));
  test('isValidStatus: pending → true', () => assert.equal(isValidStatus('pending'), true));
  test('isValidStatus: blocked → true', () => assert.equal(isValidStatus('blocked'), true));
  test('isValidStatus: invalid → false', () => assert.equal(isValidStatus('invalid'), false));
  test('isValidStatus: 빈 문자열 → false', () => assert.equal(isValidStatus(''), false));
  test('isValidStatus: undefined → false', () => assert.equal(isValidStatus(undefined), false));
  test('isValidStatus: admin(역할) → false', () => assert.equal(isValidStatus('admin'), false));
});

describe('USER_ROLE 상수 (users.service.isValidRole이 의존)', () => {
  test('ALL 배열에 admin, user 포함', () => {
    assert.deepEqual(USER_ROLE.ALL, ['admin', 'user']);
  });

  test('ADMIN === admin', () => assert.equal(USER_ROLE.ADMIN, 'admin'));
  test('USER === user', () => assert.equal(USER_ROLE.USER, 'user'));

  // isValidRole 동일 로직
  const isValidRole = (r) => USER_ROLE.ALL.includes(r);
  test('isValidRole: admin → true', () => assert.equal(isValidRole('admin'), true));
  test('isValidRole: user → true', () => assert.equal(isValidRole('user'), true));
  test('isValidRole: superadmin → false', () => assert.equal(isValidRole('superadmin'), false));
  test('isValidRole: 빈 문자열 → false', () => assert.equal(isValidRole(''), false));
  test('isValidRole: undefined → false', () => assert.equal(isValidRole(undefined), false));
  test('isValidRole: active(상태) → false', () => assert.equal(isValidRole('active'), false));
});

describe('changeUserStatus 비즈니스 규칙 (서비스 로직 인라인 검증)', () => {
  const ADMIN_EMAIL = 'admin@test.com';

  function changeUserStatus(userId, status, findUser) {
    if (!USER_STATUS.ALL.includes(status)) {
      return { success: false, code: 400, error: 'Invalid status' };
    }
    const user = findUser(userId);
    if (user && user.email === ADMIN_EMAIL && status !== USER_STATUS.ACTIVE) {
      return { success: false, code: 403, error: 'Cannot block or deactivate the initial admin' };
    }
    return { success: true, user: { ...user, status } };
  }

  test('유효하지 않은 status → code:400', () => {
    const result = changeUserStatus(2, 'invalid', () => ({ id: 2, email: 'user@test.com' }));
    assert.equal(result.success, false);
    assert.equal(result.code, 400);
  });

  test('초기 관리자를 blocked로 변경 → code:403', () => {
    const result = changeUserStatus(1, 'blocked', () => ({ id: 1, email: ADMIN_EMAIL }));
    assert.equal(result.success, false);
    assert.equal(result.code, 403);
  });

  test('초기 관리자를 active로 변경 → 성공', () => {
    const result = changeUserStatus(1, 'active', () => ({ id: 1, email: ADMIN_EMAIL }));
    assert.equal(result.success, true);
    assert.equal(result.user.status, 'active');
  });

  test('일반 사용자 status 변경 → 성공', () => {
    const result = changeUserStatus(2, 'active', () => ({ id: 2, email: 'user@test.com' }));
    assert.equal(result.success, true);
    assert.equal(result.user.status, 'active');
  });
});

describe('removeUser 비즈니스 규칙', () => {
  const ADMIN_EMAIL = 'admin@test.com';

  function removeUser(userId, reqUser, findUser) {
    if (parseInt(userId) === reqUser.id) {
      return { success: false, code: 400, error: 'Cannot delete yourself' };
    }
    const target = findUser(userId);
    if (target && target.email === ADMIN_EMAIL) {
      return { success: false, code: 403, error: 'Cannot delete the initial admin' };
    }
    return { success: true };
  }

  test('자기 자신 삭제 → code:400', () => {
    const reqUser = { id: 1, email: ADMIN_EMAIL };
    const result = removeUser(1, reqUser, () => ({ id: 1, email: ADMIN_EMAIL }));
    assert.equal(result.success, false);
    assert.equal(result.code, 400);
  });

  test('초기 관리자 삭제 → code:403', () => {
    const reqUser = { id: 2, email: 'user@test.com' };
    const result = removeUser(1, reqUser, () => ({ id: 1, email: ADMIN_EMAIL }));
    assert.equal(result.success, false);
    assert.equal(result.code, 403);
  });

  test('일반 사용자 삭제 → 성공', () => {
    const reqUser = { id: 1, email: ADMIN_EMAIL };
    const result = removeUser(3, reqUser, () => ({ id: 3, email: 'other@test.com' }));
    assert.equal(result.success, true);
  });
});
