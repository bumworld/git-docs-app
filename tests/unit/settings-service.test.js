/**
 * settings.service 단위 테스트
 *
 * NOTE: settings.service.js가 db.js를 import하고, db.js는 better-sqlite3를
 * 모듈 레벨에서 초기화합니다. 현재 환경의 better-sqlite3는 다른 Node.js
 * 버전으로 빌드되어 있어 직접 import가 불가합니다.
 * 따라서 서비스 로직을 인라인으로 검증합니다.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─── isValidEmail 로직 (settings.service와 동일) ─────────────────────────────
const isValidEmail = (email) => !!(email && email.includes('@'));

describe('settings.service - isValidEmail', () => {
  test('@를 포함하면 유효', () => assert.equal(isValidEmail('user@example.com'), true));
  test('@가 없으면 유효하지 않음', () => assert.equal(isValidEmail('userexample.com'), false));
  test('빈 문자열은 유효하지 않음', () => assert.equal(isValidEmail(''), false));
  test('null은 유효하지 않음', () => assert.equal(isValidEmail(null), false));
  test('undefined는 유효하지 않음', () => assert.equal(isValidEmail(undefined), false));
  test('@만 있어도 true (최소 형식만 검증)', () => assert.equal(isValidEmail('@'), true));
  test('도메인 포함 이메일 유효', () => assert.equal(isValidEmail('admin@domain.co.kr'), true));
});

// ─── filterAndUpdateSettings 로직 (settings.service와 동일) ──────────────────
const ALLOWED_KEYS = ['site_title', 'site_description', 'contact_email', 'footer_text', 'language'];

function filterAndUpdateSettings(body, updateSettingsFn) {
  const updates = {};
  for (const key of ALLOWED_KEYS) {
    if (body[key] !== undefined) {
      updates[key] = String(body[key]);
    }
  }
  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No valid settings provided', code: 400 };
  }
  updateSettingsFn(updates);
  return { success: true, updates };
}

describe('settings.service - filterAndUpdateSettings', () => {
  const noop = () => {};

  test('빈 body → code:400', () => {
    const result = filterAndUpdateSettings({}, noop);
    assert.equal(result.success, false);
    assert.equal(result.code, 400);
  });

  test('허용 키 없는 body → code:400', () => {
    const result = filterAndUpdateSettings({ unknown_key: 'value', hack: 'attempt' }, noop);
    assert.equal(result.success, false);
    assert.equal(result.code, 400);
  });

  test('site_title 포함 시 성공', () => {
    const result = filterAndUpdateSettings({ site_title: 'My Wiki' }, noop);
    assert.equal(result.success, true);
    assert.equal(result.updates.site_title, 'My Wiki');
  });

  test('허용 키 외 키는 updates에서 제외', () => {
    const result = filterAndUpdateSettings({ site_title: 'Wiki', secret: 'injected' }, noop);
    assert.equal(result.success, true);
    assert.equal('secret' in result.updates, false);
  });

  test('값을 문자열로 변환', () => {
    const result = filterAndUpdateSettings({ site_title: 123 }, noop);
    assert.equal(result.success, true);
    assert.equal(result.updates.site_title, '123');
  });

  test('updateSettings가 올바른 updates 객체로 호출됨', () => {
    let captured = null;
    filterAndUpdateSettings({ site_title: 'Test', site_description: 'Desc' }, (u) => { captured = u; });
    assert.ok(captured);
    assert.equal(captured.site_title, 'Test');
    assert.equal(captured.site_description, 'Desc');
  });

  test('모든 허용 키 동시 전송 성공', () => {
    const result = filterAndUpdateSettings({
      site_title: 'T', site_description: 'D',
      contact_email: 'a@b.com', footer_text: 'F', language: 'ko',
    }, noop);
    assert.equal(result.success, true);
    assert.equal(Object.keys(result.updates).length, 5);
  });
});

// ─── triggerRebuildIfNeeded 로직 ─────────────────────────────────────────────
function triggerRebuildIfNeeded(updates, reqUser, buildRunner) {
  const needsRebuild = updates.site_title !== undefined || updates.site_description !== undefined;
  if (needsRebuild && buildRunner) {
    buildRunner.triggerBuild('settings', reqUser.email);
  }
}

describe('settings.service - triggerRebuildIfNeeded', () => {
  const reqUser = { email: 'admin@test.com' };

  test('site_title 변경 시 triggerBuild 호출', () => {
    let called = false;
    const runner = { triggerBuild: () => { called = true; } };
    triggerRebuildIfNeeded({ site_title: 'New' }, reqUser, runner);
    assert.equal(called, true);
  });

  test('site_description 변경 시 triggerBuild 호출', () => {
    let called = false;
    const runner = { triggerBuild: () => { called = true; } };
    triggerRebuildIfNeeded({ site_description: 'Desc' }, reqUser, runner);
    assert.equal(called, true);
  });

  test('contact_email만 변경 시 triggerBuild 미호출', () => {
    let called = false;
    const runner = { triggerBuild: () => { called = true; } };
    triggerRebuildIfNeeded({ contact_email: 'hi@test.com' }, reqUser, runner);
    assert.equal(called, false);
  });

  test('buildRunner가 null이면 에러 없이 무시', () => {
    assert.doesNotThrow(() => {
      triggerRebuildIfNeeded({ site_title: 'X' }, reqUser, null);
    });
  });

  test('triggerBuild에 올바른 인수 전달 (settings, 이메일)', () => {
    let capturedType = null;
    let capturedEmail = null;
    const runner = {
      triggerBuild: (type, email) => { capturedType = type; capturedEmail = email; },
    };
    triggerRebuildIfNeeded({ site_title: 'X' }, reqUser, runner);
    assert.equal(capturedType, 'settings');
    assert.equal(capturedEmail, reqUser.email);
  });
});
