import fs from 'fs-extra';
import path from 'path';
import { PATHS, IGNORE_FILES } from '../config/constants.js';
import { generateTitle, sanitizeDirName, SlugError } from './prebuild/utils.js';
import { processDirectory, createStats, collectSlugErrors } from './prebuild/processors.js';
import { generateSidebarConfig } from './prebuild/sidebar.js';
import { loadCache, saveCache, CACHE_SCHEMA_VERSION } from './prebuild/cache.js';
import { loadGitdocsConfig } from './prebuild/config.js';

export function runPrebuild() {
  console.log('[Prebuild] Starting content sync from source/ to src/content/docs/');

  // Check if source directory exists
  if (!fs.existsSync(PATHS.SOURCE)) {
    fs.ensureDirSync(PATHS.SOURCE);
    console.log('[Prebuild] source/ directory created (empty)');
  }

  // .gitdocs.json 로드 (없으면 빈 객체)
  const gitdocsConfig = loadGitdocsConfig(PATHS.SOURCE);

  // 슬러그 사전 검증 — docs/downloads 를 비우기 전에 수행해야 한다.
  // 순회 도중 실패하면 출력 디렉토리가 부분 상태로 남기 때문.
  const slugErrors = collectSlugErrors(PATHS.SOURCE, '', gitdocsConfig);
  if (slugErrors.length > 0) {
    const shown = slugErrors.slice(0, 20).map(e => `  - ${e.path}`).join('\n');
    const more = slugErrors.length > 20 ? `\n  ... 외 ${slugErrors.length - 20}개` : '';
    throw new SlugError(
      `[Prebuild] URL 슬러그를 만들 수 없는 이름 ${slugErrors.length}개 — 이름을 변경한 뒤 다시 빌드하세요.\n${shown}${more}\n` +
      `(영문/숫자/한글 등 URL 로 쓸 수 있는 문자가 하나도 없는 이름입니다)`
    );
  }

  // 마지막 빌드 소스 추적 — 소스가 바뀌면 src/content/docs 전체 초기화
  // (서로 다른 캐시 파일을 사용하는 샘플↔외부 전환도 감지)
  const LAST_SOURCE_FILE = path.resolve(PATHS.ROOT, 'data', 'last-source.json');
  let lastSource = null;
  try { lastSource = fs.readJsonSync(LAST_SOURCE_FILE).source; } catch { /* 없으면 무시 */ }
  const sourceSwitched = lastSource && lastSource !== PATHS.SOURCE;

  // 증분 빌드: 캐시 로드 (없으면 전체 처리)
  const cache = loadCache(PATHS.PREBUILD_CACHE);
  // 슬러그 정규화 규칙이 바뀌면(CACHE_SCHEMA_VERSION 상승) 캐시가 통째로 무효화된다.
  // mtime/size 는 그대로여도 목적 파일명이 달라지므로 전체 재처리가 필요하다.
  if (cache.versionMismatch) {
    console.log(`[Prebuild] 캐시 스키마 변경 감지 (v${cache.previousVersion ?? 'none'} → v${CACHE_SCHEMA_VERSION}) — 전체 재빌드 시작`);
  }
  // 소스 디렉토리가 바뀌면 캐시 무효화 → 전체 재빌드
  const sourceChanged = sourceSwitched || (cache.sourceDir && cache.sourceDir !== PATHS.SOURCE);
  if (sourceChanged) {
    console.log(`[Prebuild] 소스 경로 변경 감지 — 전체 재빌드 시작 (${lastSource || cache.sourceDir} → ${PATHS.SOURCE})`);
    cache.files = {};
  }
  const cacheCtx = { cache: cache.files, newEntries: {} };
  const isFirstRun = Object.keys(cache.files).length === 0;
  if (!isFirstRun) {
    console.log(`[Prebuild] 증분 빌드 모드 — 캐시 ${Object.keys(cache.files).length}개 항목 로드`);
  }

  // 첫 실행 시 또는 소스 변경 시 전체 초기화
  if (isFirstRun) {
    fs.emptyDirSync(PATHS.DOCS);
    fs.emptyDirSync(PATHS.DOWNLOADS);
  } else {
    fs.ensureDirSync(PATHS.DOCS);
    fs.ensureDirSync(PATHS.DOWNLOADS);
  }

  const entries = fs.readdirSync(PATHS.SOURCE).filter(e => !IGNORE_FILES.includes(e));
  console.log(`[Prebuild] source/ has ${entries.length} entries: ${entries.slice(0, 10).join(', ')}${entries.length > 10 ? '...' : ''}`);
  if (entries.length === 0) {
    const welcomeContent = `---
title: "Welcome"
---

# Welcome
`;
    fs.outputFileSync(path.join(PATHS.DOCS, 'index.md'), welcomeContent, 'utf-8');
    fs.writeJsonSync(PATHS.SIDEBAR_JSON, [], { spaces: 2 });
    console.log('[Prebuild] Created default welcome page');
    console.log('[Prebuild] WARNING: source/ is empty — dist will not be updated to preserve existing content');
    return false;
  }

  const stats = createStats();
  processDirectory(PATHS.SOURCE, PATHS.DOCS, PATHS.DOWNLOADS, '', stats, cacheCtx, gitdocsConfig);

  // 삭제된 소스 파일에 대응하는 dest 파일 제거
  // 단, 이번 실행에서 살아있는 소스가 소유한 산출물은 지우지 않는다.
  // (슬러그 충돌로 두 소스가 같은 출력 경로를 거쳐간 경우 남은 문서가 사라지는 것을 방지)
  const survivingDestFiles = new Set();
  for (const entry of Object.values(cacheCtx.newEntries)) {
    for (const destFile of entry.destFiles || []) survivingDestFiles.add(destFile);
  }
  let deletedCount = 0;
  for (const [relPath, entry] of Object.entries(cache.files)) {
    if (!cacheCtx.newEntries[relPath]) {
      for (const destFile of entry.destFiles || []) {
        if (survivingDestFiles.has(destFile)) continue;
        try {
          fs.removeSync(destFile);
        } catch { /* ignore */ }
      }
      deletedCount++;
    }
  }

  // 캐시 저장 (소스 경로 포함)
  saveCache(PATHS.PREBUILD_CACHE, cacheCtx.newEntries, PATHS.SOURCE);

  // 마지막 빌드 소스 경로 기록
  try { fs.outputJsonSync(LAST_SOURCE_FILE, { source: PATHS.SOURCE }); } catch { /* ignore */ }

  // Ensure at least an index page exists
  const indexPath = path.join(PATHS.DOCS, 'index.md');
  if (!fs.existsSync(indexPath)) {
    // Try to use README.md (sanitized as readme.md by processMarkdownFile)
    const readmeDest = path.join(PATHS.DOCS, 'readme.md');
    if (fs.existsSync(readmeDest)) {
      fs.copySync(readmeDest, indexPath);
      fs.removeSync(readmeDest);
    } else {
      // Auto-generate index with list of top-level folders/files
      const srcEntries = fs.readdirSync(PATHS.SOURCE, { withFileTypes: true });
      // `.`/`_` 프리픽스 디렉토리는 라우트가 생성되지 않으므로 자동 index 링크에서 제외
      // (sidebar/processors의 라우트 제외 규칙과 일관성 유지)
      const folders = srcEntries.filter(e =>
        e.isDirectory() &&
        !IGNORE_FILES.includes(e.name) &&
        !e.name.startsWith('.') &&
        !e.name.startsWith('_'));
      let listItems = '';
      for (const folder of folders) {
        const label = generateTitle(folder.name);
        // 실제 라우트는 sanitizeDirName() 규칙으로 만들어지므로 링크도 같은 규칙을 써야 한다
        // (folder.name.toLowerCase() 만 쓰면 공백/특수문자 폴더에서 404)
        const slug = sanitizeDirName(folder.name).toLowerCase();
        listItems += `- [${label}](/${slug}/)\n`;
      }

      const content = `---
title: "Home"
sidebar:
  label: "Home"
---

${listItems ? '## Contents\n\n' + listItems : 'Navigate using the sidebar.'}
`;
      fs.outputFileSync(indexPath, content, 'utf-8');
      console.log('[Prebuild] Auto-generated index page');
    }
  }

  generateSidebarConfig(gitdocsConfig);

  // 처리 결과 요약 로그
  const { byType, largeFiles, longPaths, errors, collisions } = stats;
  console.log(`[Prebuild] 처리 완료 — 처리:${stats.processed} 스킵:${stats.skipped} 삭제:${deletedCount} (md:${byType.markdown} html:${byType.html} img:${byType.image} asset:${byType.asset} txt-noext:${byType.textNoExt} static:${byType.static})`);

  if (collisions.length > 0) {
    console.warn(`[Prebuild] 경로 충돌 ${collisions.length}개 (동일 출력 경로로 인해 건너뜀):`);
    collisions.forEach(c => console.warn(`[Prebuild]   - ${c.src} → ${c.dest}`));
  }

  if (largeFiles.length > 0) {
    console.warn(`[Prebuild] 대용량 파일 ${largeFiles.length}개 (빌드 속도에 영향 가능):`);
    largeFiles.forEach(f => console.warn(`[Prebuild]   - ${f.file} (${(f.size / 1024 / 1024).toFixed(1)}MB)`));
  }

  if (longPaths.length > 0) {
    console.warn(`[Prebuild] 경로가 긴 파일 ${longPaths.length}개:`);
    longPaths.forEach(f => console.warn(`[Prebuild]   - ${f} (${f.length}자)`));
  }

  if (errors.length > 0) {
    console.error(`[Prebuild] 오류 ${errors.length}개:`);
    errors.forEach(e => console.error(`[Prebuild]   - ${e.file} → ${e.message}`));
  }

  return true;
}

// Run directly if called as script
if (process.argv[1] && process.argv[1].endsWith('prebuild.js')) {
  runPrebuild();
}
