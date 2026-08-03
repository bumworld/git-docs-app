/**
 * tests/unit/prebuild-collisions.test.js
 * 출력 경로 충돌 등록(registerPath) 커버리지 테스트
 *
 * 슬러그 정규화가 강화되면서 `실행·예약.bru` 와 `실행예약.bru` 처럼 서로 다른
 * 원본이 같은 docs 출력 경로로 수렴할 수 있다. markdown 뿐 아니라
 * asset/html/image 래퍼 마크다운도 중앙 충돌 등록을 거쳐야 한다.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';

import { createStats, processDirectory } from '../../scripts/prebuild/processors.js';
import { PATHS } from '../../config/constants.js';

const TMP = path.join(process.cwd(), 'test-tmp-collisions');
const TEST_SOURCE = path.join(TMP, 'source');
const TEST_DOCS = path.join(TMP, 'docs');
const TEST_DOWNLOADS = path.join(TMP, 'downloads');

const ORIGINAL_PATHS = { ...PATHS };

before(() => {
  PATHS.SOURCE = TEST_SOURCE;
  PATHS.DOCS = TEST_DOCS;
  PATHS.DOWNLOADS = TEST_DOWNLOADS;
});

after(() => {
  Object.assign(PATHS, ORIGINAL_PATHS);
  fs.removeSync(TMP);
});

beforeEach(() => {
  fs.emptyDirSync(TEST_SOURCE);
  fs.emptyDirSync(TEST_DOCS);
  fs.emptyDirSync(TEST_DOWNLOADS);
});

function run() {
  const stats = createStats();
  processDirectory(TEST_SOURCE, TEST_DOCS, TEST_DOWNLOADS, '', stats, null, {});
  return stats;
}

// 1x1 PNG
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('래퍼 마크다운 충돌 등록', () => {
  it('asset 래퍼가 같은 출력 경로로 수렴하면 한 번만 생성된다', () => {
    fs.writeFileSync(path.join(TEST_SOURCE, '실행·예약.bru'), 'first');
    fs.writeFileSync(path.join(TEST_SOURCE, '실행예약.bru'), 'second');

    const stats = run();

    const docs = fs.readdirSync(TEST_DOCS).filter(f => f.endsWith('.md'));
    assert.equal(docs.length, 1, `기대: 1개 md, 실제: ${docs.join(', ')}`);
    assert.equal(stats.collisions.length, 1);
    assert.equal(stats.byType.asset, 1);
  });

  it('충돌 기록에 두 원본 경로와 목적 경로가 포함된다', () => {
    fs.writeFileSync(path.join(TEST_SOURCE, '실행·예약.bru'), 'first');
    fs.writeFileSync(path.join(TEST_SOURCE, '실행예약.bru'), 'second');

    const stats = run();
    const collision = stats.collisions[0];

    assert.ok(collision.src, 'src 누락');
    assert.ok(collision.dest, 'dest 누락');
    assert.ok(collision.existingSrc, 'existingSrc(먼저 등록된 원본) 누락');
    assert.notEqual(collision.src, collision.existingSrc);
    assert.ok(collision.dest.endsWith('실행예약.md'));
  });

  it('image 래퍼도 충돌 시 건너뛴다', () => {
    fs.writeFileSync(path.join(TEST_SOURCE, '그림·1.png'), PNG_BYTES);
    fs.writeFileSync(path.join(TEST_SOURCE, '그림1.png'), PNG_BYTES);

    const stats = run();

    const docs = fs.readdirSync(TEST_DOCS).filter(f => f.endsWith('.md'));
    assert.equal(docs.length, 1, `기대: 1개 md, 실제: ${docs.join(', ')}`);
    assert.equal(stats.collisions.length, 1);
    assert.equal(stats.byType.image, 1);
  });

  it('html 래퍼도 충돌 시 건너뛴다', () => {
    fs.writeFileSync(path.join(TEST_SOURCE, '리포트·A.html'), '<html><body>a</body></html>');
    fs.writeFileSync(path.join(TEST_SOURCE, '리포트A.html'), '<html><body>b</body></html>');

    const stats = run();

    const docs = fs.readdirSync(TEST_DOCS).filter(f => f.endsWith('.md'));
    assert.equal(docs.length, 1, `기대: 1개 md, 실제: ${docs.join(', ')}`);
    assert.equal(stats.collisions.length, 1);
    assert.equal(stats.byType.html, 1);
  });

  it('충돌이 없으면 각각 생성된다 (기존 동작 유지)', () => {
    fs.writeFileSync(path.join(TEST_SOURCE, 'alpha.bru'), 'a');
    fs.writeFileSync(path.join(TEST_SOURCE, 'beta.bru'), 'b');

    const stats = run();

    const docs = fs.readdirSync(TEST_DOCS).filter(f => f.endsWith('.md')).sort();
    assert.deepEqual(docs, ['alpha.md', 'beta.md']);
    assert.equal(stats.collisions.length, 0);
  });
});

describe('슬러그 정규화 실패 처리', () => {
  it('문장부호만으로 이루어진 파일명은 prebuild를 실패시킨다', () => {
    fs.writeFileSync(path.join(TEST_SOURCE, '···.bru'), 'x');

    assert.throws(() => run(), (err) => {
      // 상위(processDirectory)에서 원본 상대 경로 컨텍스트가 붙어야 한다
      assert.match(err.message, /···/);
      return true;
    });
  });
});

describe('충돌 시 원본 다운로드 보존', () => {
  it('래퍼 마크다운이 충돌해도 downloads 복사는 유지된다', () => {
    fs.writeFileSync(path.join(TEST_SOURCE, '실행·예약.bru'), 'first');
    fs.writeFileSync(path.join(TEST_SOURCE, '실행예약.bru'), 'second');

    run();

    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, '실행·예약.bru')), '선점 파일 다운로드 누락');
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, '실행예약.bru')), '충돌로 건너뛴 파일의 다운로드까지 사라지면 안 됨');
  });

  it('image/html 충돌에서도 downloads 는 남는다', () => {
    fs.writeFileSync(path.join(TEST_SOURCE, '그림·1.png'), PNG_BYTES);
    fs.writeFileSync(path.join(TEST_SOURCE, '그림1.png'), PNG_BYTES);
    fs.writeFileSync(path.join(TEST_SOURCE, '리포트·A.html'), '<html></html>');
    fs.writeFileSync(path.join(TEST_SOURCE, '리포트A.html'), '<html></html>');

    run();

    for (const name of ['그림·1.png', '그림1.png', '리포트·A.html', '리포트A.html']) {
      assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, name)), `다운로드 누락: ${name}`);
    }
  });
});

describe('중첩 디렉토리 래퍼 경로', () => {
  it('이미지 래퍼도 정규화된 docs 디렉토리에 생성된다', () => {
    const dir = path.join(TEST_SOURCE, '온사이트·기능');
    fs.ensureDirSync(dir);
    fs.writeFileSync(path.join(dir, 'pic.png'), PNG_BYTES);

    run();

    assert.ok(fs.existsSync(path.join(TEST_DOCS, '온사이트기능', 'pic.md')), '정규화된 디렉토리에 없음');
    assert.equal(fs.existsSync(path.join(TEST_DOCS, '온사이트·기능')), false, '정규화되지 않은 디렉토리가 생성됨');
  });

  it('중첩 디렉토리의 asset/html 래퍼도 같은 디렉토리를 쓴다', () => {
    const dir = path.join(TEST_SOURCE, '온사이트·기능');
    fs.ensureDirSync(dir);
    fs.writeFileSync(path.join(dir, 'note.bru'), 'x');
    fs.writeFileSync(path.join(dir, 'page.html'), '<html></html>');

    run();

    const docsDir = path.join(TEST_DOCS, '온사이트기능');
    assert.deepEqual(fs.readdirSync(docsDir).sort(), ['note.md', 'page.md']);
  });
});
