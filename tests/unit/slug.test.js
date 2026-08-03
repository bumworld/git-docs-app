/**
 * tests/unit/slug.test.js
 * 슬러그 정규화(sanitizeSlug / sanitizeDirName) 단위 테스트
 *
 * 핵심 불변식: prebuild가 만든 파일명/사이드바 slug은 Astro Starlight의
 * docsLoader(github-slugger) 결과와 반드시 일치해야 한다.
 * 불일치하면 Starlight가 "slug not found" 로 빌드를 중단한다.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { slug as githubSlug } from 'github-slugger';
import { sanitizeSlug, sanitizeDirName } from '../../scripts/prebuild/utils.js';

// ─── 기존 계약 유지 ───────────────────────────────────────────────────────────

describe('sanitizeSlug - 기존 동작 유지', () => {
  test('기본 특수문자 제거 규칙이 그대로 유지된다', () => {
    assert.equal(sanitizeSlug('hello-world.md'), 'hello-world');
    assert.equal(sanitizeSlug('test (1).md'), 'test-1');
    assert.equal(sanitizeSlug('build.gradle.md'), 'buildgradle');
    assert.equal(sanitizeSlug('libs.versions.md'), 'libsversions');
  });

  test('& 등 기존 제거 대상 문자의 URL이 변하지 않는다', () => {
    assert.equal(sanitizeSlug('foo & bar.md'), 'foo-bar');
    assert.equal(sanitizeSlug('100% 완료.md'), '100-완료');
  });

  test('한글 파일명이 유지된다', () => {
    assert.equal(sanitizeSlug('한글-파일.md'), '한글-파일');
    assert.equal(sanitizeSlug('프로젝트 설정.md'), '프로젝트-설정');
  });

  test('케이스는 보존된다 (호출부에서 toLowerCase 적용)', () => {
    assert.equal(sanitizeSlug('README.md'), 'README');
    assert.equal(sanitizeSlug('MyFile_Name.md'), 'MyFile_Name');
  });
});

// ─── github-slugger 멱등성 ────────────────────────────────────────────────────

describe('sanitizeSlug - github-slugger 멱등성', () => {
  test('github-slugger가 제거하는 비ASCII 문장부호(·)를 함께 제거한다', () => {
    assert.equal(sanitizeSlug('온사이트 팝업 실행·예약.bru'), '온사이트-팝업-실행예약');
    assert.equal(sanitizeDirName('실행·예약'), '실행예약');
  });

  test('대표 입력에 대해 githubSlug(sanitize(x)) === sanitize(x).toLowerCase()', () => {
    const inputs = [
      'hello-world.md',
      'test (1).md',
      'build.gradle.md',
      '한글-파일.md',
      '프로젝트 설정.md',
      'foo & bar.md',
      '온사이트 팝업 실행·예약.bru',
      'naïve—dash·dot.txt',
      'A B  C.md',
      'v1.2.3.md',
      'MyFile_Name.md',
      'café.md',
      '100% 완료.md',
      'a—b.md',
      'x+y.md',
    ];
    for (const input of inputs) {
      const sanitized = sanitizeSlug(input);
      assert.equal(
        githubSlug(sanitized),
        sanitized.toLowerCase(),
        `멱등성 위반: ${input} → ${sanitized}`
      );
    }
  });

  test('sanitize를 두 번 적용해도 결과가 같다 (idempotent)', () => {
    const inputs = ['온사이트 팝업 실행·예약', 'foo & bar', '프로젝트 설정', 'naïve—dash·dot'];
    for (const input of inputs) {
      const once = sanitizeDirName(input);
      assert.equal(sanitizeDirName(once), once, `2회 적용 불일치: ${input}`);
    }
  });
});

// ─── 유니코드 정규화 ──────────────────────────────────────────────────────────

describe('sanitizeSlug - NFC/NFD 정규화', () => {
  test('NFD 입력과 NFC 입력의 결과가 같다', () => {
    const nfc = '한글 파일.md'.normalize('NFC');
    const nfd = '한글 파일.md'.normalize('NFD');
    assert.notEqual(nfc, nfd); // 입력 자체는 다른 문자열
    assert.equal(sanitizeSlug(nfd), sanitizeSlug(nfc));
    assert.equal(sanitizeSlug(nfd), '한글-파일');
  });

  test('NFD 결과도 github-slugger 멱등성을 만족한다', () => {
    const sanitized = sanitizeSlug('한글 파일.md'.normalize('NFD'));
    assert.equal(githubSlug(sanitized), sanitized.toLowerCase());
  });
});

// ─── 빈 슬러그 ────────────────────────────────────────────────────────────────

describe('sanitizeSlug - 빈 슬러그 처리', () => {
  test('문장부호만 있는 이름은 명시적 오류를 던진다', () => {
    assert.throws(() => sanitizeSlug('···.bru'), (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /···/);
      return true;
    });
    assert.throws(() => sanitizeSlug('....md'), /\.\.\./);
    assert.throws(() => sanitizeDirName('###'), /###/);
  });

  test('오류 메시지에 원본 이름이 포함된다', () => {
    try {
      sanitizeSlug('···.bru');
      assert.fail('should throw');
    } catch (err) {
      assert.ok(err.message.includes('···.bru'), `원본 이름 누락: ${err.message}`);
    }
  });
});
