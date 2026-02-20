import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  register,
  dispatch,
  clearHandlers,
  getHandlers,
} from '../../scripts/prebuild/registry.js';

// 각 테스트 전 핸들러 초기화
// NOTE: processors.js를 import하면 기본 핸들러가 등록되므로,
// registry.js를 직접 import해서 격리된 레지스트리 상태로 테스트합니다.
beforeEach(() => clearHandlers());

const makeCtx = (overrides = {}) => ({
  docsSubDir: '/docs',
  downloadsSubDir: '/downloads',
  stats: null,
  safeFileName: 'test.md',
  entry: { name: 'test.md' },
  ...overrides,
});

// ─── register ────────────────────────────────────────────────────────────────

describe('register', () => {
  test('핸들러 등록 후 getHandlers에 포함됨', () => {
    register({ name: 'test', match: () => true, process: () => [] });
    assert.equal(getHandlers().length, 1);
    assert.equal(getHandlers()[0].name, 'test');
  });

  test('여러 핸들러 등록 시 등록 순서 유지', () => {
    register({ name: 'first',  match: () => false, process: () => [] });
    register({ name: 'second', match: () => false, process: () => [] });
    register({ name: 'third',  match: () => false, process: () => [] });
    const names = getHandlers().map(h => h.name);
    assert.deepEqual(names, ['first', 'second', 'third']);
  });
});

// ─── dispatch ────────────────────────────────────────────────────────────────

describe('dispatch - 기본 매칭', () => {
  test('매칭되는 핸들러의 process 호출', () => {
    let called = false;
    register({
      name: 'test',
      match: (ext) => ext === '.md',
      process: () => { called = true; return ['/docs/test.md']; },
    });
    const result = dispatch('.md', '/src/test.md', 'test.md', makeCtx());
    assert.equal(called, true);
    assert.deepEqual(result, ['/docs/test.md']);
  });

  test('첫 번째 매칭 핸들러만 실행됨 (이후 핸들러 건너뜀)', () => {
    const calls = [];
    register({ name: 'first',  match: (ext) => ext === '.md', process: () => { calls.push('first'); return []; } });
    register({ name: 'second', match: (ext) => ext === '.md', process: () => { calls.push('second'); return []; } });
    dispatch('.md', '/src/test.md', 'test.md', makeCtx());
    assert.deepEqual(calls, ['first']);
  });

  test('매칭 핸들러 없으면 빈 배열 반환', () => {
    register({ name: 'png-only', match: (ext) => ext === '.png', process: () => ['/out.png'] });
    const result = dispatch('.pdf', '/src/file.pdf', 'file.pdf', makeCtx());
    assert.deepEqual(result, []);
  });

  test('핸들러 없으면 빈 배열 반환', () => {
    const result = dispatch('.md', '/src/test.md', 'test.md', makeCtx());
    assert.deepEqual(result, []);
  });

  test('fallback 핸들러(match=()=>true)가 마지막에 동작', () => {
    let fallbackCalled = false;
    register({ name: 'specific', match: (ext) => ext === '.md', process: () => [] });
    register({ name: 'fallback', match: () => true, process: () => { fallbackCalled = true; return []; } });

    // .pdf는 specific에 매칭 안 되므로 fallback 호출
    fallbackCalled = false;
    dispatch('.pdf', '/src/file.pdf', 'file.pdf', makeCtx());
    assert.equal(fallbackCalled, true);

    // .md는 specific에 매칭되므로 fallback 미호출
    fallbackCalled = false;
    dispatch('.md', '/src/test.md', 'test.md', makeCtx());
    assert.equal(fallbackCalled, false);
  });
});

describe('dispatch - ctx 전달', () => {
  test('process에 srcPath, relPath, ctx 그대로 전달됨', () => {
    let capturedArgs = null;
    register({
      name: 'capture',
      match: () => true,
      process: (srcPath, relPath, ctx) => {
        capturedArgs = { srcPath, relPath, ctx };
        return [];
      },
    });
    const ctx = makeCtx({ safeFileName: 'file.png' });
    dispatch('.png', '/source/file.png', 'folder/file.png', ctx);
    assert.ok(capturedArgs);
    assert.equal(capturedArgs.srcPath, '/source/file.png');
    assert.equal(capturedArgs.relPath, 'folder/file.png');
    assert.equal(capturedArgs.ctx.safeFileName, 'file.png');
  });

  test('match에 ext, srcPath, entry 전달됨', () => {
    let capturedMatchArgs = null;
    register({
      name: 'match-capture',
      match: (ext, srcPath, entry) => {
        capturedMatchArgs = { ext, srcPath, entry };
        return false;
      },
      process: () => [],
    });
    const ctx = makeCtx({ entry: { name: 'README' } });
    dispatch('', '/source/README', 'README', ctx);
    assert.ok(capturedMatchArgs);
    assert.equal(capturedMatchArgs.ext, '');
    assert.equal(capturedMatchArgs.srcPath, '/source/README');
    assert.equal(capturedMatchArgs.entry.name, 'README');
  });
});

// ─── clearHandlers ────────────────────────────────────────────────────────────

describe('clearHandlers', () => {
  test('clearHandlers 후 핸들러 없어짐', () => {
    register({ name: 'h1', match: () => true, process: () => [] });
    register({ name: 'h2', match: () => true, process: () => [] });
    clearHandlers();
    assert.equal(getHandlers().length, 0);
  });

  test('clearHandlers 후 dispatch는 빈 배열 반환', () => {
    register({ name: 'h', match: () => true, process: () => ['something'] });
    clearHandlers();
    const result = dispatch('.md', '/src/test.md', 'test.md', makeCtx());
    assert.deepEqual(result, []);
  });
});

// ─── 커스텀 핸들러 동적 등록 ─────────────────────────────────────────────────

describe('커스텀 핸들러 동적 등록', () => {
  test('clearHandlers 후 새 핸들러 등록하면 동작함', () => {
    register({ name: 'old', match: () => false, process: () => ['old'] });
    clearHandlers();
    register({ name: 'new', match: () => true, process: () => ['new-result'] });
    const result = dispatch('.any', '/src/file.any', 'file.any', makeCtx());
    assert.deepEqual(result, ['new-result']);
  });

  test('커스텀 핸들러가 기존 핸들러보다 우선순위 가짐 (먼저 등록 시)', () => {
    register({ name: 'custom', match: (ext) => ext === '.md', process: () => ['custom'] });
    register({ name: 'default', match: (ext) => ext === '.md', process: () => ['default'] });
    const result = dispatch('.md', '/src/test.md', 'test.md', makeCtx());
    assert.deepEqual(result, ['custom']);
  });
});
