import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  addBuildHook,
  runHooks,
  clearHooks,
  getHookCount,
  STAGES,
} from '../../scripts/build-hooks.js';

// 각 테스트 전 훅 초기화
beforeEach(() => clearHooks());

// ─── addBuildHook ─────────────────────────────────────────────────────────────

describe('addBuildHook', () => {
  test('유효한 stage에 훅 등록 성공', () => {
    assert.doesNotThrow(() => {
      addBuildHook('pre-prebuild', async () => {});
    });
    assert.equal(getHookCount('pre-prebuild'), 1);
  });

  test('모든 유효한 stage에 등록 가능', () => {
    for (const stage of STAGES) {
      assert.doesNotThrow(() => addBuildHook(stage, async () => {}));
    }
    assert.equal(getHookCount(), STAGES.length);
  });

  test('알 수 없는 stage 등록 시 에러 throw', () => {
    assert.throws(
      () => addBuildHook('unknown-stage', async () => {}),
      /Unknown build stage/
    );
  });

  test('같은 stage에 여러 훅 등록 가능', () => {
    addBuildHook('pre-astro', async () => {});
    addBuildHook('pre-astro', async () => {});
    addBuildHook('pre-astro', async () => {});
    assert.equal(getHookCount('pre-astro'), 3);
  });
});

// ─── runHooks ─────────────────────────────────────────────────────────────────

describe('runHooks - 기본 실행', () => {
  test('등록한 훅이 호출됨', async () => {
    let called = false;
    addBuildHook('post-astro', async () => { called = true; });
    await runHooks('post-astro', {});
    assert.equal(called, true);
  });

  test('훅에 ctx가 전달됨', async () => {
    let received = null;
    addBuildHook('pre-sync', async (ctx) => { received = ctx; });
    await runHooks('pre-sync', { settings: { site_title: 'Test' } });
    assert.ok(received);
    assert.equal(received.settings.site_title, 'Test');
  });

  test('ctx에 stage 필드가 자동으로 추가됨', async () => {
    let receivedStage = null;
    addBuildHook('post-sync', async (ctx) => { receivedStage = ctx.stage; });
    await runHooks('post-sync', {});
    assert.equal(receivedStage, 'post-sync');
  });

  test('등록 순서대로 훅 실행됨', async () => {
    const order = [];
    addBuildHook('pre-prebuild', async () => { order.push(1); });
    addBuildHook('pre-prebuild', async () => { order.push(2); });
    addBuildHook('pre-prebuild', async () => { order.push(3); });
    await runHooks('pre-prebuild', {});
    assert.deepEqual(order, [1, 2, 3]);
  });

  test('훅 없는 stage 실행 시 에러 없음', async () => {
    await assert.doesNotReject(() => runHooks('pre-astro', {}));
  });

  test('등록되지 않은 stage 실행 시 에러 없음', async () => {
    // _hooks에 없는 stage는 빈 배열로 처리됨
    await assert.doesNotReject(() => runHooks('pre-prebuild', {}));
  });
});

describe('runHooks - 훅 실패 처리', () => {
  test('훅이 에러 throw해도 runHooks가 reject되지 않음', async () => {
    addBuildHook('on-error', async () => { throw new Error('Hook failed!'); });
    await assert.doesNotReject(() => runHooks('on-error', {}));
  });

  test('실패한 훅 다음 훅도 계속 실행됨', async () => {
    let secondCalled = false;
    addBuildHook('post-prebuild', async () => { throw new Error('First hook fails'); });
    addBuildHook('post-prebuild', async () => { secondCalled = true; });
    await runHooks('post-prebuild', {});
    assert.equal(secondCalled, true);
  });

  test('여러 훅 중 일부 실패해도 성공 훅은 모두 실행됨', async () => {
    const executed = [];
    addBuildHook('pre-sync', async () => { executed.push('A'); });
    addBuildHook('pre-sync', async () => { throw new Error('B fails'); });
    addBuildHook('pre-sync', async () => { executed.push('C'); });
    addBuildHook('pre-sync', async () => { throw new Error('D fails'); });
    addBuildHook('pre-sync', async () => { executed.push('E'); });
    await runHooks('pre-sync', {});
    assert.deepEqual(executed, ['A', 'C', 'E']);
  });
});

// ─── clearHooks ──────────────────────────────────────────────────────────────

describe('clearHooks', () => {
  test('clearHooks 후 모든 훅 제거됨', async () => {
    addBuildHook('pre-prebuild', async () => {});
    addBuildHook('post-sync', async () => {});
    clearHooks();
    assert.equal(getHookCount(), 0);
  });

  test('clearHooks 후 훅 실행 시 아무것도 호출 안 됨', async () => {
    let called = false;
    addBuildHook('pre-astro', async () => { called = true; });
    clearHooks();
    await runHooks('pre-astro', {});
    assert.equal(called, false);
  });
});

// ─── STAGES 상수 검증 ─────────────────────────────────────────────────────────

describe('STAGES 상수', () => {
  test('7개 단계 정의됨', () => {
    assert.equal(STAGES.length, 7);
  });

  test('필수 단계 모두 포함', () => {
    const required = ['pre-prebuild', 'post-prebuild', 'pre-astro', 'post-astro', 'pre-sync', 'post-sync', 'on-error'];
    for (const stage of required) {
      assert.ok(STAGES.includes(stage), `"${stage}" 가 STAGES에 없음`);
    }
  });
});
