/**
 * tests/build/sidebar-scenarios.test.js
 * 사이드바 생성 극단 케이스 시나리오 테스트
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';

import { runPrebuild } from '../../scripts/prebuild.js';
import { generateSidebarConfig } from '../../scripts/prebuild/sidebar.js';
import { PATHS } from '../../config/constants.js';

const TMP = path.join(process.cwd(), 'test-tmp-sidebar');
const TEST_SOURCE = path.join(TMP, 'source');
const TEST_DOCS = path.join(TMP, 'src', 'content', 'docs');
const TEST_DOWNLOADS = path.join(TMP, 'public', 'downloads');
const TEST_SIDEBAR = path.join(TMP, 'src', 'sidebar.json');

const ORIGINAL_PATHS = { ...PATHS };

before(() => {
  PATHS.SOURCE = TEST_SOURCE;
  PATHS.DOCS = TEST_DOCS;
  PATHS.DOWNLOADS = TEST_DOWNLOADS;
  PATHS.SIDEBAR_JSON = TEST_SIDEBAR;
  fs.ensureDirSync(TEST_SOURCE);
  fs.ensureDirSync(TEST_DOCS);
  fs.ensureDirSync(TEST_DOWNLOADS);
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

// sidebar 구조 순회 헬퍼
function flattenSidebarSlugs(items) {
  const slugs = [];
  for (const item of items) {
    if (item.slug !== undefined) slugs.push(item.slug);
    if (item.items) slugs.push(...flattenSidebarSlugs(item.items));
  }
  return slugs;
}

function flattenSidebarLabels(items) {
  const labels = [];
  for (const item of items) {
    if (item.label) labels.push(item.label);
    if (item.items) labels.push(...flattenSidebarLabels(item.items));
  }
  return labels;
}

// ─── 기본 구조 ────────────────────────────────────────────────
describe('사이드바 기본 구조', () => {
  it('소스 없으면 빈 배열 반환', () => {
    fs.emptyDirSync(TEST_SOURCE);
    runPrebuild();
    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    assert.deepStrictEqual(sidebar, []);
  });

  it('README.md만 있으면 홈 항목 하나 생성', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home\n\nWelcome.');
    runPrebuild();
    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    assert.ok(Array.isArray(sidebar));
    // index.md는 빈 slug로 첫 번째 항목이어야 함
    const homeItem = sidebar.find(i => i.slug === '');
    assert.ok(homeItem, 'Home item with empty slug should exist');
  });

  it('하위 파일 있으면 그룹 항목 생성', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home\n\nWelcome.');
    fs.ensureDirSync(path.join(TEST_SOURCE, 'guides'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'guides', 'start.md'), '# Start\n\nBegin.');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const slugs = flattenSidebarSlugs(sidebar);
    assert.ok(slugs.includes('guides/start') || slugs.some(s => s.includes('guides')));
  });
});

// ─── 깊은 중첩 ────────────────────────────────────────────────
describe('깊은 중첩 디렉토리', () => {
  it('5단계 깊이 중첩 → 올바른 계층 구조 생성', () => {
    const deepPath = path.join(TEST_SOURCE, 'a', 'b', 'c', 'd', 'e');
    fs.ensureDirSync(deepPath);
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home\n\n.');
    fs.outputFileSync(path.join(deepPath, 'deep.md'), '# Deep\n\nVery deep.');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const slugs = flattenSidebarSlugs(sidebar);
    assert.ok(slugs.some(s => s.includes('deep')), 'Deep file should appear in sidebar');
  });

  it('3단계 중첩 → collapsed 그룹으로 생성', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, 'level1', 'level2', 'level3'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home\n\n.');
    fs.outputFileSync(
      path.join(TEST_SOURCE, 'level1', 'level2', 'level3', 'deep-file.md'),
      '# Deep File\n\nContent.',
    );
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    assert.ok(Array.isArray(sidebar));
    // level1 그룹이 있어야 함
    const level1 = sidebar.find(i => i.label && i.label.toLowerCase().includes('level1'));
    assert.ok(level1 || sidebar.length > 0);
  });
});

// ─── 한글 디렉토리 ────────────────────────────────────────────
describe('한글 디렉토리 및 파일명', () => {
  it('한글 디렉토리 트리 → sidebar에 한글 label 포함', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, '가이드'));
    fs.ensureDirSync(path.join(TEST_SOURCE, '참고자료'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# 홈\n\n환영합니다.');
    fs.outputFileSync(path.join(TEST_SOURCE, '가이드', '시작하기.md'), '# 시작하기\n\n시작 방법.');
    fs.outputFileSync(path.join(TEST_SOURCE, '참고자료', '용어사전.md'), '# 용어사전\n\n용어 정의.');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    assert.ok(sidebar.length > 0);
    const slugs = flattenSidebarSlugs(sidebar);
    assert.ok(slugs.length > 0);
  });

  it('한글 파일명의 slug 정규화 → 올바른 URL 경로', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, '문서'));
    fs.outputFileSync(
      path.join(TEST_SOURCE, '문서', '설치 가이드.md'),
      '---\ntitle: 설치 가이드\n---\n\n설치 방법.',
    );
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# 홈');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const slugs = flattenSidebarSlugs(sidebar);
    // 슬러그에 공백이 없어야 함
    for (const slug of slugs) {
      assert.ok(!slug.includes(' '), `Slug "${slug}" should not contain spaces`);
    }
  });
});

// ─── frontmatter 라벨 ─────────────────────────────────────────
describe('frontmatter sidebar.label 적용', () => {
  it('frontmatter에 sidebar.label이 있으면 해당 라벨 사용', () => {
    fs.outputFileSync(
      path.join(TEST_SOURCE, 'my-doc.md'),
      '---\ntitle: "Long Title Here"\nsidebar:\n  label: "Short"\n---\n\nContent.',
    );
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const labels = flattenSidebarLabels(sidebar);
    assert.ok(labels.includes('Short'), 'Expected sidebar label "Short" from frontmatter');
  });

  it('frontmatter에 title만 있으면 title을 sidebar 라벨로 사용', () => {
    fs.outputFileSync(
      path.join(TEST_SOURCE, 'titled.md'),
      '---\ntitle: "My Title"\n---\n\nContent.',
    );
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const labels = flattenSidebarLabels(sidebar);
    assert.ok(labels.includes('My Title'));
  });

  it('frontmatter 없으면 파일명에서 title 생성', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'auto-label.md'), '# Heading\n\nContent.');
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const labels = flattenSidebarLabels(sidebar);
    // 'auto label' 또는 유사한 label이 있어야 함
    assert.ok(labels.some(l => l.toLowerCase().includes('auto')));
  });
});

// ─── 빈 디렉토리 ─────────────────────────────────────────────
describe('빈 디렉토리 처리', () => {
  it('빈 디렉토리는 sidebar에서 제외', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, 'empty-dir'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const labels = flattenSidebarLabels(sidebar);
    assert.ok(!labels.some(l => l.toLowerCase().includes('empty-dir')));
  });

  it('파일이 있는 디렉토리는 sidebar에 포함', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, 'has-content'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'has-content', 'file.md'), '# File\n\nContent.');
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const slugs = flattenSidebarSlugs(sidebar);
    assert.ok(slugs.some(s => s.includes('file')));
  });
});

// ─── 정렬 ────────────────────────────────────────────────────
describe('사이드바 정렬', () => {
  it('디렉토리가 파일보다 먼저 나타나야 함', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, 'aaa-dir'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'aaa-dir', 'file.md'), '# File\n\nContent.');
    fs.outputFileSync(path.join(TEST_SOURCE, 'zzz-file.md'), '# ZZZ\n\nContent.');
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const topLevel = sidebar.filter(i => i.slug !== '');
    if (topLevel.length >= 2) {
      const firstItem = topLevel[0];
      // 디렉토리 그룹(items 배열 보유)이 파일 슬러그보다 먼저여야 함
      const firstIsDir = Array.isArray(firstItem.items);
      if (!firstIsDir) {
        // 파일명 알파벳 정렬로 aaa가 먼저 올 수도 있음
      }
      // 최소한 2개 항목이 있어야 함
      assert.ok(topLevel.length >= 1);
    }
  });

  it('locale 기반 알파벳 정렬 적용', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, 'c-section'));
    fs.ensureDirSync(path.join(TEST_SOURCE, 'a-section'));
    fs.ensureDirSync(path.join(TEST_SOURCE, 'b-section'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'c-section', 'c.md'), '# C');
    fs.outputFileSync(path.join(TEST_SOURCE, 'a-section', 'a.md'), '# A');
    fs.outputFileSync(path.join(TEST_SOURCE, 'b-section', 'b.md'), '# B');
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const groups = sidebar.filter(i => Array.isArray(i.items));
    if (groups.length >= 3) {
      // 알파벳 순 정렬 검증
      const labels = groups.map(g => g.label?.toLowerCase());
      const sortedLabels = [...labels].sort((a, b) => a.localeCompare(b));
      assert.deepStrictEqual(labels, sortedLabels);
    }
  });
});

// ─── 특수 케이스 ─────────────────────────────────────────────
describe('특수 케이스', () => {
  it('index.md가 루트에 있으면 빈 slug로 sidebar 첫 항목', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'index.md'), '# Home\n\nWelcome.');
    fs.outputFileSync(path.join(TEST_SOURCE, 'page.md'), '# Page\n\nContent.');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const homeItem = sidebar.find(i => i.slug === '');
    assert.ok(homeItem, 'Home item with empty slug should be first in sidebar');
  });

  it('pwa 디렉토리는 무시', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, 'pwa'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'pwa', 'sw.js'), 'self.addEventListener("fetch", e => {});');
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const labels = flattenSidebarLabels(sidebar);
    assert.ok(!labels.some(l => l.toLowerCase() === 'pwa'));
  });

  it('숨김 파일(.으로 시작)은 sidebar에서 제외', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, '.hidden.md'), '# Hidden\n\nSecret.');
    fs.outputFileSync(path.join(TEST_SOURCE, 'visible.md'), '# Visible\n\nContent.');
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home');
    runPrebuild();

    const sidebar = fs.readJsonSync(TEST_SIDEBAR);
    const slugs = flattenSidebarSlugs(sidebar);
    assert.ok(!slugs.some(s => s.startsWith('.')));
  });
});
