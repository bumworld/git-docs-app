/**
 * build dist 교체 회귀 테스트 (실제 파일시스템)
 *
 * 회귀 대상: dist 가 Docker 볼륨 마운트 포인트일 때 `fs.moveSync(dist → dist-old)` 가
 * `EBUSY: ... rename` 으로 실패하던 버그. 수정 후에는 dist 디렉토리 자체를 rename 하지 않고
 * inode 를 보존한 채 "내용"만 교체해야 한다.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { moveDirContents } from '../../scripts/build.js';

let root;
let dist;
let distTemp;
let distOld;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-swap-'));
  dist = path.join(root, 'dist');
  distTemp = path.join(root, 'dist-temp');
  distOld = path.join(root, 'dist-old');
});

afterEach(() => {
  fs.removeSync(root);
});

// build.js 의 동기화 블록과 동일한 순서로 dist 내용을 교체한다.
function syncDist() {
  if (fs.existsSync(dist) && fs.readdirSync(dist).length > 0) {
    fs.emptyDirSync(distOld);
    moveDirContents(dist, distOld);
  }
  fs.emptyDirSync(dist);
  moveDirContents(distTemp, dist);
  fs.removeSync(distTemp);
}

describe('build dist 교체 - inode 보존 (마운트 포인트 안전)', () => {
  test('기존 dist 가 있어도 dist 디렉토리는 rename 되지 않고 inode 가 유지된다', () => {
    fs.outputFileSync(path.join(dist, 'old.html'), 'OLD');
    fs.outputFileSync(path.join(distTemp, 'new.html'), 'NEW');
    const inodeBefore = fs.statSync(dist).ino;

    syncDist();

    assert.equal(fs.statSync(dist).ino, inodeBefore, 'dist inode 가 바뀌면 디렉토리가 rename 된 것 (회귀)');
    assert.equal(fs.readFileSync(path.join(dist, 'new.html'), 'utf-8'), 'NEW');
    assert.equal(fs.existsSync(path.join(dist, 'old.html')), false, '이전 내용은 dist 에서 제거되어야 함');
    assert.equal(fs.readFileSync(path.join(distOld, 'old.html'), 'utf-8'), 'OLD', '롤백용 백업 보존');
    assert.equal(fs.existsSync(distTemp), false, 'dist-temp 는 정리되어야 함');
  });

  test('기존 dist 가 비어있어도 dist-temp 내용으로 채워진다', () => {
    fs.ensureDirSync(dist); // 빈 디렉토리 (첫 빌드 후 마운트만 존재)
    fs.outputFileSync(path.join(distTemp, 'a.html'), 'A');
    fs.outputFileSync(path.join(distTemp, 'sub', 'b.html'), 'B');
    const inodeBefore = fs.statSync(dist).ino;

    syncDist();

    assert.equal(fs.statSync(dist).ino, inodeBefore);
    assert.equal(fs.readFileSync(path.join(dist, 'a.html'), 'utf-8'), 'A');
    assert.equal(fs.readFileSync(path.join(dist, 'sub', 'b.html'), 'utf-8'), 'B');
  });
});

describe('moveDirContents', () => {
  test('모든 자식 엔트리를 옮기고 소스를 비운다', () => {
    fs.outputFileSync(path.join(distTemp, 'x.txt'), 'x');
    fs.outputFileSync(path.join(distTemp, 'dir', 'y.txt'), 'y');

    moveDirContents(distTemp, dist);

    assert.equal(fs.readFileSync(path.join(dist, 'x.txt'), 'utf-8'), 'x');
    assert.equal(fs.readFileSync(path.join(dist, 'dir', 'y.txt'), 'utf-8'), 'y');
    assert.equal(fs.readdirSync(distTemp).length, 0, '소스 디렉토리는 비워져야 함');
  });

  test('대상에 같은 이름이 있으면 덮어쓴다', () => {
    fs.outputFileSync(path.join(dist, 'dup.txt'), 'OLD');
    fs.outputFileSync(path.join(distTemp, 'dup.txt'), 'NEW');

    moveDirContents(distTemp, dist);

    assert.equal(fs.readFileSync(path.join(dist, 'dup.txt'), 'utf-8'), 'NEW');
  });
});
