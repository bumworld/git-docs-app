/**
 * tests/unit/gitdocs-config.test.js
 * .gitdocs.json 로더 fail-closed 검증.
 *
 * 잘못된 설정을 조용히 무시하면 ignorePatterns 가 무효화되어 숨겨야 할 문서가
 * 게시된다. 파일이 "존재하는데" 읽거나 해석할 수 없으면 빌드를 실패시킨다.
 */
import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import { loadGitdocsConfig, GitdocsConfigError } from '../../scripts/prebuild/config.js';

const TMP = path.join(process.cwd(), 'test-tmp-gitdocs-config');
const CONFIG_PATH = path.join(TMP, '.gitdocs.json');

function writeConfig(raw) {
  fs.outputFileSync(CONFIG_PATH, typeof raw === 'string' ? raw : JSON.stringify(raw), 'utf-8');
}

/** console.warn 을 가로채 경고 문자열 배열을 반환 */
function captureWarnings(fn) {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    fn();
  } finally {
    console.warn = original;
  }
  return warnings;
}

before(() => {
  fs.ensureDirSync(TMP);
});

after(() => {
  fs.removeSync(TMP);
});

afterEach(() => {
  fs.removeSync(CONFIG_PATH);
});

describe('loadGitdocsConfig - 정상 경로', () => {
  it('파일이 없으면 빈 객체를 반환한다', () => {
    assert.deepStrictEqual(loadGitdocsConfig(TMP), {});
  });

  it('유효한 설정을 그대로 반환한다', () => {
    writeConfig({
      title: 'My Wiki',
      description: 'desc',
      ignorePatterns: ['secret/**', '*.key'],
      sidebarOrder: ['guide', 'api'],
    });
    const config = loadGitdocsConfig(TMP);
    assert.strictEqual(config.title, 'My Wiki');
    assert.deepStrictEqual(config.ignorePatterns, ['secret/**', '*.key']);
    assert.deepStrictEqual(config.sidebarOrder, ['guide', 'api']);
  });

  it('빈 배열과 빈 객체를 허용한다', () => {
    writeConfig({ ignorePatterns: [], sidebarOrder: [] });
    const config = loadGitdocsConfig(TMP);
    assert.deepStrictEqual(config.ignorePatterns, []);

    writeConfig({});
    assert.deepStrictEqual(loadGitdocsConfig(TMP), {});
  });

  it('알 수 없는 키는 경고만 남기고 통과시킨다 (향후 호환)', () => {
    writeConfig({ title: 'ok', futureOption: { nested: true } });
    let config;
    const warnings = captureWarnings(() => { config = loadGitdocsConfig(TMP); });
    assert.strictEqual(config.title, 'ok');
    assert.ok(warnings.some(w => w.includes('futureOption')), `경고에 키 이름이 없음: ${warnings.join('|')}`);
  });
});

describe('loadGitdocsConfig - fail-closed', () => {
  it('JSON 문법 오류면 throw 한다', () => {
    writeConfig('{ "title": "broken", }');
    assert.throws(() => loadGitdocsConfig(TMP), GitdocsConfigError);
  });

  it('최상위가 null 이면 throw 한다', () => {
    writeConfig('null');
    assert.throws(() => loadGitdocsConfig(TMP), GitdocsConfigError);
  });

  it('최상위가 배열이면 throw 한다', () => {
    writeConfig('["a", "b"]');
    assert.throws(() => loadGitdocsConfig(TMP), GitdocsConfigError);
  });

  it('최상위가 문자열/숫자면 throw 한다', () => {
    writeConfig('"just a string"');
    assert.throws(() => loadGitdocsConfig(TMP), GitdocsConfigError);
    writeConfig('42');
    assert.throws(() => loadGitdocsConfig(TMP), GitdocsConfigError);
  });

  it('title 이 문자열이 아니면 throw 한다', () => {
    writeConfig({ title: { text: 'x' } });
    assert.throws(() => loadGitdocsConfig(TMP), /title/);
  });

  it('description 이 문자열이 아니면 throw 한다', () => {
    writeConfig({ description: ['a'] });
    assert.throws(() => loadGitdocsConfig(TMP), /description/);
  });

  it('ignorePatterns 가 배열이 아니면 throw 한다', () => {
    writeConfig({ ignorePatterns: 'secret/**' });
    assert.throws(() => loadGitdocsConfig(TMP), /ignorePatterns/);
  });

  it('ignorePatterns 에 문자열이 아닌 원소가 섞이면 throw 한다', () => {
    writeConfig({ ignorePatterns: ['ok', 42] });
    assert.throws(() => loadGitdocsConfig(TMP), /ignorePatterns/);
  });

  it('sidebarOrder 가 배열이 아니면 throw 한다', () => {
    writeConfig({ sidebarOrder: { first: 'guide' } });
    assert.throws(() => loadGitdocsConfig(TMP), /sidebarOrder/);
  });

  it('sidebarOrder 에 null 이 섞이면 throw 한다', () => {
    writeConfig({ sidebarOrder: ['guide', null] });
    assert.throws(() => loadGitdocsConfig(TMP), /sidebarOrder/);
  });

  it('파일이 존재하지만 읽을 수 없으면 throw 한다', () => {
    // 파일 대신 디렉토리를 놓아 readFileSync 가 EISDIR 로 실패하게 만든다
    fs.ensureDirSync(CONFIG_PATH);
    try {
      assert.throws(() => loadGitdocsConfig(TMP), GitdocsConfigError);
    } finally {
      fs.removeSync(CONFIG_PATH);
    }
  });
});
