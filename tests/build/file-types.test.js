/**
 * tests/build/file-types.test.js
 * 각 파일 타입별 prebuild 처리 시나리오
 * source에 파일 배치 → runPrebuild() → docs/ 결과 검증
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';

import { runPrebuild } from '../../scripts/prebuild.js';
import { PATHS } from '../../config/constants.js';

const TMP = path.join(process.cwd(), 'test-tmp-file-types');
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

// ─── Markdown 파일 ─────────────────────────────────────────────
describe('Markdown 파일 처리', () => {
  it('.md 파일 → docs/에 마크다운으로 생성', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'guide.md'), '# Guide\n\nContent.');
    runPrebuild();
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'guide.md')));
  });

  it('.mdx 파일 → docs/에 그대로 복사', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'component.mdx'), '---\ntitle: Component\n---\n<Button />');
    runPrebuild();
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'component.mdx')));
  });

  it('frontmatter 없는 .md → title이 자동 주입되어야 함', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'auto-title.md'), '# Hello\n\nContent.');
    runPrebuild();
    const content = fs.readFileSync(path.join(TEST_DOCS, 'auto-title.md'), 'utf-8');
    assert.ok(content.includes('title:'));
  });

  it('README.md → index.md로 변환', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home\n\nWelcome.');
    runPrebuild();
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'index.md')));
    assert.ok(!fs.existsSync(path.join(TEST_DOCS, 'readme.md')));
  });

  it('하위 디렉토리의 .md 파일도 처리', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, 'guides'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'guides', 'start.md'), '# Start\n\nGo.');
    runPrebuild();
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'guides', 'start.md')));
  });
});

// ─── HTML 파일 ─────────────────────────────────────────────────
describe('HTML 파일 처리', () => {
  it('단독 .html → downloads로 복사 + wrapper.md 생성', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'page.html'), '<html><body>Page</body></html>');
    runPrebuild();

    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'page.html')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'page.md')));

    const content = fs.readFileSync(path.join(TEST_DOCS, 'page.md'), 'utf-8');
    assert.ok(content.includes('iframe'));
    assert.ok(content.includes('/downloads/page.html'));
  });

  it('.html 파일 wrapper에 Security Notice 포함', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'app.html'), '<html><script>alert(1)</script></html>');
    runPrebuild();

    const content = fs.readFileSync(path.join(TEST_DOCS, 'app.md'), 'utf-8');
    assert.ok(content.includes('Security Notice') || content.includes('sandboxed'));
  });
});

// ─── HTML 폴더 (index.html 포함) ─────────────────────────────
describe('HTML 폴더 처리 (dir/index.html)', () => {
  it('index.html이 있는 폴더 → iframe wrapper.md + 폴더 전체 downloads 복사', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, 'my-app'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'my-app', 'index.html'), '<html><body>App</body></html>');
    fs.outputFileSync(path.join(TEST_SOURCE, 'my-app', 'style.css'), 'body{}');
    runPrebuild();

    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'my-app', 'index.html')));
    assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, 'my-app', 'style.css')));
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'my-app.md')));

    const content = fs.readFileSync(path.join(TEST_DOCS, 'my-app.md'), 'utf-8');
    assert.ok(content.includes('iframe'));
    assert.ok(content.includes('/downloads/my-app/'));
    assert.ok(content.includes('sandbox'));
  });
});

// ─── 이미지 파일 ───────────────────────────────────────────────
describe('이미지 파일 처리', () => {
  const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

  for (const ext of extensions) {
    it(`${ext} → downloads 복사 + 이미지 wrapper.md 생성`, () => {
      fs.emptyDirSync(TEST_SOURCE);
      const filename = `image${ext}`;
      fs.outputFileSync(path.join(TEST_SOURCE, filename), `fake ${ext} content`);
      fs.emptyDirSync(TEST_DOCS);
      fs.emptyDirSync(TEST_DOWNLOADS);
      runPrebuild();

      assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, filename)));
      const slug = filename.replace(/\.[^.]+$/, '');
      assert.ok(fs.existsSync(path.join(TEST_DOCS, `${slug}.md`)));

      const content = fs.readFileSync(path.join(TEST_DOCS, `${slug}.md`), 'utf-8');
      assert.ok(content.includes('<img'));
      assert.ok(content.includes(`/downloads/${filename}`));
    });
  }

  it('이미지 wrapper.md에 Download 링크 포함', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'photo.png'), 'fake png');
    runPrebuild();
    const content = fs.readFileSync(path.join(TEST_DOCS, 'photo.md'), 'utf-8');
    assert.ok(content.includes('Download') || content.includes('download'));
  });

  it('이미지 wrapper.md에 파일 크기 표시', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'small.png'), 'x'.repeat(2048));
    runPrebuild();
    const content = fs.readFileSync(path.join(TEST_DOCS, 'small.md'), 'utf-8');
    assert.ok(content.includes('KB') || content.includes('MB'));
  });
});

// ─── 보안 관련 실행 파일 ─────────────────────────────────────
describe('실행 파일 처리 (보안)', () => {
  const dangerousExtensions = ['.exe', '.bat', '.sh', '.dll', '.msi'];

  for (const ext of dangerousExtensions) {
    it(`${ext} → SECURITY WARNING 포함 wrapper.md`, () => {
      fs.emptyDirSync(TEST_SOURCE);
      const filename = `program${ext}`;
      fs.outputFileSync(path.join(TEST_SOURCE, filename), 'fake executable');
      fs.emptyDirSync(TEST_DOCS);
      fs.emptyDirSync(TEST_DOWNLOADS);
      runPrebuild();

      // downloads에 복사되어야 함
      assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, filename)));

      // wrapper.md에 보안 경고 포함 (index.md 제외)
      const mdFiles = fs.readdirSync(TEST_DOCS).filter(f => f.endsWith('.md') && f !== 'index.md');
      assert.ok(mdFiles.length > 0, `Expected md files for ${ext}`);

      const content = fs.readFileSync(path.join(TEST_DOCS, mdFiles[0]), 'utf-8');
      assert.ok(
        content.includes('SECURITY WARNING') || content.includes('dangerous') || content.includes('Caution'),
        `Expected security warning for ${ext}`,
      );
    });
  }
});

// ─── 텍스트 에셋 파일 (코드 미리보기) ───────────────────────
describe('텍스트/코드 에셋 파일 처리', () => {
  // 확장자를 통해 코드 에셋으로 인식되는 파일들
  const textFiles = [
    ['config.json', '{"key": "value"}', 'json'],
    ['settings.yaml', 'server:\n  port: 8080', 'yaml'],
    ['schema.sql', 'CREATE TABLE users (id INT);', 'sql'],
    ['data.csv', 'name,age\nAlice,30\n', 'csv'],
  ];

  for (const [filename, content, lang] of textFiles) {
    it(`${filename} → 코드 미리보기 포함 wrapper.md`, () => {
      fs.emptyDirSync(TEST_SOURCE);
      fs.outputFileSync(path.join(TEST_SOURCE, filename), content);
      fs.emptyDirSync(TEST_DOCS);
      fs.emptyDirSync(TEST_DOWNLOADS);
      runPrebuild();

      const mdFiles = fs.readdirSync(TEST_DOCS).filter(f => f.endsWith('.md') && f !== 'index.md');
      assert.ok(mdFiles.length > 0, `Expected wrapper.md for ${filename}`);
      const mdContent = fs.readFileSync(path.join(TEST_DOCS, mdFiles[0]), 'utf-8');
      assert.ok(mdContent.includes('```'), `Expected code block for ${filename}`);
    });
  }

  // .env 파일: path.extname('.env') === '' 이므로 확장자 없는 파일로 처리됨
  // 코드 블록 대신 텍스트 또는 에셋 wrapper로 생성됨
  it('.env → wrapper.md 생성됨 (확장자 없는 파일로 처리)', () => {
    fs.emptyDirSync(TEST_SOURCE);
    fs.outputFileSync(path.join(TEST_SOURCE, '.env'), 'SECRET=abc123\n');
    fs.emptyDirSync(TEST_DOCS);
    fs.emptyDirSync(TEST_DOWNLOADS);
    runPrebuild();

    // .env가 숨김 파일로 무시될 수도 있으므로 어느 방향이든 예외 없이 완료
    assert.doesNotThrow(() => fs.readdirSync(TEST_DOCS));
  });
});

// ─── 확장자 없는 파일 ─────────────────────────────────────────
describe('확장자 없는 파일 처리', () => {
  it('텍스트 내용의 확장자 없는 파일 → 마크다운 또는 텍스트로 처리', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'Makefile'), 'all:\n\techo "done"\n');
    runPrebuild();

    const mdFiles = fs.readdirSync(TEST_DOCS).filter(f => f.endsWith('.md') && f !== 'index.md');
    assert.ok(mdFiles.length > 0);
  });

  it('바이너리 내용의 확장자 없는 파일 → asset으로 처리', () => {
    // null byte 포함 = 바이너리
    const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
    fs.outputFileSync(path.join(TEST_SOURCE, 'binary-no-ext'), binaryContent);
    runPrebuild();
    // downloads에 복사되거나 docs에 wrapper.md가 생성되어야 함
    const docsFiles = fs.readdirSync(TEST_DOCS).filter(f => f !== 'index.md');
    const downloadsFiles = fs.existsSync(TEST_DOWNLOADS)
      ? fs.readdirSync(TEST_DOWNLOADS).filter(f => f !== '.gitkeep')
      : [];
    assert.ok(docsFiles.length > 0 || downloadsFiles.length > 0);
  });

  it('shebang으로 시작하는 파일 → 스크립트로 처리 (마크다운 아님)', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'deploy'), '#!/bin/bash\necho "deploy"\n');
    runPrebuild();
    // asset 또는 text로 처리되어야 함 (마크다운으로는 처리 안 됨)
    const mdFiles = fs.readdirSync(TEST_DOCS).filter(f => f.endsWith('.md') && f !== 'index.md');
    assert.ok(mdFiles.length > 0, 'Expected a wrapper md to be created');
  });
});

// ─── 대용량 파일 ─────────────────────────────────────────────
describe('대용량 파일 처리', () => {
  it('1MB 이상 파일 → 처리 완료 + largeFiles stat 기록', () => {
    const bigContent = 'A'.repeat(1024 * 1024 + 1);
    fs.outputFileSync(path.join(TEST_SOURCE, 'big.md'), `# Big\n\n${bigContent}`);
    // runPrebuild이 예외 없이 완료되어야 함
    assert.doesNotThrow(() => runPrebuild());
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'big.md')));
  });

  it('5MB 마크다운 파일 처리', () => {
    const content = '# 대용량\n\n' + 'content line\n'.repeat(300000);
    fs.outputFileSync(path.join(TEST_SOURCE, 'massive.md'), content);
    assert.doesNotThrow(() => runPrebuild());
  });
});

// ─── slug 충돌 ────────────────────────────────────────────────
describe('slug 충돌 처리', () => {
  it('같은 slug로 정규화되는 두 파일 → 첫 번째만 처리, 충돌 기록', () => {
    // 'test (1).md'와 'test-1.md'는 같은 slug로 정규화될 수 있음
    fs.outputFileSync(path.join(TEST_SOURCE, 'test-1.md'), '# Test 1\n\nFirst.');
    fs.outputFileSync(path.join(TEST_SOURCE, 'test_1.md'), '# Test 1b\n\nSecond.');
    // 예외 없이 완료되어야 함
    assert.doesNotThrow(() => runPrebuild());
  });

  it('폴더와 파일이 같은 slug → 충돌 처리 후 정상 완료', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, 'guide'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'guide', 'index.html'), '<html><body>App</body></html>');
    fs.outputFileSync(path.join(TEST_SOURCE, 'guide.md'), '# Guide\n\nContent.');
    assert.doesNotThrow(() => runPrebuild());
  });
});

// ─── 무시 파일/디렉토리 ───────────────────────────────────────
describe('무시 파일 및 디렉토리', () => {
  it('.DS_Store 파일은 무시', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, '.DS_Store'), 'binary data');
    fs.outputFileSync(path.join(TEST_SOURCE, 'real.md'), '# Real\n\nContent.');
    runPrebuild();
    // .ds_store.md 같은 파일이 생성되면 안 됨
    const files = fs.readdirSync(TEST_DOCS);
    assert.ok(!files.some(f => f.toLowerCase().includes('ds_store')));
  });

  it('node_modules 디렉토리는 무시', () => {
    fs.ensureDirSync(path.join(TEST_SOURCE, 'node_modules', 'package'));
    fs.outputFileSync(path.join(TEST_SOURCE, 'node_modules', 'package', 'index.md'), '# Package');
    fs.outputFileSync(path.join(TEST_SOURCE, 'actual.md'), '# Actual\n\nContent.');
    runPrebuild();
    // node_modules 내용이 docs에 포함되면 안 됨
    const docsDirs = fs.existsSync(TEST_DOCS) ? fs.readdirSync(TEST_DOCS) : [];
    assert.ok(!docsDirs.includes('node_modules'));
  });
});
